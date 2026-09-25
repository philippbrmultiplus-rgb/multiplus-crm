import { useMemo, useState } from "react";
import { Building2, ChevronDown, Lock, Phone, Search, Target, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useData } from "@/lib/DataContext";
import { addDays, DAY_NAMES, formatDateBR, mondayOf } from "@/lib/geo";
import type { Client, ProspeccaoStatus, Visit } from "@/lib/types";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "2026-09" -> "Setembro 2026" */
function mesLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[(m || 1) - 1]} ${y}`;
}

const STATUS_LABEL: Record<ProspeccaoStatus, string> = {
  em_negociacao: "Em negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

const STATUS_TONE: Record<ProspeccaoStatus, string> = {
  em_negociacao: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  fechado: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  perdido: "bg-destructive/15 text-destructive",
};

export default function Prospeccoes() {
  const { state, setProspeccaoStatus, deleteClient, role } = useData();
  const { clients, visits } = state;
  const podeExcluir = role === "coordenador";

  const [search, setSearch] = useState("");
  const [situ, setSitu] = useState("todas");
  const [lostTarget, setLostTarget] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [detailTarget, setDetailTarget] = useState<Client | null>(null);
  // seções abertas/fechadas (mês e semana)
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (key: string, defaultOpen: boolean) => toggled[key] ?? defaultOpen;
  const toggle = (key: string, current: boolean) =>
    setToggled((t) => ({ ...t, [key]: !current }));

  const lastVisitOf = useMemo(() => {
    const map = new Map<string, Visit>();
    for (const v of visits) {
      const cur = map.get(v.clientId);
      if (!cur || v.visitedAt > cur.visitedAt) map.set(v.clientId, v);
    }
    return map;
  }, [visits]);

  const prospects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => c.isProspecao)
      .filter((c) => {
        if (situ === "todas") return true;
        return (c.prospeccaoStatus ?? "em_negociacao") === situ;
      })
      .filter((c) =>
        q ? `${c.name} ${c.responsavel ?? ""} ${c.city} ${c.segment}`.toLowerCase().includes(q) : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [clients, search, situ]);

  const counts = useMemo(() => {
    const all = clients.filter((c) => c.isProspecao);
    return {
      total: all.length,
      em_negociacao: all.filter((c) => (c.prospeccaoStatus ?? "em_negociacao") === "em_negociacao").length,
      fechado: all.filter((c) => c.prospeccaoStatus === "fechado").length,
      perdido: all.filter((c) => c.prospeccaoStatus === "perdido").length,
    };
  }, [clients]);

  /** agrupa por mês > semana > dia (data do registro da prospecção); sem data vai no fim */
  const { hierarchy, semData } = useMemo(() => {
    const months = new Map<string, Map<string, Map<string, Client[]>>>();
    const sem: Client[] = [];
    for (const c of prospects) {
      const v = lastVisitOf.get(c.id);
      if (!v) {
        sem.push(c);
        continue;
      }
      const date = v.visitedAt.slice(0, 10);
      const month = date.slice(0, 7);
      const week = mondayOf(date);
      const byWeek = months.get(month) ?? new Map<string, Map<string, Client[]>>();
      const byDay = byWeek.get(week) ?? new Map<string, Client[]>();
      const list = byDay.get(date) ?? [];
      list.push(c);
      byDay.set(date, list);
      byWeek.set(week, byDay);
      months.set(month, byWeek);
    }
    const hier = [...months.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, weeks]) => {
        const weeksArr = [...weeks.entries()]
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .map(([week, days]) => {
            const daysArr = [...days.entries()]
              .sort((a, b) => (a[0] < b[0] ? 1 : -1))
              .map(([date, items]) => ({ date, items }));
            return { week, days: daysArr, total: daysArr.reduce((n, d) => n + d.items.length, 0) };
          });
        return { month, weeks: weeksArr, total: weeksArr.reduce((n, w) => n + w.total, 0) };
      });
    return { hierarchy: hier, semData: sem };
  }, [prospects, lastVisitOf]);

  const renderCard = (c: Client) => (
    <ProspectCard
      key={c.id}
      client={c}
      visit={lastVisitOf.get(c.id)}
      canDelete={podeExcluir}
      onOpen={() => setDetailTarget(c)}
      onFinalize={(s) =>
        s === "fechado" ? setProspeccaoStatus(c.id, "fechado") : setLostTarget(c)
      }
      onDelete={() => setDeleteTarget(c)}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prospecções</h1>
          <p className="text-sm text-muted-foreground">
            Toda prospecção entra como <b>Em negociação</b>. Depois só pode ser finalizada como{" "}
            <b>Fechado</b> ou <b>Perdido</b> — e não muda mais.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge className={STATUS_TONE.em_negociacao}>Em negociação {counts.em_negociacao}</Badge>
          <Badge className={STATUS_TONE.fechado}>Fechado {counts.fechado}</Badge>
          <Badge className={STATUS_TONE.perdido}>Perdido {counts.perdido}</Badge>
        </div>
      </div>

      <div className="card-soft flex flex-wrap items-end gap-2 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por cliente, responsável, cidade ou segmento…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={situ} onValueChange={setSitu}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as situações</SelectItem>
            <SelectItem value="em_negociacao">Em negociação</SelectItem>
            <SelectItem value="fechado">Fechado</SelectItem>
            <SelectItem value="perdido">Perdido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {prospects.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-3 p-12 text-center">
          <Target className="h-8 w-8 text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">
            {counts.total === 0
              ? "Nenhuma prospecção registrada ainda. Registre em “Nova prospecção” na sua rota (hoje ou semana)."
              : "Nenhuma prospecção corresponde aos filtros atuais."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {hierarchy.map((m, mi) => {
            const monthOpen = isOpen(`m:${m.month}`, mi === 0);
            return (
              <section key={m.month} className="card-soft overflow-hidden">
                <button
                  onClick={() => toggle(`m:${m.month}`, monthOpen)}
                  className="flex w-full items-center justify-between gap-2 p-3 text-left transition-colors hover:bg-secondary/40"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition-transform ${monthOpen ? "rotate-180" : ""}`}
                    />
                    {mesLabel(m.month)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {m.total} prospecção(ões) · {m.weeks.length} semana(s)
                  </span>
                </button>

                {monthOpen && (
                  <div className="space-y-3 border-t p-3">
                    {m.weeks.map((w, wi) => {
                      const weekOpen = isOpen(`w:${w.week}`, mi === 0 && wi === 0);
                      return (
                        <div key={w.week} className="rounded-lg border">
                          <button
                            onClick={() => toggle(`w:${w.week}`, weekOpen)}
                            className="flex w-full items-center justify-between gap-2 p-2.5 text-left transition-colors hover:bg-secondary/40"
                          >
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <ChevronDown
                                className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                                  weekOpen ? "rotate-180" : ""
                                }`}
                              />
                              Semana {formatDateBR(w.week)} a {formatDateBR(addDays(w.week, 6))}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {w.total} prospecção(ões) · {w.days.length} dia(s)
                            </span>
                          </button>

                          {weekOpen && (
                            <div className="space-y-4 border-t p-2.5">
                              {w.days.map((d) => (
                                <div key={d.date}>
                                  <div className="mb-1.5 flex items-baseline gap-2">
                                    <h3 className="text-sm font-semibold">
                                      {DAY_NAMES[new Date(`${d.date}T12:00:00`).getDay()]} ·{" "}
                                      {formatDateBR(d.date)}
                                    </h3>
                                    <span className="text-xs text-muted-foreground">
                                      · {d.items.length} prospecção(ões)
                                    </span>
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {d.items.map(renderCard)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          {semData.length > 0 && (
            <section className="card-soft overflow-hidden">
              <div className="flex items-center justify-between gap-2 p-3">
                <span className="font-semibold">Sem data de registro</span>
                <span className="text-xs text-muted-foreground">
                  {semData.length} prospecção(ões)
                </span>
              </div>
              <div className="grid gap-3 border-t p-3 md:grid-cols-2 xl:grid-cols-3">
                {semData.map(renderCard)}
              </div>
            </section>
          )}
        </div>
      )}

      {lostTarget && (
        <LostDialog
          client={lostTarget}
          onClose={() => setLostTarget(null)}
          onConfirm={(justificativa) => {
            setProspeccaoStatus(lostTarget.id, "perdido", justificativa);
            setLostTarget(null);
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir prospecção definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" será removido de TODAS as bases (prospecções, visitas, rotas e cadastro). Essa ação não pode ser desfeita.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteClient(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {detailTarget && (
        <DetailDialog client={detailTarget} visit={lastVisitOf.get(detailTarget.id)} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
}

function ProspectCard({
  client,
  visit,
  canDelete,
  onOpen,
  onFinalize,
  onDelete,
}: {
  client: Client;
  visit?: Visit;
  canDelete: boolean;
  onOpen: () => void;
  onFinalize: (s: "fechado" | "perdido") => void;
  onDelete: () => void;
}) {
  const status: ProspeccaoStatus = client.prospeccaoStatus ?? "em_negociacao";
  const finalizada = status === "fechado" || status === "perdido";
  const photo = visit?.photoUrl ?? visit?.photoData ?? null;

  return (
    <div
      onClick={onOpen}
      className="card-soft flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:bg-secondary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold leading-tight">{client.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {client.segment && <span>{client.segment}</span>}
            {client.city && <span>· {client.city}</span>}
          </div>
        </div>
        <Badge className={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>

      {photo && (
        <img src={photo} alt="Foto da prospecção" className="h-36 w-full rounded-lg object-cover" crossOrigin="anonymous" />
      )}

      <div className="space-y-1 text-sm">
        {client.responsavel && (
          <p className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{client.responsavel}</span>
          </p>
        )}
        {client.contato && (
          <p className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{client.contato}</span>
          </p>
        )}
        {(client.address || client.city) && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{[client.address, client.city].filter(Boolean).join(" · ")}</span>
          </p>
        )}
        {client.obs && <p className="line-clamp-2 text-xs text-muted-foreground">{client.obs}</p>}
        {visit && (
          <p className="text-xs text-muted-foreground">
            Prospecção registrada em {formatDateBR(visit.visitedAt.slice(0, 10))}
          </p>
        )}
        {status === "perdido" && client.prospeccaoJustificativa && (
          <p className="rounded-md bg-destructive/5 p-2 text-xs text-destructive">
            <b>Justificativa:</b> {client.prospeccaoJustificativa}
          </p>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
        {finalizada ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Prospecção finalizada — não pode mais ser alterada.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onFinalize("fechado"); }}>
              Fechar negócio
            </Button>
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onFinalize("perdido"); }}>
              Perdido
            </Button>
          </div>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            title="Excluir esta prospecção definitivamente"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function LostDialog({
  client,
  onClose,
  onConfirm,
}: {
  client: Client;
  onClose: () => void;
  onConfirm: (justificativa: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    const texto = reason.trim();
    if (!texto) {
      setError("Escreva a justificativa para marcar como perdida.");
      return;
    }
    onConfirm(texto);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar prospecção como perdida</DialogTitle>
          <DialogDescription>
            Cliente: <span className="font-medium text-foreground">{client.name}</span>. Depois de
            confirmar, a prospecção fica finalizada e não pode mais ser alterada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>
            Justificativa <span className="font-normal text-muted-foreground">(obrigatória)</span>
          </Label>
          <Textarea
            rows={3}
            autoFocus
            placeholder="Ex.: optou por outro fornecedor, preço acima do praticado…"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setError(null);
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={!reason.trim()}>
            Confirmar perdido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** janela com TODAS as informações da prospecção, incluindo fotos */
function DetailDialog({
  client,
  visit,
  onClose,
}: {
  client: Client;
  visit?: Visit;
  onClose: () => void;
}) {
  const status: ProspeccaoStatus = client.prospeccaoStatus ?? "em_negociacao";
  const fotos = visit
    ? visit.photos && visit.photos.length > 0
      ? visit.photos
      : visit.photoData
        ? [visit.photoData]
        : []
    : [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-lg overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>{client.name}</DialogTitle>
          <DialogDescription>
            {visit
              ? `Prospecção registrada em ${formatDateBR(visit.visitedAt.slice(0, 10))}`
              : "Prospecção"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
        </div>

        <div className="space-y-1.5 text-sm">
          {client.responsavel && (
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Responsável</span>
              {client.responsavel}
            </div>
          )}
          {client.contato && (
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Contato</span>
              {client.contato}
            </div>
          )}
          {client.segment && (
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Segmento</span>
              {client.segment}
            </div>
          )}
          {client.city && (
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Cidade</span>
              {client.city}
            </div>
          )}
          {client.address && (
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Endereço</span>
              {client.address}
            </div>
          )}
          {client.obs && (
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Observações</span>
              {client.obs}
            </div>
          )}
          {visit?.resultComments && (
            <div>
              <span className="block text-xs font-medium text-muted-foreground">
                O que foi realizado
              </span>
              {visit.resultComments}
            </div>
          )}
          {visit?.nextActions && (
            <div>
              <span className="block text-xs font-medium text-muted-foreground">Próxima visita</span>
              {visit.nextActions}
            </div>
          )}
        </div>

        {status === "perdido" && client.prospeccaoJustificativa && (
          <p className="rounded-md bg-destructive/5 p-2 text-sm text-destructive">
            <b>Justificativa:</b> {client.prospeccaoJustificativa}
          </p>
        )}

        {fotos.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Fotos ({fotos.length})
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {fotos.map((f, i) => (
                <a key={i} href={f} target="_blank" rel="noreferrer">
                  <img src={f} alt={`Foto ${i + 1}`} className="h-32 w-full rounded-lg object-cover" />
                </a>
              ))}
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
