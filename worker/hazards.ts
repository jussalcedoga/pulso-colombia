import type { Env, MmiGrid, UsgsFeature, UsgsProduct } from "./types";

const USGS_API = "https://earthquake.usgs.gov/fdsnws/event/1/query";
const DEFAULT_EVENT_ID = "us6000tjl2";
const CEMS_ACTIVATION_CODE = "EMSR916";
const CEMS_ACTIVATION_URL =
  "https://mapping.emergency.copernicus.eu/activations/EMSR916/";
const CEMS_API =
  "https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations/?code=EMSR916";

type CityId = "manizales" | "pereira" | "armenia" | "cali" | "choco";

interface CityArea {
  id: CityId;
  name: string;
  latitude: number;
  longitude: number;
  bounds: [south: number, west: number, north: number, east: number];
}

const cities: CityArea[] = [
  {
    id: "manizales",
    name: "Manizales",
    latitude: 5.0689,
    longitude: -75.5174,
    bounds: [4.99, -75.61, 5.16, -75.4]
  },
  {
    id: "pereira",
    name: "Pereira",
    latitude: 4.8087,
    longitude: -75.6906,
    bounds: [4.71, -75.82, 4.91, -75.59]
  },
  {
    id: "armenia",
    name: "Armenia",
    latitude: 4.5339,
    longitude: -75.6811,
    bounds: [4.44, -75.79, 4.64, -75.58]
  },
  {
    id: "cali",
    name: "Cali",
    latitude: 3.4516,
    longitude: -76.532,
    bounds: [3.28, -76.67, 3.61, -76.39]
  },
  {
    id: "choco",
    name: "Chocó / Quibdó",
    latitude: 5.6947,
    longitude: -76.6611,
    bounds: [5.59, -76.78, 5.81, -76.54]
  }
];

interface CoverageJson {
  domain: {
    axes: {
      x: MmiGrid["x"];
      y: MmiGrid["y"];
    };
  };
  ranges: {
    MMI: {
      values: Array<number | null>;
    };
  };
}

interface FeatureCollection {
  type: "FeatureCollection";
  features: unknown[];
}

interface DyfiFeature {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties: {
    cdi: number;
    nresp: number;
    stddev?: number | null;
  };
}

interface ModeledCell {
  id: string;
  city: CityId;
  bounds: [number, number, number, number];
  mmi: number;
}

interface DyfiCell {
  id: string;
  city: CityId;
  bounds: [number, number, number, number];
  cdi: number;
  responses: number;
  standardDeviation: number | null;
}

interface CemsLayer {
  name: string;
  format: string;
  json?: string;
}

interface CemsProduct {
  type: string;
  monitoringNumber: number;
  layers: CemsLayer[];
  images?: Array<{
    sensorName?: string;
    acquisitionTime?: string;
  }>;
  stats?: Record<string, Record<string, { total?: unknown; affected?: unknown }>>;
  version?: {
    statusCode?: string;
    deliveryTime?: string;
  };
}

interface CemsAoi {
  number: number;
  name: string;
  extent: string;
  products?: CemsProduct[];
}

interface CemsActivation {
  code: string;
  closed: boolean;
  aois?: CemsAoi[];
}

interface CemsResponse {
  results?: CemsActivation[];
}

interface CemsPointFeature {
  type: "Feature";
  properties: {
    damage_gra?: string;
    det_method?: string;
    obj_desc?: string;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
}

interface OfficialDamageArea {
  id: string;
  city: CityId;
  name: string;
  deliveredAt: string;
  acquisitionAt: string | null;
  sensor: string | null;
  boundary: [number, number][];
  affectedBuildings: number | null;
  totalBuildings: number | null;
  damagePoints: Array<{
    id: string;
    city: CityId;
    latitude: number;
    longitude: number;
    classification: "destroyed" | "damaged" | "possibly_damaged";
    method: string;
  }>;
  roadBlocks: Array<{
    id: string;
    city: CityId;
    latitude: number;
    longitude: number;
  }>;
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

function roundCoordinate(value: number): number {
  return Number(value.toFixed(5));
}

function gridResolutionKm(grid: MmiGrid | null): number | null {
  if (!grid || grid.x.num < 2 || grid.y.num < 2) return null;
  const latitudeStep = Math.abs((grid.y.stop - grid.y.start) / (grid.y.num - 1));
  return Number((latitudeStep * 111.32).toFixed(2));
}

function modeledCellsForCities(grid: MmiGrid | null): ModeledCell[] {
  if (!grid || grid.x.num < 2 || grid.y.num < 2) return [];
  const longitudeStep = (grid.x.stop - grid.x.start) / (grid.x.num - 1);
  const latitudeStep = (grid.y.stop - grid.y.start) / (grid.y.num - 1);
  const cells: ModeledCell[] = [];

  for (const city of cities) {
    const [south, west, north, east] = city.bounds;
    const minX = Math.max(0, Math.floor((west - grid.x.start) / longitudeStep));
    const maxX = Math.min(
      grid.x.num - 1,
      Math.ceil((east - grid.x.start) / longitudeStep)
    );
    const minY = Math.max(0, Math.floor((south - grid.y.start) / latitudeStep));
    const maxY = Math.min(
      grid.y.num - 1,
      Math.ceil((north - grid.y.start) / latitudeStep)
    );

    for (let y = minY; y <= maxY; y += 1) {
      const latitude = grid.y.start + y * latitudeStep;
      for (let x = minX; x <= maxX; x += 1) {
        const longitude = grid.x.start + x * longitudeStep;
        const value = grid.values[y * grid.x.num + x];
        if (!Number.isFinite(value)) continue;
        cells.push({
          id: `mmi-${city.id}-${y}-${x}`,
          city: city.id,
          bounds: [
            roundCoordinate(latitude - latitudeStep / 2),
            roundCoordinate(longitude - longitudeStep / 2),
            roundCoordinate(latitude + latitudeStep / 2),
            roundCoordinate(longitude + longitudeStep / 2)
          ],
          mmi: Number(value.toFixed(1))
        });
      }
    }
  }

  return cells;
}

function cityForPoint(latitude: number, longitude: number): CityArea | null {
  return (
    cities.find(({ bounds: [south, west, north, east] }) =>
      latitude >= south && latitude <= north && longitude >= west && longitude <= east
    ) ?? null
  );
}

function dyfiCellsForCities(collection: FeatureCollection | null): DyfiCell[] {
  if (!collection) return [];
  const cells: DyfiCell[] = [];

  for (const [index, feature] of (collection.features as DyfiFeature[]).entries()) {
    const ring = feature.geometry?.coordinates?.[0];
    const cdi = Number(feature.properties?.cdi);
    const responses = Number(feature.properties?.nresp);
    if (!ring?.length || !Number.isFinite(cdi) || !Number.isFinite(responses)) continue;
    const longitudes = ring.map((point) => Number(point[0])).filter(Number.isFinite);
    const latitudes = ring.map((point) => Number(point[1])).filter(Number.isFinite);
    if (!longitudes.length || !latitudes.length) continue;
    const west = Math.min(...longitudes);
    const east = Math.max(...longitudes);
    const south = Math.min(...latitudes);
    const north = Math.max(...latitudes);
    const city = cityForPoint((south + north) / 2, (west + east) / 2);
    if (!city) continue;
    const standardDeviation = Number(feature.properties.stddev);
    cells.push({
      id: `dyfi-${city.id}-${index}`,
      city: city.id,
      bounds: [
        roundCoordinate(south),
        roundCoordinate(west),
        roundCoordinate(north),
        roundCoordinate(east)
      ],
      cdi: Number(cdi.toFixed(1)),
      responses: Math.max(0, Math.round(responses)),
      standardDeviation: Number.isFinite(standardDeviation)
        ? Number(standardDeviation.toFixed(2))
        : null
    });
  }

  return cells;
}

function cityForCemsAoi(name: string): CityId | null {
  const normalized = name.toLowerCase();
  if (normalized.includes("manizales")) return "manizales";
  if (normalized.includes("pereira")) return "pereira";
  if (normalized.includes("armenia")) return "armenia";
  if (normalized.includes("cali")) return "cali";
  if (normalized.includes("quibdo") || normalized.includes("quibdó")) return "choco";
  return null;
}

function parseWktBoundary(wkt: string): [number, number][] {
  const match = wkt.match(/POLYGON\s*\(\((.+)\)\)/i);
  if (!match) return [];
  return match[1].split(",").flatMap((pair) => {
    const [longitude, latitude] = pair.trim().split(/\s+/).map(Number);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [[roundCoordinate(latitude), roundCoordinate(longitude)] as [number, number]]
      : [];
  });
}

function numericStat(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sumBuiltUpStat(
  stats: CemsProduct["stats"],
  field: "affected" | "total"
): number | null {
  const entries = stats?.["Built-up"];
  if (!entries) return null;
  const values = Object.values(entries)
    .map((entry) => numericStat(entry[field]))
    .filter((value): value is number => value != null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function normalizeDamageClass(
  value: string | undefined
): "destroyed" | "damaged" | "possibly_damaged" | null {
  if (value === "Destroyed") return "destroyed";
  if (value === "Damaged") return "damaged";
  if (value === "Possibly damaged") return "possibly_damaged";
  return null;
}

function emptyCopernicus() {
  return {
    activationCode: CEMS_ACTIVATION_CODE,
    activationUrl: CEMS_ACTIVATION_URL,
    active: true,
    updatedAt: null,
    areas: [] as OfficialDamageArea[]
  };
}

async function getCopernicusDamage() {
  const response = await fetchJson<CemsResponse>(CEMS_API);
  const activation = response.results?.[0];
  if (!activation) return emptyCopernicus();

  const areaSpecs = (activation.aois ?? []).flatMap((aoi) => {
    const city = cityForCemsAoi(aoi.name);
    if (!city) return [];
    const product = [...(aoi.products ?? [])]
      .filter(
        (candidate) =>
          candidate.type === "GRA" && candidate.version?.statusCode === "F"
      )
      .sort((a, b) => b.monitoringNumber - a.monitoringNumber)[0];
    const deliveredAt = product?.version?.deliveryTime;
    const damageUrl = product?.layers.find((layer) =>
      layer.name.includes("_builtUpP_")
    )?.json;
    if (!product || !deliveredAt || !damageUrl) return [];
    return [
      {
        aoi,
        city,
        product,
        deliveredAt,
        damageUrl,
        roadUrl: product.layers.find((layer) =>
          layer.name.includes("_ancillaryCrisisInfoP_")
        )?.json
      }
    ];
  });

  const areas = await Promise.all(
    areaSpecs.map(async ({ aoi, city, product, deliveredAt, damageUrl, roadUrl }) => {
      const [damageCollection, roadCollection] = await Promise.all([
        fetchJson<FeatureCollection>(damageUrl).catch(() => null),
        roadUrl
          ? fetchJson<FeatureCollection>(roadUrl).catch(() => null)
          : Promise.resolve(null)
      ]);
      const damagePoints = (damageCollection?.features as CemsPointFeature[] | undefined)
        ?.flatMap((feature, index) => {
          const classification = normalizeDamageClass(feature.properties?.damage_gra);
          const [longitude, latitude] = feature.geometry?.coordinates ?? [];
          if (
            !classification ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
          ) {
            return [];
          }
          return [
            {
              id: `cems-${aoi.number}-damage-${index}`,
              city,
              latitude: roundCoordinate(latitude),
              longitude: roundCoordinate(longitude),
              classification,
              method: feature.properties.det_method ?? "Photo-interpretation"
            }
          ];
        }) ?? [];
      const roadBlocks = (roadCollection?.features as CemsPointFeature[] | undefined)
        ?.flatMap((feature, index) => {
          const [longitude, latitude] = feature.geometry?.coordinates ?? [];
          if (
            !feature.properties?.obj_desc?.toLowerCase().includes("blocked road") ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
          ) {
            return [];
          }
          return [
            {
              id: `cems-${aoi.number}-road-${index}`,
              city,
              latitude: roundCoordinate(latitude),
              longitude: roundCoordinate(longitude)
            }
          ];
        }) ?? [];
      return {
        id: `EMSR916-AOI${String(aoi.number).padStart(2, "0")}`,
        city,
        name: aoi.name,
        deliveredAt,
        acquisitionAt: product.images?.[0]?.acquisitionTime ?? null,
        sensor: product.images?.[0]?.sensorName ?? null,
        boundary: parseWktBoundary(aoi.extent),
        affectedBuildings: sumBuiltUpStat(product.stats, "affected"),
        totalBuildings: sumBuiltUpStat(product.stats, "total"),
        damagePoints,
        roadBlocks
      } satisfies OfficialDamageArea;
    })
  );
  const updatedAt = areas.reduce(
    (latest, area) => Math.max(latest, Date.parse(area.deliveredAt) || 0),
    0
  );
  return {
    activationCode: activation.code || CEMS_ACTIVATION_CODE,
    activationUrl: CEMS_ACTIVATION_URL,
    active: !activation.closed,
    updatedAt: updatedAt || null,
    areas
  };
}

function dateOnly(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function yesterdayUtc(): string {
  return dateOnly(Date.now() - 30 * 60 * 60 * 1000);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "user-agent": "PulsoColombia/0.2 (+https://github.com/jussalcedoga/pulso-colombia)" },
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
  const cacheKey = new Request("https://pulso.internal/api/hazards-v2");
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const eventId = env.PRIMARY_EVENT_ID || DEFAULT_EVENT_ID;
  const eventUrl = `${USGS_API}?format=geojson&eventid=${encodeURIComponent(eventId)}`;
  const detail = await fetchJson<UsgsFeature>(eventUrl);
  const shakemap = preferredProduct(detail.properties.products?.shakemap);
  const groundFailure = preferredProduct(detail.properties.products?.["ground-failure"]);
  const dyfi = preferredProduct(detail.properties.products?.dyfi);

  const mmiUrl = contentUrl(shakemap, [
    "download/coverage_mmi_high_res.covjson",
    "download/coverage_mmi_medium_res.covjson",
    "download/coverage_mmi_low_res.covjson"
  ]);
  const dyfiUrl = contentUrl(dyfi, ["dyfi_geo_1km.geojson", "dyfi_geo_10km.geojson"]);

  const eventTime = new Date(detail.properties.time);
  const aftershockUrl =
    `${USGS_API}?format=geojson&starttime=${encodeURIComponent(eventTime.toISOString())}` +
    `&latitude=${detail.geometry.coordinates[1]}&longitude=${detail.geometry.coordinates[0]}` +
    "&maxradiuskm=350&minmagnitude=3&orderby=time&limit=100";

  const [coverage, dyfiCollection, aftershocks, copernicus] = await Promise.all([
    mmiUrl ? fetchJson<CoverageJson>(mmiUrl).catch(() => null) : Promise.resolve(null),
    dyfiUrl ? fetchJson<FeatureCollection>(dyfiUrl).catch(() => null) : Promise.resolve(null),
    fetchJson<FeatureCollection>(aftershockUrl).catch(() => ({
      type: "FeatureCollection" as const,
      features: []
    })),
    getCopernicusDamage().catch(() => emptyCopernicus())
  ]);

  const grid: MmiGrid | null = coverage
    ? {
        x: coverage.domain.axes.x,
        y: coverage.domain.axes.y,
        values: coverage.ranges.MMI.values.map((value) => Number(value))
      }
    : null;
  const modeledCells = modeledCellsForCities(grid);
  const dyfiCells = dyfiCellsForCities(dyfiCollection);

  const rankedCities = cities
    .map((city) => {
      const localDyfi = dyfiCells.filter((cell) => cell.city === city.id);
      const dyfiResponses = localDyfi.reduce((sum, cell) => sum + cell.responses, 0);
      const observedCdi =
        dyfiResponses > 0
          ? Number(
              (
                localDyfi.reduce((sum, cell) => sum + cell.cdi * cell.responses, 0) /
                dyfiResponses
              ).toFixed(1)
            )
          : null;
      return {
        id: city.id,
        name: city.name,
        latitude: city.latitude,
        longitude: city.longitude,
        mmi: sampleGrid(grid, city.latitude, city.longitude),
        observedCdi,
        dyfiResponses
      };
    })
    .sort((a, b) => (b.mmi ?? -1) - (a.mmi ?? -1));

  const bounds = shakemap
    ? {
        minLatitude: Number(shakemap.properties["minimum-latitude"]),
        minLongitude: Number(shakemap.properties["minimum-longitude"]),
        maxLatitude: Number(shakemap.properties["maximum-latitude"]),
        maxLongitude: Number(shakemap.properties["maximum-longitude"])
      }
    : null;

  const aftershockFeatures = (aftershocks.features as UsgsFeature[])
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
      available: Boolean(shakemap && grid),
      updatedAt: shakemap?.updateTime ?? null,
      reviewStatus: shakemap?.properties["review-status"] ?? null,
      maxMmi: shakemap ? Number(shakemap.properties.maxmmi) : null,
      resolutionKm: gridResolutionKm(grid),
      bounds,
      modeledCells
    },
    groundFailure: groundFailure
      ? {
          landslideAlert: groundFailure.properties["landslide-alert"] ?? null,
          liquefactionAlert: groundFailure.properties["liquefaction-alert"] ?? null,
          updatedAt: groundFailure.updateTime
        }
      : null,
    dyfi: {
      available: Boolean(dyfi && dyfiCells.length),
      updatedAt: dyfi?.updateTime ?? null,
      sourceUrl: dyfiUrl,
      resolutionKm: 1,
      cells: dyfiCells
    },
    copernicus,
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
      "x-data-source": "USGS,COPERNICUS-EMS,NASA-GIBS"
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
  const fallbackCities = [
    ["choco", "Chocó / Quibdó", 5.6947, -76.6611, 7.6],
    ["pereira", "Pereira", 4.8087, -75.6906, 7.4],
    ["armenia", "Armenia", 4.5339, -75.6811, 7.4],
    ["manizales", "Manizales", 5.0689, -75.5174, 7.2],
    ["cali", "Cali", 3.4516, -76.532, 6.3]
  ].map(([id, name, latitude, longitude, mmi]) => ({
    id,
    name,
    latitude,
    longitude,
    mmi,
    observedCdi: null,
    dyfiResponses: 0
  }));

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
        resolutionKm: 1,
        bounds: {
          minLatitude: 1.767,
          minLongitude: -79.3,
          maxLatitude: 7.9,
          maxLongitude: -73.133
        },
        modeledCells: []
      },
      groundFailure: {
        landslideAlert: "orange",
        liquefactionAlert: "red",
        updatedAt: 1786452368917
      },
      dyfi: {
        available: false,
        updatedAt: null,
        sourceUrl: null,
        resolutionKm: 1,
        cells: []
      },
      copernicus: emptyCopernicus(),
      cities: fallbackCities,
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
