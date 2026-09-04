import { useEffect, useRef, type ReactNode } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

export interface MapPoint {
  id?: string;
  lat: number;
  lng: number;
  /** nome exibido no popup quando `popup` não é informado */
  label?: string;
  /** conteúdo do tooltip ao passar o mouse sobre o ponto */
  tooltip?: ReactNode;
  /** cartão aberto ao clicar no ponto (quando ausente, usa `label`) */
  popup?: ReactNode;
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

function clusterIcon(count: number) {
  const size = count < 10 ? 38 : count < 100 ? 46 : 54;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:hsl(175 72% 28% / 0.92);border:2px solid rgba(255,255,255,.9);color:#fff;font-weight:700;font-size:${count < 100 ? 12 : 11}px;box-shadow:0 1px 8px rgba(0,0,0,.35)">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  const lastSig = useRef<string | null>(null);
  useEffect(() => {
    if (points.length === 0) return;
    const sig = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
    // evita reajustar o enquadramento quando só a cor/dados do ponto muda
    if (lastSig.current === sig) return;
    lastSig.current = sig;
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
  /** agrupa pontos próximos em um círculo com contagem (zoom automático ao clicar) */
  cluster?: boolean;
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
  cluster = false,
}: LeafletMapProps) {
  const fitPoints = fit ? points : [];

  const markers = points.map((p, i) => {
    const key = p.id ?? (p.label ? `${p.label}-${i}` : `pt-${i}`);
    const isSelected = p.label === selectedId;
    return (
      <Marker
        key={key}
        position={[p.lat, p.lng]}
        icon={dotIcon(p.color ?? "#0f766e", isSelected ? 22 : 15, p.isHome)}
      >
        {p.tooltip && (
          <Tooltip direction="top" offset={[0, -(p.isHome ? 12 : 9)]} opacity={1}>
            {p.tooltip}
          </Tooltip>
        )}
        {(p.label || p.popup) && <Popup maxWidth={360}>{p.popup ?? p.label}</Popup>}
      </Marker>
    );
  });

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
        {cluster && points.length > 0 ? (
          <MarkerClusterGroup
            showCoverageOnHover={false}
            maxClusterRadius={44}
            disableClusteringAtZoom={16}
            iconCreateFunction={(mc) => clusterIcon(mc.getChildCount())}
          >
            {markers}
          </MarkerClusterGroup>
        ) : (
          markers
        )}
      </MapContainer>
    </div>
  );
}
