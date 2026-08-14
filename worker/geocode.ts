import { enforceRateLimit, requireUser } from "./auth";
import { HttpError, json, readJson } from "./http";
import type { Env } from "./types";
import { CITY_IDS, enumValue, requiredString } from "./validation";

interface GeocodeBody {
  query?: unknown;
  city?: unknown;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    neighbourhood?: string;
    suburb?: string;
    quarter?: string;
    city_district?: string;
    city?: string;
    town?: string;
    municipality?: string;
    postcode?: string;
  };
}

const CITY_SEARCH: Record<
  (typeof CITY_IDS)[number],
  {
    name: string;
    bounds: [south: number, west: number, north: number, east: number];
  }
> = {
  manizales: { name: "Manizales, Caldas", bounds: [4.99, -75.61, 5.16, -75.4] },
  pereira: { name: "Pereira, Risaralda", bounds: [4.71, -75.82, 4.91, -75.59] },
  armenia: { name: "Armenia, Quindío", bounds: [4.44, -75.79, 4.64, -75.58] },
  cali: { name: "Cali, Valle del Cauca", bounds: [3.28, -76.67, 3.61, -76.39] },
  choco: { name: "Quibdó, Chocó", bounds: [5.59, -76.78, 5.81, -76.54] }
};

function pointInBounds(
  latitude: number,
  longitude: number,
  [south, west, north, east]: [number, number, number, number]
): boolean {
  return latitude >= south && latitude <= north && longitude >= west && longitude <= east;
}

async function enforceGlobalProviderLimit(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const key = `geocode-global:${now}`;
  await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, expires_at)
     VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET count = count + 1`
  )
    .bind(key, now + 90)
    .run();
  const row = await env.DB.prepare("SELECT count FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number }>();
  if ((row?.count ?? 1) > 1) {
    throw new HttpError(
      429,
      "geocode_busy",
      "La búsqueda de direcciones está ocupada. Espera dos segundos e intenta de nuevo.",
      { "retry-after": "2" }
    );
  }
}

function cleanText(value: string | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function geocode(env: Env, request: Request): Promise<Response> {
  const user = await requireUser(env, request);
  const body = await readJson<GeocodeBody>(request, 2_000);
  const query = requiredString(body.query, "La dirección o el barrio", 3, 120);
  const city = enumValue(body.city, CITY_IDS, "La ciudad");
  await enforceRateLimit(env, request, `geocode:${user.id}`, 10, 10 * 60);

  const selected = CITY_SEARCH[city];
  const [south, west, north, east] = selected.bounds;
  const language = request.headers.get("x-pulso-language") === "en" ? "en" : "es";
  const cache = (caches as unknown as { default: Cache }).default;
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, " ").trim();
  const cacheKey = new Request(
    `https://pulso.internal/geocode/${city}/${language}?q=${encodeURIComponent(normalizedQuery)}`
  );
  const cached = await cache.match(cacheKey);
  if (cached) {
    return json(await cached.json(), {
      headers: {
        "cache-control": "no-store",
        "x-geocoder": "OpenStreetMap-Nominatim",
        "x-geocoder-cache": "hit"
      }
    });
  }

  await enforceGlobalProviderLimit(env);
  const params = new URLSearchParams({
    q: `${query}, ${selected.name}, Colombia`,
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "co",
    bounded: "1",
    viewbox: `${west},${north},${east},${south}`,
    limit: "5",
    "accept-language": language
  });

  let upstream: Response;
  try {
    upstream = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        accept: "application/json",
        "accept-language": language,
        "user-agent":
          "PulsoColombia/0.2 (+https://github.com/jussalcedoga/pulso-colombia)"
      },
      signal: AbortSignal.timeout(8_000),
      cf: { cacheTtl: 0 }
    });
  } catch {
    throw new HttpError(
      502,
      "geocode_failed",
      "No se pudo buscar la dirección. Elige el punto directamente en el mapa."
    );
  }
  if (!upstream.ok) {
    throw new HttpError(
      502,
      "geocode_failed",
      "No se pudo buscar la dirección. Elige el punto directamente en el mapa."
    );
  }

  const rawResults = await upstream.json<NominatimResult[]>();
  const results = rawResults.flatMap((result) => {
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !pointInBounds(latitude, longitude, selected.bounds)
    ) {
      return [];
    }
    const address = result.address ?? {};
    const road = cleanText(address.road ?? address.pedestrian, 80);
    const houseNumber = cleanText(address.house_number, 20);
    const neighborhood = cleanText(
      address.neighbourhood ??
        address.suburb ??
        address.quarter ??
        address.city_district,
      60
    );
    const displayParts = cleanText(result.display_name, 220)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const label =
      cleanText([road, houseNumber].filter(Boolean).join(" "), 100) ||
      neighborhood ||
      displayParts.slice(0, 2).join(", ");
    const context = displayParts
      .filter((part) => part !== label)
      .slice(label ? 1 : 0, 5)
      .join(", ");

    return [
      {
        id: String(result.place_id),
        label: label || selected.name,
        context: context || selected.name,
        neighborhood,
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6))
      }
    ];
  });

  const payload = { results };
  await cache
    .put(
      cacheKey,
      json(payload, { headers: { "cache-control": "public, max-age=21600" } })
    )
    .catch(() => undefined);
  return json(
    payload,
    {
      headers: {
        "cache-control": "no-store",
        "x-geocoder": "OpenStreetMap-Nominatim",
        "x-geocoder-cache": "miss"
      }
    }
  );
}
