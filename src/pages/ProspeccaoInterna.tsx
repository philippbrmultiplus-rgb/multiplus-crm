import { useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useData } from "@/lib/DataContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { agruparCidades, canonicalCidade, cidadeKey, formatDateBR } from "@/lib/geo";
import { SEGMENTOS_LOGISTICOS, SEGMENTO_EM_ANALISE } from "@/lib/segmentos";
import type { InternalProspect } from "@/lib/types";

const VAZIO = "";

/** data e hora (fuso local) de uma anotação */
function dataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** cadastro interno de prospecção: ficha do cliente conversado, sem visita em campo */
export default function ProspeccaoInterna() {
  const { state, role, user, addInternalProspect, deleteInternalProspect } = useData();
  const { internalProspects, internalProspectNotes, clients } = state;
  const isMobile = useIsMobile();
  // o gerente é somente leitura; coordenador e vendedor cadastram
  const podeCadastrar = role === "coordenador" || role === "vendedor";

  const [nome, setNome] = useState(VAZIO);
  const [cidade, setCidade] = useState(VAZIO);
  const [endereco, setEndereco] = useState(VAZIO);
  const [contato, setContato] = useState(VAZIO);
  const [telefone, setTelefone] = useState(VAZIO);
  const [segmentoComercial, setSegmentoComercial] = useState(VAZIO);
  const [segmentoLogistico, setSegmentoLogistico] = useState(VAZIO);
  const [observacoes, setObservacoes] = useState(VAZIO);
  const [visitaAgendada, setVisitaAgendada] = useState(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<InternalProspect | null>(null);
  // ficha aberta para visualizar / acrescentar informações
  const [detalhe, setDetalhe] = useState<InternalProspect | null>(null);

  /** quantas informações de histórico cada prospecção tem */
  const notasPorProspect = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const n of internalProspectNotes) {
      mapa.set(n.prospectId, (mapa.get(n.prospectId) ?? 0) + 1);
    }
    return mapa;
  }, [internalProspectNotes]);
  // filtros da lista
  const [filtroCidade, setFiltroCidade] = useState("all");
  const [filtroSegmento, setFiltroSegmento] = useState("all");

  /** opções dos filtros, a partir das fichas já registradas */
  /** cidades das prospecções internas, sem duplicar grafias */
  const cidades = useMemo(
    () => agruparCidades(internalProspects.map((p) => p.cidade || "(sem cidade)")).map((g) => g.label),
    [internalProspects],
  );

  const segmentosLog = useMemo(() => {
    const set = new Set<string>();
    for (const p of internalProspects) set.add(p.segmentoLogistico || "(sem segmento)");
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [internalProspects]);

  const filtradas = useMemo(
    () =>
      internalProspects
        .filter((p) =>
          filtroCidade === "all"
            ? true
            : cidadeKey(p.cidade || "(sem cidade)") === cidadeKey(filtroCidade),
        )
        .filter((p) =>
          filtroSegmento === "all"
            ? true
            : (p.segmentoLogistico || "(sem segmento)") === filtroSegmento,
        ),
    [internalProspects, filtroCidade, filtroSegmento],
  );

  const temFiltro = filtroCidade !== "all" || filtroSegmento !== "all";

  /** segmentos logísticos da prospecção interna: os oficiais + "Em análise" */
  const segmentos = [...SEGMENTOS_LOGISTICOS, SEGMENTO_EM_ANALISE];

  /**
   * Cidades já salvas (clientes + prospecções internas), sem duplicar por
   * maiúscula/minúscula ou acento — usadas nas sugestões e para padronizar a gravação.
   */
  const cidadesSalvas = useMemo(
    () => agruparCidades([...clients.map((c) => c.city), ...internalProspects.map((p) => p.cidade)]).map((o) => o.label),
    [clients, internalProspects],
  );

  const salvar = () => {
    const faltando: string[] = [];
    if (!nome.trim()) faltando.push("nome do cliente");
    if (!cidade.trim()) faltando.push("cidade");
    if (!segmentoLogistico) faltando.push("segmento logístico");
    if (!segmentoComercial.trim()) faltando.push("segmento comercial");
    if (faltando.length > 0) {
      setErro(`Preencha: ${faltando.join(", ")}.`);
      return;
    }
    setErro(null);
    addInternalProspect({
      nome: nome.trim(),
      // grava com a grafia já existente (evita "porto alegre" e "Porto Alegre" duplicados)
      cidade: canonicalCidade(cidade, cidadesSalvas),
      endereco: endereco.trim(),
      contato: contato.trim(),
      telefone: telefone.trim(),
      segmentoComercial: segmentoComercial.trim(),
      segmentoLogistico,
      observacoes: observacoes.trim(),
      visitaAgendada: visitaAgendada || null,
    });
    setNome(VAZIO);
    setCidade(VAZIO);
    setEndereco(VAZIO);
    setContato(VAZIO);
    setTelefone(VAZIO);
    setSegmentoComercial(VAZIO);
    setSegmentoLogistico(VAZIO);
    setObservacoes(VAZIO);
    setVisitaAgendada(VAZIO);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Prospecção interna</h1>
        <p className="text-sm text-muted-foreground">
          Ficha de prospecção preenchida internamente (sem visita em campo) · {internalProspects.length}{" "}
          registro(s)
        </p>
      </div>

      {podeCadastrar && (
        <Card className="card-soft">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4 text-primary" /> Nova prospecção interna
            </CardTitle>
            <CardDescription>
              Preencha os dados do cliente e o que foi conversado. Fica salvo na lista abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ip-nome">
                  Nome do cliente <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ip-nome"
                  value={nome}
                  onChange={(e) => {
                    setNome(e.target.value);
                    if (e.target.value.trim()) setErro(null);
                  }}
                  placeholder="Ex.: Construtora Horizonte"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ip-cidade">
                  Cidade <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ip-cidade"
                  list="ip-cidades"
                  value={cidade}
                  onChange={(e) => {
                    setCidade(e.target.value);
                    if (e.target.value.trim()) setErro(null);
                  }}
                  onBlur={() => {
                    const padrao = canonicalCidade(cidade, cidadesSalvas);
                    if (padrao && padrao !== cidade) setCidade(padrao);
                  }}
                  placeholder="Comece a digitar a cidade"
                />
                <datalist id="ip-cidades">
                  {cidadesSalvas.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  As cidades já cadastradas aparecem conforme você digita.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ip-contato">Contato</Label>
                <Input
                  id="ip-contato"
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  placeholder="Nome de quem atendeu"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ip-endereco">Endereço completo</Label>
                <Input
                  id="ip-endereco"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Rua, número, bairro, cidade"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ip-telefone">Número do telefone</Label>
                <Input
                  id="ip-telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(51) 9 9999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ip-comercial">
                  Segmento comercial <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ip-comercial"
                  value={segmentoComercial}
                  onChange={(e) => {
                    setSegmentoComercial(e.target.value);
                    if (e.target.value.trim()) setErro(null);
                  }}
                  placeholder="Ex.: construtora, gesseiro, entulho…"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>
                  Segmento logístico <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={segmentoLogistico}
                  onValueChange={(v) => {
                    setSegmentoLogistico(v);
                    setErro(null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar segmento logístico" />
                  </SelectTrigger>
                  <SelectContent>
                    {segmentos.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Use <b>{SEGMENTO_EM_ANALISE}</b> quando o segmento logístico ainda não estiver
                  definido — a definição acontece depois.
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>
                  Agendar visita <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    className="w-44"
                    value={visitaAgendada}
                    onChange={(e) => setVisitaAgendada(e.target.value)}
                  />
                  {visitaAgendada && (
                    <Button variant="ghost" size="sm" onClick={() => setVisitaAgendada("")}>
                      Remover data
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Marcando uma data, ela aparece em destaque na montagem da rota da semana.
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ip-obs">Observações — o que foi conversado</Label>
                <Textarea
                  id="ip-obs"
                  rows={3}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex.: falei com o encarregado, pediu proposta para 2 caçambas por semana…"
                />
              </div>
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <div className="flex justify-end">
              <Button onClick={salvar}>
                <Plus className="mr-1.5 h-4 w-4" /> Salvar prospecção
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="card-soft flex flex-wrap items-end gap-2 p-3">
        <Select value={filtroCidade} onValueChange={setFiltroCidade}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as cidades</SelectItem>
            {cidades.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroSegmento} onValueChange={setFiltroSegmento}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Segmento logístico" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os segmentos logísticos</SelectItem>
            {segmentosLog.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {temFiltro && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFiltroCidade("all");
              setFiltroSegmento("all");
            }}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Limpar filtros
          </Button>
        )}
      </div>

      <Card className="card-soft">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" /> Prospecções internas registradas
          </CardTitle>
          <CardDescription>
            Fichas preenchidas pela equipe, da mais recente para a mais antiga · {filtradas.length} de{" "}
            {internalProspects.length} registro(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {internalProspects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma prospecção interna registrada ainda.</p>
          ) : filtradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma prospecção interna corresponde aos filtros atuais.
            </p>
          ) : (
            <div className={isMobile ? "space-y-3" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3"}>
              {filtradas.map((p) => {
                const podeExcluir = role === "coordenador" || p.createdBy === user?.id;
                return (
                  <div
                    key={p.id}
                    className="cursor-pointer space-y-2 rounded-lg border p-3 text-sm transition-colors hover:bg-secondary/40"
                    onClick={() => setDetalhe(p)}
                    title="Clique para ver todos os dados e o histórico"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold leading-tight">{p.nome}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {[p.cidade, p.segmentoComercial].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      {podeExcluir && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                          title="Remover esta prospecção interna"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExcluir(p);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {p.visitaAgendada && (
                        <Badge className="border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          <CalendarDays className="mr-1 h-3 w-3" /> Visita agendada{" "}
                          {formatDateBR(p.visitaAgendada)}
                        </Badge>
                      )}
                      {p.segmentoLogistico && <Badge variant="outline">{p.segmentoLogistico}</Badge>}
                      {p.segmentoComercial && (
                        <Badge className="bg-primary/10 text-primary">{p.segmentoComercial}</Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      {p.endereco && (
                        <p>
                          <b className="font-medium text-foreground">Endereço:</b> {p.endereco}
                        </p>
                      )}
                      {p.contato && (
                        <p>
                          <b className="font-medium text-foreground">Contato:</b> {p.contato}
                        </p>
                      )}
                      {p.telefone && (
                        <p>
                          <b className="font-medium text-foreground">Telefone:</b> {p.telefone}
                        </p>
                      )}
                    </div>

                    {p.observacoes && (
                      <p className="rounded-md bg-secondary/50 p-2 text-xs">
                        <b className="font-medium">O que foi conversado:</b> {p.observacoes}
                      </p>
                    )}

                    <p className="text-[11px] text-muted-foreground">
                      {formatDateBR(p.createdAt.slice(0, 10))}
                      {p.createdByName ? ` · ${p.createdByName}` : ""}
                      {notasPorProspect.get(p.id)
                        ? ` · ${notasPorProspect.get(p.id)} informação(ões) no histórico`
                        : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ProspectDetailDialog
        key={detalhe?.id ?? "none"}
        prospect={detalhe}
        onClose={() => setDetalhe(null)}
      />

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir prospecção interna?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir ? `A ficha de "${excluir.nome}" será removida. Essa ação não pode ser desfeita.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (excluir) deleteInternalProspect(excluir.id);
                setExcluir(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** janela com todos os dados da prospecção interna + histórico de conversa */
function ProspectDetailDialog({
  prospect,
  onClose,
}: {
  prospect: InternalProspect | null;
  onClose: () => void;
}) {
  const {
    state,
    role,
    user,
    addInternalProspectNote,
    deleteInternalProspectNote,
    scheduleInternalVisit,
  } = useData();
  const [texto, setTexto] = useState("");
  const [dataVisita, setDataVisita] = useState(prospect?.visitaAgendada ?? "");
  // a ficha pode mudar enquanto a janela está aberta (ex.: agendar visita)
  const atual = prospect
    ? (state.internalProspects.find((p) => p.id === prospect.id) ?? prospect)
    : null;
  if (!atual) return null;

  const podeEscrever = role === "coordenador" || role === "vendedor";
  const notas = state.internalProspectNotes
    .filter((n) => n.prospectId === atual.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  // histórico: o que foi conversado no cadastro + o que foi acrescentado depois
  const historico: Array<{
    id: string;
    texto: string;
    createdAt: string;
    createdByName?: string | null;
    inicial: boolean;
  }> = [
    ...(atual.observacoes
      ? [
          {
            id: "cadastro",
            texto: atual.observacoes,
            createdAt: atual.createdAt,
            createdByName: atual.createdByName,
            inicial: true,
          },
        ]
      : []),
    ...notas.map((n) => ({
      id: n.id,
      texto: n.texto,
      createdAt: n.createdAt,
      createdByName: n.createdByName,
      inicial: false,
    })),
  ];

  const acrescentar = () => {
    if (!texto.trim()) return;
    addInternalProspectNote(atual.id, texto);
    setTexto("");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-lg overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>{atual.nome}</DialogTitle>
          <DialogDescription>
            {[atual.cidade, atual.segmentoLogistico].filter(Boolean).join(" · ") ||
              "Prospecção interna"}{" "}
            · cadastrada em {formatDateBR(atual.createdAt.slice(0, 10))}
            {atual.createdByName ? ` por ${atual.createdByName}` : ""}
          </DialogDescription>
        </DialogHeader>

        {atual.visitaAgendada && (
          <Badge className="w-fit border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <CalendarDays className="mr-1 h-3 w-3" /> Visita agendada{" "}
            {formatDateBR(atual.visitaAgendada)}
          </Badge>
        )}

        <div className="space-y-1.5 text-sm">
          {atual.endereco && (
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Endereço completo</span>
              {atual.endereco}
            </div>
          )}
          {atual.contato && (
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Contato</span>
              {atual.contato}
            </div>
          )}
          {atual.telefone && (
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Telefone</span>
              {atual.telefone}
            </div>
          )}
          {atual.segmentoComercial && (
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Segmento comercial</span>
              {atual.segmentoComercial}
            </div>
          )}
          {atual.segmentoLogistico && (
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Segmento logístico</span>
              {atual.segmentoLogistico}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <Label className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> Agendar visita
          </Label>
          {podeEscrever ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                className="w-40"
                value={dataVisita}
                onChange={(e) => setDataVisita(e.target.value)}
              />
              <Button
                size="sm"
                onClick={() => scheduleInternalVisit(atual.id, dataVisita || null)}
                disabled={!dataVisita}
              >
                Salvar data
              </Button>
              {atual.visitaAgendada && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => {
                    setDataVisita("");
                    scheduleInternalVisit(atual.id, null);
                  }}
                >
                  Remover agendamento
                </Button>
              )}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {atual.visitaAgendada
              ? `Visita marcada para ${formatDateBR(atual.visitaAgendada)} — aparece em destaque na montagem da rota da semana.`
              : "Sem visita agendada. Ao marcar uma data, ela aparece em destaque na montagem da rota da semana."}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Histórico de conversa</span>
            <span className="text-xs text-muted-foreground">{historico.length} registro(s)</span>
          </div>
          {historico.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma conversa registrada ainda. Use o campo abaixo para acrescentar.
            </p>
          ) : (
            <ol className="space-y-2">
              {historico.map((h) => {
                const nota = notas.find((n) => n.id === h.id);
                const podeExcluir = !!nota && (role === "coordenador" || nota.createdBy === user?.id);
                return (
                  <li
                    key={h.id}
                    className={`rounded-lg border p-2 text-sm ${h.inicial ? "bg-secondary/40" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {dataHora(h.createdAt)}
                        {h.createdByName ? ` · ${h.createdByName}` : ""}
                        {h.inicial ? " · cadastro" : ""}
                      </span>
                      {podeExcluir && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          title="Excluir esta anotação"
                          onClick={() => deleteInternalProspectNote(h.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{h.texto}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {podeEscrever && (
          <div className="space-y-1.5">
            <Label htmlFor="ip-nova-info">Acrescentar informação</Label>
            <Textarea
              id="ip-nova-info"
              rows={3}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex.: cliente retornou hoje pedindo proposta revisada para 3 caçambas…"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={acrescentar} disabled={!texto.trim()}>
                <Plus className="mr-1.5 h-4 w-4" /> Acrescentar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
