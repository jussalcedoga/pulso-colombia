import type { Env, SessionUser } from "./types";
import { HttpError } from "./http";

const SESSION_COOKIE = "pulso_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const BASE32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function generateSecret(bytesLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLength));
  return bytesToBase64Url(bytes);
}

function generateRecoverySecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

export function formatRecoveryCode(secret: string): string {
  return `PULSO-${secret.match(/.{1,4}/g)?.join("-") ?? secret}`;
}

export function normalizeRecoveryCode(value: string): string {
  const normalized = value.toUpperCase().replace(/^PULSO/, "").replace(/[^A-Z2-9]/g, "");
  if (normalized.length !== 32 || [...normalized].some((character) => !BASE32.includes(character))) {
    throw new HttpError(400, "invalid_recovery_code", "El código de acceso no es válido.");
  }
  return normalized;
}

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return null;
}

export async function hashRecoveryCode(secret: string): Promise<string> {
  return sha256(`recovery:${secret}`);
}

export async function createRecoveryIdentity(): Promise<{
  secret: string;
  formatted: string;
  hash: string;
}> {
  const secret = generateRecoverySecret();
  return {
    secret,
    formatted: formatRecoveryCode(secret),
    hash: await hashRecoveryCode(secret)
  };
}

export async function createSession(
  env: Env,
  request: Request,
  userId: string
): Promise<{ cookie: string }> {
  const token = generateSecret();
  const tokenHash = await sha256(`session:${token}`);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)"
  )
    .bind(tokenHash, userId, expiresAt)
    .run();

  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure}`
  };
}

export function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export async function deleteSession(env: Env, request: Request): Promise<void> {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return;
  const tokenHash = await sha256(`session:${token}`);
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function getSessionUser(env: Env, request: Request): Promise<SessionUser | null> {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(`session:${token}`);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT u.id, u.display_name, u.city, u.account_type, u.role, u.verified
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`
  )
    .bind(tokenHash, now)
    .first<{
      id: string;
      display_name: string;
      city: string;
      account_type: "resident" | "volunteer" | "sponsor";
      role: string;
      verified: number;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    city: row.city,
    accountType: row.account_type,
    role: row.role,
    verified: row.verified === 1
  };
}

export async function requireUser(env: Env, request: Request): Promise<SessionUser> {
  const user = await getSessionUser(env, request);
  if (!user) {
    throw new HttpError(401, "auth_required", "Inicia sesión para continuar.");
  }
  return user;
}

export async function enforceRateLimit(
  env: Env,
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const secret = env.APP_SECRET ?? "pulso-local-development";
  const ipHash = await sha256(`ip:${secret}:${ip}`);
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const key = `${scope}:${ipHash}:${bucket}`;
  const expiresAt = (bucket + 1) * windowSeconds + 60;

  await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, expires_at)
     VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET count = count + 1`
  )
    .bind(key, expiresAt)
    .run();

  const row = await env.DB.prepare("SELECT count FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number }>();
  if ((row?.count ?? 1) > limit) {
    throw new HttpError(429, "rate_limited", "Demasiados intentos. Espera un momento.");
  }

  if (Math.random() < 0.02) {
    await env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(now).run();
  }
}
