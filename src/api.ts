import type {
  ChatMessage,
  CityId,
  HazardResponse,
  NeedType,
  Offer,
  OfferStatus,
  OfferType,
  PostType,
  PublicConfig,
  Report,
  ReportStatus,
  User
} from "./types";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  headers.set("x-pulso-language", document.documentElement.lang === "en" ? "en" : "es");
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin"
  });
  if (!response.ok) {
    let message = "Request failed";
    let code = "request_failed";
    try {
      const body = (await response.json()) as { error?: string; code?: string };
      message = body.error || message;
      code = body.code || code;
    } catch {
      // The status still provides a useful failure path.
    }
    throw new ApiRequestError(message, code, response.status);
  }
  return (await response.json()) as T;
}

export const api = {
  health: () => request<{ ok: boolean; time: string }>("/api/health"),
  config: () => request<PublicConfig>("/api/config"),
  hazards: () => request<HazardResponse>("/api/hazards"),
  me: () => request<{ user: User | null }>("/api/me"),
  reports: (city?: CityId | "all") =>
    request<{ reports: Report[] }>(
      `/api/reports${city && city !== "all" ? `?city=${encodeURIComponent(city)}` : ""}`
    ),
  register: (
    displayName: string,
    city: CityId,
    accountType: User["accountType"],
    turnstileToken = ""
  ) =>
    request<{ user: User; recoveryCode: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ displayName, city, accountType, turnstileToken })
    }),
  login: (recoveryCode: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ recoveryCode })
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  createReport: (payload: {
    postType: PostType;
    city: CityId;
    neighborhood: string;
    latitude: number;
    longitude: number;
    needTypes: NeedType[];
    urgency: number;
    peopleCount: number;
    details: string;
    turnstileToken?: string;
  }) =>
    request<{ id: string }>("/api/reports", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateReport: (id: string, status: ReportStatus) =>
    request<{ ok: boolean }>(`/api/reports/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }),
  confirmReport: (id: string) =>
    request<{ ok: boolean; changed: boolean }>(
      `/api/reports/${encodeURIComponent(id)}/confirm`,
      { method: "POST", body: "{}" }
    ),
  flagReport: (id: string, reason: string) =>
    request<{ ok: boolean; changed: boolean }>(
      `/api/reports/${encodeURIComponent(id)}/flag`,
      { method: "POST", body: JSON.stringify({ reason }) }
    ),
  sendOffer: (reportId: string, offerType: OfferType, message: string) =>
    request<{ id: string }>(`/api/reports/${encodeURIComponent(reportId)}/offers`, {
      method: "POST",
      body: JSON.stringify({ offerType, message })
    }),
  inbox: () => request<{ offers: Offer[] }>("/api/inbox"),
  updateOffer: (
    id: string,
    status: Extract<OfferStatus, "accepted" | "declined" | "withdrawn">,
    responseMessage = ""
  ) =>
    request<{ ok: boolean }>(`/api/offers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, responseMessage })
    }),
  chatMessages: (offerId: string, after = 0) =>
    request<{ messages: ChatMessage[] }>(
      `/api/offers/${encodeURIComponent(offerId)}/messages?after=${after}`
    ),
  sendChatMessage: (offerId: string, message: string) =>
    request<{ message: ChatMessage }>(
      `/api/offers/${encodeURIComponent(offerId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ message })
      }
    )
};
