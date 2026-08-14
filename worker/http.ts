import type { ApiError } from "./types";

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function apiError(
  status: number,
  code: string,
  error: string,
  headers?: HeadersInit
): Response {
  return json({ code, error } satisfies ApiError, { status, headers });
}

export async function readJson<T>(request: Request, maxBytes = 16_000): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "content_type", "Se requiere contenido JSON.");
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxBytes) {
    throw new HttpError(413, "body_too_large", "La solicitud es demasiado grande.");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, "body_too_large", "La solicitud es demasiado grande.");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "invalid_json", "El contenido JSON no es válido.");
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly headers?: HeadersInit
  ) {
    super(message);
  }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError(403, "origin_rejected", "Origen de solicitud no permitido.");
  }
}

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(self)");
  headers.set("cross-origin-opener-policy", "same-origin");
  headers.set(
    "content-security-policy",
    [
      "default-src 'self'",
      "script-src 'self' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.arcgisonline.com https://gibs.earthdata.nasa.gov https://earthquake.usgs.gov",
      "connect-src 'self' https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join("; ")
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function routeId(pathname: string, prefix: string, suffix = ""): string | null {
  if (!pathname.startsWith(prefix) || (suffix && !pathname.endsWith(suffix))) {
    return null;
  }
  const end = suffix ? -suffix.length : undefined;
  const id = pathname.slice(prefix.length, end);
  return id && !id.includes("/") ? id : null;
}
