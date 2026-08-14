import {
  ArrowUpRight,
  BadgeCheck,
  ChevronRight,
  CircleAlert,
  Globe2,
  HeartHandshake,
  ListFilter,
  MapPin,
  MapPinned,
  MessageSquarePlus,
  ShieldCheck
} from "lucide-react";
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

function reportAreaLabel(
  report: Report,
  language: Language,
  t: TFunction
): string {
  const city = CITIES.find((item) => item.id === report.city);
  const cityName = language === "es" ? city?.name : city?.nameEn;
  return report.locationMode === "remote"
    ? t("remoteHelpFor", { city: cityName ?? "" })
    : report.neighborhood || cityName || "";
}

export function SidePanel({
  t,
  language,
  selectedCity,
  selectedNeed,
  selectedPostType,
  tab,
  reports,
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
  const openReports = reports.filter((report) => report.status === "open");
  const filteredReports = reports.filter(
    (report) =>
      (selectedPostType === "all" || report.postType === selectedPostType) &&
      (selectedNeed === "all" || report.needTypes.includes(selectedNeed))
  );
  const visibleLocalAreas = localAreas.filter((area) => area.openReports > 0);
  const affectedPeople = visibleLocalAreas.reduce(
    (sum, area) => sum + area.affectedPeople,
    0
  );

  return (
    <aside className="side-panel" id="community-feed">
      <div className="event-summary">
        <div className="event-summary__topline">
          <span className="source-chip source-chip--official">
            <MapPin size={14} aria-hidden="true" />
            {t("evidenceCommunity")}
          </span>
        </div>
        <div className="event-summary__main">
          <span className="event-magnitude">{openReports.length}</span>
          <div>
            <strong>{t("openNeeds", { count: openReports.length })}</strong>
            <span>{t("communityHubIntro")}</span>
          </div>
        </div>
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
                      aria-label={
                        report.locationMode === "remote"
                          ? t("remoteHelp")
                          : t("offerPost")
                      }
                    >
                      {report.locationMode === "remote" ? (
                        <Globe2 size={17} aria-hidden="true" />
                      ) : (
                        <HeartHandshake size={17} aria-hidden="true" />
                      )}
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
                      <strong>{reportAreaLabel(report, language, t)}</strong>
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
                          ? `${t(
                              report.locationMode === "remote"
                                ? "remoteHelp"
                                : "offerPost"
                            )} · `
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
          </div>
          <div className="local-stats-grid" aria-label={t("interactiveStats")}>
            <div>
              <strong>{formatNumber(openReports.length, language)}</strong>
              <span>{t("communityNeeds")}</span>
            </div>
            <div>
              <strong>{formatNumber(affectedPeople, language)}</strong>
              <span>{t("peopleLabel")}</span>
            </div>
            <div>
              <strong>
                {visibleLocalAreas.filter((area) => area.criticalNeeds > 0).length}
              </strong>
              <span>{t("urgentSectors")}</span>
            </div>
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
                  <span className="local-evidence-counts">
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
                    {area.criticalNeeds ? (
                      <span>{t("urgentReports", { count: area.criticalNeeds })}</span>
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
