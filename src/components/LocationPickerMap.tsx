import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useEffect } from "react";
import { cityDefinition, isPointInCityBounds } from "../data";
import type { CityId } from "../types";

interface LocationPickerMapProps {
  city: CityId;
  location: [number, number] | null;
  urgency: number;
  label: string;
  onChange: (location: [number, number]) => void;
  onInvalid: () => void;
}

function LocationController({
  city,
  location
}: {
  city: CityId;
  location: [number, number] | null;
}) {
  const map = useMap();
  useEffect(() => {
    const definition = cityDefinition(city);
    map.setMaxBounds(definition.bounds);
    map.flyTo(location ?? definition.center, location ? 17 : definition.zoom, {
      duration: 0.45
    });
    window.setTimeout(() => map.invalidateSize(), 50);
  }, [city, location, map]);
  return null;
}

function LocationEvents({
  city,
  onChange,
  onInvalid
}: Pick<LocationPickerMapProps, "city" | "onChange" | "onInvalid">) {
  useMapEvents({
    click(event) {
      if (!isPointInCityBounds(city, event.latlng.lat, event.latlng.lng)) {
        onInvalid();
        return;
      }
      onChange([event.latlng.lat, event.latlng.lng]);
    }
  });
  return null;
}

export function LocationPickerMap({
  city,
  location,
  urgency,
  label,
  onChange,
  onInvalid
}: LocationPickerMapProps) {
  const definition = cityDefinition(city);
  const severityColors = ["#668aa3", "#3f8f63", "#d39a1e", "#df6b2b", "#c93443"];
  const pinIcon = L.divIcon({
    className: "report-marker-wrap",
    html:
      `<span class="report-pin" style="--marker-color:${severityColors[urgency - 1]}">` +
      `<span>${urgency}</span></span>`,
    iconSize: [36, 44],
    iconAnchor: [18, 42]
  });

  return (
    <MapContainer
      center={definition.center}
      zoom={definition.zoom}
      minZoom={12}
      maxZoom={19}
      zoomControl
      attributionControl
      maxBounds={definition.bounds}
      maxBoundsViscosity={0.85}
      className="location-map"
      aria-label={label}
    >
      <LocationController city={city} location={location} />
      <LocationEvents city={city} onChange={onChange} onInvalid={onInvalid} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      {location ? (
        <Marker position={location} icon={pinIcon} />
      ) : null}
    </MapContainer>
  );
}
