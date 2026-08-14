import {
  ArrowUpRight,
  BadgeCheck,
  ChevronRight,
  CircleAlert,
  HeartHandshake,
  ListFilter,
  MapPin,
  MapPinned,
  MessageSquarePlus,
  Radio,
  ShieldCheck
} from "lucide-react";
import { useState } from "react";
import { CITIES, NEED_TYPES, OFFICIAL_INFORMATION } from "../data";
import { formatNumber, formatRelativeTime } from "../format";
import type { TFunction } from "../i18n";
import type { LocalAreaPriority } from "../scoring";
import type {
  CityId,
  HazardResponse,
  Language,
  NeedType,
  PostType,
  Report
} from "../types";
import { NeedIcon } from "./NeedIcon";

type PanelTab = "needs" | "areas" | "resources";

interface SidePanelProps {
  t: TFunction;
  language: Language;
  selectedCity: CityId;
  selectedNeed: NeedType | "all";
  selectedPostType: PostType | "all";
  tab: PanelTab;
  reports: Report[];
  hazards: HazardResponse | null;
  localAreas: LocalAreaPriority[];
  onCityChange: (city: CityId) => void;
  onNeedChange: (need: NeedType | "all") => void;
  onPostTypeChange: (postType: PostType | "all") => void;
  onTabChange: (tab: PanelTab) => void;
  onNeedHelp: () => void;
  onOfferHelp: () => void;
  onPostUpdate: () => void;
  onReportSelect: (report: Report) => void;
  onAreaFocus: (latitude: number, longitude: number) => void;
  onSources: () => void;
}

function needLabel(type: NeedType, t: TFunction): string {
  return t(
    {
      water: "needWater",
      food: "needFood",
      shelter: "needShelter",
      medical: "needMedical",
      hygiene: "needHygiene",
      rescue: "needRescue",
      transport: "needTransport",
      information: "needInformation",
      funds: "needFunds"
    }[type] as Parameters<TFunction>[0]
  );
}

export function SidePanel({
  t,
  language,
  selectedCity,
  selectedNeed,
  selectedPostType,
  tab,
  reports,
  hazards,
  localAreas,
  onCityChange,
  onNeedChange,
  onPostTypeChange,
  onTabChange,
  onNeedHelp,
  onOfferHelp,
  onPostUpdate,
  onReportSelect,
  onAreaFocus,
  onSources
}: SidePanelProps) {
  const [localEvidenceFilter, setLocalEvidenceFilter] = useState<
    "all" | "official" | "community"
  >("all");
  const openReports = reports.filter((report) => report.status === "open");
  const filteredReports = reports.filter(
    (report) =>
      (selectedPostType === "all" || report.postType === selectedPostType) &&
      (selectedNeed === "all" || report.needTypes.includes(selectedNeed))
  );
  const selectedOfficialAreas =
    hazards?.copernicus.areas.filter((area) => area.city === selectedCity) ?? [];
  const officialPoints = selectedOfficialAreas.flatMap((area) => area.damagePoints);
  const destroyedBuildings = officialPoints.filter(
    (point) => point.classification === "destroyed"
  ).length;
  const damagedBuildings = officialPoints.filter(
    (point) => point.classification === "damaged"
  ).length;
  const possiblyDamagedBuildings = officialPoints.filter(
    (point) => point.classification === "possibly_damaged"
  ).length;
  const mappedRoadBlocks = selectedOfficialAreas.reduce(
    (sum, area) => sum + area.roadBlocks.length,
    0
  );
  const visibleLocalAreas = localAreas.filter((area) => {
    if (localEvidenceFilter === "official") {
      return area.destroyed + area.damaged + area.possiblyDamaged + area.roadBlocks > 0;
    }
    if (localEvidenceFilter === "community") return area.openReports > 0;
    return true;
  });

  return (
    <aside className="side-panel" id="community-feed">
      <div className="event-summary">
        <div className="event-summary__topline">
          <span className="source-chip source-chip--official">
            <ShieldCheck size={14} aria-hidden="true" />
            {t("evidenceOfficial")}
          </span>
          {hazards ? (
            <span>{formatRelativeTime(hazards.source.updatedAt, language, t)}</span>
          ) : null}
        </div>
        {hazards ? (
          <>
            <div className="event-summary__main">
              <span className="event-magnitude">M {hazards.event.magnitude.toFixed(1)}</span>
              <div>
                <strong>{hazards.event.place}</strong>
                <span>{t("eventDepth", { value: Math.round(hazards.event.depthKm) })}</span>
              </div>
            </div>
            <div className="event-summary__signals">
              {hazards.event.alert === "red" ? (
                <span className="signal signal--critical">
                  <CircleAlert size={14} aria-hidden="true" /> {t("redAlert")}
                </span>
              ) : null}
              {hazards.event.felt ? (
                <span className="signal">
                  <Radio size={14} aria-hidden="true" />
                  {t("eventFelt", { count: formatNumber(hazards.event.felt, language) })}
                </span>
              ) : null}
              {hazards.groundFailure?.landslideAlert ? (
                <span className="signal">
                  <CircleAlert size={14} aria-hidden="true" />
                  {t("landslideAlert", { value: hazards.groundFailure.landslideAlert })}
                </span>
              ) : null}
              {hazards.groundFailure?.liquefactionAlert ? (
                <span className="signal">
                  <CircleAlert size={14} aria-hidden="true" />
                  {t("liquefactionAlert", {
                    value: hazards.groundFailure.liquefactionAlert
                  })}
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <div className="event-summary__loading">{t("loading")}</div>
        )}
      </div>

      <div className="primary-actions">
        <button className="action-button action-button--need" type="button" onClick={onNeedHelp}>
          <CircleAlert size={20} aria-hidden="true" />
          {t("needHelp")}
        </button>
        <button className="action-button action-button--give" type="button" onClick={onOfferHelp}>
          <HeartHandshake size={20} aria-hidden="true" />
          {t("offerHelp")}
        </button>
        <button
          className="action-button action-button--update"
          type="button"
          onClick={onPostUpdate}
          title={t("updateFormTitle")}
        >
          <MessageSquarePlus size={20} aria-hidden="true" />
          <span>{t("postUpdate")}</span>
        </button>
      </div>

      <div className="scope-row">
        <label>
          <span className="sr-only">{t("selectCity")}</span>
          <MapPinned size={17} aria-hidden="true" />
          <select
            value={selectedCity}
            onChange={(event) => onCityChange(event.target.value as CityId)}
          >
            {CITIES.map((city) => (
              <option key={city.id} value={city.id}>
                {language === "es" ? city.name : city.nameEn}
              </option>
            ))}
          </select>
        </label>
        <span>{t("openNeeds", { count: openReports.length })}</span>
      </div>

      <nav className="panel-tabs" aria-label={t("filters")}>
        {(["needs", "areas", "resources"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? "is-active" : ""}
            onClick={() => onTabChange(item)}
            aria-current={tab === item ? "page" : undefined}
          >
            {item === "needs"
              ? t("needsTab")
              : item === "areas"
                ? t("areasTab")
                : t("resourcesTab")}
          </button>
        ))}
      </nav>

      {tab === "needs" ? (
        <>
          <div className="post-type-filter" role="group" aria-label={t("filters")}>
            <button
              type="button"
              className={selectedPostType === "all" ? "is-active" : ""}
              onClick={() => onPostTypeChange("all")}
            >
              {t("filterAll")}
            </button>
            <button
              type="button"
              className={selectedPostType === "need" ? "is-active" : ""}
              onClick={() => onPostTypeChange("need")}
            >
              <CircleAlert size={15} aria-hidden="true" />
              {t("needPost")}
            </button>
            <button
              type="button"
              className={selectedPostType === "offer" ? "is-active" : ""}
              onClick={() => onPostTypeChange("offer")}
            >
              <HeartHandshake size={15} aria-hidden="true" />
              {t("offerPost")}
            </button>
            <button
              type="button"
              className={selectedPostType === "update" ? "is-active" : ""}
              onClick={() => onPostTypeChange("update")}
            >
              <MessageSquarePlus size={15} aria-hidden="true" />
              {t("updatePost")}
            </button>
          </div>
          <div className="need-filter" aria-label={t("filters")}>
            <ListFilter size={16} aria-hidden="true" />
            <button
              type="button"
              className={selectedNeed === "all" ? "is-active" : ""}
              onClick={() => onNeedChange("all")}
            >
              {t("filterAll")}
            </button>
            {NEED_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={selectedNeed === type ? "is-active" : ""}
                onClick={() => onNeedChange(type)}
                title={needLabel(type, t)}
                aria-label={needLabel(type, t)}
              >
                <NeedIcon type={type} size={15} />
              </button>
            ))}
          </div>
          <div className="report-list">
            {filteredReports.length ? (
              filteredReports.map((report) => (
                <button
                  key={report.id}
                  type="button"
                  className={`report-row report-row--${report.status}`}
                  onClick={() => onReportSelect(report)}
                >
                  {report.postType === "need" ? (
                    <span
                      className={`urgency-indicator urgency-${report.urgency}`}
                      aria-label={t("urgencyLevel", { count: report.urgency })}
                    >
                      {report.urgency}
                    </span>
                  ) : report.postType === "offer" ? (
                    <span
                      className="post-kind-indicator post-kind-indicator--offer"
                      aria-label={t("offerPost")}
                    >
                      <HeartHandshake size={17} aria-hidden="true" />
                    </span>
                  ) : (
                    <span
                      className="post-kind-indicator post-kind-indicator--update"
                      aria-label={t("updatePost")}
                    >
                      <MessageSquarePlus size={17} aria-hidden="true" />
                    </span>
                  )}
                  <span className="report-row__content">
                    <span className="report-row__meta">
                      <strong>
                        {report.neighborhood ||
                          CITIES.find((city) => city.id === report.city)?.name}
                      </strong>
                      <span>{formatRelativeTime(report.createdAt, language, t)}</span>
                    </span>
                    <span className="report-row__details">{report.details}</span>
                    <span className="report-row__footer">
                      <span className="need-icon-stack">
                        {report.needTypes.slice(0, 4).map((type) => (
                          <span key={type} title={needLabel(type, t)}>
                            <NeedIcon type={type} size={14} />
                          </span>
                        ))}
                      </span>
                      <span>
                        {report.postType === "offer"
                          ? `${t("offerPost")} · `
                          : report.postType === "update"
                            ? `${t("updatePost")} · `
                            : ""}
                        {report.peopleCount === 1
                          ? t("onePerson")
                          : t("people", { count: report.peopleCount })}
                      </span>
                      {report.author.verified ? (
                        <BadgeCheck
                          size={15}
                          aria-label={t("verifiedRepresentative")}
                        />
                      ) : null}
                      <span className={`status-text status-text--${report.status}`}>
                        {report.postType === "offer"
                          ? report.status === "open"
                            ? t("statusAvailable")
                            : report.status === "matched"
                              ? t("statusCoordinating")
                              : t("statusClosed")
                          : report.postType === "update"
                            ? report.status === "open"
                              ? t("statusPublished")
                              : report.status === "matched"
                                ? t("statusCoordinating")
                                : t("statusClosed")
                            : report.status === "open"
                              ? t("statusOpen")
                              : report.status === "matched"
                                ? t("statusMatched")
                                : t("statusResolved")}
                      </span>
                    </span>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              ))
            ) : (
              <div className="empty-state">
                <MapPinned size={28} aria-hidden="true" />
                <strong>{t("noReportsTitle")}</strong>
                <p>{t("noReportsBody")}</p>
                <button type="button" className="text-button" onClick={onNeedHelp}>
                  {t("needHelp")}
                </button>
              </div>
            )}
          </div>
        </>
      ) : null}

      {tab === "areas" ? (
        <div className="area-list local-area-list">
          <div className="method-note">
            <strong>{t("neighborhoodEvidence")}</strong>
            <p>{t("neighborhoodEvidenceNote")}</p>
            <div className="coverage-status">
              <ShieldCheck size={15} aria-hidden="true" />
              {hazards?.copernicus.areas.some((area) => area.city === selectedCity)
                ? t("officialCoverageAvailable")
                : t("officialMappingPending")}
            </div>
            <button type="button" className="text-button" onClick={onSources}>
              {t("liveSources")}
            </button>
          </div>
          <div className="local-stats-grid" aria-label={t("interactiveStats")}>
            <div>
              <strong>{formatNumber(destroyedBuildings, language)}</strong>
              <span>{t("destroyedBuildings")}</span>
            </div>
            <div>
              <strong>{formatNumber(damagedBuildings, language)}</strong>
              <span>{t("damagedBuildings")}</span>
            </div>
            <div>
              <strong>{formatNumber(possiblyDamagedBuildings, language)}</strong>
              <span>{t("possiblyDamagedBuildings")}</span>
            </div>
            <div>
              <strong>{formatNumber(openReports.length, language)}</strong>
              <span>{t("communityNeeds")}</span>
            </div>
          </div>
          {mappedRoadBlocks ? (
            <div className="road-stat">
              <CircleAlert size={15} aria-hidden="true" />
              {t("blockedRoadsCount", { count: mappedRoadBlocks })}
            </div>
          ) : null}
          <div className="local-evidence-filter" role="group" aria-label={t("filters")}>
            <button
              type="button"
              className={localEvidenceFilter === "all" ? "is-active" : ""}
              onClick={() => setLocalEvidenceFilter("all")}
            >
              {t("filterAll")}
            </button>
            <button
              type="button"
              className={localEvidenceFilter === "official" ? "is-active" : ""}
              onClick={() => setLocalEvidenceFilter("official")}
            >
              {t("officialMappedDamage")}
            </button>
            <button
              type="button"
              className={localEvidenceFilter === "community" ? "is-active" : ""}
              onClick={() => setLocalEvidenceFilter("community")}
            >
              {t("communityNeeds")}
            </button>
          </div>
          {visibleLocalAreas.length ? (
            visibleLocalAreas.slice(0, 30).map((area, index) => (
              <button
                key={area.id}
                type="button"
                className="local-area-row"
                onClick={() => onAreaFocus(area.latitude, area.longitude)}
              >
                <span className="area-row__rank">{index + 1}</span>
                <span className="local-area-row__main">
                  <span className="local-area-row__heading">
                    <strong>
                      {area.neighborhood ||
                        t("mappedSector", { count: index + 1 })}
                    </strong>
                    <span className={`priority-band priority-band--${area.priorityBand}`}>
                      {area.priorityBand === "critical"
                        ? t("priorityCritical")
                        : area.priorityBand === "high"
                          ? t("priorityHigh")
                          : t("priorityActive")}
                    </span>
                  </span>
                  {area.officialAreaName ? (
                    <small>{area.officialAreaName} · Copernicus EMSR916</small>
                  ) : null}
                  <span className="local-evidence-counts">
                    {area.destroyed ? (
                      <span className="damage-count damage-count--destroyed">
                        {t("destroyedCount", { count: area.destroyed })}
                      </span>
                    ) : null}
                    {area.damaged ? (
                      <span className="damage-count damage-count--damaged">
                        {t("damagedCount", { count: area.damaged })}
                      </span>
                    ) : null}
                    {area.possiblyDamaged ? (
                      <span className="damage-count damage-count--possible">
                        {t("possibleCount", { count: area.possiblyDamaged })}
                      </span>
                    ) : null}
                    {area.roadBlocks ? (
                      <span>{t("blockedRoadsCount", { count: area.roadBlocks })}</span>
                    ) : null}
                    {area.openReports ? (
                      <span>
                        {area.openReports === 1
                          ? t("oneReport")
                          : t("reportsLabel", { count: area.openReports })}
                      </span>
                    ) : null}
                  </span>
                  <span className="local-area-row__context">
                    {area.affectedPeople ? (
                      <span>
                        {t("people", {
                          count: formatNumber(area.affectedPeople, language)
                        })}
                      </span>
                    ) : null}
                    {area.modeledMmi != null ? (
                      <span>{t("modeledMmi", { value: area.modeledMmi })}</span>
                    ) : null}
                    {area.observedCdi != null ? (
                      <span>{t("observedCdi", { value: area.observedCdi })}</span>
                    ) : null}
                  </span>
                </span>
                <MapPin size={17} aria-hidden="true" />
              </button>
            ))
          ) : (
            <div className="empty-state">
              <MapPinned size={28} aria-hidden="true" />
              <strong>{t("noLocalEvidenceTitle")}</strong>
              <p>{t("noLocalEvidenceBody")}</p>
              <button type="button" className="text-button" onClick={onNeedHelp}>
                {t("needHelp")}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {tab === "resources" ? (
        <div className="resource-list">
          <div className="resource-emergency">
            <CircleAlert size={21} aria-hidden="true" />
            <div>
              <strong>{t("emergency")}</strong>
              <a href="tel:123">123</a>
            </div>
          </div>
          <h3>{t("officialInfo")}</h3>
          {OFFICIAL_INFORMATION.map((resource) => (
            <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer" className="resource-row">
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                <strong>{resource.name}</strong>
                <small>{resource.domain}</small>
              </span>
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          ))}
          <button className="source-detail-button" type="button" onClick={onSources}>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              <strong>{t("dataSources")}</strong>
              <small>{t("methodology")}</small>
            </span>
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </aside>
  );
}
