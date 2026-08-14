import { cellToBoundary } from "h3-js";
import L, { type LatLngExpression, type Map as LeafletMap } from "leaflet";
import {
  CircleMarker,
  GeoJSON,
  ImageOverlay,
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents
} from "react-leaflet";
import {
  CalendarDays,
  Crosshair,
  Layers3,
  LocateFixed,
  Minus,
  Plus,
  Satellite,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CITIES } from "../data";
import type { TFunction } from "../i18n";
import { scoreColor, summarizeCells } from "../scoring";
import type { CityId, HazardResponse, Report } from "../types";

interface MapLayers {
  satellite: boolean;
  shaking: boolean;
  reports: boolean;
  aftershocks: boolean;
}

interface MapViewProps {
  t: TFunction;
  selectedCity: CityId | "all";
  reports: Report[];
  hazards: HazardResponse | null;
  selectedReportId: string | null;
  layers: MapLayers;
  satelliteDate: string;
  pickingLocation: boolean;
  pendingLocation: [number, number] | null;
  onLayersChange: (layers: MapLayers) => void;
  onSatelliteDateChange: (date: string) => void;
  onReportSelect: (report: Report) => void;
  onLocationPick: (location: [number, number]) => void;
  onLocationError: () => void;
}

function MapController({
  selectedCity,
  mapRef
}: {
  selectedCity: CityId | "all";
  mapRef: React.MutableRefObject<LeafletMap | null>;
}) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  useEffect(() => {
    if (selectedCity === "all") {
      map.flyTo([4.85, -75.95], 8, { duration: 0.7 });
      return;
    }
    const city = CITIES.find((item) => item.id === selectedCity);
    if (city) map.flyTo(city.center, city.zoom, { duration: 0.7 });
  }, [map, selectedCity]);

  return null;
}

function MapEvents({
  picking,
  onPick
}: {
  picking: boolean;
  onPick: (location: [number, number]) => void;
}) {
  useMapEvents({
    click(event) {
      if (picking) onPick([event.latlng.lat, event.latlng.lng]);
    }
  });
  return null;
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
  const content =
    report.postType === "offer"
      ? "+"
      : report.postType === "update"
        ? "i"
        : String(report.urgency);
  return L.divIcon({
    className: "report-marker-wrap",
    html: `<span class="report-marker${report.postType !== "need" ? " report-marker--social" : ""}${selected ? " is-selected" : ""}" style="--marker-color:${color}"><span>${content}</span></span>`,
    iconSize: [34, 40],
    iconAnchor: [17, 36]
  });
}

export function MapView({
  t,
  selectedCity,
  reports,
  hazards,
  selectedReportId,
  layers,
  satelliteDate,
  pickingLocation,
  pendingLocation,
  onLayersChange,
  onSatelliteDateChange,
  onReportSelect,
  onLocationPick,
  onLocationError
}: MapViewProps) {
  const [layersOpen, setLayersOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);
  const cells = useMemo(
    () => summarizeCells(reports, hazards?.shakemap.grid),
    [hazards?.shakemap.grid, reports]
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
        const location: [number, number] = [
          position.coords.latitude,
          position.coords.longitude
        ];
        mapRef.current?.flyTo(location, 14, { duration: 0.7 });
        if (pickingLocation) onLocationPick(location);
        setLocating(false);
      },
      () => {
        setLocating(false);
        onLocationError();
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 120_000 }
    );
  };

  const overlayBounds =
    hazards?.shakemap.bounds &&
    ([
      [hazards.shakemap.bounds.minLatitude, hazards.shakemap.bounds.minLongitude],
      [hazards.shakemap.bounds.maxLatitude, hazards.shakemap.bounds.maxLongitude]
    ] as L.LatLngBoundsExpression);

  return (
    <section
      className={`map-shell${pickingLocation ? " map-shell--picking" : ""}`}
      aria-label={t("map")}
    >
      <MapContainer
        center={[4.85, -75.95]}
        zoom={8}
        minZoom={6}
        maxZoom={18}
        zoomControl={false}
        className="map"
        preferCanvas
      >
        <MapController selectedCity={selectedCity} mapRef={mapRef} />
        <MapEvents picking={pickingLocation} onPick={onLocationPick} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
        />
        {layers.satellite && satelliteDate ? (
          <TileLayer
            key={satelliteDate}
            url={satelliteUrl}
            attribution="NASA EOSDIS GIBS"
            maxNativeZoom={hazards?.satellite.maxNativeZoom ?? 9}
            maxZoom={18}
            opacity={0.76}
            noWrap
          />
        ) : null}
        {layers.shaking &&
        hazards?.shakemap.intensityOverlayUrl &&
        overlayBounds ? (
          <ImageOverlay
            url={hazards.shakemap.intensityOverlayUrl}
            bounds={overlayBounds}
            opacity={0.47}
            crossOrigin
          />
        ) : null}
        {layers.shaking && hazards?.shakemap.contours ? (
          <GeoJSON
            key={`${hazards.event.id}-${hazards.shakemap.updatedAt}`}
            data={hazards.shakemap.contours}
            style={(feature) => ({
              color: String(feature?.properties?.color ?? "#324e62"),
              weight: Math.min(3, Number(feature?.properties?.weight ?? 2)),
              opacity: 0.78
            })}
            onEachFeature={(feature, layer) => {
              const value = feature.properties?.value;
              if (value != null) layer.bindTooltip(t("mmiLabel", { value }));
            }}
          />
        ) : null}
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
                    fillOpacity: 0.2 + (cell.score / 100) * 0.28,
                    weight: 1.5
                  }}
                  eventHandlers={topReport ? { click: () => onReportSelect(topReport) } : undefined}
                >
                  <Tooltip sticky>
                    <strong>{t("prioritySignal")}: {cell.score}</strong>
                    <br />
                    {cell.mmi != null ? t("mmiLabel", { value: cell.mmi }) : t("noOfficialMmi")}
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
            radius={12}
            pathOptions={{ color: "#ffffff", fillColor: "#d92f3d", fillOpacity: 1, weight: 3 }}
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
                  zIndexOffset={
                    report.id === selectedReportId
                      ? 1000
                      : report.postType === "need"
                        ? report.urgency * 10
                        : 5
                  }
                >
                  <Tooltip direction="top" offset={[0, -28]}>
                    <strong>{report.neighborhood || CITIES.find((city) => city.id === report.city)?.name}</strong>
                    <br />
                    {report.postType === "offer"
                      ? t("offerPost")
                      : report.postType === "update"
                        ? t("updatePost")
                        : t("urgencyLevel", { count: report.urgency })}
                  </Tooltip>
                </Marker>
              ))
          : null}
        {pendingLocation ? (
          <CircleMarker
            center={pendingLocation}
            radius={10}
            pathOptions={{ color: "#ffffff", fillColor: "#167e73", fillOpacity: 1, weight: 4 }}
          />
        ) : null}
      </MapContainer>

      {pickingLocation ? (
        <div className="map-pick-banner" role="status">
          <Crosshair size={18} aria-hidden="true" />
          {t("mapInstruction")}
        </div>
      ) : null}

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
            <span><Satellite size={17} aria-hidden="true" />{t("satellite")}</span>
            <input
              type="checkbox"
              checked={layers.satellite}
              onChange={(event) => onLayersChange({ ...layers, satellite: event.target.checked })}
            />
          </label>
          {layers.satellite ? (
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
            <span>{t("shaking")}</span>
            <input
              type="checkbox"
              checked={layers.shaking}
              onChange={(event) => onLayersChange({ ...layers, shaking: event.target.checked })}
            />
          </label>
          <label className="toggle-row">
            <span>{t("communityNeeds")}</span>
            <input
              type="checkbox"
              checked={layers.reports}
              onChange={(event) => onLayersChange({ ...layers, reports: event.target.checked })}
            />
          </label>
          <label className="toggle-row">
            <span>{t("aftershocks")}</span>
            <input
              type="checkbox"
              checked={layers.aftershocks}
              onChange={(event) => onLayersChange({ ...layers, aftershocks: event.target.checked })}
            />
          </label>
          {layers.satellite ? <p>{t("satelliteResolution")}</p> : null}
        </div>
      ) : null}

      <div className="map-attribution-note">
        <span className={`live-dot${hazards?.source.fallback ? " live-dot--cached" : ""}`} aria-hidden="true" />
        {hazards?.source.fallback ? t("sourceCached") : t("sourceOnline")}
      </div>
    </section>
  );
}
