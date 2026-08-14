import { cellToBoundary, latLngToCell } from "h3-js";
import type { LatLngExpression } from "leaflet";
import { CircleMarker, MapContainer, Polygon, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useEffect } from "react";
import { cityDefinition, isPointInCityBounds } from "../data";
import type { CityId } from "../types";

interface LocationPickerMapProps {
  city: CityId;
  location: [number, number] | null;
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
  label,
  onChange,
  onInvalid
}: LocationPickerMapProps) {
  const definition = cityDefinition(city);
  const publicCell = location
    ? (cellToBoundary(latLngToCell(location[0], location[1], 9)) as [number, number][])
    : [];

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
      {publicCell.length ? (
        <Polygon
          positions={publicCell as LatLngExpression[]}
          pathOptions={{
            color: "#0f6c5b",
            fillColor: "#32a68c",
            fillOpacity: 0.16,
            weight: 2
          }}
        />
      ) : null}
      {location ? (
        <CircleMarker
          center={location}
          radius={7}
          pathOptions={{
            color: "#ffffff",
            fillColor: "#0f6c5b",
            fillOpacity: 1,
            weight: 3
          }}
        />
      ) : null}
    </MapContainer>
  );
}
