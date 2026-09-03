import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  isHome?: boolean;
}

function dotIcon(color: string, size = 15, isHome = false) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:${isHome ? 3 : 2}px solid white;box-shadow:0 1px 5px rgba(0,0,0,.45)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 13);
    } else {
      map.fitBounds(points.map((p) => [p.lat, p.lng] as [number, number]), {
        padding: [40, 40],
      });
    }
  }, [points, map]);
  return null;
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface LeafletMapProps {
  points?: MapPoint[];
  polylinePoints?: [number, number][];
  polylines?: { points: [number, number][]; color: string }[];
  onMapClick?: (lat: number, lng: number) => void;
  center?: [number, number];
  zoom?: number;
  height?: string;
  fit?: boolean;
  selectedId?: string;
  routeColor?: string;
}

export function LeafletMap({
  points = [],
  polylinePoints = [],
  polylines = [],
  onMapClick,
  center = [-30.03, -51.22],
  zoom = 10,
  height = "420px",
  fit = true,
  selectedId,
  routeColor = "#047857",
}: LeafletMapProps) {
  const fitPoints = fit ? points : [];
  return (
    <div style={{ height, width: "100%" }} className="relative z-0 isolate">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onClick={onMapClick} />
        <FitBounds points={fitPoints} />
        {polylinePoints.length > 1 && (
          <Polyline positions={polylinePoints} pathOptions={{ color: routeColor, weight: 3, opacity: 0.8 }} />
        )}
        {polylines.map((pl, i) => (
          <Polyline
            key={`pl-${i}`}
            positions={pl.points}
            pathOptions={{ color: pl.color, weight: 3, opacity: 0.75 }}
          />
        ))}
        {points.map((p, i) => {
          const key = p.label ? `${p.label}-${i}` : `pt-${i}`;
          const isSelected = p.label === selectedId;
          return (
            <Marker
              key={key}
              position={[p.lat, p.lng]}
              icon={dotIcon(p.color ?? "#0f766e", isSelected ? 22 : 15, p.isHome)}
            >
              {p.label && <Popup>{p.label}</Popup>}
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
