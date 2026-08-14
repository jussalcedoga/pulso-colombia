import { cellToBoundary } from "h3-js";
import L, { type LatLngExpression, type Map as LeafletMap } from "leaflet";
import {
  CalendarDays,
  CircleAlert,
  Crosshair,
  ExternalLink,
  HeartHandshake,
  Layers3,
  LocateFixed,
  MapPinned,
  Minus,
  Plus,
  Satellite,
  ShieldCheck,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Rectangle,
  TileLayer,
  Tooltip,
  useMap
} from "react-leaflet";
import { CITIES, cityDefinition } from "../data";
import type { TFunction } from "../i18n";
import { scoreColor, summarizeCells } from "../scoring";
import type {
  CityId,
  DamageClassification,
  HazardResponse,
  Language,
  NeedType,
  Report
} from "../types";

export interface MapLayers {
  base: "imagery" | "streets";
  nasa: boolean;
  modeled: boolean;
  observed: boolean;
  officialDamage: boolean;
  reports: boolean;
  aftershocks: boolean;
}

interface MapViewProps {
  t: TFunction;
  language: Language;
  selectedCity: CityId;
  reports: Report[];
  hazards: HazardResponse | null;
  selectedReportId: string | null;
  focusedLocation: [number, number] | null;
  layers: MapLayers;
  satelliteDate: string;
  onCityChange: (city: CityId) => void;
  onLayersChange: (layers: MapLayers) => void;
  onSatelliteDateChange: (date: string) => void;
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
    map.flyTo(city.center, city.zoom, { duration: 0.6 });
  }, [map, selectedCity]);

  useEffect(() => {
    if (selectedReport) {
      map.flyTo([selectedReport.latitude, selectedReport.longitude], 17, {
        duration: 0.55
      });
    }
  }, [map, selectedReport]);

  useEffect(() => {
    if (focusedLocation) map.flyTo(focusedLocation, 16, { duration: 0.55 });
  }, [focusedLocation, map]);

  return null;
}

function markerSymbol(report: Report): string {
  if (report.postType === "offer") return "+";
  if (report.postType === "update") return "i";
  const symbols: Record<NeedType, string> = {
    water: "💧",
    food: "●",
    shelter: "⌂",
    medical: "+",
    hygiene: "✦",
    rescue: "!",
    transport: "↗",
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

function mmiColor(mmi: number): string {
  if (mmi >= 8) return "#bf1e2e";
  if (mmi >= 7) return "#e64b2e";
  if (mmi >= 6) return "#ed8b2f";
  if (mmi >= 5) return "#d4ad28";
  return "#4b9166";
}

function damageColor(classification: DamageClassification): string {
  if (classification === "destroyed") return "#ff0000";
  if (classification === "damaged") return "#e69800";
  return "#e4cc00";
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
  language,
  selectedCity,
  reports,
  hazards,
  selectedReportId,
  focusedLocation,
  layers,
  satelliteDate,
  onCityChange,
  onLayersChange,
  onSatelliteDateChange,
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
  const cityHazard = hazards?.cities.find((item) => item.id === selectedCity);
  const officialAreas =
    hazards?.copernicus.areas.filter((area) => area.city === selectedCity) ?? [];
  const officialDamageCount = officialAreas.reduce(
    (sum, area) => sum + area.damagePoints.length,
    0
  );
  const officialRoadCount = officialAreas.reduce(
    (sum, area) => sum + area.roadBlocks.length,
    0
  );
  const modeledCells =
    hazards?.shakemap.modeledCells.filter((cell) => cell.city === selectedCity) ?? [];
  const observedCells =
    hazards?.dyfi.cells.filter((cell) => cell.city === selectedCity) ?? [];
  const cells = useMemo(
    () => summarizeCells(reports, modeledCells),
    [modeledCells, reports]
  );
  const satelliteUrl =
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/` +
    `VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${satelliteDate}/` +
    "GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg";

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
          { duration: 0.55 }
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
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Imagery &copy; Esri and contributors"
            maxNativeZoom={19}
            maxZoom={20}
          />
        )}

        {layers.nasa && satelliteDate ? (
          <TileLayer
            key={satelliteDate}
            url={satelliteUrl}
            attribution="NASA EOSDIS GIBS"
            maxNativeZoom={hazards?.satellite.maxNativeZoom ?? 9}
            maxZoom={20}
            opacity={0.58}
            noWrap
          />
        ) : null}

        {layers.base === "imagery" || layers.nasa ? (
          <>
            <TileLayer
              url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
              attribution="Reference &copy; Esri"
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
        ) : null}

        {layers.modeled
          ? modeledCells.map((cell) => (
              <Rectangle
                key={cell.id}
                bounds={[
                  [cell.bounds[0], cell.bounds[1]],
                  [cell.bounds[2], cell.bounds[3]]
                ]}
                pathOptions={{
                  color: mmiColor(cell.mmi),
                  fillColor: mmiColor(cell.mmi),
                  fillOpacity: 0.11,
                  opacity: 0.65,
                  weight: 1
                }}
              >
                <Tooltip sticky>
                  <strong>{t("modeledMmi", { value: cell.mmi })}</strong>
                  <br />
                  {t("modelCellResolution", {
                    value: hazards?.shakemap.resolutionKm ?? 1
                  })}
                  <br />
                  {t("notObservedDamage")}
                </Tooltip>
              </Rectangle>
            ))
          : null}

        {layers.observed
          ? observedCells.map((cell) => (
              <Rectangle
                key={cell.id}
                bounds={[
                  [cell.bounds[0], cell.bounds[1]],
                  [cell.bounds[2], cell.bounds[3]]
                ]}
                pathOptions={{
                  color: "#2c6f99",
                  fillColor: "#69a8cb",
                  fillOpacity: 0.08,
                  opacity: 0.9,
                  dashArray: "5 4",
                  weight: 1.5
                }}
              >
                <Tooltip sticky>
                  <strong>{t("observedCdi", { value: cell.cdi })}</strong>
                  <br />
                  {t("dyfiResponses", { count: cell.responses })}
                  <br />
                  {t("feltNotDamage")}
                </Tooltip>
              </Rectangle>
            ))
          : null}

        {layers.officialDamage
          ? officialAreas.map((area) => (
              <Polygon
                key={area.id}
                positions={area.boundary as LatLngExpression[]}
                pathOptions={{
                  color: "#136886",
                  fillOpacity: 0,
                  opacity: 0.9,
                  dashArray: "7 5",
                  weight: 2
                }}
              >
                <Tooltip sticky>
                  <strong>{t("officialMappedArea")}: {area.name}</strong>
                  <br />
                  {t("copernicusAcquisition", {
                    sensor: area.sensor ?? "VHR",
                    date: new Date(area.acquisitionAt ?? area.deliveredAt).toLocaleDateString(
                      language
                    )
                  })}
                </Tooltip>
              </Polygon>
            ))
          : null}

        {layers.officialDamage
          ? officialAreas.flatMap((area) =>
              area.damagePoints.map((point) => (
                <CircleMarker
                  key={point.id}
                  center={[point.latitude, point.longitude]}
                  radius={5}
                  pathOptions={{
                    color: point.classification === "possibly_damaged" ? "#665d00" : "#ffffff",
                    fillColor: damageColor(point.classification),
                    fillOpacity: 0.95,
                    weight: 1.5
                  }}
                >
                  <Tooltip>
                    <strong>
                      {point.classification === "destroyed"
                        ? t("destroyedBuilding")
                        : point.classification === "damaged"
                          ? t("damagedBuilding")
                          : t("possiblyDamagedBuilding")}
                    </strong>
                    <br />
                    {t("copernicusPhotoInterpretation")}
                    <br />
                    {area.name} · {hazards?.copernicus.activationCode}
                  </Tooltip>
                </CircleMarker>
              ))
            )
          : null}

        {layers.officialDamage
          ? officialAreas.flatMap((area) =>
              area.roadBlocks.map((road) => (
                <CircleMarker
                  key={road.id}
                  center={[road.latitude, road.longitude]}
                  radius={6}
                  pathOptions={{
                    color: "#ffffff",
                    fillColor: "#20272c",
                    fillOpacity: 1,
                    weight: 2
                  }}
                >
                  <Tooltip>
                    <strong>{t("blockedRoad")}</strong>
                    <br />
                    {t("copernicusPhotoInterpretation")}
                  </Tooltip>
                </CircleMarker>
              ))
            )
          : null}

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
                    <strong>{t("communityPriority")}</strong>
                    <br />
                    {cell.mmi != null
                      ? t("modeledMmi", { value: cell.mmi })
                      : t("noOfficialMmi")}
                    <br />
                    {cell.reportCount === 1
                      ? t("oneReport")
                      : t("reportsLabel", { count: cell.reportCount })}
                  </Tooltip>
                </Polygon>
              );
            })
          : null}

        {layers.aftershocks
          ? hazards?.aftershocks.map((event) => (
              <CircleMarker
                key={event.id}
                center={[event.latitude, event.longitude]}
                radius={Math.max(4, (event.magnitude - 2.5) * 2.5)}
                pathOptions={{
                  color: "#1b2730",
                  fillColor: "#f3c44f",
                  fillOpacity: 0.78,
                  weight: 1.5
                }}
              >
                <Tooltip>
                  M {event.magnitude.toFixed(1)} · {event.place}
                </Tooltip>
              </CircleMarker>
            ))
          : null}

        {hazards ? (
          <CircleMarker
            center={[hazards.event.latitude, hazards.event.longitude]}
            radius={10}
            pathOptions={{
              color: "#ffffff",
              fillColor: "#d92f3d",
              fillOpacity: 1,
              weight: 3
            }}
          >
            <Tooltip>
              <strong>M {hazards.event.magnitude.toFixed(1)}</strong>
              <br />
              {hazards.event.place}
            </Tooltip>
          </CircleMarker>
        ) : null}

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
              {language === "es" ? item.name : item.nameEn}
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
          className={layers.base === "imagery" ? "is-active" : ""}
          onClick={() => onLayersChange({ ...layers, base: "imagery" })}
          aria-pressed={layers.base === "imagery"}
        >
          <Satellite size={16} aria-hidden="true" />
          {t("referenceImagery")}
        </button>
        <button
          type="button"
          className={layers.base === "streets" ? "is-active" : ""}
          onClick={() => onLayersChange({ ...layers, base: "streets" })}
          aria-pressed={layers.base === "streets"}
        >
          <MapPinned size={16} aria-hidden="true" />
          {t("streetMap")}
        </button>
      </div>

      <div className="map-evidence-strip">
        <span className="evidence-strip__source">
          <ShieldCheck size={16} aria-hidden="true" />
          {officialDamageCount
            ? t("officialDamageFindings", { count: officialDamageCount })
            : t("officialMappingPending")}
        </span>
        <span>
          {cityHazard?.mmi != null
            ? t("modeledMmi", { value: cityHazard.mmi })
            : t("noOfficialMmi")}
        </span>
        <span>
          {cityHazard?.dyfiResponses
            ? t("dyfiResponses", { count: cityHazard.dyfiResponses })
            : t("noDyfiResponses")}
        </span>
        {officialRoadCount ? (
          <span>{t("blockedRoadsCount", { count: officialRoadCount })}</span>
        ) : null}
        <a
          href={hazards?.copernicus.activationUrl ?? CEMS_ACTIVATION_URL}
          target="_blank"
          rel="noreferrer"
          title={t("openOfficialSource")}
        >
          {hazards?.copernicus.activationCode ?? "EMSR916"}
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>

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
            <span><ShieldCheck size={17} aria-hidden="true" />{t("officialDamageLayer")}</span>
            <input
              type="checkbox"
              checked={layers.officialDamage}
              onChange={(event) =>
                onLayersChange({ ...layers, officialDamage: event.target.checked })
              }
            />
          </label>
          <label className="toggle-row">
            <span>{t("communityNeeds")}</span>
            <input
              type="checkbox"
              checked={layers.reports}
              onChange={(event) =>
                onLayersChange({ ...layers, reports: event.target.checked })
              }
            />
          </label>
          <label className="toggle-row">
            <span>{t("observedShaking")}</span>
            <input
              type="checkbox"
              checked={layers.observed}
              onChange={(event) =>
                onLayersChange({ ...layers, observed: event.target.checked })
              }
            />
          </label>
          <label className="toggle-row">
            <span>{t("modeledShaking")}</span>
            <input
              type="checkbox"
              checked={layers.modeled}
              onChange={(event) =>
                onLayersChange({ ...layers, modeled: event.target.checked })
              }
            />
          </label>
          <label className="toggle-row">
            <span><Satellite size={17} aria-hidden="true" />{t("nasaDailyImagery")}</span>
            <input
              type="checkbox"
              checked={layers.nasa}
              onChange={(event) =>
                onLayersChange({ ...layers, nasa: event.target.checked })
              }
            />
          </label>
          {layers.nasa ? (
            <label className="layer-date">
              <span><CalendarDays size={16} aria-hidden="true" />{t("satelliteDate")}</span>
              <input
                type="date"
                min={hazards?.satellite.eventDate}
                max={hazards?.satellite.latestSuggestedDate}
                value={satelliteDate}
                onChange={(event) => onSatelliteDateChange(event.target.value)}
              />
            </label>
          ) : null}
          <label className="toggle-row">
            <span>{t("aftershocks")}</span>
            <input
              type="checkbox"
              checked={layers.aftershocks}
              onChange={(event) =>
                onLayersChange({ ...layers, aftershocks: event.target.checked })
              }
            />
          </label>
          <p>
            {layers.nasa ? t("satelliteResolution") : t("layerEvidenceNote")}
          </p>
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
