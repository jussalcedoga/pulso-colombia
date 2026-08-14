import type { Env, MmiGrid, UsgsFeature, UsgsProduct } from "./types";

const USGS_API = "https://earthquake.usgs.gov/fdsnws/event/1/query";
const DEFAULT_EVENT_ID = "us6000tjl2";

const cities = [
  { id: "manizales", name: "Manizales", latitude: 5.0689, longitude: -75.5174 },
  { id: "pereira", name: "Pereira", latitude: 4.8087, longitude: -75.6906 },
  { id: "armenia", name: "Armenia", latitude: 4.5339, longitude: -75.6811 },
  { id: "cali", name: "Cali", latitude: 3.4516, longitude: -76.532 },
  { id: "choco", name: "Chocó / Quibdó", latitude: 5.6947, longitude: -76.6611 }
] as const;

interface CoverageJson {
  domain: {
    axes: {
      x: MmiGrid["x"];
      y: MmiGrid["y"];
    };
  };
  ranges: {
    MMI: {
      values: number[];
    };
  };
}

interface FeatureCollection {
  type: "FeatureCollection";
  features: unknown[];
}

function preferredProduct(products: UsgsProduct[] | undefined): UsgsProduct | null {
  if (!products?.length) return null;
  return [...products].sort((a, b) => b.updateTime - a.updateTime)[0];
}

function contentUrl(product: UsgsProduct | null, keys: string[]): string | null {
  if (!product) return null;
  for (const key of keys) {
    const content = product.contents[key];
    if (content?.url) return content.url;
  }
  return null;
}

function sampleGrid(grid: MmiGrid | null, latitude: number, longitude: number): number | null {
  if (!grid) return null;
  const xRatio = (longitude - grid.x.start) / (grid.x.stop - grid.x.start);
  const yRatio = (latitude - grid.y.start) / (grid.y.stop - grid.y.start);
  if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) return null;
  const x = Math.round(xRatio * (grid.x.num - 1));
  const y = Math.round(yRatio * (grid.y.num - 1));
  const value = grid.values[y * grid.x.num + x];
  return Number.isFinite(value) ? Number(value.toFixed(1)) : null;
}

function dateOnly(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function yesterdayUtc(): string {
  return dateOnly(Date.now() - 30 * 60 * 60 * 1000);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "user-agent": "PulsoColombia/0.1 (+https://pulso-colombia.pages.dev)" },
    cf: { cacheTtl: 300, cacheEverything: true }
  });
  if (!response.ok) throw new Error(`Upstream ${response.status}: ${url}`);
  return response.json<T>();
}

function publicEvent(feature: UsgsFeature) {
  return {
    id: feature.id,
    magnitude: feature.properties.mag,
    place: feature.properties.place,
    title: feature.properties.title,
    time: feature.properties.time,
    updated: feature.properties.updated,
    status: feature.properties.status,
    alert: feature.properties.alert,
    felt: feature.properties.felt,
    reportedIntensity: feature.properties.cdi,
    instrumentalIntensity: feature.properties.mmi,
    significance: feature.properties.sig,
    url: feature.properties.url,
    longitude: feature.geometry.coordinates[0],
    latitude: feature.geometry.coordinates[1],
    depthKm: feature.geometry.coordinates[2]
  };
}

async function getLiveHazards(env: Env): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request("https://pulso.internal/api/hazards");
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const eventId = env.PRIMARY_EVENT_ID || DEFAULT_EVENT_ID;
  const eventUrl = `${USGS_API}?format=geojson&eventid=${encodeURIComponent(eventId)}`;
  const detail = await fetchJson<UsgsFeature>(eventUrl);
  const shakemap = preferredProduct(detail.properties.products?.shakemap);
  const groundFailure = preferredProduct(detail.properties.products?.["ground-failure"]);
  const dyfi = preferredProduct(detail.properties.products?.dyfi);

  const mmiUrl = contentUrl(shakemap, [
    "download/coverage_mmi_low_res.covjson",
    "download/coverage_mmi_medium_res.covjson"
  ]);
  const contoursUrl = contentUrl(shakemap, ["download/cont_mi.json", "download/cont_mmi.json"]);
  const intensityOverlayUrl = contentUrl(shakemap, ["download/intensity_overlay.png"]);
  const dyfiUrl = contentUrl(dyfi, ["dyfi_geo_1km.geojson", "dyfi_geo_10km.geojson"]);

  const eventTime = new Date(detail.properties.time);
  const aftershockStart = eventTime.toISOString();
  const aftershockUrl =
    `${USGS_API}?format=geojson&starttime=${encodeURIComponent(aftershockStart)}` +
    `&latitude=${detail.geometry.coordinates[1]}&longitude=${detail.geometry.coordinates[0]}` +
    "&maxradiuskm=350&minmagnitude=3&orderby=time&limit=100";

  const [coverage, contours, aftershocks] = await Promise.all([
    mmiUrl ? fetchJson<CoverageJson>(mmiUrl).catch(() => null) : Promise.resolve(null),
    contoursUrl ? fetchJson<FeatureCollection>(contoursUrl).catch(() => null) : Promise.resolve(null),
    fetchJson<FeatureCollection>(aftershockUrl).catch(() => ({
      type: "FeatureCollection" as const,
      features: []
    }))
  ]);

  const grid: MmiGrid | null = coverage
    ? {
        x: coverage.domain.axes.x,
        y: coverage.domain.axes.y,
        values: coverage.ranges.MMI.values
      }
    : null;

  const rankedCities = cities
    .map((city) => ({
      ...city,
      mmi: sampleGrid(grid, city.latitude, city.longitude)
    }))
    .sort((a, b) => (b.mmi ?? -1) - (a.mmi ?? -1));

  const bounds = shakemap
    ? {
        minLatitude: Number(shakemap.properties["minimum-latitude"]),
        minLongitude: Number(shakemap.properties["minimum-longitude"]),
        maxLatitude: Number(shakemap.properties["maximum-latitude"]),
        maxLongitude: Number(shakemap.properties["maximum-longitude"])
      }
    : null;

  const aftershockFeatures = (aftershocks.features as unknown as UsgsFeature[])
    .filter((feature) => feature.id !== detail.id)
    .slice(0, 50)
    .map(publicEvent);

  const body = {
    source: {
      name: "USGS",
      url: detail.properties.url,
      updatedAt: detail.properties.updated
    },
    event: publicEvent(detail),
    aftershocks: aftershockFeatures,
    shakemap: {
      available: Boolean(shakemap),
      updatedAt: shakemap?.updateTime ?? null,
      reviewStatus: shakemap?.properties["review-status"] ?? null,
      maxMmi: shakemap ? Number(shakemap.properties.maxmmi) : null,
      bounds,
      intensityOverlayUrl,
      contours,
      grid
    },
    groundFailure: groundFailure
      ? {
          landslideAlert: groundFailure.properties["landslide-alert"] ?? null,
          liquefactionAlert: groundFailure.properties["liquefaction-alert"] ?? null,
          updatedAt: groundFailure.updateTime
        }
      : null,
    communityIntensityUrl: dyfiUrl,
    cities: rankedCities,
    satellite: {
      provider: "NASA GIBS / VIIRS SNPP",
      layer: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
      eventDate: dateOnly(detail.properties.time),
      latestSuggestedDate: yesterdayUtc(),
      maxNativeZoom: 9,
      resolutionNote: "Daily imagery; approximately 375 m at source."
    }
  };

  const response = new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=120, s-maxage=300",
      "x-data-source": "USGS,NASA-GIBS"
    }
  });
  await cache.put(cacheKey, response.clone());
  return response;
}

function fallbackHazards(): Response {
  const event = {
    id: DEFAULT_EVENT_ID,
    magnitude: 7.4,
    place: "5 km S of San José del Palmar, Colombia",
    title: "M 7.4 - 5 km S of San José del Palmar, Colombia",
    time: 1786365268125,
    updated: 1786678361963,
    status: "reviewed",
    alert: "red",
    felt: 1138,
    reportedIntensity: 7.9,
    instrumentalIntensity: 7.999,
    significance: 2790,
    url: `https://earthquake.usgs.gov/earthquakes/eventpage/${DEFAULT_EVENT_ID}`,
    longitude: -76.2422,
    latitude: 4.8436,
    depthKm: 110.285
  };
  return new Response(
    JSON.stringify({
      source: {
        name: "USGS",
        url: event.url,
        updatedAt: event.updated,
        fallback: true
      },
      event,
      aftershocks: [],
      shakemap: {
        available: true,
        updatedAt: 1786452072000,
        reviewStatus: "automatic",
        maxMmi: 7.999,
        bounds: {
          minLatitude: 1.767,
          minLongitude: -79.3,
          maxLatitude: 7.9,
          maxLongitude: -73.133
        },
        intensityOverlayUrl:
          "https://earthquake.usgs.gov/product/shakemap/us6000tjl2/us/1786452072000/download/intensity_overlay.png",
        contours: null,
        grid: null
      },
      groundFailure: {
        landslideAlert: "orange",
        liquefactionAlert: "red",
        updatedAt: 1786452368917
      },
      communityIntensityUrl: null,
      cities: [
        { id: "choco", name: "Chocó / Quibdó", latitude: 5.6947, longitude: -76.6611, mmi: 7.6 },
        { id: "pereira", name: "Pereira", latitude: 4.8087, longitude: -75.6906, mmi: 7.4 },
        { id: "armenia", name: "Armenia", latitude: 4.5339, longitude: -75.6811, mmi: 7.4 },
        { id: "manizales", name: "Manizales", latitude: 5.0689, longitude: -75.5174, mmi: 7.2 },
        { id: "cali", name: "Cali", latitude: 3.4516, longitude: -76.532, mmi: 6.3 }
      ],
      satellite: {
        provider: "NASA GIBS / VIIRS SNPP",
        layer: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
        eventDate: "2026-08-10",
        latestSuggestedDate: yesterdayUtc(),
        maxNativeZoom: 9,
        resolutionNote: "Daily imagery; approximately 375 m at source."
      }
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=30, s-maxage=60",
        "x-data-source": "USGS-FALLBACK"
      }
    }
  );
}

export async function getHazards(env: Env): Promise<Response> {
  try {
    return await getLiveHazards(env);
  } catch (error) {
    console.error("USGS live feed unavailable; serving official fallback snapshot", error);
    return fallbackHazards();
  }
}
