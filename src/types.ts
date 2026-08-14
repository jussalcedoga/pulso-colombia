export type Language = "es" | "en";
export type CityId = "manizales" | "pereira" | "armenia" | "cali" | "choco";
export type PostType = "need" | "offer" | "update";
export type LocationMode = "local" | "remote";
export type NeedType =
  | "water"
  | "food"
  | "shelter"
  | "medical"
  | "hygiene"
  | "rescue"
  | "transport"
  | "information"
  | "funds";
export type OfferType =
  | "supplies"
  | "transport"
  | "shelter"
  | "medical"
  | "volunteer"
  | "funds"
  | "other";
export type ReportStatus = "open" | "matched" | "resolved";
export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn";

export interface User {
  id: string;
  displayName: string;
  city: CityId;
  accountType: "resident" | "volunteer" | "sponsor";
  role: "resident" | "volunteer" | "representative" | "moderator";
  verified: boolean;
}

export interface Report {
  id: string;
  userId: string;
  postType: PostType;
  locationMode: LocationMode;
  city: CityId;
  neighborhood: string;
  h3Cell: string;
  latitude: number;
  longitude: number;
  needTypes: NeedType[];
  urgency: number;
  peopleCount: number;
  details: string;
  status: ReportStatus;
  confirmations: number;
  createdAt: string;
  updatedAt: string;
  author: {
    displayName: string;
    accountType: User["accountType"];
    role: User["role"];
    verified: boolean;
  };
}

export interface PublicConfig {
  turnstileSiteKey: string | null;
}

export interface Offer {
  id: string;
  reportId: string;
  direction: "received" | "sent";
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  offerType: OfferType;
  message: string;
  responseMessage: string;
  status: OfferStatus;
  canChat: boolean;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  report: {
    postType: PostType;
    city: CityId;
    neighborhood: string;
    details: string;
  };
}

export interface ChatMessage {
  id: number;
  offerId: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
  mine: boolean;
}

export interface ReportComment {
  id: number;
  reportId: string;
  authorName: string;
  authorVerified: boolean;
  message: string;
  createdAt: string;
  mine: boolean;
}

export interface PublicEvent {
  id: string;
  magnitude: number;
  place: string;
  title: string;
  time: number;
  updated: number;
  status: string | null;
  alert: string | null;
  felt: number | null;
  reportedIntensity: number | null;
  instrumentalIntensity: number | null;
  significance: number | null;
  url: string;
  longitude: number;
  latitude: number;
  depthKm: number;
}

export interface MmiGrid {
  x: { start: number; stop: number; num: number };
  y: { start: number; stop: number; num: number };
  values: number[];
}

export interface MmiEvidenceCell {
  id: string;
  city: CityId;
  bounds: [number, number, number, number];
  mmi: number;
}

export interface DyfiEvidenceCell {
  id: string;
  city: CityId;
  bounds: [number, number, number, number];
  cdi: number;
  responses: number;
  standardDeviation: number | null;
}

export type DamageClassification =
  | "destroyed"
  | "damaged"
  | "possibly_damaged";

export interface OfficialDamagePoint {
  id: string;
  city: CityId;
  latitude: number;
  longitude: number;
  classification: DamageClassification;
  method: string;
}

export interface OfficialRoadBlock {
  id: string;
  city: CityId;
  latitude: number;
  longitude: number;
}

export interface OfficialDamageArea {
  id: string;
  city: CityId;
  name: string;
  deliveredAt: string;
  acquisitionAt: string | null;
  sensor: string | null;
  boundary: [number, number][];
  affectedBuildings: number | null;
  totalBuildings: number | null;
  damagePoints: OfficialDamagePoint[];
  roadBlocks: OfficialRoadBlock[];
}

export interface GeocodeResult {
  id: string;
  label: string;
  context: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
}

export interface HazardResponse {
  source: {
    name: string;
    url: string;
    updatedAt: number;
    fallback?: boolean;
  };
  event: PublicEvent;
  aftershocks: PublicEvent[];
  shakemap: {
    available: boolean;
    updatedAt: number | null;
    reviewStatus: string | null;
    maxMmi: number | null;
    resolutionKm: number | null;
    bounds: {
      minLatitude: number;
      minLongitude: number;
      maxLatitude: number;
      maxLongitude: number;
    } | null;
    modeledCells: MmiEvidenceCell[];
  };
  groundFailure: {
    landslideAlert: string | null;
    liquefactionAlert: string | null;
    updatedAt: number;
  } | null;
  dyfi: {
    available: boolean;
    updatedAt: number | null;
    sourceUrl: string | null;
    resolutionKm: number;
    cells: DyfiEvidenceCell[];
  };
  copernicus: {
    activationCode: string;
    activationUrl: string;
    active: boolean;
    updatedAt: number | null;
    areas: OfficialDamageArea[];
  };
  cities: {
    id: CityId;
    name: string;
    latitude: number;
    longitude: number;
    mmi: number | null;
    observedCdi: number | null;
    dyfiResponses: number;
  }[];
  satellite: {
    provider: string;
    layer: string;
    eventDate: string;
    latestSuggestedDate: string;
    maxNativeZoom: number;
    resolutionNote: string;
  };
}

export type ModalName =
  | "auth"
  | "need"
  | "donate"
  | "inbox"
  | "sources"
  | "recovery"
  | null;
