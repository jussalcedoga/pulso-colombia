import { Building2, HandHeart, KeyRound, Shield, UserRound, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, ApiRequestError } from "../api";
import { CITIES } from "../data";
import type { TFunction } from "../i18n";
import type { CityId, Language, User } from "../types";
import { Modal } from "./Modal";
import { TurnstileWidget } from "./TurnstileWidget";

interface AuthModalProps {
  t: TFunction;
  language: Language;
  initialCity: CityId;
  turnstileSiteKey: string | null;
  onClose: () => void;
  onSuccess: (user: User, recoveryCode?: string) => void;
}

export function AuthModal({
  t,
  language,
  initialCity,
  turnstileSiteKey,
  onClose,
  onSuccess
}: AuthModalProps) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState<CityId>(initialCity);
  const [accountType, setAccountType] = useState<User["accountType"]>("resident");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (mode === "register") {
        const result = await api.register(
          displayName,
          city,
          accountType,
          turnstileToken
        );
        onSuccess(result.user, result.recoveryCode);
      } else {
        const result = await api.login(recoveryCode);
        onSuccess(result.user);
      }
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : t("genericError"));
      if (mode === "register" && turnstileSiteKey) {
        setTurnstileReset((value) => value + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={t("authTitle")} t={t} onClose={onClose} size="small">
      <div className="auth-intro">
        <Shield size={21} aria-hidden="true" />
        <p>{t("authIntro")}</p>
      </div>
      <div className="segmented-control" role="tablist" aria-label={t("authTitle")}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={mode === "register" ? "is-active" : ""}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          <UserPlus size={17} aria-hidden="true" />
          {t("createAccount")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? "is-active" : ""}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          <KeyRound size={17} aria-hidden="true" />
          {t("restoreAccount")}
        </button>
      </div>
      <form className="form-stack" onSubmit={submit}>
        {mode === "register" ? (
          <>
            <label className="field">
              <span>{t("displayName")}</span>
              <input
                type="text"
                autoComplete="nickname"
                minLength={2}
                maxLength={60}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                autoFocus
              />
              <small>{t("displayNameHint")}</small>
            </label>
            <label className="field">
              <span>{t("yourCity")}</span>
              <select value={city} onChange={(event) => setCity(event.target.value as CityId)}>
                {CITIES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {language === "es" ? item.name : item.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="field">
              <legend>{t("accountType")}</legend>
              <div className="account-type-grid">
                {(
                  [
                    ["resident", UserRound, t("accountResident")],
                    ["volunteer", HandHeart, t("accountVolunteer")],
                    ["sponsor", Building2, t("accountSponsor")]
                  ] as const
                ).map(([value, Icon, label]) => (
                  <label
                    key={value}
                    className={`account-type-option${accountType === value ? " is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="accountType"
                      value={value}
                      checked={accountType === value}
                      onChange={() => setAccountType(value)}
                    />
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <small>{t("accountTypeNote")}</small>
            </fieldset>
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              action="register"
              language={language}
              label={t("securityCheck")}
              resetSignal={turnstileReset}
              onTokenChange={setTurnstileToken}
              onUnavailable={() => setError(t("securityCheckError"))}
            />
          </>
        ) : (
          <label className="field">
            <span>{t("recoveryCode")}</span>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={recoveryCode}
              placeholder={t("recoveryPlaceholder")}
              onChange={(event) => setRecoveryCode(event.target.value)}
              required
              autoFocus
            />
          </label>
        )}
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <button
          className="button button--primary button--full"
          type="submit"
          disabled={
            submitting ||
            (mode === "register" && Boolean(turnstileSiteKey) && !turnstileToken)
          }
        >
          {submitting
            ? mode === "register"
              ? t("creating")
              : t("loggingIn")
            : t("continue")}
        </button>
      </form>
    </Modal>
  );
}
