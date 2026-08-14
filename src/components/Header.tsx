import {
  Languages,
  LogIn,
  LogOut,
  Mail,
  PhoneCall,
  Radio
} from "lucide-react";
import type { TFunction } from "../i18n";
import type { HazardResponse, Language, User } from "../types";

interface HeaderProps {
  t: TFunction;
  language: Language;
  user: User | null;
  hazards: HazardResponse | null;
  inboxCount: number;
  onLanguageChange: (language: Language) => void;
  onAuth: () => void;
  onLogout: () => void;
  onInbox: () => void;
}

export function Header({
  t,
  language,
  user,
  hazards,
  inboxCount,
  onLanguageChange,
  onAuth,
  onLogout,
  onInbox
}: HeaderProps) {
  return (
    <>
      <a className="skip-link" href="#community-feed">
        {t("skipToFeed")}
      </a>
      <header className="app-header">
        <div className="brand" aria-label={`${t("appName")} ${t("appCountry")}`}>
          <span className="brand__mark" aria-hidden="true">
            <img src="/pulso-mark.svg" alt="" width="36" height="36" />
          </span>
          <span className="brand__name">
            {t("appName")} <strong>{t("appCountry")}</strong>
          </span>
          <span className="brand__tagline">{t("appTagline")}</span>
        </div>

        {hazards ? (
          <a
            className="event-status"
            href={hazards.event.url}
            target="_blank"
            rel="noreferrer"
            title={t("openOfficialSource")}
          >
            <Radio size={15} aria-hidden="true" />
            <span>M {hazards.event.magnitude.toFixed(1)}</span>
            <span className="event-status__place">{hazards.event.place}</span>
            <span className="event-status__verified">{t("verifiedEvent")}</span>
          </a>
        ) : (
          <span className="event-status event-status--loading">
            <Radio size={15} aria-hidden="true" />
            {t("eventFallback")}
          </span>
        )}

        <div className="app-header__actions">
          <a className="emergency-link" href="tel:123">
            <PhoneCall size={16} aria-hidden="true" />
            <span>{t("emergency")}</span>
          </a>
          {user ? (
            <button
              className="header-action"
              type="button"
              onClick={onInbox}
              aria-label={inboxCount ? t("messagesCount", { count: inboxCount }) : t("inbox")}
              title={t("inbox")}
            >
              <Mail size={19} aria-hidden="true" />
              {inboxCount > 0 ? <span className="notification-count">{Math.min(99, inboxCount)}</span> : null}
            </button>
          ) : null}
          <div className="language-switch" role="group" aria-label={t("language")}>
            <Languages size={17} aria-hidden="true" />
            <button
              type="button"
              className={language === "es" ? "is-active" : ""}
              onClick={() => onLanguageChange("es")}
              aria-pressed={language === "es"}
            >
              ES
            </button>
            <button
              type="button"
              className={language === "en" ? "is-active" : ""}
              onClick={() => onLanguageChange("en")}
              aria-pressed={language === "en"}
            >
              EN
            </button>
          </div>
          <button
            className="account-button"
            type="button"
            onClick={user ? onLogout : onAuth}
            title={user ? t("signOut") : t("signIn")}
          >
            {user ? <LogOut size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
            <span>{user ? user.displayName : t("signIn")}</span>
          </button>
        </div>
      </header>
    </>
  );
}
