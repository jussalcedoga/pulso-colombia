export type Language = "es" | "en";
export type CityId = "manizales" | "pereira" | "armenia" | "cali" | "choco";
export type PostType = "need" | "offer" | "update";
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
    bounds: {
      minLatitude: number;
      minLongitude: number;
      maxLatitude: number;
      maxLongitude: number;
    } | null;
    intensityOverlayUrl: string | null;
    contours: GeoJSON.FeatureCollection | null;
    grid: MmiGrid | null;
  };
  groundFailure: {
    landslideAlert: string | null;
    liquefactionAlert: string | null;
    updatedAt: number;
  } | null;
  communityIntensityUrl: string | null;
  cities: {
    id: CityId;
    name: string;
    latitude: number;
    longitude: number;
    mmi: number | null;
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
