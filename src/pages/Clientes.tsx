import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  Filter,
  History,
  Loader2,
  Map as MapIcon,
  MapPin,
  MapPinOff,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Wallet,
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
import { cadenceLabel } from "@/lib/cadence";
import {
  agruparCidades,
  cidadeKey,
  formatDateBR,
  formatKm,
  formatM3,
  formatNumero,
  mesLabel,
} from "@/lib/geo";
import {
  coletaDays,
  compareClients,
  isColetaOverdue,
  lastVisitDays,
  visitaStatus,
  type ClientSort,
} from "@/components/clients/clientBits";
import { distanciaClienteKm, distanciaFaixa, distanciaTexto } from "@/components/clients/clientBits";
import { ColetaBadge, TierBadge, VisitaBadge } from "@/components/clients/clientBadges";
import { PhotoZoom } from "@/components/visitas/PhotoZoom";
import { NewClientDialog } from "@/components/clients/NewClientDialog";
import { ClientPaymentsDialog } from "@/components/clients/ClientPaymentsDialog";
import type { Client, Visit } from "@/lib/types";

const PROSPECTA = "__prospecao__";

/** coluna Pago: "Não" quando não há condição registrada; "Sim" abre os detalhes */
function PagamentoCell({ tem, onOpen }: { tem: boolean; onOpen: () => void }) {
  if (!tem) return <span className="text-xs text-muted-foreground">Não</span>;
  return (
    <Button variant="link" size="sm" className="h-auto p-0" onClick={onOpen}>
      Sim
    </Button>
  );
}


function ColetaCell({ c, onDate }: { c: Client; onDate: (v: string | null) => void }) {
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <input
        type="date"
        aria-label="Data da última troca"
        className="h-8 w-20 rounded-md border bg-transparent px-1 text-xs text-foreground"
        value={c.lastCollectAt ?? ""}
        onChange={(e) => onDate(e.target.value || null)}
      />
      <ColetaBadge c={c} />
    </div>
  );
}

function GeocodeStatus({ c }: { c: Client }) {
  if (c.lat != null && c.geocodeStatus === "ok") {
    if (c.geoAproximado) {
      return (
        <MapPin
          className="h-4 w-4 text-amber-500"
          aria-label="Coordenada aproximada (pela cidade)"
        />
      );
    }
    return <CheckCircle2 className="h-4 w-4 text-primary" />;
  }
  if (c.geocodeStatus === "falha") {
    return <MapPinOff className="h-4 w-4 text-destructive" />;
  }
  return <MapPin className="h-4 w-4 text-muted-foreground" />;
}

export default function Clientes() {
  const { state, updateClient, geocodeAll, deleteClient, loadClientColetas, role } = useData();
  const { clients } = state;
  const isMobile = useIsMobile();
  const podeEditar = role === "coordenador";
  const [history, setHistory] = useState<Client | null>(null);
  const [novo, setNovo] = useState(false);

  const [search, setSearch] = useState("");
  const [city, setCity] = useState("all");
  const [tier, setTier] = useState("all");
  const [segment, setSegment] = useState("all");
  const [params] = useSearchParams();
  const [situ, setSitu] = useState(params.get("situ") ?? "todas");
  const [situVisita, setSituVisita] = useState(params.get("situVisita") ?? "todas");
  const [dist, setDist] = useState("todas");
  const [pago, setPago] = useState("todos");
  const [sortBy, setSortBy] = useState<ClientSort>("nome");
  const [onlyActive, setOnlyActive] = useState(true);
  const [editing, setEditing] = useState<Client | null>(null);
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [pagamento, setPagamento] = useState<Client | null>(null);
  const [geocoding, setGeocoding] = useState<{ done: number; total: number; current: string } | null>(null);
  // atualiza o contador "há X dias" automaticamente
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // confere se o cliente passa em TODOS os filtros atuais, exceto o informado em "ignore"
  const matchOutros = useCallback(
    (c: Client, ignore: "cidade" | "segmento" | "grupo") => {
      // as prospecções ficam separadas da lista normal de clientes
      if (segment === PROSPECTA) {
        if (!c.isProspecao) return false;
      } else if (c.isProspecao) {
        return false;
      }
      if (ignore !== "cidade" && city !== "all" && cidadeKey(c.city || "(sem cidade)") !== cidadeKey(city))
        return false;
      if (ignore !== "segmento" && segment !== "all" && (c.segment || "(sem segmento)") !== segment)
        return false;
      if (ignore !== "grupo" && tier !== "all" && c.tier !== tier) return false;
      if (onlyActive && !c.active) return false;
      if (situ === "atrasada" && !isColetaOverdue(c)) return false;
      if (situ === "em_dia" && (c.lastCollectAt == null || isColetaOverdue(c))) return false;
      if (situ === "sem_data" && c.lastCollectAt != null) return false;
      if (situVisita === "atrasada" && visitaStatus(c) !== "late") return false;
      if (situVisita === "sem_ou_atrasada" && c.lastVisitAt != null && visitaStatus(c) !== "late")
        return false;
      if (situVisita === "em_dia" && (c.lastVisitAt == null || visitaStatus(c) === "late")) return false;
      if (situVisita === "sem_visita" && c.lastVisitAt != null) return false;
      return true;
    },
    [city, segment, tier, onlyActive, situ, situVisita],
  );

  // cidades em ordem alfabética, agrupando grafias que só diferem por maiúscula/minúscula
  const cities = useMemo(() => {
    const lista = agruparCidades(
      clients.filter((c) => matchOutros(c, "cidade")).map((c) => c.city || "(sem cidade)"),
    );
    if (city !== "all" && !lista.some((o) => cidadeKey(o.label) === cidadeKey(city))) {
      return [...lista, { label: city, count: 0 }].sort((a, b) =>
        a.label.localeCompare(b.label, "pt-BR"),
      );
    }
    return lista;
  }, [clients, matchOutros, city]);

  const segments = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clients) {
      if (!matchOutros(c, "segmento")) continue;
      const k = c.segment || "(sem segmento)";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    if (segment !== "all" && !map.has(segment)) map.set(segment, 0);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [clients, matchOutros, segment]);

  const grupoOptions = useMemo(() => {
    const tiers = new Set<string>();
    for (const c of clients) if (matchOutros(c, "grupo")) tiers.add(c.tier);
    return (["A", "B", "C", "D"] as const).filter((t) => tiers.has(t) || tier === t);
  }, [clients, matchOutros, tier]);

  // clientes com condição de pagamento registrada (planilha de pagamentos)
  const comPagamento = useMemo(() => {
    const ids = new Set<string>();
    for (const p of state.payments) if (p.clientId) ids.add(p.clientId);
    return ids;
  }, [state.payments]);

  // média de dias entre coletas de cada cliente (vem da Cadência de troca)
  const cadenciaPorCliente = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of state.cadence) {
      if (c.clientId && c.mediaDias != null) mapa.set(c.clientId, c.mediaDias);
    }
    return mapa;
  }, [state.cadence]);

  /** lista já filtrada e ordenada (sem o corte de 300) */
  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => (onlyActive ? c.active : true))
      .filter((c) => (tier === "all" ? true : c.tier === tier))
      .filter((c) => (city === "all" ? true : cidadeKey(c.city || "(sem cidade)") === cidadeKey(city)))
      .filter((c) => {
        if (segment === PROSPECTA) return c.isProspecao;
        if (c.isProspecao) return false;
        return segment === "all" ? true : (c.segment || "(sem segmento)") === segment;
      })
      .filter((c) => {
        if (situ === "todas") return true;
        if (situ === "sem_data") return c.lastCollectAt == null;
        if (situ === "em_dia") return c.lastCollectAt != null && !isColetaOverdue(c);
        return isColetaOverdue(c);
      })
      .filter((c) => {
        if (situVisita === "todas") return true;
        if (situVisita === "sem_visita") return c.lastVisitAt == null;
        if (situVisita === "em_dia") return c.lastVisitAt != null && visitaStatus(c) !== "late";
        if (situVisita === "sem_ou_atrasada")
          return c.lastVisitAt == null || visitaStatus(c) === "late";
        return visitaStatus(c) === "late";
      })
      .filter((c) => (dist === "todas" ? true : distanciaFaixa(c) === dist))
      .filter((c) =>
        pago === "todos" ? true : pago === "sim" ? comPagamento.has(c.id) : !comPagamento.has(c.id),
      )
      .filter((c) =>
        q ? `${c.name} ${c.address} ${c.city} ${c.segment}`.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => {
        // a ordem escolhida manda: nome A–Z sempre alfabético
        if (sortBy === "nome") return compareClients(a, b, "nome");
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
      });
  }, [clients, search, city, tier, segment, situ, situVisita, dist, pago, sortBy, onlyActive, comPagamento]);

  /** a lista é longa: mostra até 300, mas o total filtrado continua contando todos */
  const filtered = useMemo(() => matching.slice(0, 300), [matching]);
  const filteredTotal = matching.length;

  const segmentOptions = useMemo(
    () =>
      segments
        .map(([s]) => s)
        .filter((s) => s !== "(sem segmento)")
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [segments],
  );

  const prospectCount = useMemo(() => clients.filter((c) => c.isProspecao).length, [clients]);

  const anyFilter =
    search.trim() !== "" ||
    city !== "all" ||
    tier !== "all" ||
    segment !== "all" ||
    situ !== "todas" ||
    situVisita !== "todas" ||
    dist !== "todas" ||
    pago !== "todos";

  const resetFilters = () => {
    setSearch("");
    setCity("all");
    setTier("all");
    setSegment("all");
    setSitu("todas");
    setSituVisita("todas");
    setDist("todas");
    setPago("todos");
  };

  const pendingGeocode = clients.filter((c) => c.lat == null || c.geocodeStatus !== "ok").length;

  /** extrai a lista (respeitando os filtros atuais) para Excel, com colunas separadas */
  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const situacaoTroca = (c: Client) => {
      const d = coletaDays(c);
      if (d == null) return "Sem data de troca";
      if (d > 30) return "Atrasada";
      if (d > 20) return "Atenção";
      return "Em dia";
    };
    const situacaoVisita = (c: Client) => {
      const d = lastVisitDays(c);
      if (d == null) return "Sem visita";
      if (d > 30) return "Atrasada";
      if (d > 20) return "Atenção";
      return "Em dia";
    };
    const rows = filtered.map((c) => ({
      Nome: c.name,
      Segmento: c.segment || "",
      Cidade: c.city || "",
      "Distância da base (km)": distanciaClienteKm(c) != null ? Number(distanciaClienteKm(c)!.toFixed(1)) : "",
      Endereço: c.address || "",
      Contato: c.contato ?? "",
      Responsável: c.responsavel ?? "",
      Grupo: c.tier,
      Cadência: cadenceLabel(c.freqMonth),
      "Frequência (visitas/mês)": c.freqMonth,
      "Última troca": c.lastCollectAt ? formatDateBR(c.lastCollectAt) : "",
      "Dias sem troca": coletaDays(c) ?? "",
      "Situação da troca": situacaoTroca(c),
      "Cadência de troca (dias)": cadenciaPorCliente.get(c.id) ?? "",
      "Última visita": c.lastVisitAt ? formatDateBR(c.lastVisitAt) : "",
      "Dias sem visita": lastVisitDays(c) ?? "",
      "Situação da visita": situacaoVisita(c),
      Ativo: c.active ? "Sim" : "Não",
      Pago: comPagamento.has(c.id) ? "Sim" : "Não",
      Prospecção: c.isProspecao ? "Sim" : "Não",
      Observações: c.obs ?? "",
      Latitude: c.lat ?? "",
      Longitude: c.lng ?? "",
      Geocodificação: c.geocodeStatus,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, `clientes-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${rows.length} cliente(s) exportado(s) para Excel.`);
  };

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
            {clients.filter((c) => !c.isProspecao).length} clientes ·{" "}
            {clients.filter((c) => c.active && !c.isProspecao).length} ativos · {prospectCount}{" "}
            prospecção(ões) · {comPagamento.size} pagos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {anyFilter && (
            <Badge className="gap-1.5 bg-primary/10 px-3 py-1.5 text-sm text-primary">
              <Filter className="h-3.5 w-3.5" />
              {filteredTotal} {filteredTotal === 1 ? "cliente filtrado" : "clientes filtrados"}
            </Badge>
          )}
          {podeEditar && (
            <Button onClick={() => setNovo(true)}>
              <Plus className="mr-2 h-4 w-4" /> Novo cliente
            </Button>
          )}
          <Button variant="outline" onClick={() => void exportExcel()}>
            <Download className="mr-2 h-4 w-4" /> Exportar Excel
          </Button>
          <Button variant="outline" asChild>
            <Link to="/mapa">
              <MapIcon className="mr-2 h-4 w-4" /> Mapa
            </Link>
          </Button>
          {podeEditar && (
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
          )}
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
            {cities.map(({ label, count }) => (
              <SelectItem key={label} value={label}>
                {label} ({count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os segmentos</SelectItem>
            {prospectCount > 0 && (
              <SelectItem value={PROSPECTA}>Prospecção ({prospectCount})</SelectItem>
            )}
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
            {grupoOptions.map((t) => (
              <SelectItem key={t} value={t}>
                Grupo {t}
                {t === "A" ? " (4x/mês)" : t === "B" ? " (3x/mês)" : t === "C" ? " (2x/mês)" : " (<2x/mês)"}
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
        <Select value={dist} onValueChange={setDist}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Distância da base" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as distâncias</SelectItem>
            <SelectItem value="ate100">Até 100 km</SelectItem>
            <SelectItem value="100a200">100 a 200 km</SelectItem>
            <SelectItem value="200mais">200 km ou mais</SelectItem>
            <SelectItem value="sem">Sem coordenadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={situVisita} onValueChange={setSituVisita}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Situação da visita" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as visitas</SelectItem>
            <SelectItem value="atrasada">Visita atrasada (&gt;30 dias)</SelectItem>
            <SelectItem value="em_dia">Visita em dia</SelectItem>
            <SelectItem value="sem_visita">Sem visita registrada</SelectItem>
            <SelectItem value="sem_ou_atrasada">Sem visita ou atrasada (&gt;30 dias)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={pago} onValueChange={setPago}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Pago: todos</SelectItem>
            <SelectItem value="sim">Pago: sim ({comPagamento.size})</SelectItem>
            <SelectItem value="nao">Pago: não</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as ClientSort)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Ordem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nome">Nome A–Z</SelectItem>
            <SelectItem value="grupo">Grupo + mais tempo sem coleta</SelectItem>
            <SelectItem value="atraso">Mais tempo sem coleta</SelectItem>
            <SelectItem value="volume">Maior volume (t/mês)</SelectItem>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setHistory(c)}
                    title="Histórico de visitas e trocas"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  {podeEditar && (
                    <>
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
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <div className="min-w-0">
                  <span className="block text-[11px] text-muted-foreground">Cidade</span>
                  <span className="block truncate">{c.city || "—"}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground">Distância da base</span>
                  <span className="block">
                    {distanciaTexto(c)}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] text-muted-foreground">Segmento</span>
                  <span className="block truncate">{c.segment || "—"}</span>
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground">Grupo</span>
                  <TierBadge tier={c.tier} />
                </div>
                <div>
                  <span className="block text-[11px] text-muted-foreground">Pago</span>
                  <PagamentoCell tem={comPagamento.has(c.id)} onOpen={() => setPagamento(c)} />
                </div>
              </div>
              <div className="mt-2 space-y-2 border-t pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">Última troca</span>
                  {podeEditar ? (
                    <ColetaCell c={c} onDate={(v) => updateClient(c.id, { lastCollectAt: v })} />
                  ) : (
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {c.lastCollectAt ? formatDateBR(c.lastCollectAt) : "sem data"}
                      </span>
                      <ColetaBadge c={c} />
                    </span>
                  )}
                </div>
                {cadenciaPorCliente.has(c.id) && (
                  <p
                    className="text-[11px] text-muted-foreground"
                    title="Média de dias entre coletas (Cadência de troca)"
                  >
                    cadência de troca: a cada {formatNumero(cadenciaPorCliente.get(c.id) as number)} dias
                  </p>
                )}
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
              <col className="w-[18%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[11%]" />
              <col className="w-[6%]" />
              <col className="w-[19%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Distância da base</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Últ. troca / dias</TableHead>
                <TableHead>Últ. visita</TableHead>
                <TableHead>Pago</TableHead>
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
                      <GeocodeStatus c={c} />
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.address || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="truncate text-sm">{c.city || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {distanciaTexto(c)}
                  </TableCell>
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
                    <TierBadge tier={c.tier} />
                  </TableCell>
                  <TableCell>
                    {podeEditar ? (
                      <ColetaCell c={c} onDate={(v) => updateClient(c.id, { lastCollectAt: v })} />
                    ) : (
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {c.lastCollectAt ? formatDateBR(c.lastCollectAt) : "sem data"}
                        </span>
                        <ColetaBadge c={c} />
                      </span>
                    )}
                    {cadenciaPorCliente.has(c.id) && (
                      <div
                        className="text-[11px] text-muted-foreground"
                        title="Média de dias entre coletas (Cadência de troca)"
                      >
                        a cada {formatNumero(cadenciaPorCliente.get(c.id) as number)} dias
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <VisitaBadge c={c} />
                  </TableCell>
                  <TableCell>
                    <PagamentoCell tem={comPagamento.has(c.id)} onOpen={() => setPagamento(c)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHistory(c)}
                        title="Histórico de visitas e trocas"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      {podeEditar && (
                        <>
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
                        </>
                      )}
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

      <ClientHistoryDialog
        key={`h-${history?.id ?? "none"}`}
        client={history}
        onClose={() => setHistory(null)}
      />

      <ClientPaymentsDialog
        key={`p-${pagamento?.id ?? "none"}`}
        client={pagamento}
        onClose={() => setPagamento(null)}
      />

      {novo && <NewClientDialog onClose={() => setNovo(false)} segmentOptions={segmentOptions} />}

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
  const { state, saveClientPayment, deleteClientPayment } = useData();
  const [name, setName] = useState(client?.name ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [city, setCity] = useState(client?.city ?? "");
  const [segment, setSegment] = useState(client?.segment ?? "");
  const [contato, setContato] = useState(client?.contato ?? "");
  const [active, setActive] = useState(client?.active ?? true);
  const [isProsp, setIsProsp] = useState(client?.isProspecao ?? false);
  const [lat, setLat] = useState<number | null>(client?.lat ?? null);
  const [lng, setLng] = useState<number | null>(client?.lng ?? null);

  // condições de pagamento (editáveis junto com o cadastro)
  type PagamentoDraft = {
    id: string;
    novo: boolean;
    valor: string;
    servico: string;
    modalidade: string;
    maquina: string;
  };
  const [pagamentos, setPagamentos] = useState<PagamentoDraft[]>(() =>
    client
      ? state.payments
          .filter((p) => p.clientId === client.id)
          .map((p) => ({
            id: p.id,
            novo: false,
            valor: p.valor ?? "",
            servico: p.servico ?? "",
            modalidade: p.modalidade ?? "",
            maquina: p.maquina ?? "",
          }))
      : [],
  );
  const [removidos, setRemovidos] = useState<string[]>([]);

  const SEG_NONE = "__none__";
  const segOptions = useMemo(
    () =>
      [...new Set([...(segment ? [segment] : []), ...segmentOptions])].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [segment, segmentOptions],
  );

  if (!client) return null;

  const points = lat != null && lng != null ? [{ lat, lng, label: client.name, color: "#2563eb" }] : [];

  const atualizarPagamento = (id: string, patch: Partial<PagamentoDraft>) =>
    setPagamentos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const adicionarPagamento = () =>
    setPagamentos((prev) => [
      ...prev,
      {
        id: `pag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        novo: true,
        valor: "",
        servico: "",
        modalidade: "",
        maquina: "",
      },
    ]);

  const removerPagamento = (p: PagamentoDraft) => {
    if (!p.novo) setRemovidos((prev) => [...prev, p.id]);
    setPagamentos((prev) => prev.filter((x) => x.id !== p.id));
  };

  /** salva o cadastro + as condições de pagamento (só o que mudou) */
  const salvar = () => {
    for (const id of removidos) deleteClientPayment(id);
    const originais = new Map(state.payments.map((p) => [p.id, p]));
    for (const p of pagamentos) {
      const antes = originais.get(p.id);
      const vazio = !p.valor.trim() && !p.servico.trim() && !p.modalidade.trim() && !p.maquina.trim();
      if (!antes && vazio) continue;
      const mudou =
        !antes ||
        (antes.valor ?? "") !== p.valor ||
        (antes.servico ?? "") !== p.servico ||
        (antes.modalidade ?? "") !== p.modalidade ||
        (antes.maquina ?? "") !== p.maquina;
      if (!mudou) continue;
      saveClientPayment({
        id: p.id,
        clientId: client.id,
        label: antes?.label ?? null,
        valor: p.valor,
        servico: p.servico || null,
        modalidade: p.modalidade || null,
        maquina: p.maquina || null,
      });
    }
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
    });
  };

  return (
    <Dialog open={!!client} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-2xl overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>
            Ajuste os dados, as condições de pagamento e clique no mapa para posicionar o cliente (usado na
            rota e na validação de presença).
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
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-primary" /> Pago
              <span className="font-normal text-muted-foreground">(condições de pagamento)</span>
            </Label>
            <Button type="button" variant="outline" size="sm" onClick={adicionarPagamento}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {pagamentos.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhuma condição registrada. Use “Adicionar” para lançar como o cliente paga.
            </p>
          )}
          {pagamentos.map((p, i) => (
            <div key={p.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {p.novo ? "Nova condição" : `Condição ${i + 1}`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removerPagamento(p)}
                  title="Remover esta condição"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor a pagar</Label>
                  <Input
                    value={p.valor}
                    onChange={(e) => atualizarPagamento(p.id, { valor: e.target.value })}
                    placeholder="R$ 800,00 · 35m³ · R$45,00 a ton"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de serviço</Label>
                  <Input
                    value={p.servico}
                    onChange={(e) => atualizarPagamento(p.id, { servico: e.target.value })}
                    placeholder="ROLL ON · POLI · PP · CARREG. NA HORA"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Modalidade</Label>
                  <Input
                    value={p.modalidade}
                    onChange={(e) => atualizarPagamento(p.id, { modalidade: e.target.value })}
                    placeholder="Fechamento mensal · Coletou pagou · Antecipação de 3 cargas"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">A pagar máquina</Label>
                  <Input
                    value={p.maquina}
                    onChange={(e) => atualizarPagamento(p.id, { maquina: e.target.value })}
                    placeholder="Não · Sim · R$440,00 (fixo)"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const HIST_STATUS_LABEL: Record<Visit["status"], string> = {
  realizada: "Visita realizada",
  nao_encontrado: "Não encontrado",
  recusada: "Recusado",
  nao_realizada: "Não realizada",
};

/** histórico do cliente: visitas registradas pelo vendedor + trocas/coletas */
function ClientHistoryDialog({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const { state, loadClientColetas } = useData();
  const [coletas, setColetas] = useState<
    Array<{ date: string; note: string; volume: number | null; trocas: number }>
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!client) {
      setColetas([]);
      return;
    }
    setLoading(true);
    void loadClientColetas(client.id).then((rows) => {
      setColetas(rows);
      setLoading(false);
    });
  }, [client, loadClientColetas]);

  if (!client) return null;

  const visitas = state.visits
    .filter((v) => v.clientId === client.id)
    .sort((a, b) => (a.visitedAt < b.visitedAt ? 1 : -1));

  // volume coletado por mês (das planilhas de entrada) — do mês mais recente para o mais antigo
  const volumes = state.volumes
    .filter((v) => v.clientId === client.id)
    .sort((a, b) => (a.month < b.month ? 1 : -1));
  const volumeTotal = volumes.reduce((acc, v) => acc + v.volumeM3, 0);

  type Linha =
    | { kind: "visita"; key: string; date: string; visit: Visit }
    | {
        kind: "troca";
        key: string;
        date: string;
        note: string;
        volume: number | null;
        trocas: number;
      };

  const linhas: Linha[] = [
    ...visitas.map((v) => ({
      kind: "visita" as const,
      key: `v-${v.id}`,
      date: v.visitedAt.slice(0, 10),
      visit: v,
    })),
    ...coletas.map((k) => ({
      kind: "troca" as const,
      key: `c-${k.date}`,
      date: k.date,
      note: k.note,
      volume: k.volume,
      trocas: k.trocas,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-lg overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>{client.name}</DialogTitle>
          <DialogDescription>
            Histórico de visitas e trocas/coletas · última troca:{" "}
            {client.lastCollectAt ? formatDateBR(client.lastCollectAt) : "—"}
            {coletas.length > 0 && ` · ${coletas.length} registro(s) de troca/coleta`}
          </DialogDescription>
        </DialogHeader>

        {volumes.length > 0 && (
          <div className="rounded-lg border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Volume por mês (m³)</span>
              <span className="text-xs text-muted-foreground">
                total {formatM3(volumeTotal)} m³
              </span>
            </div>
            <div className="mt-2 space-y-1 text-sm">
              {volumes.map((v) => (
                <div key={v.month} className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">{mesLabel(v.month)}</span>
                  <span className="tabular-nums">{formatM3(v.volumeM3)} m³</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground">Carregando histórico…</p>}

        {!loading && linhas.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma visita ou troca registrada ainda.</p>
        )}

        <div className="space-y-3">
          {linhas.map((l) => {
            if (l.kind === "troca") {
              return (
                <div key={l.key} className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{formatDateBR(l.date)}</span>
                    <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300">
                      Troca/coleta
                    </Badge>
                    {l.volume != null && (
                      <Badge className="bg-primary/10 text-primary">{formatM3(l.volume)} m³</Badge>
                    )}
                    {l.trocas > 1 && (
                      <span className="text-xs text-muted-foreground">{l.trocas} trocas</span>
                    )}
                  </div>
                  {l.note && <p className="mt-1 text-xs text-muted-foreground">{l.note}</p>}
                </div>
              );
            }
            const v = l.visit;
            const fotos = v.photos && v.photos.length > 0 ? v.photos : v.photoData ? [v.photoData] : [];
            return (
              <div key={l.key} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{formatDateBR(l.date)}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(v.visitedAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <Badge
                    className={
                      v.status === "realizada"
                        ? "bg-primary/10 text-primary"
                        : v.status === "nao_encontrado"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : v.status === "nao_realizada"
                            ? "bg-slate-500/15 text-slate-600 dark:text-slate-300"
                            : "bg-destructive/10 text-destructive"
                    }
                  >
                    {HIST_STATUS_LABEL[v.status]}
                  </Badge>
                </div>
                <div className="mt-1.5 text-sm">
                  <div className="text-xs font-medium text-muted-foreground">
                    {v.status === "nao_realizada" ? "Justificativa" : "O que foi feito"}
                  </div>
                  <p>{v.resultComments || "—"}</p>
                </div>
                {v.nextActions && (
                  <p className="mt-1 text-xs text-muted-foreground">Próxima visita: {v.nextActions}</p>
                )}
                {fotos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fotos.map((f, i) => (
                      <PhotoZoom
                        key={i}
                        src={f}
                        alt={`Foto ${i + 1}`}
                        imgClassName="h-16 w-20 rounded-md object-cover"
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
