import { HttpError } from "./http";
import type { Env } from "./types";

interface TurnstileResponse {
  success: boolean;
  action?: string;
  "error-codes"?: string[];
}

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

export async function enforceEdgeRateLimits(env: Env, request: Request): Promise<void> {
  const ip = clientIp(request);
  const checks: Promise<RateLimitOutcome>[] = [];

  if (env.API_RATE_LIMITER) {
    checks.push(env.API_RATE_LIMITER.limit({ key: `api:${ip}` }));
  }
  if (
    env.WRITE_RATE_LIMITER &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())
  ) {
    checks.push(env.WRITE_RATE_LIMITER.limit({ key: `write:${ip}` }));
  }

  const outcomes = await Promise.all(checks);
  if (outcomes.some((outcome) => !outcome.success)) {
    throw new HttpError(
      429,
      "edge_rate_limited",
      "Demasiadas solicitudes. Espera un momento antes de continuar.",
      { "retry-after": "60" }
    );
  }
}

export async function verifyTurnstile(
  env: Env,
  request: Request,
  tokenValue: unknown,
  expectedAction: "register" | "report"
): Promise<void> {
  if (!env.TURNSTILE_SECRET_KEY) return;
  if (typeof tokenValue !== "string" || tokenValue.length < 10 || tokenValue.length > 2048) {
    throw new HttpError(
      422,
      "security_check_required",
      "Completa la verificación de seguridad para continuar."
    );
  }

  const form = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: tokenValue,
    remoteip: clientIp(request)
  });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form
  });
  if (!response.ok) {
    throw new HttpError(
      503,
      "security_check_unavailable",
      "La verificación de seguridad no está disponible. Intenta de nuevo."
    );
  }

  const result = await response.json<TurnstileResponse>();
  if (!result.success || (result.action && result.action !== expectedAction)) {
    throw new HttpError(
      422,
      "security_check_failed",
      "La verificación de seguridad venció o no fue válida. Intenta de nuevo."
    );
  }
}
