import {
  CircleAlert,
  Crosshair,
  Globe2,
  HeartHandshake,
  LoaderCircle,
  LocateFixed,
  MapPin,
  MessageSquarePlus,
  Search,
  ShieldAlert
} from "lucide-react";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { api, ApiRequestError } from "../api";
import { CITIES, isPointInCityBounds, NEED_TYPES } from "../data";
import type { TFunction } from "../i18n";
import type {
  CityId,
  GeocodeResult,
  Language,
  LocationMode,
  NeedType,
  PostType,
  User
} from "../types";
import { LocationPickerMap } from "./LocationPickerMap";
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
  onClose: () => void;
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
  onClose,
  onPublished
}: NeedModalProps) {
  const [postType, setPostType] = useState<PostType>(initialPostType);
  const [locationMode, setLocationMode] = useState<LocationMode>("local");
  const [city, setCity] = useState<CityId>(initialCity || user.city);
  const [neighborhood, setNeighborhood] = useState("");
  const [needTypes, setNeedTypes] = useState<NeedType[]>([]);
  const [urgency, setUrgency] = useState(3);
  const [peopleCount, setPeopleCount] = useState(1);
  const [details, setDetails] = useState("");
  const [location, setLocation] = useState<[number, number] | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [addressResults, setAddressResults] = useState<GeocodeResult[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [locating, setLocating] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const addressSearchInFlight = useRef(false);
  const isRemoteOffer = postType === "offer" && locationMode === "remote";

  const toggleNeed = (type: NeedType) => {
    setNeedTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type]
    );
  };

  const changeCity = (nextCity: CityId) => {
    setCity(nextCity);
    setLocation(null);
    setLocationLabel("");
    setAddressResults([]);
    setError("");
  };

  const chooseLocation = (
    nextLocation: [number, number],
    label = t("mapPointSelected")
  ) => {
    setLocation(nextLocation);
    setLocationLabel(label);
    setAddressResults([]);
    setError("");
  };

  const searchAddress = async () => {
    if (addressSearchInFlight.current) return;
    const query = addressQuery.trim();
    if (query.length < 3) {
      setError(t("addressSearchMinimum"));
      return;
    }
    addressSearchInFlight.current = true;
    setSearchingAddress(true);
    setError("");
    try {
      let result;
      try {
        result = await api.geocode(query, city);
      } catch (caught) {
        if (
          caught instanceof ApiRequestError &&
          caught.code === "geocode_busy"
        ) {
          await new Promise((resolve) => window.setTimeout(resolve, 1_200));
          result = await api.geocode(query, city);
        } else {
          throw caught;
        }
      }
      setAddressResults(result.results);
      if (!result.results.length) setError(t("addressNoResults"));
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.message : t("genericError"));
    } finally {
      addressSearchInFlight.current = false;
      setSearchingAddress(false);
    }
  };

  const handleSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void searchAddress();
  };

  const selectAddress = (result: GeocodeResult) => {
    chooseLocation(
      [result.latitude, result.longitude],
      `${result.label}${result.context ? `, ${result.context}` : ""}`
    );
    if (!neighborhood && result.neighborhood) setNeighborhood(result.neighborhood);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError(t("locationError"));
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: [number, number] = [
          position.coords.latitude,
          position.coords.longitude
        ];
        setLocating(false);
        if (!isPointInCityBounds(city, next[0], next[1])) {
          setError(t("locationOutsideCity"));
          return;
        }
        chooseLocation(next, t("deviceLocationSelected"));
      },
      () => {
        setLocating(false);
        setError(t("locationError"));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 120_000 }
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isRemoteOffer && !location) {
      setError(t("locationPending"));
      return;
    }
    if (!needTypes.length) {
      setError(t("categoryPending"));
      return;
    }
    if (details.trim().length < 10) {
      setError(t("detailsPending"));
      return;
    }
    if (turnstileSiteKey && !turnstileToken) {
      setError(t("securityPending"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.createReport({
        postType,
        locationMode: isRemoteOffer ? "remote" : "local",
        city,
        neighborhood: isRemoteOffer ? "" : neighborhood,
        latitude: location?.[0],
        longitude: location?.[1],
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
        {postType === "offer" ? (
          <fieldset className="field field--wide help-location-choice">
            <legend>{t("helpDeliveryMode")}</legend>
            <div
              className="segmented-control help-location-control"
              role="group"
              aria-label={t("helpDeliveryMode")}
            >
              <button
                type="button"
                className={locationMode === "local" ? "is-active" : ""}
                aria-pressed={locationMode === "local"}
                onClick={() => {
                  setLocationMode("local");
                  setError("");
                }}
              >
                <MapPin size={17} aria-hidden="true" />
                {t("localHelp")}
              </button>
              <button
                type="button"
                className={locationMode === "remote" ? "is-active" : ""}
                aria-pressed={locationMode === "remote"}
                onClick={() => {
                  setLocationMode("remote");
                  setError("");
                }}
              >
                <Globe2 size={17} aria-hidden="true" />
                {t("remoteHelp")}
              </button>
            </div>
            <small>
              {locationMode === "remote"
                ? t("remoteHelpModeNote")
                : t("localHelpModeNote")}
            </small>
          </fieldset>
        ) : null}
        <label className="field">
          <span>{isRemoteOffer ? t("communityToSupport") : t("yourCity")}</span>
          <select
            value={city}
            onChange={(event) => changeCity(event.target.value as CityId)}
          >
            {CITIES.map((item) => (
              <option key={item.id} value={item.id}>
                {language === "es" ? item.name : item.nameEn}
              </option>
            ))}
          </select>
        </label>
        {!isRemoteOffer ? (
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
        ) : (
          <div className="remote-help-context">
            <Globe2 size={19} aria-hidden="true" />
            <span>{t("remoteHelperLocationPrivate")}</span>
          </div>
        )}

        {!isRemoteOffer ? (
          <div className="field field--wide location-field">
          <span>{t("findLocation")}</span>
          <div className="address-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="text"
              value={addressQuery}
              maxLength={120}
              placeholder={t("addressPlaceholder")}
              autoComplete="street-address"
              onChange={(event) => setAddressQuery(event.target.value)}
              onKeyDown={handleSearchKey}
            />
            <button
              type="button"
              onClick={() => void searchAddress()}
              disabled={searchingAddress}
              aria-label={t("searchAddress")}
              title={t("searchAddress")}
            >
              {searchingAddress ? (
                <LoaderCircle className="spin-icon" size={18} aria-hidden="true" />
              ) : (
                <Search size={18} aria-hidden="true" />
              )}
            </button>
          </div>
          {addressResults.length ? (
            <div className="address-results" role="listbox" aria-label={t("addressResults")}>
              {addressResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => selectAddress(result)}
                >
                  <MapPin size={17} aria-hidden="true" />
                  <span>
                    <strong>{result.label}</strong>
                    <small>{result.context}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="location-tools">
            <button
              className="button button--secondary"
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
            >
              {locating ? (
                <LoaderCircle className="spin-icon" size={17} aria-hidden="true" />
              ) : (
                <LocateFixed size={17} aria-hidden="true" />
              )}
              {locating ? t("locating") : t("locateMe")}
            </button>
            <span>
              <Crosshair size={15} aria-hidden="true" />
              {t("mapClickFallback")}
            </span>
          </div>
          <LocationPickerMap
            city={city}
            location={location}
            urgency={postType === "need" ? urgency : 3}
            label={t("locationMap")}
            onChange={(nextLocation) => chooseLocation(nextLocation)}
            onInvalid={() => setError(t("locationOutsideCity"))}
          />
          <div className={`location-status${location ? " is-selected" : ""}`}>
            <MapPin size={17} aria-hidden="true" />
            <span>
              <strong>{location ? t("selectedLocation") : t("locationPending")}</strong>
              <small>
                {location
                  ? `${locationLabel} · ${t("publicCellPreview")}`
                  : t("locationSelectionHint")}
              </small>
            </span>
          </div>
          <small className="geocoder-credit">
            {t("addressSearchCredit")}{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap
            </a>
          </small>
          </div>
        ) : null}

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
          <p
            className={`need-selection-summary${needTypes.length ? " is-active" : ""}`}
            aria-live="polite"
          >
            {needTypes.length
              ? t("needsSelected", {
                  count: needTypes.length,
                  needs: needTypes.map((type) => needLabel(type, t)).join(", ")
                })
              : t("selectMultipleNeeds")}
          </p>
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
            disabled={submitting}
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
