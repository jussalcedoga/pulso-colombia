import L, { type Map as LeafletMap } from "leaflet";
import {
  CircleAlert,
  ExternalLink,
  HeartHandshake,
  Layers3,
  LocateFixed,
  MapPinned,
  Minus,
  Plus,
  Satellite,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap
} from "react-leaflet";
import { CITIES, cityDefinition } from "../data";
import type { TFunction } from "../i18n";
import type { CityId, NeedType, Report } from "../types";

export interface MapLayers {
  base: "imagery" | "streets";
  reports: boolean;
}

interface MapViewProps {
  t: TFunction;
  selectedCity: CityId;
  reports: Report[];
  selectedReportId: string | null;
  focusedLocation: [number, number] | null;
  layers: MapLayers;
  onCityChange: (city: CityId) => void;
  onLayersChange: (layers: MapLayers) => void;
  onReportSelect: (report: Report) => void;
  onLocationError: () => void;
  onNeedHelp: () => void;
  onOfferHelp: () => void;
}

function MapController({
  selectedCity,
  selectedReport,
  focusedLocation,
  mapRef
}: {
  selectedCity: CityId;
  selectedReport: Report | null;
  focusedLocation: [number, number] | null;
  mapRef: React.MutableRefObject<LeafletMap | null>;
}) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  useEffect(() => {
    const city = cityDefinition(selectedCity);
    map.flyTo(city.center, city.zoom, { duration: 0.45 });
  }, [map, selectedCity]);

  useEffect(() => {
    if (selectedReport && selectedReport.locationMode === "local") {
      map.flyTo([selectedReport.latitude, selectedReport.longitude], 17, {
        duration: 0.45
      });
    }
  }, [map, selectedReport]);

  useEffect(() => {
    if (focusedLocation) map.flyTo(focusedLocation, 16, { duration: 0.45 });
  }, [focusedLocation, map]);

  return null;
}

function reportMarker(report: Report, selected: boolean): L.DivIcon {
  const severityColors = ["#668aa3", "#3f8f63", "#d39a1e", "#df6b2b", "#c93443"];
  const color = report.status === "resolved"
    ? "#64717b"
    : report.postType === "offer"
      ? "#167a67"
      : report.postType === "update"
        ? "#2f74a7"
        : severityColors[report.urgency - 1] ?? severityColors[2];
  const label =
    report.postType === "need"
      ? String(report.urgency)
      : report.postType === "offer"
        ? "+"
        : "i";
  return L.divIcon({
    className: "report-marker-wrap",
    html:
      `<span class="report-pin${selected ? " is-selected" : ""}" ` +
      `style="--marker-color:${color}"><span>${label}</span></span>`,
    iconSize: [36, 44],
    iconAnchor: [18, 42]
  });
}

function needSummary(report: Report, t: TFunction): string {
  const labels: Record<NeedType, Parameters<TFunction>[0]> = {
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
  return report.needTypes
    .slice(0, 3)
    .map((type) => t(labels[type]))
    .join(" · ");
}

export function MapView({
  t,
  selectedCity,
  reports,
  selectedReportId,
  focusedLocation,
  layers,
  onCityChange,
  onLayersChange,
  onReportSelect,
  onLocationError,
  onNeedHelp,
  onOfferHelp
}: MapViewProps) {
  const [layersOpen, setLayersOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const selectedReport =
    reports.find((report) => report.id === selectedReportId) ?? null;
  const city = cityDefinition(selectedCity);
  const locate = () => {
    if (!navigator.geolocation) {
      onLocationError();
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        mapRef.current?.flyTo(
          [position.coords.latitude, position.coords.longitude],
          17,
          { duration: 0.45 }
        );
        setLocating(false);
      },
      () => {
        setLocating(false);
        onLocationError();
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 120_000 }
    );
  };

  return (
    <section className="map-shell" aria-label={t("map")}>
      <MapContainer
        center={city.center}
        zoom={city.zoom}
        minZoom={6}
        maxZoom={20}
        maxBounds={[[-4.5, -79.5], [13.8, -66.5]]}
        maxBoundsViscosity={0.65}
        zoomControl={false}
        className="map"
        preferCanvas
      >
        <MapController
          selectedCity={selectedCity}
          selectedReport={selectedReport}
          focusedLocation={focusedLocation}
          mapRef={mapRef}
        />

        {layers.base === "streets" ? (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={19}
          />
        ) : (
          <>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Imagery &copy; Esri and contributors"
              maxNativeZoom={19}
              maxZoom={20}
            />
            <TileLayer
              url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
              attribution="Reference &copy; Esri"
              maxNativeZoom={19}
              maxZoom={20}
            />
          </>
        )}

        {layers.reports
          ? reports
              .filter(
                (report) =>
                  report.status !== "resolved" && report.locationMode === "local"
              )
              .map((report) => (
                <Marker
                  key={report.id}
                  position={[report.latitude, report.longitude]}
                  icon={reportMarker(report, report.id === selectedReportId)}
                  eventHandlers={{ click: () => onReportSelect(report) }}
                  zIndexOffset={report.id === selectedReportId ? 1000 : 20}
                >
                  <Tooltip direction="top" offset={[0, -14]}>
                    <strong>{report.neighborhood || city.name}</strong>
                    <br />
                    {report.postType === "offer"
                      ? t("offerPost")
                      : report.postType === "update"
                        ? t("updatePost")
                        : needSummary(report, t)}
                    {report.postType === "need" ? (
                      <>
                        <br />
                        {t("urgencyLevel", { count: report.urgency })}
                      </>
                    ) : null}
                  </Tooltip>
                </Marker>
              ))
          : null}
      </MapContainer>

      <label className="map-city-selector">
        <MapPinned size={18} aria-hidden="true" />
        <span className="sr-only">{t("selectCity")}</span>
        <select
          value={selectedCity}
          onChange={(event) => onCityChange(event.target.value as CityId)}
        >
          {CITIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <div className="map-controls map-controls--left">
        <button
          className="map-control-button"
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label={t("zoomIn")}
          title={t("zoomIn")}
        >
          <Plus size={19} aria-hidden="true" />
        </button>
        <button
          className="map-control-button"
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label={t("zoomOut")}
          title={t("zoomOut")}
        >
          <Minus size={19} aria-hidden="true" />
        </button>
      </div>

      <div className="map-controls map-controls--right">
        <button
          className={`map-control-button${locating ? " is-loading" : ""}`}
          type="button"
          onClick={locate}
          aria-label={locating ? t("locating") : t("locateMe")}
          title={t("locateMe")}
        >
          <LocateFixed size={19} aria-hidden="true" />
        </button>
        <button
          className={`map-control-button${layersOpen ? " is-active" : ""}`}
          type="button"
          onClick={() => setLayersOpen((open) => !open)}
          aria-label={t("mapLayers")}
          aria-expanded={layersOpen}
          title={t("mapLayers")}
        >
          <Layers3 size={19} aria-hidden="true" />
        </button>
      </div>

      <div className="map-style-switch" role="group" aria-label={t("baseMap")}>
        <button
          type="button"
          className={layers.base === "streets" ? "is-active" : ""}
          onClick={() => onLayersChange({ ...layers, base: "streets" })}
          aria-pressed={layers.base === "streets"}
        >
          <MapPinned size={16} aria-hidden="true" />
          {t("streetMap")}
        </button>
        <button
          type="button"
          className={layers.base === "imagery" ? "is-active" : ""}
          onClick={() => onLayersChange({ ...layers, base: "imagery" })}
          aria-pressed={layers.base === "imagery"}
        >
          <Satellite size={16} aria-hidden="true" />
          {t("referenceImagery")}
        </button>
      </div>

      <a
        className="map-evidence-strip map-reference-link"
        href={CEMS_ACTIVATION_URL}
        target="_blank"
        rel="noreferrer"
      >
        {t("officialMapReference")}
        <ExternalLink size={14} aria-hidden="true" />
      </a>

      {layersOpen ? (
        <div className="layer-panel">
          <header>
            <span>
              <Layers3 size={17} aria-hidden="true" />
              {t("mapLayers")}
            </span>
            <button
              className="icon-button icon-button--small"
              type="button"
              onClick={() => setLayersOpen(false)}
              aria-label={t("close")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>
          <label className="toggle-row">
            <span>{t("communityReports")}</span>
            <input
              type="checkbox"
              checked={layers.reports}
              onChange={(event) =>
                onLayersChange({ ...layers, reports: event.target.checked })
              }
            />
          </label>
          <div className="severity-legend" aria-label={t("severityLegend")}>
            <strong>{t("urgency")}</strong>
            <span><i className="severity-swatch severity-swatch--1" />1</span>
            <span><i className="severity-swatch severity-swatch--2" />2</span>
            <span><i className="severity-swatch severity-swatch--3" />3</span>
            <span><i className="severity-swatch severity-swatch--4" />4</span>
            <span><i className="severity-swatch severity-swatch--5" />5</span>
          </div>
          <a
            className="layer-reference-link"
            href={CEMS_ACTIVATION_URL}
            target="_blank"
            rel="noreferrer"
          >
            {t("officialMapReference")}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      ) : null}

      <div className="map-mobile-actions">
        <button type="button" className="button button--need" onClick={onNeedHelp}>
          <CircleAlert size={18} aria-hidden="true" />
          {t("needHelp")}
        </button>
        <button type="button" className="button button--give" onClick={onOfferHelp}>
          <HeartHandshake size={18} aria-hidden="true" />
          {t("offerHelp")}
        </button>
      </div>
    </section>
  );
}

const CEMS_ACTIVATION_URL =
  "https://mapping.emergency.copernicus.eu/activations/EMSR916/";
