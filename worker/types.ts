export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PRIMARY_EVENT_ID?: string;
  APP_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  API_RATE_LIMITER?: RateLimit;
  WRITE_RATE_LIMITER?: RateLimit;
}

export interface SessionUser {
  id: string;
  displayName: string;
  city: string;
  accountType: "resident" | "volunteer" | "sponsor";
  role: string;
  verified: boolean;
}

export interface ApiError {
  error: string;
  code: string;
}

export interface UsgsFeature {
  type: "Feature";
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    updated: number;
    url: string;
    detail?: string;
    felt?: number | null;
    cdi?: number | null;
    mmi?: number | null;
    alert?: string | null;
    status?: string;
    sig?: number;
    title: string;
    products?: Record<string, UsgsProduct[]>;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number, number];
  };
}

export interface UsgsProduct {
  updateTime: number;
  properties: Record<string, string>;
  contents: Record<
    string,
    {
      contentType: string;
      url: string;
      length?: number;
    }
  >;
}

export interface MmiGrid {
  x: { start: number; stop: number; num: number };
  y: { start: number; stop: number; num: number };
  values: number[];
}
