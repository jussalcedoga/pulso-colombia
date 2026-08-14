import type { CityId, NeedType, OfferType } from "./types";

export interface CityDefinition {
  id: CityId;
  name: string;
  nameEn: string;
  center: [number, number];
  zoom: number;
  bounds: [[number, number], [number, number]];
}

export const CITIES: CityDefinition[] = [
  {
    id: "manizales",
    name: "Manizales",
    nameEn: "Manizales",
    center: [5.0689, -75.5174],
    zoom: 14,
    bounds: [[4.99, -75.61], [5.16, -75.4]]
  },
  {
    id: "pereira",
    name: "Pereira",
    nameEn: "Pereira",
    center: [4.8087, -75.6906],
    zoom: 14,
    bounds: [[4.71, -75.82], [4.91, -75.59]]
  },
  {
    id: "armenia",
    name: "Armenia",
    nameEn: "Armenia",
    center: [4.5339, -75.6811],
    zoom: 14,
    bounds: [[4.44, -75.79], [4.64, -75.58]]
  },
  {
    id: "cali",
    name: "Cali",
    nameEn: "Cali",
    center: [3.4516, -76.532],
    zoom: 13,
    bounds: [[3.28, -76.67], [3.61, -76.39]]
  },
  {
    id: "choco",
    name: "Chocó / Quibdó",
    nameEn: "Chocó / Quibdó",
    center: [5.6947, -76.6611],
    zoom: 14,
    bounds: [[5.59, -76.78], [5.81, -76.54]]
  }
];

export function cityDefinition(city: CityId): CityDefinition {
  return CITIES.find((item) => item.id === city) ?? CITIES[0];
}

export function isPointInCityBounds(
  city: CityId,
  latitude: number,
  longitude: number
): boolean {
  const [[south, west], [north, east]] = cityDefinition(city).bounds;
  return latitude >= south && latitude <= north && longitude >= west && longitude <= east;
}

export const NEED_TYPES: NeedType[] = [
  "water",
  "food",
  "shelter",
  "medical",
  "hygiene",
  "rescue",
  "transport",
  "information",
  "funds"
];

export const OFFER_TYPES: OfferType[] = [
  "supplies",
  "transport",
  "shelter",
  "medical",
  "volunteer",
  "funds",
  "other"
];

export const OFFICIAL_RESOURCES = [
  {
    id: "crc",
    name: "Cruz Roja Colombiana",
    kind: "national",
    url: "https://www.cruzrojacolombiana.org/",
    domain: "cruzrojacolombiana.org"
  },
  {
    id: "ifrc",
    name: "Federación Internacional de la Cruz Roja",
    kind: "international",
    url: "https://www.ifrc.org/donate",
    domain: "ifrc.org"
  },
  {
    id: "unicef",
    name: "UNICEF Colombia",
    kind: "international",
    url: "https://www.unicef.org/colombia/dona",
    domain: "unicef.org"
  }
] as const;

export const OFFICIAL_INFORMATION = [
  {
    id: "copernicus",
    name: "Copernicus EMSR916",
    url: "https://mapping.emergency.copernicus.eu/activations/EMSR916/",
    domain: "mapping.emergency.copernicus.eu"
  },
  {
    id: "ungrd",
    name: "UNGRD Colombia",
    url: "https://portal.gestiondelriesgo.gov.co/",
    domain: "gestiondelriesgo.gov.co"
  },
  {
    id: "usgs",
    name: "USGS Earthquake Hazards",
    url: "https://earthquake.usgs.gov/",
    domain: "earthquake.usgs.gov"
  }
] as const;

export const MMI_COLORS = [
  { min: 7, color: "#d92f2f", text: "Very strong" },
  { min: 6, color: "#f07b32", text: "Strong" },
  { min: 5, color: "#e9bd2e", text: "Moderate" },
  { min: 4, color: "#55a96b", text: "Light" },
  { min: 0, color: "#7aa6c2", text: "Weak" }
] as const;

export const NEED_COLORS: Record<NeedType, string> = {
  water: "#2d7dd2",
  food: "#d48a15",
  shelter: "#7b61a8",
  medical: "#d9485f",
  hygiene: "#168f88",
  rescue: "#d14a28",
  transport: "#4f6678",
  information: "#3d72a4",
  funds: "#33805a"
};
