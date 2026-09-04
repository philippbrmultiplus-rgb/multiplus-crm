import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useData } from "@/lib/DataContext";
import { LeafletMap, type MapPoint } from "@/components/map/LeafletMap";
import { coletaDays, coletaStatus } from "@/components/clients/clientBits";
import { ColetaBadge, TierBadge } from "@/components/clients/clientBadges";
import type { Client } from "@/lib/types";

/** cor do ponto conforme a situação da coleta (faixas iguais às dos badges) */
function dotColor(c: Client): string {
  if (!c.active) return "#cbd5e1"; // inativo
  const s = coletaStatus(c);
  if (s === "ok") return "#10b981";
  if (s === "warn") return "#f59e0b";
  if (s === "late") return "#ef4444";
  return "#94a3b8"; // sem data de última troca
}

function coletaTooltip(c: Client): string {
  if (!c.active) return `${c.name} — cliente inativo`;
  const d = coletaDays(c);
  if (d == null) return `${c.name} — sem data de coleta`;
  if (d === 0) return `${c.name} — coleta hoje`;
  return `${c.name} — ${d} ${d === 1 ? "dia" : "dias"} sem coleta`;
}

function ClientPopup({ c, onSetDate }: { c: Client; onSetDate: (v: string | null) => void }) {
  return (
    <div className="w-60 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold leading-tight">{c.name}</div>
          <div className="text-xs text-muted-foreground">
            {c.city}
            {c.segment ? ` · ${c.segment}` : ""}
            {!c.active ? " · inativo" : ""}
          </div>
        </div>
        <TierBadge tier={c.tier} />
      </div>
      {c.address && <p className="truncate text-xs text-muted-foreground">{c.address}</p>}
      <div className="flex items-center gap-2">
        <input
          type="date"
          aria-label="Data da última troca"
          title="Data da última troca/coleta"
          className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-1.5 text-xs text-foreground"
          value={c.lastCollectAt ?? ""}
          onChange={(e) => onSetDate(e.target.value || null)}
        />
      </div>
      {c.lastCollectAt ? (
        <ColetaBadge c={c} withLabel />
      ) : (
        <span className="block text-xs text-muted-foreground">Sem data de coleta cadastrada.</span>
      )}
    </div>
  );
}

const LEGEND = [
  { color: "#10b981", label: "Em dia (até 20 dias)" },
  { color: "#f59e0b", label: "21 a 30 dias" },
  { color: "#ef4444", label: "Atrasada (>30 dias)" },
  { color: "#94a3b8", label: "Sem data de troca" },
  { color: "#cbd5e1", label: "Inativo" },
];

export default function MapaClientes() {
  const { state, updateClient } = useData();
  const { clients } = state;

  const [onlyActive, setOnlyActive] = useState(true);
  const [grupo, setGrupo] = useState("all");
  const [situ, setSitu] = useState("todas");

  const geocoded = useMemo(
    () => clients.filter((c) => c.lat != null && c.lng != null),
    [clients],
  );
  const missingCoords = useMemo(
    () => clients.filter((c) => c.active && (c.lat == null || c.lng == null)),
    [clients],
  );

  const points = useMemo<MapPoint[]>(() => {
    return geocoded
      .filter((c) => (onlyActive ? c.active : true))
      .filter((c) => (grupo === "all" ? true : c.tier === grupo))
      .filter((c) => {
        if (situ === "todas") return true;
        if (situ === "sem_data") return c.lastCollectAt == null;
        if (situ === "em_dia") return c.lastCollectAt != null && coletaStatus(c) !== "late";
        return coletaStatus(c) === "late";
      })
      .map((c) => ({
        id: c.id,
        lat: c.lat as number,
        lng: c.lng as number,
        label: c.name,
        tooltip: coletaTooltip(c),
        popup: <ClientPopup c={c} onSetDate={(v) => updateClient(c.id, { lastCollectAt: v })} />,
        color: dotColor(c),
      }));
  }, [geocoded, onlyActive, grupo, situ, updateClient]);

  const inativosVisiveis = !onlyActive;
  const legend = inativosVisiveis ? LEGEND : LEGEND.filter((l) => l.label !== "Inativo");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mapa de clientes</h1>
          <p className="text-sm text-muted-foreground">
            Passe o mouse sobre um ponto para ver o nome e os dias sem coleta. Clique para abrir o cartão do
            cliente.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          {geocoded.length} {geocoded.length === 1 ? "cliente no mapa" : "clientes no mapa"}
          <span>·</span>
          <MapPinOff className="h-4 w-4" />
          {missingCoords.length} sem coordenadas
        </div>
      </div>

      {missingCoords.length > 0 && (
        <div className="card-soft flex flex-wrap items-center gap-2 border-amber-500/30 p-3 text-sm">
          <span className="flex items-center gap-2">
            <MapPinOff className="h-4 w-4 text-amber-600" />
            {missingCoords.length} cliente(s) ativo(s) ainda não têm endereço no mapa e não aparecem aqui.
          </span>
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <Link to="/clientes">Geocodificar em Clientes</Link>
          </Button>
        </div>
      )}

      <div className="card-soft flex flex-wrap items-end gap-2 p-3">
        <Select value={grupo} onValueChange={setGrupo}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Grupo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os grupos</SelectItem>
            <SelectItem value="A">Grupo A (4x/mês)</SelectItem>
            <SelectItem value="B">Grupo B (3x/mês)</SelectItem>
            <SelectItem value="C">Grupo C (2x/mês)</SelectItem>
            <SelectItem value="D">Grupo D (&lt;2x/mês)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={situ} onValueChange={setSitu}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Situação da coleta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as situações</SelectItem>
            <SelectItem value="atrasada">Coleta atrasada</SelectItem>
            <SelectItem value="em_dia">Em dia</SelectItem>
            <SelectItem value="sem_data">Sem data de coleta</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={onlyActive} onCheckedChange={setOnlyActive} />
          Só ativos
        </label>
      </div>

      {geocoded.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 p-12 text-center">
          <MapPinOff className="h-8 w-8 text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">
            Nenhum cliente tem coordenadas ainda. Use "Geocodificar" na tela Clientes para localizar os
            endereços e voltar aqui para conferir cada um no mapa.
          </p>
          <Button asChild>
            <Link to="/clientes">Ir para Clientes</Link>
          </Button>
        </div>
      ) : points.length === 0 ? (
        <div className="card-soft flex items-center justify-center p-12 text-center text-sm text-muted-foreground">
          Nenhum cliente corresponde aos filtros atuais.
        </div>
      ) : (
        <div className="card-soft space-y-2 p-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-1 text-xs text-muted-foreground">
            {legend.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
          <LeafletMap points={points} height="min(70dvh, 640px)" fit cluster />
        </div>
      )}
    </div>
  );
}
