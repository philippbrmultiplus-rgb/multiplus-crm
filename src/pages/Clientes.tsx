import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronDown,
  Clock,
  CheckCircle2,
  Download,
  FileSignature,
  Filter,
  History,
  Loader2,
  Map as MapIcon,
  MapPin,
  MapPinOff,
  Pencil,
  Phone,
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
import { useStickyState } from "@/hooks/use-sticky-state";
import { LeafletMap } from "@/components/map/LeafletMap";
import { cadenceLabel } from "@/lib/cadence";
import { agruparCidades, cidadeKey, formatDateBR, formatKm, formatM3, formatNumero, mesLabel } from "@/lib/geo";
import { SEGMENTOS_LOGISTICOS } from "@/lib/segmentos";
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
import {
  EQUIPAMENTOS_CONTRATO,
  baixarArquivo,
  gerarContratoDocx,
  montarContrato,
  nomeArquivoContrato,
  proximoNumeroContrato,
  type ContratoMontado,
} from "@/lib/contrato";
import { ContratoPreviewDialog } from "@/components/clients/ContratoPreviewDialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Client, ClientNote, Visit } from "@/lib/types";

const PROSPECTA = "__prospecao__";
/** rótulo usado quando o cliente não tem segmento comercial */
const SEM_SEGMENTO_COMERCIAL = "(sem segmento comercial)";

/** rótulos usados quando o cliente não tem o dado */
const SEM_CIDADE = "(sem cidade)";
const SEM_SEGMENTO = "(sem segmento)";

/** valores escolhidos num filtro (guardados juntos por "|"; vazio = todos) */
function escolhidos(valor: string | null | undefined): string[] {
  if (!valor || valor === "all" || valor === "todas" || valor === "todos") return [];
  return valor.split("|").filter(Boolean);
}

/** monta o valor do filtro a partir das opções marcadas */
function juntar(valores: string[]): string {
  return valores.length > 0 ? valores.join("|") : "all";
}

/** situação de coleta do cliente combina com a opção escolhida? */
function combinaColeta(c: Client, situacao: string): boolean {
  if (situacao === "sem_data") return c.lastCollectAt == null;
  if (situacao === "em_dia") return c.lastCollectAt != null && !isColetaOverdue(c);
  if (situacao === "atrasada") return isColetaOverdue(c);
  return false;
}

/** situação da visita do cliente combina com a opção escolhida? */
function combinaVisita(c: Client, situacao: string): boolean {
  if (situacao === "sem_visita") return c.lastVisitAt == null;
  if (situacao === "em_dia") return c.lastVisitAt != null && visitaStatus(c) !== "late";
  if (situacao === "sem_ou_atrasada") return c.lastVisitAt == null || visitaStatus(c) === "late";
  if (situacao === "atrasada") return visitaStatus(c) === "late";
  return false;
}

interface OpcaoFiltro {
  valor: string;
  label: string;
  contagem?: number;
}

/** filtro com várias opções marcáveis — as escolhas aparecem juntas na lista */
function FiltroMulti({
  titulo,
  valor,
  onChange,
  opcoes,
  largura = "w-48",
  vazio = "Todos",
}: {
  titulo: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: OpcaoFiltro[];
  largura?: string;
  vazio?: string;
}) {
  const selecionados = escolhidos(valor);
  const resumo =
    selecionados.length === 0
      ? vazio
      : selecionados.length === 1
        ? (opcoes.find((o) => o.valor === selecionados[0])?.label ?? selecionados[0])
        : `${selecionados.length} selecionados`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`h-9 justify-between gap-1 px-3 font-normal ${largura}`}
          title="Pode marcar mais de uma opção"
        >
          <span className="min-w-0 truncate">
            <span className="text-muted-foreground">{titulo}: </span>
            {resumo}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="max-h-72 space-y-0.5 overflow-y-auto overscroll-contain">
          {opcoes.map((opcao) => {
            const marcado = selecionados.includes(opcao.valor);
            return (
              <div
                key={opcao.valor}
                role="button"
                tabIndex={0}
                onClick={() =>
                  onChange(
                    marcado
                      ? juntar(selecionados.filter((v) => v !== opcao.valor))
                      : juntar([...selecionados, opcao.valor]),
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onChange(
                      marcado
                        ? juntar(selecionados.filter((v) => v !== opcao.valor))
                        : juntar([...selecionados, opcao.valor]),
                    );
                  }
                }}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox checked={marcado} className="pointer-events-none" tabIndex={-1} />
                <span className="min-w-0 flex-1 truncate">{opcao.label}</span>
                {opcao.contagem != null && (
                  <span className="text-xs text-muted-foreground">{opcao.contagem}</span>
                )}
              </div>
            );
          })}
        </div>
        {selecionados.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => onChange("all")}>
            Limpar seleção
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

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
  const { state, updateClient, geocodeAll, deleteClient, loadClientColetas, role, podeEditarClientes } =
    useData();
  const { clients } = state;
  const isMobile = useIsMobile();
  // edição/cadastro: coordenador ou vendedor com liberação temporária
  const podeEditar = podeEditarClientes;
  // exclusão definitiva e geocodificação continuam só com o coordenador
  const podeExcluir = role === "coordenador";
  const [history, setHistory] = useState<Client | null>(null);
  const [novo, setNovo] = useState(false);

  // filtros ficam guardados: ao sair da tela e voltar, continuam como você deixou
  const [search, setSearch] = useStickyState("rs-clientes-search", "");
  const [city, setCity] = useStickyState("rs-clientes-city", "all");
  const [tier, setTier] = useStickyState("rs-clientes-tier", "all");
  const [segment, setSegment] = useStickyState("rs-clientes-segment", "all");
  const [segmentoComercial, setSegmentoComercial] = useStickyState(
    "rs-clientes-segmento-comercial",
    "all",
  );
  const [params] = useSearchParams();
  const [situ, setSitu] = useStickyState("rs-clientes-situ", params.get("situ") ?? "todas");
  const [situVisita, setSituVisita] = useStickyState(
    "rs-clientes-situ-visita",
    params.get("situVisita") ?? "todas",
  );
  const [dist, setDist] = useStickyState("rs-clientes-dist", "todas");
  const [pago, setPago] = useStickyState("rs-clientes-pago", "todos");
  const [sortBy, setSortBy] = useStickyState<ClientSort>("rs-clientes-ordem", "nome");
  const [onlyActive, setOnlyActive] = useStickyState("rs-clientes-apenas-ativos", true);
  const [editing, setEditing] = useState<Client | null>(null);
  const [toDelete, setToDelete] = useState<Client | null>(null);
  const [pagamento, setPagamento] = useState<Client | null>(null);
  const [geocoding, setGeocoding] = useState<{ done: number; total: number; current: string } | null>(null);
  // links do painel (ex.: "Em risco") aplicam a situação ao abrir a tela
  useEffect(() => {
    const s = params.get("situ");
    const sv = params.get("situVisita");
    if (s) setSitu(s);
    if (sv) setSituVisita(sv);
  }, [params, setSitu, setSituVisita]);

  // atualiza o contador "há X dias" automaticamente
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // confere se o cliente passa em TODOS os filtros atuais (grupos com várias opções)
  const matchOutros = useCallback(
    (c: Client, ignore?: "cidade" | "segmento" | "segmentoComercial" | "grupo" | "situacao" | "visita" | "distancia" | "pago") => {
      const cidades = escolhidos(city);
      const segmentos = escolhidos(segment);
      const comerciais = escolhidos(segmentoComercial);
      const grupos = escolhidos(tier);
      const situacoes = escolhidos(situ);
      const visitas = escolhidos(situVisita);
      const distancias = escolhidos(dist);
      const pagamentos = escolhidos(pago);

      // segmento: com nada marcado a lista é a carteira (prospecções ficam fora)
      if (ignore !== "segmento") {
        if (segmentos.length === 0) {
          if (c.isProspecao) return false;
        } else {
          const alvo = c.isProspecao ? PROSPECTA : c.segment || SEM_SEGMENTO;
          if (!segmentos.includes(alvo)) return false;
        }
      }
      if (
        ignore !== "cidade" &&
        cidades.length > 0 &&
        !cidades.some((v) => cidadeKey(v) === cidadeKey(c.city || SEM_CIDADE))
      )
        return false;
      if (
        ignore !== "segmentoComercial" &&
        comerciais.length > 0 &&
        !comerciais.includes(c.segmentoComercial || SEM_SEGMENTO_COMERCIAL)
      )
        return false;
      if (ignore !== "grupo" && grupos.length > 0 && !grupos.includes(c.tier)) return false;
      // marcado: só clientes ativos; desmarcado: só os inativos
      if (onlyActive ? !c.active : c.active) return false;
      if (ignore !== "situacao" && situacoes.length > 0 && !situacoes.some((v) => combinaColeta(c, v)))
        return false;
      if (ignore !== "visita" && visitas.length > 0 && !visitas.some((v) => combinaVisita(c, v)))
        return false;
      if (
        ignore !== "distancia" &&
        distancias.length > 0 &&
        !distancias.includes(distanciaFaixa(c))
      )
        return false;
      if (
        ignore !== "pago" &&
        pagamentos.length > 0 &&
        !pagamentos.some((v) =>
          v === "receber" ? comAReceber.has(c.id) : v === "sim" ? comPagamento.has(c.id) : !comPagamento.has(c.id),
        )
      )
        return false;
      return true;
    },
    [
      city,
      segment,
      segmentoComercial,
      tier,
      onlyActive,
      situ,
      situVisita,
      dist,
      pago,
      comPagamento,
      comAReceber,
    ],
  );

  // cidades em ordem alfabética, agrupando grafias que só diferem por maiúscula/minúscula
  const cities = useMemo(() => {
    const lista = agruparCidades(
      clients.filter((c) => matchOutros(c, "cidade")).map((c) => c.city || SEM_CIDADE),
    );
    const faltando = escolhidos(city).filter(
      (v) => !lista.some((o) => cidadeKey(o.label) === cidadeKey(v)),
    );
    if (faltando.length === 0) return lista;
    return [...lista, ...faltando.map((label) => ({ label, count: 0 }))].sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    );
  }, [clients, matchOutros, city]);

  const segments = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clients) {
      if (!matchOutros(c, "segmento")) continue;
      const k = c.segment || SEM_SEGMENTO;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    for (const v of escolhidos(segment)) if (!map.has(v)) map.set(v, 0);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [clients, matchOutros, segment]);

  const segmentosComerciais = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clients) {
      if (!matchOutros(c, "segmentoComercial")) continue;
      const k = c.segmentoComercial || SEM_SEGMENTO_COMERCIAL;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    for (const v of escolhidos(segmentoComercial)) if (!map.has(v)) map.set(v, 0);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [clients, matchOutros, segmentoComercial]);

  const grupoOptions = useMemo(() => {
    const tiers = new Set<string>();
    for (const c of clients) if (matchOutros(c, "grupo")) tiers.add(c.tier);
    const marcados = escolhidos(tier);
    return (["A", "B", "C", "D"] as const).filter((t) => tiers.has(t) || marcados.includes(t));
  }, [clients, matchOutros, tier]);

  // clientes cuja forma de pagamento registrada é "À receber / A receber"
  const comAReceber = useMemo(() => {
    const ids = new Set<string>();
    for (const p of state.payments) {
      const modalidade = String(p.modalidade ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (p.clientId && /a\s*receber/i.test(modalidade)) ids.add(p.clientId);
    }
    return ids;
  }, [state.payments]);

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

  // clientes cujo último contato registrado foi por telefone
  const ultimoContatoTelefone = useMemo(() => {
    const ultimo = new Map<string, Visit>();
    for (const v of state.visits) {
      const atual = ultimo.get(v.clientId);
      if (!atual || v.visitedAt > atual.visitedAt) ultimo.set(v.clientId, v);
    }
    const ids = new Set<string>();
    for (const [id, v] of ultimo) if (v.tipoContato === "telefone") ids.add(id);
    return ids;
  }, [state.visits]);

  /** lista já filtrada e ordenada (sem o corte de 300) */
  const matching = useMemo(() => {
    const q = search.trim().toLowerCase();
    const semFiltroSegmento = escolhidos(segment).length === 0;
    const situacoes = escolhidos(situ);

    return clients
      .filter((c) => {
        // prospecções entram pela busca do nome; os outros filtros continuam valendo
        if (c.isProspecao && semFiltroSegmento) return q !== "" && matchOutros(c, "segmento");
        return matchOutros(c);
      })
      .filter((c) =>
        q
          ? `${c.name} ${c.address} ${c.city} ${c.segment} ${c.segmentoComercial ?? ""}`
              .toLowerCase()
              .includes(q)
          : true,
      )
      .sort((a, b) => {
        // a ordem escolhida manda: nome A–Z sempre alfabético
        if (sortBy === "nome") return compareClients(a, b, "nome");
        // a situação escolhida define a ordem: atrasada = da mais atrasada para baixo;
        // em dia = da mais em dia (menos dias sem coleta) para baixo
        if (situacoes.includes("atrasada")) {
          const da = coletaDays(a) ?? -1;
          const db = coletaDays(b) ?? -1;
          return db - da || compareClients(a, b, "grupo");
        }
        if (situacoes.includes("em_dia")) {
          const da = coletaDays(a) ?? Number.POSITIVE_INFINITY;
          const db = coletaDays(b) ?? Number.POSITIVE_INFINITY;
          return da - db || compareClients(a, b, "grupo");
        }
        return compareClients(a, b, sortBy);
      });
  }, [clients, search, sortBy, segment, matchOutros, situ]);

  /** a lista é longa: mostra até 300, mas o total filtrado continua contando todos */
  const filtered = useMemo(() => matching.slice(0, 300), [matching]);
  const filteredTotal = matching.length;

  const prospectCount = useMemo(() => clients.filter((c) => c.isProspecao).length, [clients]);

  const anyFilter =
    search.trim() !== "" ||
    escolhidos(city).length > 0 ||
    escolhidos(tier).length > 0 ||
    escolhidos(segment).length > 0 ||
    escolhidos(segmentoComercial).length > 0 ||
    escolhidos(situ).length > 0 ||
    escolhidos(situVisita).length > 0 ||
    escolhidos(dist).length > 0 ||
    escolhidos(pago).length > 0;

  const resetFilters = () => {
    setSearch("");
    setCity("all");
    setTier("all");
    setSegment("all");
    setSegmentoComercial("all");
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
    const pagamentoDe = (id: string) =>
      state.payments.filter((p) => p.clientId === id);
    const rows = filtered.map((c) => ({
      Nome: c.name,
      Segmento: c.segment || "",
      "Segmento comercial": c.segmentoComercial ?? "",
      "Valor pago": pagamentoDe(c.id)
        .map((p) => p.valor)
        .filter(Boolean)
        .join(" / "),
      "Forma de pagamento": pagamentoDe(c.id)
        .map((p) => p.modalidade)
        .filter(Boolean)
        .join(" / "),
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
          {podeExcluir && (
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
        <FiltroMulti
          titulo="Cidade"
          valor={city}
          onChange={setCity}
          largura="w-44"
          opcoes={cities.map(({ label, count }) => ({ valor: label, label, contagem: count }))}
        />
        <FiltroMulti
          titulo="Segmento"
          valor={segment}
          onChange={setSegment}
          opcoes={[
            ...(prospectCount > 0
              ? [{ valor: PROSPECTA, label: "Prospecção", contagem: prospectCount }]
              : []),
            ...segments.map(([nome, n]) => ({ valor: nome, label: nome, contagem: n })),
          ]}
        />
        <FiltroMulti
          titulo="Comercial"
          valor={segmentoComercial}
          onChange={setSegmentoComercial}
          largura="w-52"
          opcoes={segmentosComerciais.map(([nome, n]) => ({ valor: nome, label: nome, contagem: n }))}
        />
        <FiltroMulti
          titulo="Grupo"
          valor={tier}
          onChange={setTier}
          largura="w-36"
          opcoes={grupoOptions.map((t) => ({ valor: t, label: `Grupo ${t}` }))}
        />
        <FiltroMulti
          titulo="Coleta"
          valor={situ}
          onChange={setSitu}
          largura="w-40"
          opcoes={[
            { valor: "atrasada", label: "Coleta atrasada" },
            { valor: "em_dia", label: "Em dia" },
            { valor: "sem_data", label: "Sem data de coleta" },
          ]}
        />
        <FiltroMulti
          titulo="Visita"
          valor={situVisita}
          onChange={setSituVisita}
          largura="w-40"
          opcoes={[
            { valor: "atrasada", label: "Visita atrasada (>30 dias)" },
            { valor: "em_dia", label: "Visita em dia" },
            { valor: "sem_visita", label: "Sem visita registrada" },
            { valor: "sem_ou_atrasada", label: "Sem visita ou atrasada" },
          ]}
        />
        <FiltroMulti
          titulo="Distância"
          valor={dist}
          onChange={setDist}
          largura="w-40"
          opcoes={[
            { valor: "ate100", label: "Até 100 km" },
            { valor: "100a200", label: "100 a 200 km" },
            { valor: "200mais", label: "200 km ou mais" },
            { valor: "sem", label: "Sem coordenadas" },
          ]}
        />
        <FiltroMulti
          titulo="Pago"
          valor={pago}
          onChange={setPago}
          largura="w-40"
          opcoes={[
            { valor: "receber", label: "A receber", contagem: comAReceber.size },
            { valor: "sim", label: "Com condição de pagamento", contagem: comPagamento.size },
            { valor: "nao", label: "Sem condição" },
          ]}
        />
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
        <label
          className="flex h-9 items-center gap-2 text-sm text-muted-foreground"
          title="Marcado mostra só os ativos; desmarcado mostra só os inativos"
        >
          <Checkbox checked={onlyActive} onCheckedChange={(v) => setOnlyActive(!!v)} />
          {onlyActive ? "Só ativos" : "Só inativos"}
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
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {podeExcluir && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setToDelete(c)}
                      title="Excluir este cliente definitivamente"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
                <div className="min-w-0">
                  <span className="block text-[11px] text-muted-foreground">Segmento comercial</span>
                  <span className="block truncate">{c.segmentoComercial || "—"}</span>
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
                  <span className="flex flex-wrap items-center gap-1.5">
                    <VisitaBadge c={c} />
                    {ultimoContatoTelefone.has(c.id) && (
                      <Badge className="border border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-300">
                        <Phone className="mr-1 h-3 w-3" /> telefone
                      </Badge>
                    )}
                    {c.visitaAgendada && (
                      <Badge className="border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        <CalendarDays className="mr-1 h-3 w-3" /> agendada{" "}
                        {formatDateBR(c.visitaAgendada)}
                      </Badge>
                    )}
                  </span>
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
          <Table className="table-fixed [&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-1.5 [&_thead_tr]:bg-[#4169e1] [&_thead_th]:font-semibold [&_thead_th]:text-white">
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
                    {c.segmentoComercial && (
                      <div className="truncate text-[11px] text-muted-foreground">
                        {c.segmentoComercial}
                      </div>
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      <VisitaBadge c={c} />
                      {ultimoContatoTelefone.has(c.id) && (
                        <Badge className="border border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-300">
                          <Phone className="mr-1 h-3 w-3" /> telefone
                        </Badge>
                      )}
                      {c.visitaAgendada && (
                        <Badge className="border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          <CalendarDays className="mr-1 h-3 w-3" /> agendada{" "}
                          {formatDateBR(c.visitaAgendada)}
                        </Badge>
                      )}
                    </div>
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
                        <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {podeExcluir && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setToDelete(c)}
                          title="Excluir este cliente definitivamente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
        segmentOptions={SEGMENTOS_LOGISTICOS}
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

      {novo && (
        <NewClientDialog onClose={() => setNovo(false)} segmentOptions={SEGMENTOS_LOGISTICOS} />
      )}

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
  const { state, updateClient, saveClientPayment, deleteClientPayment } = useData();
  const [name, setName] = useState(client?.name ?? "");
  const [address, setAddress] = useState(client?.address ?? "");
  const [city, setCity] = useState(client?.city ?? "");
  const [segment, setSegment] = useState(client?.segment ?? "");
  const [segmentoComercial, setSegmentoComercial] = useState(client?.segmentoComercial ?? "");
  const [visitaAgendada, setVisitaAgendada] = useState(client?.visitaAgendada ?? "");
  const [contato, setContato] = useState(client?.contato ?? "");
  const [active, setActive] = useState(client?.active ?? true);
  const [isProsp, setIsProsp] = useState(client?.isProspecao ?? false);
  const [lat, setLat] = useState<number | null>(client?.lat ?? null);
  const [lng, setLng] = useState<number | null>(client?.lng ?? null);

  // dados do contrato de prestação de serviços (usados no documento em Word)
  const [cnpj, setCnpj] = useState(client?.cnpj ?? "");
  const [inscricaoEstadual, setInscricaoEstadual] = useState(client?.inscricaoEstadual ?? "");
  const [contratoNumero, setContratoNumero] = useState(
    client?.contratoNumero ?? (client ? proximoNumeroContrato(state.clients) : ""),
  );
  const [equipamento, setEquipamento] = useState(client?.equipamento ?? EQUIPAMENTOS_CONTRATO[0]);
  const [equipamentosQtd, setEquipamentosQtd] = useState(String(client?.equipamentosQtd ?? 1));
  const [trocasMinimas, setTrocasMinimas] = useState(String(client?.trocasMinimas ?? 1));
  const [valorTroca, setValorTroca] = useState(client?.valorTroca ?? "");
  const [diaPagamento, setDiaPagamento] = useState(String(client?.diaPagamento ?? 10));
  const [formaPagamento, setFormaPagamento] = useState(client?.formaPagamento ?? "Fechamento mensal");
  const [localColeta, setLocalColeta] = useState(client?.localColeta ?? "");
  const [previa, setPrevia] = useState<ContratoMontado | null>(null);
  const [baixando, setBaixando] = useState(false);

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
      segmentoComercial: segmentoComercial.trim() || null,
      visitaAgendada: visitaAgendada || null,
      contato: contato.trim() || null,
      active,
      isProspecao: isProsp,
      lat,
      lng,
      geocodeStatus: lat != null ? "ok" : client.geocodeStatus,
      // contrato: número, CNPJ, equipamento, valores e local da coleta
      ...dadosContrato(),
    });
  };

  /** dados do contrato como estão no formulário (gravados ao gerar e ao salvar) */
  const dadosContrato = (): Partial<Client> => ({
    cnpj: cnpj.trim() || null,
    inscricaoEstadual: inscricaoEstadual.trim() || null,
    contratoNumero: contratoNumero.trim() || null,
    equipamento,
    equipamentosQtd: Number(equipamentosQtd) || 1,
    trocasMinimas: Number(trocasMinimas) || 0,
    valorTroca: valorTroca.trim() || null,
    diaPagamento: Number(diaPagamento) || 10,
    formaPagamento: formaPagamento.trim() || null,
    localColeta: localColeta.trim() || null,
  });

  /**
   * Grava os dados do contrato no cadastro e monta o documento para
   * a pré-visualização (só depois, se estiver tudo certo, ele é baixado).
   */
  const abrirPreviaContrato = () => {
    if (!client) return;
    // se o número ainda não foi informado, usa o próximo e já grava (para não repetir)
    const numero = contratoNumero.trim() || proximoNumeroContrato(state.clients);
    if (!contratoNumero.trim()) setContratoNumero(numero);
    const patch: Partial<Client> = { ...dadosContrato(), contratoNumero: numero };
    updateClient(client.id, patch);
    setPrevia(
      montarContrato({
        numero,
        cliente: { ...client, ...patch },
        settings: state.settings,
      }),
    );
  };

  /** baixa o contrato em Word exatamente como está na prévia */
  const baixarContrato = async () => {
    if (!previa) return;
    setBaixando(true);
    try {
      const blob = await gerarContratoDocx(previa);
      baixarArquivo(blob, nomeArquivoContrato(previa.clienteNome, previa.numero));
      toast.success("Contrato gerado", {
        description: `Nº ${previa.numero} — arquivo Word pronto para assinatura`,
      });
    } catch (err) {
      toast.error("Não foi possível gerar o contrato", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBaixando(false);
    }
  };

  return (
    <>
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
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Paulínia" />
          </div>
          <div className="space-y-2">
            <Label>Segmento logístico</Label>
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
            <Label>Segmento comercial</Label>
            <Input
              value={segmentoComercial}
              onChange={(e) => setSegmentoComercial(e.target.value)}
              placeholder="Ex.: construtora, gesseiro, entulho…"
            />
          </div>
          <div className="space-y-2">
            <Label>Contato</Label>
            <Input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="(51) 9 9999-9999" />
          </div>
          <div className="space-y-2">
            <Label>
              Visita agendada <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                className="w-44"
                value={visitaAgendada}
                onChange={(e) => setVisitaAgendada(e.target.value)}
              />
              {visitaAgendada && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setVisitaAgendada("")}>
                  Remover data
                </Button>
              )}
            </div>
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
            center={lat != null && lng != null ? [lat, lng] : [-22.7819623, -47.128651]}
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

          {/* contrato de prestação de serviços: dados usados no documento em Word */}
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <FileSignature className="h-4 w-4" /> Contrato de prestação de serviços
              </span>
              <span className="text-xs text-muted-foreground">
                preenche o modelo com os dados deste cliente
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nº do contrato</Label>
                <Input
                  value={contratoNumero}
                  onChange={(e) => setContratoNumero(e.target.value)}
                  placeholder="26351"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CNPJ do cliente</Label>
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Inscrição estadual</Label>
                <Input
                  value={inscricaoEstadual}
                  onChange={(e) => setInscricaoEstadual(e.target.value)}
                  placeholder="ISENTO"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Equipamento</Label>
                <Select value={equipamento} onValueChange={setEquipamento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o equipamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set([equipamento, ...EQUIPAMENTOS_CONTRATO].filter(Boolean))].map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={equipamentosQtd}
                  onChange={(e) => setEquipamentosQtd(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Trocas mínimas/mês</Label>
                <Input
                  type="number"
                  min={0}
                  value={trocasMinimas}
                  onChange={(e) => setTrocasMinimas(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor por troca</Label>
                <Input
                  value={valorTroca}
                  onChange={(e) => setValorTroca(e.target.value)}
                  placeholder="R$ 300,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Dia de pagamento</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={diaPagamento}
                  onChange={(e) => setDiaPagamento(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Forma de pagamento</Label>
                <Input
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  placeholder="Fechamento mensal · Coletou pagou"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-3">
                <Label className="text-xs">Local da coleta</Label>
                <Input
                  value={localColeta}
                  onChange={(e) => setLocalColeta(e.target.value)}
                  placeholder={[address, city, state].filter(Boolean).join(" - ")}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={abrirPreviaContrato}>
                <FileSignature className="mr-2 h-4 w-4" />
                Gerar contrato
              </Button>
              <span className="text-xs text-muted-foreground">
                abre a prévia para conferir os dados antes de baixar em Word
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ContratoPreviewDialog
      montado={previa}
      onClose={() => setPrevia(null)}
      onBaixar={() => void baixarContrato()}
      baixando={baixando}
    />
      </>
  );
}

const HIST_STATUS_LABEL: Record<Visit["status"], string> = {
  realizada: "Visita realizada",
  nao_encontrado: "Não encontrado",
  recusada: "Recusado",
  nao_realizada: "Não realizada",
};

/** histórico de observações do cliente (mais recente primeiro) */
function ObservacoesCliente({
  clientId,
  podeExcluir,
}: {
  clientId: string;
  podeExcluir: (nota: ClientNote) => boolean;
}) {
  const { state, deleteClientNote } = useData();
  const notas = state.clientNotes
    .filter((n) => n.clientId === clientId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (notas.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhuma observação registrada ainda.</p>;
  }

  return (
    <ul className="max-h-60 space-y-1.5 overflow-y-auto overscroll-contain">
      {notas.map((n) => (
        <li key={n.id} className="rounded-md border px-2 py-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">
              {formatDateBR(n.createdAt.slice(0, 10))} ·{" "}
              {new Date(n.createdAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {n.createdByName ? ` · ${n.createdByName}` : ""}
            </span>
            {podeExcluir(n) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                title="Excluir esta observação"
                onClick={() => deleteClientNote(n.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{n.texto}</p>
        </li>
      ))}
    </ul>
  );
}

/** histórico do cliente: visitas registradas pelo vendedor + trocas/coletas */
function ClientHistoryDialog({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const { state, user, role, loadClientColetas, addClientNote, podeEditarClientes } = useData();
  const [observacao, setObservacao] = useState("");
  const podeObservar = role === "coordenador" || role === "vendedor" || podeEditarClientes;
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
            Histórico do cliente · observações, visitas e trocas/coletas · última troca:{" "}
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

        {/* observações: ficam aqui, no histórico do cliente, com data e autor */}
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" /> Observações
            </span>
            <span className="text-xs text-muted-foreground">fica salvo com a data</span>
          </div>
          {podeObservar && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: portão 2 é o acesso do caminhão; pediu para não coletar nas sextas…"
                className="min-h-[60px]"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!observacao.trim()}
                onClick={() => {
                  addClientNote(client.id, observacao);
                  setObservacao("");
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Registrar
              </Button>
            </div>
          )}
          <ObservacoesCliente
            clientId={client.id}
            podeExcluir={(n) => role === "coordenador" || n.createdBy === user?.id}
          />
        </div>

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
                  {v.tipoContato === "telefone" && (
                    <Badge className="border border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-300">
                      <Phone className="mr-1 h-3 w-3" /> Contato via telefone
                    </Badge>
                  )}
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
