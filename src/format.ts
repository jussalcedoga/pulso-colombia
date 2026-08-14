import type { Language } from "./types";
import type { TFunction } from "./i18n";

export function formatRelativeTime(
  date: string | number,
  language: Language,
  t: TFunction
): string {
  const timestamp = typeof date === "number" ? date : new Date(date).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return t("agoMinutes", { count: Math.max(1, minutes) });
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t("agoHours", { count: hours });
  const days = Math.round(hours / 24);
  return t("agoDays", { count: days });
}

export function formatDateTime(timestamp: number, language: Language): string {
  return new Intl.DateTimeFormat(language === "es" ? "es-CO" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota"
  }).format(new Date(timestamp));
}

export function formatNumber(value: number, language: Language): string {
  return new Intl.NumberFormat(language === "es" ? "es-CO" : "en-US").format(value);
}
