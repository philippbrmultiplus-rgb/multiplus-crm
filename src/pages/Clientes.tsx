import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  Map as MapIcon,
  MapPin,
  MapPinOff,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { LeafletMap } from "@/components/map/LeafletMap";
import { cadenceLabel, tierOfFreq } from "@/lib/cadence";
import {
  coletaDays,
  compareClients,
  isColetaOverdue,
  type ClientSort,
} from "@/components/clients/clientBits";
import { ColetaBadge, TierBadge, VisitaBadge } from "@/components/clients/clientBadges";
import type { Client } from "@/lib/types";

const FREQ_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "0", label: cadenceLabel(0) },
  { value: "0.33", label: cadenceLabel(0.33) },
  { value: "0.5", label: cadenceLabel(0.5) },
  { value: "1", label: cadenceLabel(1) },
  { value: "2", label: cadenceLabel(2) },
  { value: "3", label: cadenceLabel(3) },
  { value: "4", label: cadenceLabel(4) },
];

function ColetaCell({ c, onDate }: { c: Client; onDate: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <input
        type="date"
        aria-label="Data da última troca"
        className="h-8 w-24 rounded-md border bg-transparent px-1 text-xs text-foreground"
        value={c.lastCollectAt ?? ""}
        onChange={(e) => onDate(e.target.value || null)}
      />
      {c.lastCollectAt && <ColetaBadge c={c} />}
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

function CadenceSelect({ value, onValue }: { value: number; onValue: (f: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onValue(parseFloat(v))}>
      <SelectTrigger className="h-8 w-24 text-xs">
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
  );
}

export default function Clientes() {
  const { state, updateClient, geocodeAll, recomputeTiers, deleteClient } = useData();
  const { clients } = state;
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [city, setCity] = useState("all");
  const [tier, setTier] = useState("all");
  const [segment, setSegment] = useState("all");
  const [freqF, setFreqF] = useState("all");
  const [situ, setSitu] = useState("todas");
  const [sortBy, setSortBy] = useState<ClientSort>("grupo");
  const [onlyActive, setOnlyActive] = useState(true);
  const [editing, setEditing] = useState<Client | null>(null);
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [geocoding, setGeocoding] = useState<{ done: number; total: number; current: string } | null>(null);
  // atualiza o contador "há X dias" automaticamente
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const cities = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach((c) => {
      const k = c.city || "(sem cidade)";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [clients]);

  const segments = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach((c) => map.set(c.segment || "(sem segmento)", (map.get(c.segment || "(sem segmento)") ?? 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => (onlyActive ? c.active : true))
      .filter((c) => (tier === "all" ? true : c.tier === tier))
      .filter((c) => (city === "all" ? true : (c.city || "(sem cidade)") === city))
      .filter((c) => (segment === "all" ? true : (c.segment || "(sem segmento)") === segment))
      .filter((c) => (freqF === "all" ? true : String(c.freqMonth) === freqF))
      .filter((c) => {
        if (situ === "todas") return true;
        if (situ === "sem_data") return c.lastCollectAt == null;
        if (situ === "em_dia") return c.lastCollectAt != null && !isColetaOverdue(c);
        return isColetaOverdue(c);
      })
      .filter((c) =>
        q ? `${c.name} ${c.address} ${c.city} ${c.segment}`.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => {
        // a situação escolhida define a ordem: atrasada = da mais atrasada para baixo;
        // em dia = da mais em dia (menos dias sem coleta) para baixo
        if (situ === "atrasada") {
          const da = coletaDays(a) ?? -1;
          const db = coletaDays(b) ?? -1;
          return db - da || compareClients(a, b, "grupo");
        }
        if (situ === "em_dia") {
          const da = coletaDays(a) ?? Number.POSITIVE_INFINITY;
          const db = coletaDays(b) ?? Number.POSITIVE_INFINITY;
          return da - db || compareClients(a, b, "grupo");
        }
        return compareClients(a, b, sortBy);
      })
      .slice(0, 300);
  }, [clients, search, city, tier, segment, freqF, situ, sortBy, onlyActive]);

  const segmentOptions = useMemo(
    () =>
      segments
        .map(([s]) => s)
        .filter((s) => s !== "(sem segmento)")
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [segments],
  );

  const anyFilter =
    search.trim() !== "" ||
    city !== "all" ||
    tier !== "all" ||
    segment !== "all" ||
    freqF !== "all" ||
    situ !== "todas";

  const resetFilters = () => {
    setSearch("");
    setCity("all");
    setTier("all");
    setSegment("all");
    setFreqF("all");
    setSitu("todas");
  };

  const pendingGeocode = clients.filter((c) => c.lat == null || c.geocodeStatus !== "ok").length;

  const handleGeocode = async () => {
    setGeocoding({ done: 0, total: 0, current: "" });
    const res = await geocodeAll((done, total, current) =>
      setGeocoding({ done, total, current }),
    );
    setGeocoding(null);
    if (res.ok > 0) {
      toast.success(`Geocodificação concluída: ${res.ok} localizados.`);
    } else {
      toast.warning("Nenhum endereço localizado.", {
        description:
          "Confira se os endereços estão preenchidos corretamente em Clientes (editar). A lista de cidades pode conter endereços incompletos.",
      });
    }
    if (res.failed > 0) {
      toast.warning(`${res.failed} não foram localizados (endereço não encontrado ou erro de rede).`);
    }
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
          <Button variant="outline" asChild>
            <Link to="/mapa">
              <MapIcon className="mr-2 h-4 w-4" /> Mapa
            </Link>
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

      <div className="card-soft flex flex-wrap items-end gap-2 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome, endereço, cidade ou segmento…"
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
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os segmentos</SelectItem>
            {segments.map(([name, n]) => (
              <SelectItem key={name} value={name}>
                {name} ({n})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-40">
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
        <Select value={freqF} onValueChange={setFreqF}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Cadência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as cadências</SelectItem>
            {FREQ_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={situ} onValueChange={setSitu}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Situação da coleta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as situações</SelectItem>
            <SelectItem value="atrasada">Coleta atrasada</SelectItem>
            <SelectItem value="em_dia">Em dia</SelectItem>
            <SelectItem value="sem_data">Sem data de coleta</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as ClientSort)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Ordem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grupo">Grupo + mais tempo sem coleta</SelectItem>
            <SelectItem value="atraso">Mais tempo sem coleta</SelectItem>
            <SelectItem value="volume">Maior volume (t/mês)</SelectItem>
            <SelectItem value="nome">Nome A–Z</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={onlyActive} onCheckedChange={(v) => setOnlyActive(!!v)} />
          Só ativos
        </label>
        {anyFilter && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Limpar filtros
          </Button>
        )}
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className={`card-soft p-3 ${isColetaOverdue(c) ? "opt-overdue" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold leading-tight">{c.name}</span>
                    {c.isProspecao && (
                      <Badge variant="outline" className="border-violet-500/40 text-violet-600 dark:text-violet-300">
                        prospecção
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{c.address || "—"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <GeocodeStatus c={c} />
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setToDelete(c)}
                    title="Excluir este cliente definitivamente"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <div className="min-w-0">
                  <span className="block text-[11px] text-muted-foreground">Cidade</span>
                  <span className="block truncate">{c.city || "—"}</span>
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] text-muted-foreground">Segmento</span>
                  <span className="block truncate">{c.segment || "—"}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground">Grupo</span>
                  <TierBadge tier={c.tier} showFreq />
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground">Status</span>
                  {c.active ? <Badge variant="outline">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                </div>
              </div>
              <div className="mt-2 space-y-2 border-t pt-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">Cadência</span>
                  <CadenceSelect
                    value={c.freqMonth}
                    onValue={(f) => updateClient(c.id, { freqMonth: f, tier: tierOfFreq(f) })}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">Última troca</span>
                  <ColetaCell c={c} onDate={(v) => updateClient(c.id, { lastCollectAt: v })} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">Última visita</span>
                  <VisitaBadge c={c} />
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="card-soft p-10 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado com os filtros atuais.
            </div>
          )}
          {filtered.length >= 300 && (
            <p className="text-xs text-muted-foreground">
              Mostrando os 300 primeiros — use a busca ou os filtros para refinar.
            </p>
          )}
        </div>
      ) : (
        <div className="card-soft overflow-x-auto">
          <Table className="table-fixed [&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-1.5">
            <colgroup>
              <col className="w-[21%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[7%]" />
              <col className="w-[10%]" />
              <col className="w-[15%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Cadência</TableHead>
                <TableHead>Últ. troca / dias</TableHead>
                <TableHead>Últ. visita</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className={isColetaOverdue(c) ? "row-overdue" : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{c.name}</span>
                      {c.isProspecao && (
                        <Badge variant="outline" className="shrink-0 border-violet-500/40 text-violet-600 dark:text-violet-300">
                          prospecção
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.address || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="truncate text-sm">{c.city || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {c.segment ? (
                      <Badge variant="outline" className="max-w-full truncate">
                        {c.segment}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <TierBadge tier={c.tier} showFreq />
                  </TableCell>
                  <TableCell>
                    <CadenceSelect
                      value={c.freqMonth}
                      onValue={(f) => updateClient(c.id, { freqMonth: f, tier: tierOfFreq(f) })}
                    />
                  </TableCell>
                  <TableCell>
                    <ColetaCell c={c} onDate={(v) => updateClient(c.id, { lastCollectAt: v })} />
                  </TableCell>
                  <TableCell>
                    <VisitaBadge c={c} />
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
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setToDelete(c)}
                        title="Excluir este cliente definitivamente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Nenhum cliente encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {filtered.length >= 300 && (
            <p className="border-t p-2 text-xs text-muted-foreground">
              Mostrando os 300 primeiros — use a busca ou os filtros para refinar.
            </p>
          )}
        </div>
      )}

      <EditClientDialog
        key={editing?.id ?? "none"}
        client={editing}
        segmentOptions={segmentOptions}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) updateClient(editing.id, patch);
          setEditing(null);
        }}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `"${toDelete.name}" será removido de TODAS as bases (visitas, rotas e cadastro). Essa ação não pode ser desfeita, mas fica registrado o histórico da exclusão.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) deleteClient(toDelete.id);
                setToDelete(null);
              }}
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditClientDialog({
  client,
  segmentOptions,
  onClose,
  onSave,
}: {
  client: Client | null;
  segmentOptions: string[];
  onClose: () => void;
  onSave: (patch: Partial<Client>) => void;
}) {
  const [name, setName] = useState(client?.name ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [city, setCity] = useState(client?.city ?? "");
  const [segment, setSegment] = useState(client?.segment ?? "");
  const [contato, setContato] = useState(client?.contato ?? "");
  const [active, setActive] = useState(client?.active ?? true);
  const [isProsp, setIsProsp] = useState(client?.isProspecao ?? false);
  const [lat, setLat] = useState<number | null>(client?.lat ?? null);
  const [lng, setLng] = useState<number | null>(client?.lng ?? null);

  const SEG_NONE = "__none__";
  const segOptions = useMemo(
    () =>
      [...new Set([...(segment ? [segment] : []), ...segmentOptions])].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [segment, segmentOptions],
  );

  if (!client) return null;

  const points = lat != null && lng != null ? [{ lat, lng, label: client.name, color: "#047857" }] : [];

  return (
    <Dialog open={!!client} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-2xl overflow-y-auto overscroll-contain">
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
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Porto Alegre" />
          </div>
          <div className="space-y-2">
            <Label>Segmento</Label>
            <Select value={segment || SEG_NONE} onValueChange={(v) => setSegment(v === SEG_NONE ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecionar segmento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEG_NONE}>—</SelectItem>
                {segOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Contato</Label>
            <Input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="(51) 9 9999-9999" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Endereço</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Cliente ativo (entra na rota)</Label>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch checked={isProsp} onCheckedChange={setIsProsp} />
            <Label>Prospecção (novo cliente em negociação)</Label>
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
                segment,
                contato: contato.trim() || null,
                active,
                isProspecao: isProsp,
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
