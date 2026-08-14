import { cellToBoundary } from "h3-js";
import L, { type LatLngExpression, type Map as LeafletMap } from "leaflet";
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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  Tooltip,
  useMap
} from "react-leaflet";
import { CITIES, cityDefinition } from "../data";
import type { TFunction } from "../i18n";
import { scoreColor, summarizeCells } from "../scoring";
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
    if (selectedReport) {
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

function markerSymbol(report: Report): string {
  if (report.postType === "offer") return "+";
  if (report.postType === "update") return "i";
  const symbols: Record<NeedType, string> = {
    water: "W",
    food: "F",
    shelter: "H",
    medical: "+",
    hygiene: "C",
    rescue: "!",
    transport: "T",
    information: "i",
    funds: "$"
  };
  return symbols[report.needTypes[0]] ?? "!";
}

function reportMarker(report: Report, selected: boolean): L.DivIcon {
  const color =
    report.status === "resolved"
      ? "#64717b"
      : report.postType === "offer"
        ? "#167a67"
        : report.postType === "update"
          ? "#2f74a7"
          : report.urgency >= 4
            ? "#c93443"
            : "#d77a26";
  return L.divIcon({
    className: "report-marker-wrap",
    html:
      `<span class="report-dot${selected ? " is-selected" : ""}" ` +
      `style="--marker-color:${color}"><span>${markerSymbol(report)}</span></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
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
  const cells = useMemo(() => summarizeCells(reports), [reports]);

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
          ? cells.map((cell) => {
              const positions = cellToBoundary(cell.h3Cell) as [number, number][];
              const topReport = reports
                .filter((report) => cell.reportIds.includes(report.id))
                .sort((a, b) => b.urgency - a.urgency)[0];
              return (
                <Polygon
                  key={cell.h3Cell}
                  positions={positions as LatLngExpression[]}
                  pathOptions={{
                    color: scoreColor(cell.score),
                    fillColor: scoreColor(cell.score),
                    fillOpacity: 0.08,
                    opacity: 0.9,
                    weight: 2
                  }}
                  eventHandlers={
                    topReport ? { click: () => onReportSelect(topReport) } : undefined
                  }
                >
                  <Tooltip sticky>
                    <strong>{t("communityReports")}</strong>
                    <br />
                    {cell.reportCount === 1
                      ? t("oneReport")
                      : t("reportsLabel", { count: cell.reportCount })}
                  </Tooltip>
                </Polygon>
              );
            })
          : null}

        {layers.reports
          ? reports
              .filter((report) => report.status !== "resolved")
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
