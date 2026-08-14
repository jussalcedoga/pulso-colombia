import { cellToLatLng } from "h3-js";
import {
  clearSessionCookie,
  createRecoveryIdentity,
  createSession,
  deleteSession,
  enforceRateLimit,
  generateId,
  getSessionUser,
  hashRecoveryCode,
  normalizeRecoveryCode,
  requireUser
} from "./auth";
import { getHazards } from "./hazards";
import { geocode } from "./geocode";
import {
  apiError,
  applySecurityHeaders,
  assertSameOrigin,
  HttpError,
  json,
  readJson,
  routeId
} from "./http";
import { localizedError } from "./i18n";
import { enforceEdgeRateLimits, verifyTurnstile } from "./security";
import {
  MAX_ACTIVE_OFFERS_PER_REPORT,
  MAX_CHAT_MESSAGES_PER_OFFER,
  MAX_COMMENTS_PER_REPORT,
  MAX_REPORTS_PER_USER_PER_DAY,
  runRetentionCleanup
} from "./storage";
import type { Env } from "./types";
import {
  approximateLocation,
  CITY_IDS,
  enumArray,
  enumValue,
  integerValue,
  NEED_TYPES,
  OFFER_TYPES,
  optionalString,
  rejectPublicContactInfo,
  requiredString,
  targetCityAnchor
} from "./validation";

interface RegisterBody {
  displayName?: unknown;
  city?: unknown;
  accountType?: unknown;
  turnstileToken?: unknown;
}

interface LoginBody {
  recoveryCode?: unknown;
}

interface ReportBody {
  postType?: unknown;
  locationMode?: unknown;
  city?: unknown;
  neighborhood?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  needTypes?: unknown;
  urgency?: unknown;
  peopleCount?: unknown;
  details?: unknown;
  turnstileToken?: unknown;
}

interface OfferBody {
  offerType?: unknown;
  message?: unknown;
}

interface ChatMessageBody {
  message?: unknown;
}

interface ReportCommentBody {
  message?: unknown;
}

function validatedReport(body: ReportBody) {
  const postType = enumValue(
    body.postType ?? "need",
    ["need", "offer", "update"] as const,
    "El tipo de publicación"
  );
  const locationMode =
    postType === "offer"
      ? enumValue(
          body.locationMode ?? "local",
          ["local", "remote"] as const,
          "La modalidad de ayuda"
        )
      : "local";
  const city = enumValue(body.city, CITY_IDS, "La ciudad");
  const neighborhood =
    locationMode === "remote" ? "" : optionalString(body.neighborhood, 60);
  const needTypes = enumArray(body.needTypes, NEED_TYPES, "Las necesidades", NEED_TYPES.length);
  const submittedUrgency = integerValue(body.urgency, "La urgencia", 1, 5);
  const submittedPeopleCount = integerValue(
    body.peopleCount,
    "El número de personas",
    1,
    10_000
  );
  const urgency = postType === "need" ? submittedUrgency : 1;
  const peopleCount = postType === "update" ? 1 : submittedPeopleCount;
  const details = requiredString(
    body.details,
    "La descripción",
    10,
    postType === "update" ? 420 : 700
  );
  rejectPublicContactInfo(`${neighborhood} ${details}`);
  const location =
    locationMode === "remote"
      ? targetCityAnchor(city)
      : approximateLocation(body.latitude, body.longitude, city);

  return {
    postType,
    locationMode,
    city,
    neighborhood,
    needTypes,
    urgency,
    peopleCount,
    details,
    location
  };
}

function userPayload(user: Awaited<ReturnType<typeof getSessionUser>>) {
  return user ? { user } : { user: null };
}

async function requireModerator(env: Env, request: Request) {
  const user = await requireUser(env, request);
  if (user.role !== "moderator") {
    throw new HttpError(
      403,
      "moderator_required",
      "Solo la persona moderadora de Pulso puede administrar publicaciones."
    );
  }
  return user;
}

async function register(env: Env, request: Request): Promise<Response> {
  const body = await readJson<RegisterBody>(request);
  await verifyTurnstile(env, request, body.turnstileToken, "register");
  await enforceRateLimit(env, request, "register", 5, 60 * 60);
  const displayName = requiredString(body.displayName, "El nombre", 2, 60);
  const city = enumValue(body.city, CITY_IDS, "La ciudad");
  const accountType = enumValue(
    body.accountType ?? "resident",
    ["resident", "volunteer", "sponsor"] as const,
    "El tipo de cuenta"
  );
  const identity = await createRecoveryIdentity();
  const userId = generateId("usr");

  await env.DB.prepare(
    `INSERT INTO users (id, display_name, city, recovery_hash, account_type)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(userId, displayName, city, identity.hash, accountType)
    .run();
  const session = await createSession(env, request, userId);
  return json(
    {
      user: {
        id: userId,
        displayName,
        city,
        accountType,
        role: "resident",
        verified: false
      },
      recoveryCode: identity.formatted
    },
    { status: 201, headers: { "set-cookie": session.cookie, "cache-control": "no-store" } }
  );
}

async function login(env: Env, request: Request): Promise<Response> {
  await enforceRateLimit(env, request, "login", 12, 15 * 60);
  const body = await readJson<LoginBody>(request);
  const rawCode = requiredString(body.recoveryCode, "El código", 20, 80);
  const secret = normalizeRecoveryCode(rawCode);
  const recoveryHash = await hashRecoveryCode(secret);
  const row = await env.DB.prepare(
    `SELECT id, display_name, city, account_type, role, verified
       FROM users WHERE recovery_hash = ?`
  )
    .bind(recoveryHash)
    .first<{
      id: string;
      display_name: string;
      city: string;
      account_type: "resident" | "volunteer" | "sponsor";
      role: string;
      verified: number;
    }>();
  if (!row) {
    throw new HttpError(401, "invalid_credentials", "El código de acceso no coincide.");
  }
  const session = await createSession(env, request, row.id);
  return json(
    {
      user: {
        id: row.id,
        displayName: row.display_name,
        city: row.city,
        accountType: row.account_type,
        role: row.role,
        verified: row.verified === 1
      }
    },
    { headers: { "set-cookie": session.cookie, "cache-control": "no-store" } }
  );
}

async function listReports(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cityParam = url.searchParams.get("city");
  const city = cityParam && CITY_IDS.includes(cityParam as (typeof CITY_IDS)[number]) ? cityParam : null;
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 200);
  const useCache = limit === 100;
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(
    `https://pulso.internal/api/reports${city ? `?city=${encodeURIComponent(city)}` : ""}`
  );
  if (useCache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }
  const query = `
    SELECT r.id, r.user_id, r.post_type, r.location_mode, r.city, r.neighborhood,
           r.h3_cell, r.latitude, r.longitude,
           r.need_types, r.urgency, r.people_count, r.details, r.status,
           r.confirmations, r.created_at, r.updated_at,
           u.display_name, u.account_type, u.role, u.verified
      FROM reports r
      JOIN users u ON u.id = r.user_id
     WHERE r.status != 'resolved'
       ${city ? "AND r.city = ?" : ""}
     ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'matched' THEN 1 ELSE 2 END,
              CASE r.post_type WHEN 'need' THEN r.urgency ELSE 0 END DESC,
              r.created_at DESC
     LIMIT ?`;
  const statement = env.DB.prepare(query);
  const result = city
    ? await statement.bind(city, limit).all<Record<string, unknown>>()
    : await statement.bind(limit).all<Record<string, unknown>>();
  const reports = result.results.map((row) => ({
    id: row.id,
    userId: row.user_id,
    postType: row.post_type,
    locationMode: row.location_mode,
    city: row.city,
    neighborhood: row.neighborhood,
    h3Cell: row.h3_cell,
    latitude: row.latitude,
    longitude: row.longitude,
    needTypes: JSON.parse(String(row.need_types)) as string[],
    urgency: row.urgency,
    peopleCount: row.people_count,
    details: row.details,
    status: row.status,
    confirmations: row.confirmations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      displayName: row.display_name,
      accountType: row.account_type,
      role: row.role,
      verified: row.verified === 1
    }
  }));
  const response = json(
    { reports },
    { headers: { "cache-control": "public, max-age=5, s-maxage=15" } }
  );
  if (useCache) await cache.put(cacheKey, response.clone());
  return response;
}

async function invalidateReportCache(): Promise<void> {
  const cache = (caches as unknown as { default: Cache }).default;
  await Promise.all(
    [null, ...CITY_IDS].map((city) =>
      cache.delete(
        new Request(
          `https://pulso.internal/api/reports${city ? `?city=${encodeURIComponent(city)}` : ""}`
        )
      )
    )
  );
}

async function createReport(env: Env, request: Request): Promise<Response> {
  const user = await requireUser(env, request);
  const body = await readJson<ReportBody>(request);
  await verifyTurnstile(env, request, body.turnstileToken, "report");
  await enforceRateLimit(env, request, `report:${user.id}`, 8, 60 * 60);
  const report = validatedReport(body);

  const reportCounts = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status != 'resolved' THEN 1 ELSE 0 END) AS open_count,
       SUM(CASE WHEN created_at >= datetime('now', '-24 hours') THEN 1 ELSE 0 END)
         AS recent_count
     FROM reports
     WHERE user_id = ?`
  )
    .bind(user.id)
    .first<{ open_count: number | null; recent_count: number | null }>();
  if ((reportCounts?.open_count ?? 0) >= 5) {
    throw new HttpError(
      409,
      "too_many_open_reports",
      "Actualiza o resuelve uno de tus reportes antes de crear otro."
    );
  }
  if ((reportCounts?.recent_count ?? 0) >= MAX_REPORTS_PER_USER_PER_DAY) {
    throw new HttpError(
      429,
      "daily_report_limit",
      "Alcanzaste el límite diario de publicaciones. Intenta de nuevo mañana."
    );
  }

  const reportId = generateId("rpt");
  await env.DB.prepare(
    `INSERT INTO reports
      (id, user_id, post_type, location_mode, city, neighborhood, h3_cell, latitude,
       longitude, need_types, urgency, people_count, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      reportId,
      user.id,
      report.postType,
      report.locationMode,
      report.city,
      report.neighborhood,
      report.location.h3Cell,
      report.location.latitude,
      report.location.longitude,
      JSON.stringify(report.needTypes),
      report.urgency,
      report.peopleCount,
      report.details
    )
    .run();
  await invalidateReportCache();
  return json({ id: reportId }, { status: 201, headers: { "cache-control": "no-store" } });
}

async function updateReport(
  env: Env,
  request: Request,
  reportId: string
): Promise<Response> {
  await requireModerator(env, request);
  const body = await readJson<{ status?: unknown }>(request);
  const status = enumValue(body.status, ["open", "resolved"] as const, "El estado");
  const result = await env.DB.prepare(
    "UPDATE reports SET status = ?, updated_at = datetime('now') WHERE id = ?"
  )
    .bind(status, reportId)
    .run();
  if (!result.meta.changes) {
    throw new HttpError(404, "report_not_found", "No se encontró el reporte.");
  }
  await invalidateReportCache();
  return json({ ok: true });
}

async function updateReportContent(
  env: Env,
  request: Request,
  reportId: string
): Promise<Response> {
  const user = await requireUser(env, request);
  const body = await readJson<ReportBody>(request);
  await verifyTurnstile(env, request, body.turnstileToken, "report");
  await enforceRateLimit(env, request, `report-edit:${user.id}`, 20, 60 * 60);

  const existing = await env.DB.prepare(
    "SELECT user_id, post_type, status FROM reports WHERE id = ?"
  )
    .bind(reportId)
    .first<{ user_id: string; post_type: string; status: string }>();
  if (!existing) {
    throw new HttpError(404, "report_not_found", "No se encontró el reporte.");
  }
  if (existing.user_id !== user.id) {
    throw new HttpError(
      403,
      "report_author_required",
      "Solo quien publicó esta entrada puede editarla."
    );
  }
  if (existing.status === "resolved") {
    throw new HttpError(409, "report_resolved", "Esta publicación ya fue cerrada.");
  }

  const report = validatedReport(body);
  if (report.postType !== existing.post_type) {
    throw new HttpError(
      409,
      "post_type_immutable",
      "El tipo de publicación no se puede cambiar."
    );
  }

  await env.DB.batch([
    env.DB
      .prepare(
        `UPDATE reports
            SET location_mode = ?, city = ?, neighborhood = ?, h3_cell = ?,
                latitude = ?, longitude = ?, need_types = ?, urgency = ?,
                people_count = ?, details = ?, confirmations = 0,
                updated_at = datetime('now')
          WHERE id = ? AND user_id = ?`
      )
      .bind(
        report.locationMode,
        report.city,
        report.neighborhood,
        report.location.h3Cell,
        report.location.latitude,
        report.location.longitude,
        JSON.stringify(report.needTypes),
        report.urgency,
        report.peopleCount,
        report.details,
        reportId,
        user.id
      ),
    env.DB
      .prepare("DELETE FROM report_confirmations WHERE report_id = ?")
      .bind(reportId)
  ]);
  await invalidateReportCache();
  return json({ ok: true }, { headers: { "cache-control": "no-store" } });
}

async function deleteReport(
  env: Env,
  request: Request,
  reportId: string
): Promise<Response> {
  const user = await requireUser(env, request);
  const report = await env.DB.prepare("SELECT user_id FROM reports WHERE id = ?")
    .bind(reportId)
    .first<{ user_id: string }>();
  if (!report) {
    throw new HttpError(404, "report_not_found", "No se encontró el reporte.");
  }
  if (user.role !== "moderator" && report.user_id !== user.id) {
    throw new HttpError(
      403,
      "report_owner_required",
      "Solo quien publicó esta entrada o la persona moderadora puede eliminarla."
    );
  }
  const result = await env.DB.prepare("DELETE FROM reports WHERE id = ?")
    .bind(reportId)
    .run();
  if (!result.meta.changes) {
    throw new HttpError(404, "report_not_found", "No se encontró el reporte.");
  }
  await invalidateReportCache();
  return json({ ok: true }, { headers: { "cache-control": "no-store" } });
}

async function confirmReport(
  env: Env,
  request: Request,
  reportId: string
): Promise<Response> {
  const user = await requireUser(env, request);
  const report = await env.DB.prepare(
    "SELECT user_id, post_type FROM reports WHERE id = ? AND status != 'resolved'"
  )
    .bind(reportId)
    .first<{ user_id: string; post_type: "need" | "offer" | "update" }>();
  if (!report) throw new HttpError(404, "report_not_found", "No se encontró el reporte.");
  if (report.user_id === user.id) {
    throw new HttpError(409, "self_confirmation", "No puedes confirmar tu propio reporte.");
  }
  if (report.post_type !== "need") {
    throw new HttpError(
      409,
      "post_not_confirmable",
      "Solo se pueden confirmar publicaciones de necesidad."
    );
  }
  const result = await env.DB.batch([
    env.DB
      .prepare(
        "INSERT OR IGNORE INTO report_confirmations (report_id, user_id) VALUES (?, ?)"
      )
      .bind(reportId, user.id),
    env.DB
      .prepare(
        `UPDATE reports
            SET confirmations = (SELECT COUNT(*) FROM report_confirmations WHERE report_id = ?),
                updated_at = datetime('now')
          WHERE id = ?`
      )
      .bind(reportId, reportId)
  ]);
  await invalidateReportCache();
  return json({ ok: true, changed: result[0].meta.changes > 0 });
}

async function flagReport(env: Env, request: Request, reportId: string): Promise<Response> {
  const user = await requireUser(env, request);
  const report = await env.DB.prepare(
    "SELECT user_id FROM reports WHERE id = ? AND status != 'resolved'"
  )
    .bind(reportId)
    .first<{ user_id: string }>();
  if (!report) throw new HttpError(404, "report_not_found", "No se encontró el reporte.");
  if (report.user_id === user.id) {
    throw new HttpError(409, "self_flag", "No puedes reportar tu propia publicación.");
  }
  const body = await readJson<{ reason?: unknown }>(request);
  const reason = enumValue(
    body.reason,
    ["incorrect", "duplicate", "unsafe", "fraud", "other"] as const,
    "El motivo"
  );
  const [insert] = await env.DB.batch([
    env.DB
      .prepare(
        "INSERT OR IGNORE INTO report_flags (report_id, user_id, reason) VALUES (?, ?, ?)"
      )
      .bind(reportId, user.id, reason),
    env.DB
      .prepare(
        `UPDATE reports
            SET flags = (SELECT COUNT(*) FROM report_flags WHERE report_id = ?),
                updated_at = datetime('now')
          WHERE id = ?`
      )
      .bind(reportId, reportId)
  ]);
  await invalidateReportCache();
  return json({ ok: true, changed: insert.meta.changes > 0 });
}

async function listReportComments(
  env: Env,
  request: Request,
  reportId: string
): Promise<Response> {
  const viewer = await getSessionUser(env, request);
  const report = await env.DB.prepare(
    "SELECT id FROM reports WHERE id = ? AND status != 'resolved'"
  )
    .bind(reportId)
    .first<{ id: string }>();
  if (!report) {
    throw new HttpError(404, "report_not_found", "No se encontró la publicación.");
  }

  const result = await env.DB.prepare(
    `SELECT c.id, c.report_id, c.user_id, c.message, c.created_at,
            u.display_name, u.verified
       FROM report_comments c
       JOIN users u ON u.id = c.user_id
      WHERE c.report_id = ?
      ORDER BY c.id ASC
      LIMIT ?`
  )
    .bind(reportId, MAX_COMMENTS_PER_REPORT)
    .all<{
      id: number;
      report_id: string;
      user_id: string;
      message: string;
      created_at: string;
      display_name: string;
      verified: number;
    }>();

  return json(
    {
      comments: result.results.map((row) => ({
        id: row.id,
        reportId: row.report_id,
        authorName: row.display_name,
        authorVerified: row.verified === 1,
        message: row.message,
        createdAt: row.created_at,
        mine: row.user_id === viewer?.id
      }))
    },
    { headers: { "cache-control": "no-store" } }
  );
}

async function createReportComment(
  env: Env,
  request: Request,
  reportId: string
): Promise<Response> {
  const user = await requireUser(env, request);
  await enforceRateLimit(env, request, `comment:${user.id}`, 60, 60 * 60);
  const body = await readJson<ReportCommentBody>(request);
  const message = requiredString(body.message, "El comentario", 1, 500);
  rejectPublicContactInfo(message);

  const report = await env.DB.prepare(
    "SELECT status FROM reports WHERE id = ?"
  )
    .bind(reportId)
    .first<{ status: string }>();
  if (!report) {
    throw new HttpError(404, "report_not_found", "No se encontró la publicación.");
  }
  if (report.status === "resolved") {
    throw new HttpError(
      409,
      "comments_closed",
      "La conversación está cerrada porque la publicación fue resuelta."
    );
  }

  const inserted = await env.DB.prepare(
    `INSERT INTO report_comments (report_id, user_id, message)
     SELECT ?, ?, ?
      WHERE (SELECT COUNT(*) FROM report_comments WHERE report_id = ?) < ?
     RETURNING id, created_at`
  )
    .bind(reportId, user.id, message, reportId, MAX_COMMENTS_PER_REPORT)
    .first<{ id: number; created_at: string }>();
  if (!inserted) {
    throw new HttpError(
      409,
      "comment_capacity",
      "Esta conversación alcanzó su límite de comentarios."
    );
  }

  return json(
    {
      comment: {
        id: inserted.id,
        reportId,
        authorName: user.displayName,
        authorVerified: user.verified,
        message,
        createdAt: inserted.created_at,
        mine: true
      }
    },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}

async function createOffer(
  env: Env,
  request: Request,
  reportId: string
): Promise<Response> {
  const user = await requireUser(env, request);
  await enforceRateLimit(env, request, `offer:${user.id}`, 20, 60 * 60);
  const body = await readJson<OfferBody>(request);
  const offerType = enumValue(body.offerType, OFFER_TYPES, "El tipo de ayuda");
  const message = requiredString(body.message, "El mensaje", 10, 500);
  const report = await env.DB.prepare(
    `SELECT r.user_id, r.status,
            (SELECT COUNT(*)
               FROM offers o
              WHERE o.report_id = r.id
                AND o.status IN ('pending', 'accepted')) AS active_offers
       FROM reports r
      WHERE r.id = ?`
  )
    .bind(reportId)
    .first<{ user_id: string; status: string; active_offers: number }>();
  if (!report) throw new HttpError(404, "report_not_found", "No se encontró el reporte.");
  if (report.user_id === user.id) {
    throw new HttpError(409, "self_offer", "No puedes enviarte una oferta a ti mismo.");
  }
  if (report.status === "resolved") {
    throw new HttpError(409, "report_resolved", "Este reporte ya fue resuelto.");
  }
  if (report.active_offers >= MAX_ACTIVE_OFFERS_PER_REPORT) {
    throw new HttpError(
      409,
      "offer_capacity",
      "Esta publicación ya tiene suficientes conexiones activas."
    );
  }
  const offerId = generateId("ofr");
  try {
    await env.DB.prepare(
      `INSERT INTO offers
        (id, report_id, sender_id, recipient_id, offer_type, message)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(offerId, reportId, user.id, report.user_id, offerType, message)
      .run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      throw new HttpError(409, "offer_exists", "Ya enviaste una oferta activa para este reporte.");
    }
    throw error;
  }
  return json({ id: offerId }, { status: 201 });
}

async function listInbox(env: Env, request: Request): Promise<Response> {
  const user = await requireUser(env, request);
  const result = await env.DB.prepare(
    `SELECT o.id, o.report_id, o.sender_id, o.recipient_id, o.offer_type, o.message,
            o.response_message, o.status, o.created_at, o.updated_at,
            sender.display_name AS sender_name,
            recipient.display_name AS recipient_name,
            r.post_type, r.city, r.neighborhood, r.details AS report_details
       FROM offers o
       JOIN users sender ON sender.id = o.sender_id
       JOIN users recipient ON recipient.id = o.recipient_id
       JOIN reports r ON r.id = o.report_id
      WHERE o.sender_id = ? OR o.recipient_id = ?
      ORDER BY o.created_at DESC
      LIMIT 100`
  )
    .bind(user.id, user.id)
    .all<Record<string, unknown>>();
  const offers = result.results.map((row) => ({
    id: row.id,
    reportId: row.report_id,
    direction: row.recipient_id === user.id ? "received" : "sent",
    senderId: row.sender_id,
    senderName: row.sender_name,
    recipientId: row.recipient_id,
    recipientName: row.recipient_name,
    offerType: row.offer_type,
    message: row.message,
    responseMessage: row.response_message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    report: {
      postType: row.post_type,
      city: row.city,
      neighborhood: row.neighborhood,
      details: row.report_details
    }
  }));
  return json({ offers }, { headers: { "cache-control": "no-store" } });
}

async function updateOffer(env: Env, request: Request, offerId: string): Promise<Response> {
  const user = await requireUser(env, request);
  const body = await readJson<{ status?: unknown; responseMessage?: unknown }>(request);
  const status = enumValue(
    body.status,
    ["accepted", "declined", "withdrawn"] as const,
    "El estado"
  );
  const responseMessage =
    status === "accepted" ? optionalString(body.responseMessage, 500) : "";
  const offer = await env.DB.prepare(
    "SELECT report_id, sender_id, recipient_id, status FROM offers WHERE id = ?"
  )
    .bind(offerId)
    .first<{
      report_id: string;
      sender_id: string;
      recipient_id: string;
      status: string;
    }>();
  if (!offer) throw new HttpError(404, "offer_not_found", "No se encontró la oferta.");
  const allowed =
    (status === "withdrawn" && offer.sender_id === user.id) ||
    (status !== "withdrawn" && offer.recipient_id === user.id);
  if (!allowed) throw new HttpError(403, "not_allowed", "No puedes actualizar esta oferta.");
  if (offer.status !== "pending") {
    throw new HttpError(409, "offer_closed", "Esta oferta ya fue actualizada.");
  }

  const statements = [
    env.DB
      .prepare(
        "UPDATE offers SET status = ?, response_message = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(status, responseMessage, offerId)
  ];
  if (status === "accepted") {
    statements.push(
      env.DB
        .prepare(
          `UPDATE reports
              SET status = 'matched', updated_at = datetime('now')
            WHERE id = ? AND status != 'resolved'`
        )
        .bind(offer.report_id)
    );
  }
  await env.DB.batch(statements);
  if (status === "accepted") await invalidateReportCache();
  return json({ ok: true });
}

async function requireOfferParticipant(
  env: Env,
  offerId: string,
  userId: string
): Promise<{ senderId: string; recipientId: string; status: string }> {
  const offer = await env.DB.prepare(
    "SELECT sender_id, recipient_id, status FROM offers WHERE id = ?"
  )
    .bind(offerId)
    .first<{ sender_id: string; recipient_id: string; status: string }>();
  if (!offer) throw new HttpError(404, "offer_not_found", "No se encontró la oferta.");
  if (offer.sender_id !== userId && offer.recipient_id !== userId) {
    throw new HttpError(403, "not_allowed", "No puedes acceder a esta conversación.");
  }
  if (offer.status !== "accepted") {
    throw new HttpError(409, "chat_not_open", "El chat se activa cuando la oferta es aceptada.");
  }
  return {
    senderId: offer.sender_id,
    recipientId: offer.recipient_id,
    status: offer.status
  };
}

async function listChatMessages(
  env: Env,
  request: Request,
  offerId: string
): Promise<Response> {
  const user = await requireUser(env, request);
  await requireOfferParticipant(env, offerId, user.id);
  const afterValue = Number(new URL(request.url).searchParams.get("after") ?? 0);
  const after = Number.isSafeInteger(afterValue) && afterValue >= 0 ? afterValue : 0;
  const result = await env.DB.prepare(
    `SELECT m.id, m.sender_id, m.message, m.created_at, u.display_name
       FROM chat_messages m
       JOIN users u ON u.id = m.sender_id
      WHERE m.offer_id = ? AND m.id > ?
      ORDER BY m.id ASC
      LIMIT 100`
  )
    .bind(offerId, after)
    .all<{
      id: number;
      sender_id: string;
      message: string;
      created_at: string;
      display_name: string;
    }>();
  return json(
    {
      messages: result.results.map((row) => ({
        id: row.id,
        offerId,
        senderId: row.sender_id,
        senderName: row.display_name,
        message: row.message,
        createdAt: row.created_at,
        mine: row.sender_id === user.id
      }))
    },
    { headers: { "cache-control": "no-store" } }
  );
}

async function createChatMessage(
  env: Env,
  request: Request,
  offerId: string
): Promise<Response> {
  const user = await requireUser(env, request);
  await requireOfferParticipant(env, offerId, user.id);
  await enforceRateLimit(env, request, `chat:${user.id}`, 120, 60 * 60);
  const body = await readJson<ChatMessageBody>(request);
  const message = requiredString(body.message, "El mensaje", 1, 500);
  const inserted = await env.DB.prepare(
    `INSERT INTO chat_messages (offer_id, sender_id, message)
     SELECT ?, ?, ?
      WHERE (SELECT COUNT(*) FROM chat_messages WHERE offer_id = ?) < ?
     RETURNING id, created_at`
  )
    .bind(offerId, user.id, message, offerId, MAX_CHAT_MESSAGES_PER_OFFER)
    .first<{ id: number; created_at: string }>();
  if (!inserted) {
    throw new HttpError(
      409,
      "chat_capacity",
      "Este chat alcanzó su límite de mensajes. Coordinen por un canal de confianza."
    );
  }
  return json(
    {
      message: {
        id: inserted.id,
        offerId,
        senderId: user.id,
        senderName: user.displayName,
        message,
        createdAt: inserted.created_at,
        mine: true
      }
    },
    { status: 201, headers: { "cache-control": "no-store" } }
  );
}

async function handleApi(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method.toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) assertSameOrigin(request);

  if (method === "GET" && pathname === "/api/health") {
    return json({ ok: true, service: "pulso-colombia", time: new Date().toISOString() });
  }
  if (method === "GET" && pathname === "/api/config") {
    return json(
      {
        turnstileSiteKey:
          env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY
            ? env.TURNSTILE_SITE_KEY
            : null
      },
      { headers: { "cache-control": "no-store" } }
    );
  }
  if (method === "GET" && pathname === "/api/hazards") return getHazards(env);
  if (method === "POST" && pathname === "/api/geocode") return geocode(env, request);
  if (method === "GET" && pathname === "/api/me") {
    return json(userPayload(await getSessionUser(env, request)), {
      headers: { "cache-control": "no-store" }
    });
  }
  if (method === "POST" && pathname === "/api/auth/register") return register(env, request);
  if (method === "POST" && pathname === "/api/auth/login") return login(env, request);
  if (method === "POST" && pathname === "/api/auth/logout") {
    await deleteSession(env, request);
    return json(
      { ok: true },
      { headers: { "set-cookie": clearSessionCookie(request), "cache-control": "no-store" } }
    );
  }
  if (method === "GET" && pathname === "/api/reports") return listReports(env, request);
  if (method === "POST" && pathname === "/api/reports") return createReport(env, request);
  if (method === "GET" && pathname === "/api/inbox") return listInbox(env, request);

  const reportId = routeId(pathname, "/api/reports/");
  if (method === "PATCH" && reportId) return updateReport(env, request, reportId);
  if (method === "PUT" && reportId) return updateReportContent(env, request, reportId);
  if (method === "DELETE" && reportId) return deleteReport(env, request, reportId);
  const confirmId = routeId(pathname, "/api/reports/", "/confirm");
  if (method === "POST" && confirmId) return confirmReport(env, request, confirmId);
  const flagId = routeId(pathname, "/api/reports/", "/flag");
  if (method === "POST" && flagId) return flagReport(env, request, flagId);
  const commentReportId = routeId(pathname, "/api/reports/", "/comments");
  if (method === "GET" && commentReportId) {
    return listReportComments(env, request, commentReportId);
  }
  if (method === "POST" && commentReportId) {
    return createReportComment(env, request, commentReportId);
  }
  const offerReportId = routeId(pathname, "/api/reports/", "/offers");
  if (method === "POST" && offerReportId) return createOffer(env, request, offerReportId);
  const chatOfferId = routeId(pathname, "/api/offers/", "/messages");
  if (method === "GET" && chatOfferId) {
    return listChatMessages(env, request, chatOfferId);
  }
  if (method === "POST" && chatOfferId) {
    return createChatMessage(env, request, chatOfferId);
  }
  const offerId = routeId(pathname, "/api/offers/");
  if (method === "PATCH" && offerId) return updateOffer(env, request, offerId);

  throw new HttpError(404, "not_found", "Ruta no encontrada.");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        await enforceEdgeRateLimits(env, request);
      }
      const response = url.pathname.startsWith("/api/")
        ? await handleApi(env, request)
        : await env.ASSETS.fetch(request);
      return applySecurityHeaders(response);
    } catch (error) {
      if (error instanceof HttpError) {
        return applySecurityHeaders(
          apiError(
            error.status,
            error.code,
            localizedError(request, error.code, error.message),
            error.headers
          )
        );
      }
      console.error("Unhandled request error", error);
      return applySecurityHeaders(
        apiError(
          500,
          "internal_error",
          localizedError(
            request,
            "internal_error",
            "No pudimos completar la solicitud. Intenta de nuevo."
          )
        )
      );
    }
  },
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(runRetentionCleanup(env));
  }
} satisfies ExportedHandler<Env>;
