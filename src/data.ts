import type { CityId, NeedType, OfferType } from "./types";

export interface CityDefinition {
  id: CityId;
  name: string;
  nameEn: string;
  center: [number, number];
  zoom: number;
}

export const CITIES: CityDefinition[] = [
  { id: "manizales", name: "Manizales", nameEn: "Manizales", center: [5.0689, -75.5174], zoom: 12 },
  { id: "pereira", name: "Pereira", nameEn: "Pereira", center: [4.8087, -75.6906], zoom: 12 },
  { id: "armenia", name: "Armenia", nameEn: "Armenia", center: [4.5339, -75.6811], zoom: 12 },
  { id: "cali", name: "Cali", nameEn: "Cali", center: [3.4516, -76.532], zoom: 11 },
  {
    id: "choco",
    name: "Chocó / Quibdó",
    nameEn: "Chocó / Quibdó",
    center: [5.6947, -76.6611],
    zoom: 11
  }
];

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
