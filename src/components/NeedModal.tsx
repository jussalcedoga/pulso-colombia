import {
  CircleAlert,
  Crosshair,
  HeartHandshake,
  MapPin,
  MessageSquarePlus,
  ShieldAlert
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { api, ApiRequestError } from "../api";
import { CITIES, NEED_TYPES } from "../data";
import type { TFunction } from "../i18n";
import type { CityId, Language, NeedType, PostType, User } from "../types";
import { Modal } from "./Modal";
import { NeedIcon } from "./NeedIcon";
import { TurnstileWidget } from "./TurnstileWidget";

interface NeedModalProps {
  t: TFunction;
  language: Language;
  user: User;
  initialCity: CityId;
  initialPostType: PostType;
  turnstileSiteKey: string | null;
  location: [number, number] | null;
  onClose: () => void;
  onChooseLocation: (postType: PostType) => void;
  onPublished: (postType: PostType) => void;
}

function needLabel(type: NeedType, t: TFunction): string {
  const keys: Record<NeedType, Parameters<TFunction>[0]> = {
    water: "needWater",
    food: "needFood",
    shelter: "needShelter",
    medical: "needMedical",
    hygiene: "needHygiene",
    rescue: "needRescue",
    transport: "needTransport",
    information: "needInformation",
    funds: "needFunds"
  };
  return t(keys[type]);
}

export function NeedModal({
  t,
  language,
  user,
  initialCity,
  initialPostType,
  turnstileSiteKey,
  location,
  onClose,
  onChooseLocation,
  onPublished
}: NeedModalProps) {
  const [postType, setPostType] = useState<PostType>(initialPostType);
  const [city, setCity] = useState<CityId>(initialCity || user.city);
  const [neighborhood, setNeighborhood] = useState("");
  const [needTypes, setNeedTypes] = useState<NeedType[]>([]);
  const [urgency, setUrgency] = useState(3);
  const [peopleCount, setPeopleCount] = useState(1);
  const [details, setDetails] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const canSubmit = useMemo(
    () =>
      Boolean(
        location &&
          needTypes.length &&
          details.trim().length >= 10 &&
          (!turnstileSiteKey || turnstileToken)
      ),
    [details, location, needTypes.length, turnstileSiteKey, turnstileToken]
  );

  const toggleNeed = (type: NeedType) => {
    setNeedTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : current.length < 5
          ? [...current, type]
          : current
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!location) {
      setError(t("locationPending"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.createReport({
        postType,
        city,
        neighborhood,
        latitude: location[0],
        longitude: location[1],
        needTypes,
        urgency: postType === "need" ? urgency : 1,
        peopleCount: postType === "update" ? 1 : peopleCount,
        details,
        turnstileToken
      });
      onPublished(postType);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : t("genericError"));
      if (turnstileSiteKey) setTurnstileReset((value) => value + 1);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        postType === "need"
          ? t("needFormTitle")
          : postType === "offer"
            ? t("offerFormTitle")
            : t("updateFormTitle")
      }
      t={t}
      onClose={onClose}
      size="large"
    >
      <div className="segmented-control post-type-control">
        <button
          type="button"
          className={postType === "need" ? "is-active" : ""}
          onClick={() => setPostType("need")}
        >
          <CircleAlert size={17} aria-hidden="true" />
          {t("needPost")}
        </button>
        <button
          type="button"
          className={postType === "offer" ? "is-active" : ""}
          onClick={() => setPostType("offer")}
        >
          <HeartHandshake size={17} aria-hidden="true" />
          {t("offerPost")}
        </button>
        <button
          type="button"
          className={postType === "update" ? "is-active" : ""}
          onClick={() => setPostType("update")}
        >
          <MessageSquarePlus size={17} aria-hidden="true" />
          {t("updatePost")}
        </button>
      </div>
      <p className="modal-intro">
        {postType === "need"
          ? t("needFormIntro")
          : postType === "offer"
            ? t("offerFormIntro")
            : t("updateFormIntro")}
      </p>
      <form className="form-grid" onSubmit={submit}>
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
        <label className="field">
          <span>{t("neighborhood")}</span>
          <input
            type="text"
            value={neighborhood}
            maxLength={60}
            placeholder={t("neighborhoodPlaceholder")}
            onChange={(event) => setNeighborhood(event.target.value)}
          />
        </label>

        <div className="field field--wide">
          <span>{t("approximateLocation")}</span>
          {location ? (
            <button
              className="location-selected"
              type="button"
              onClick={() => onChooseLocation(postType)}
            >
              <MapPin size={19} aria-hidden="true" />
              <span>
                <strong>{t("selectedLocation")}</strong>
                <small>{t("approximateLocation")}</small>
              </span>
              <Crosshair size={18} aria-hidden="true" />
            </button>
          ) : (
            <button
              className="location-picker"
              type="button"
              onClick={() => onChooseLocation(postType)}
            >
              <Crosshair size={19} aria-hidden="true" />
              {t("chooseLocation")}
            </button>
          )}
        </div>

        <fieldset className="field field--wide">
          <legend>
            {postType === "need"
              ? t("needs")
              : postType === "offer"
                ? t("offerCategories")
                : t("updateCategories")}
          </legend>
          <div className="choice-grid">
            {NEED_TYPES.map((type) => (
              <label key={type} className={needTypes.includes(type) ? "choice is-selected" : "choice"}>
                <input
                  type="checkbox"
                  checked={needTypes.includes(type)}
                  onChange={() => toggleNeed(type)}
                />
                <NeedIcon type={type} size={18} />
                <span>{needLabel(type, t)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {postType !== "update" ? (
          <label className="field">
            <span>{postType === "need" ? t("affectedPeople") : t("peopleCanHelp")}</span>
            <input
              type="number"
              min={1}
              max={10_000}
              value={peopleCount}
              onChange={(event) => setPeopleCount(Number(event.target.value))}
              required
            />
          </label>
        ) : null}

        {postType === "need" ? (
          <label className="field urgency-field">
            <span>{t("urgencyQuestion")}</span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={urgency}
              onChange={(event) => setUrgency(Number(event.target.value))}
            />
            <span className="range-labels">
              <small>{t("urgency1")}</small>
              <strong className={`urgency-value urgency-${urgency}`}>{urgency}</strong>
              <small>{t("urgency5")}</small>
            </span>
          </label>
        ) : (
          <div
            className={`offer-form-context${postType === "update" ? " field--wide" : ""}`}
          >
            {postType === "offer" ? (
              <HeartHandshake size={22} aria-hidden="true" />
            ) : (
              <MessageSquarePlus size={22} aria-hidden="true" />
            )}
            <span>{t("offerExcludedFromRisk")}</span>
          </div>
        )}

        <label className="field field--wide">
          <span>{t("details")}</span>
          <textarea
            rows={4}
            minLength={10}
            maxLength={postType === "update" ? 420 : 700}
            value={details}
            placeholder={
              postType === "need"
                ? t("detailsPlaceholder")
                : postType === "offer"
                  ? t("offerDetailsPlaceholder")
                  : t("updateDetailsPlaceholder")
            }
            onChange={(event) => setDetails(event.target.value)}
            required
          />
          <small className="char-count">
            {t("charCount", {
              count: details.length,
              max: postType === "update" ? 420 : 700
            })}
          </small>
        </label>

        <div className="privacy-note field--wide">
          <ShieldAlert size={19} aria-hidden="true" />
          <span>{t("privacyWarning")}</span>
        </div>
        {postType === "update" ? (
          <div className="safety-callout fundraiser-callout field--wide">
            <ShieldAlert size={19} aria-hidden="true" />
            <span>{t("fundraiserSafety")}</span>
          </div>
        ) : null}
        <div className="field--wide">
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            action="report"
            language={language}
            label={t("securityCheck")}
            resetSignal={turnstileReset}
            onTokenChange={setTurnstileToken}
            onUnavailable={() => setError(t("securityCheckError"))}
          />
        </div>
        {error ? <div className="form-error field--wide" role="alert">{error}</div> : null}
        <div className="form-actions field--wide">
          <button className="button button--secondary" type="button" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            className={`button ${
              postType === "need"
                ? "button--need"
                : postType === "offer"
                  ? "button--give"
                  : "button--primary"
            }`}
            type="submit"
            disabled={!canSubmit || submitting}
          >
            {submitting
              ? t("publishing")
              : postType === "need"
                ? t("publishReport")
                : postType === "offer"
                  ? t("publishOffer")
                  : t("publishUpdate")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
