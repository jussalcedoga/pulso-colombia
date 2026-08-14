import { cellToLatLng, latLngToCell } from "h3-js";
import { HttpError } from "./http";

export const CITY_IDS = ["manizales", "pereira", "armenia", "cali", "choco"] as const;
export const NEED_TYPES = [
  "water",
  "food",
  "shelter",
  "medical",
  "hygiene",
  "rescue",
  "transport",
  "information",
  "funds"
] as const;
export const OFFER_TYPES = [
  "supplies",
  "transport",
  "shelter",
  "medical",
  "volunteer",
  "funds",
  "other"
] as const;

export function requiredString(
  value: unknown,
  label: string,
  min: number,
  max: number
): string {
  if (typeof value !== "string") {
    throw new HttpError(422, "invalid_field", `${label} no es válido.`);
  }
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length < min || clean.length > max) {
    throw new HttpError(
      422,
      "invalid_field",
      `${label} debe tener entre ${min} y ${max} caracteres.`
    );
  }
  return clean;
}

export function optionalString(value: unknown, max: number): string {
  if (value == null || value === "") return "";
  if (typeof value !== "string") {
    throw new HttpError(422, "invalid_field", "El texto no es válido.");
  }
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length > max) {
    throw new HttpError(422, "invalid_field", `El texto no puede superar ${max} caracteres.`);
  }
  return clean;
}

export function enumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new HttpError(422, "invalid_field", `${label} no es válido.`);
  }
  return value as T[number];
}

export function integerValue(
  value: unknown,
  label: string,
  min: number,
  max: number
): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpError(422, "invalid_field", `${label} no es válido.`);
  }
  return number;
}

export function enumArray<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
  maxItems = 5
): T[number][] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxItems) {
    throw new HttpError(422, "invalid_field", `${label} no es válido.`);
  }
  const unique = [...new Set(value)];
  if (unique.some((item) => typeof item !== "string" || !allowed.includes(item))) {
    throw new HttpError(422, "invalid_field", `${label} contiene una opción no válida.`);
  }
  return unique as T[number][];
}

export function approximateLocation(
  latitudeValue: unknown,
  longitudeValue: unknown
): { h3Cell: string; latitude: number; longitude: number } {
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -5 ||
    latitude > 14 ||
    longitude < -82 ||
    longitude > -66
  ) {
    throw new HttpError(422, "invalid_location", "Selecciona una ubicación válida en Colombia.");
  }
  const h3Cell = latLngToCell(latitude, longitude, 8);
  const [cellLatitude, cellLongitude] = cellToLatLng(h3Cell);
  return {
    h3Cell,
    latitude: Number(cellLatitude.toFixed(6)),
    longitude: Number(cellLongitude.toFixed(6))
  };
}

export function rejectPublicContactInfo(text: string): void {
  const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const phone = /(?:\+?\d[\s().-]*){7,}/;
  if (email.test(text) || phone.test(text)) {
    throw new HttpError(
      422,
      "public_contact_info",
      "No publiques teléfonos ni correos. Las ofertas se envían de forma privada."
    );
  }
}
