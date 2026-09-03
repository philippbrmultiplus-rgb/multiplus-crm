import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  MapPinOff,
  Pencil,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useData } from "@/lib/DataContext";
import { LeafletMap } from "@/components/map/LeafletMap";
import { cadenceLabel, intervalDays, tierOfFreq } from "@/lib/cadence";
import { daysSinceToday } from "@/lib/geo";
import type { Client, Tier } from "@/lib/types";

const FREQ_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "0", label: "Fora da rota" },
  { value: "0.33", label: cadenceLabel(0.33) },
  { value: "0.5", label: cadenceLabel(0.5) },
  { value: "1", label: cadenceLabel(1) },
  { value: "2", label: cadenceLabel(2) },
  { value: "3", label: cadenceLabel(3) },
  { value: "4", label: cadenceLabel(4) },
];

const TIER_LABEL: Record<Tier, string> = {
  A: "Grupo A · 4x/mês",
  B: "Grupo B · 3x/mês",
  C: "Grupo C · 2x/mês",
  D: "Grupo D · <2x/mês",
};
// usado como título de tooltip dos grupos
const TIER_ORDER: Record<Tier, number> = { A: 4, B: 3, C: 2, D: 1 };

function tierBadge(t: Tier) {
  const cls =
    t === "A" ? "tier-badge-a" : t === "B" ? "tier-badge-b" : t === "C" ? "tier-badge-c" : "tier-badge-d";
  return (
    <span className="inline-flex items-center gap-1" title={TIER_LABEL[t]}>
      <Badge className={cls}>{t}</Badge>
      <span className="text-[10px] text-muted-foreground">
        {t === "A" ? "4x" : t === "B" ? "3x" : t === "C" ? "2x" : "<2x"}
      </span>
    </span>
  );
}

function ColetaCell({ c, onDate }: { c: Client; onDate: (v: string | null) => void }) {
  const days = daysSinceToday(c.lastCollectAt);
  const overdue = days != null && days >= intervalDays(c.freqMonth);
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <input
        type="date"
        aria-label="Data da última troca"
        className="h-8 w-32 rounded-md border bg-transparent px-1.5 text-xs text-foreground"
        value={c.lastCollectAt ?? ""}
        onChange={(e) => onDate(e.target.value || null)}
      />
      {days != null && days > 0 && (
        <Badge
          className={
            overdue
              ? "bg-destructive/15 text-destructive ring-1 ring-destructive/30"
              : days >= Math.max(3, Math.floor((intervalDays(c.freqMonth) || 30) / 2))
                ? "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300"
                : "bg-primary/10 text-primary"
          }
        >
          há {days} {days === 1 ? "dia" : "dias"}
        </Badge>
      )}
    </div>
  );
}

function GeocodeStatus({ c }: { c: Client }) {
  if (c.lat != null && c.geocodeStatus === "ok") {
    return <CheckCircle2 className="h-4 w-4 text-primary" />;
  }
  if (c.geocodeStatus === "falha") {
    return <MapPinOff className="h-4 w-4 text-destructive" />;
  }
  return <MapPin className="h-4 w-4 text-muted-foreground" />;
}

export default function Clientes() {
  const { state, updateClient, geocodeAll, recomputeTiers } = useData();
  const { clients } = state;

  const [search, setSearch] = useState("");
  const [city, setCity] = useState("all");
  const [tier, setTier] = useState("all");
  const [onlyActive, setOnlyActive] = useState(true);
  const [editing, setEditing] = useState<Client | null>(null);
  const [geocoding, setGeocoding] = useState<{ done: number; total: number; current: string } | null>(null);
  // atualiza o contador "há X dias" automaticamente
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const cities = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach((c) => map.set(c.city, (map.get(c.city) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => (onlyActive ? c.active : true))
      .filter((c) => (tier === "all" ? true : c.tier === tier))
      .filter((c) => (city === "all" ? true : c.city === city))
      .filter((c) =>
        q ? `${c.name} ${c.address} ${c.city}`.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => TIER_ORDER[b.tier] - TIER_ORDER[a.tier] || b.freqMonth - a.freqMonth || b.avgMonthly - a.avgMonthly);
  }, [clients, search, city, tier, onlyActive]);

  const pendingGeocode = clients.filter((c) => c.lat == null || c.geocodeStatus !== "ok").length;

  const handleGeocode = async () => {
    setGeocoding({ done: 0, total: 0, current: "" });
    const res = await geocodeAll((done, total, current) =>
      setGeocoding({ done, total, current }),
    );
    setGeocoding(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} na carteira · {clients.filter((c) => c.active).length} ativos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={recomputeTiers}>
            Recalcular prioridades
          </Button>
          <Button onClick={handleGeocode} disabled={geocoding !== null || pendingGeocode === 0}>
            {geocoding !== null ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Geocodificando…
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" /> Geocodificar ({pendingGeocode})
              </>
            )}
          </Button>
        </div>
      </div>

      {geocoding && (
        <div className="card-soft p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Localizando endereços no mapa</span>
            <span>
              {geocoding.done}/{geocoding.total}
            </span>
          </div>
          <Progress value={(geocoding.done / Math.max(1, geocoding.total)) * 100} />
          <p className="mt-2 truncate text-xs text-muted-foreground">
            {geocoding.current || "Aguarde…"}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome, endereço ou cidade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={city} onValueChange={setCity}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as cidades</SelectItem>
            {cities.map(([name, n]) => (
              <SelectItem key={name} value={name}>
                {name || "(sem cidade)"} ({n})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="A">Grupo A (4x/mês)</SelectItem>
            <SelectItem value="B">Grupo B (3x/mês)</SelectItem>
            <SelectItem value="C">Grupo C (2x/mês)</SelectItem>
            <SelectItem value="D">Grupo D (&lt;2x/mês)</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={onlyActive} onCheckedChange={(v) => setOnlyActive(!!v)} />
          Só ativos
        </label>
      </div>

      <div className="card-soft overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Segmento</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Cadência</TableHead>
              <TableHead>Últ. troca / dias</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 200).map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="font-medium">{c.name}</div>
                  <div className="max-w-64 truncate text-xs text-muted-foreground">
                    {c.address || "—"}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{c.city}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {c.segment ? <Badge variant="outline">{c.segment}</Badge> : "—"}
                </TableCell>
                <TableCell>{tierBadge(c.tier)}</TableCell>
                <TableCell>
                  <Select
                    value={String(c.freqMonth)}
                    onValueChange={(v) => {
                      const f = parseFloat(v);
                      updateClient(c.id, { freqMonth: f, tier: tierOfFreq(f) });
                    }}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQ_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <ColetaCell c={c} onDate={(v) => updateClient(c.id, { lastCollectAt: v })} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {c.active ? (
                      <Badge variant="outline">Ativo</Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                    <GeocodeStatus c={c} />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {filtered.length > 200 && (
          <p className="border-t p-2 text-xs text-muted-foreground">
            Mostrando 200 de {filtered.length} — refine a busca para ver mais.
          </p>
        )}
      </div>

      <EditClientDialog
        client={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) updateClient(editing.id, patch);
          setEditing(null);
        }}
      />
    </div>
  );
}

function EditClientDialog({
  client,
  onClose,
  onSave,
}: {
  client: Client | null;
  onClose: () => void;
  onSave: (patch: Partial<Client>) => void;
}) {
  const [name, setName] = useState(client?.name ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [city, setCity] = useState(client?.city ?? "");
  const [active, setActive] = useState(client?.active ?? true);
  const [lat, setLat] = useState<number | null>(client?.lat ?? null);
  const [lng, setLng] = useState<number | null>(client?.lng ?? null);

  if (!client) return null;

  const points = lat != null && lng != null ? [{ lat, lng, label: client.name, color: "#047857" }] : [];

  return (
    <Dialog open={!!client} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>
            Ajuste os dados e clique no mapa para posicionar o cliente (usado na rota e na validação de
            presença).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Endereço</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Cliente ativo (entra na rota)</Label>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Posição no mapa</Label>
          <LeafletMap
            height="280px"
            fit={false}
            center={lat != null && lng != null ? [lat, lng] : [-30.03, -51.22]}
            zoom={12}
            points={points}
            onMapClick={(l, n) => {
              setLat(l);
              setLng(n);
            }}
          />
          <p className="text-xs text-muted-foreground">
            {lat != null && lng != null
              ? `Coordenadas: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
              : "Sem coordenadas — clique no mapa para marcar."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onSave({
                name,
                address,
                city,
                active,
                lat,
                lng,
                geocodeStatus: lat != null ? "ok" : client.geocodeStatus,
              })
            }
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
