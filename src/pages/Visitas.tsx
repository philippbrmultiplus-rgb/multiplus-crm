import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarX2, ChevronDown, Phone, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useData } from "@/lib/DataContext";
import { PhotoZoom } from "@/components/visitas/PhotoZoom";
import { cidadeComDistancia } from "@/components/clients/clientBits";
import { addDays, DAY_NAMES, formatDateBR, formatDistanceM, mondayOf } from "@/lib/geo";
import type { Client, Visit } from "@/lib/types";

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

const STATUS_LABEL: Record<Visit["status"], string> = {
  realizada: "Realizada",
  nao_encontrado: "Não encontrado",
  recusada: "Recusado",
  nao_realizada: "Não realizada",
};

/** lista de fotos da visita (novas em `photos`, antigas em `photoData`) */
function fotosOf(v: Visit): string[] {
  if (v.photos && v.photos.length > 0) return v.photos;
  return v.photoData ? [v.photoData] : [];
}

/** hora local do registro (o banco guarda em UTC) */
function horaOf(v: Visit): string {
  return new Date(v.visitedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** cartão de uma visita (clique abre os detalhes) */
function VisitCard({
  v,
  client,
  radiusM,
  onOpen,
  onDelete,
}: {
  v: Visit;
  client?: Client;
  radiusM: number;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const isProsp = client?.isProspecao;
  const fotos = fotosOf(v);
  return (
    <div
      onClick={onOpen}
      className={`card-soft flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-start ${
        v.alerta
          ? "border-destructive/60 bg-destructive/5"
          : isProsp
            ? "border-violet-500/40"
            : ""
      }`}
    >
      {fotos.length > 0 ? (
        <button onClick={onOpen} className="relative shrink-0">
          <img src={fotos[0]} alt="Comprovante" className="h-24 w-32 rounded-lg object-cover" />
          {fotos.length > 1 && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
              +{fotos.length - 1} foto(s)
            </span>
          )}
        </button>
      ) : (
        <div className="flex h-24 w-32 items-center justify-center rounded-lg bg-secondary text-xs text-muted-foreground">
          Sem foto
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{client?.name ?? "Cliente removido"}</span>
          {isProsp && (
            <Badge
              variant="outline"
              className="border-violet-500/40 text-violet-600 dark:text-violet-300"
            >
              Prospecção
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
            {STATUS_LABEL[v.status]}
          </Badge>
          {v.withinRadius === false && (
            <Badge className="bg-destructive/10 text-destructive">Fora do raio</Badge>
          )}
          {v.tipoContato === "telefone" && (
            <Badge className="border border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-300">
              <Phone className="mr-1 h-3 w-3" /> Contato via telefone
            </Badge>
          )}
          {v.alerta && (
            <Badge className="border border-destructive/50 bg-destructive/10 text-destructive">
              Alerta do vendedor
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDateBR(v.visitedAt.slice(0, 10))} às {horaOf(v)} ·{" "}
          {client ? cidadeComDistancia(client) : "—"}
        </p>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              {v.status === "nao_realizada" ? "Justificativa" : "O que foi feito"}
            </div>
            <p className="line-clamp-2">{v.resultComments || "—"}</p>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">Próxima visita</div>
            <p className="line-clamp-2">{v.nextActions || "—"}</p>
          </div>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>
            Visita em:{" "}
            <span className="font-medium text-foreground">
              {client ? cidadeComDistancia(client) : "—"}
            </span>
          </span>
          {v.withinRadius === false && v.distanceFromClientM != null && (
            <span className="text-destructive">
              {formatDistanceM(v.distanceFromClientM)} do endereço cadastrado (raio {radiusM} m)
            </span>
          )}
          {v.withinRadius === false && client?.geoAproximado && (
            <span>coordenada aproximada (só a cidade) — distância pode não ser precisa</span>
          )}
        </p>
        {v.alerta && (
          <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
            <b>Motivo do alerta:</b> {v.alertaMotivo || "não informado pelo vendedor"}
          </p>
        )}
      </div>
      {onDelete && (
        <div className="flex shrink-0 gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Visitas() {
  const { state, deleteVisit, role } = useData();
  const podeExcluir = role === "coordenador";
  const { clients, visits, settings } = state;
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  // o filtro de alertas cobre as visitas fora do raio e as marcadas pelo vendedor
  const [onlyAlerta, setOnlyAlerta] = useState(params.get("alerta") != null);
  const [onlyRealizadas, setOnlyRealizadas] = useState(false);
  const [tipo, setTipo] = useState<"todas" | "visitas" | "prospecoes">("todas");
  const [viewing, setViewing] = useState<Visit | null>(null);
  const [toDelete, setToDelete] = useState<Visit | null>(null);
  // seções abertas/fechadas (mês e semana); o que não estiver aqui usa o padrão
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (key: string, defaultOpen: boolean) => toggled[key] ?? defaultOpen;
  const toggle = (key: string, current: boolean) =>
    setToggled((t) => ({ ...t, [key]: !current }));

  const clientOf = (id: string) => clients.find((c) => c.id === id);
  const prospectClientIds = useMemo(
    () => new Set(clients.filter((c) => c.isProspecao).map((c) => c.id)),
    [clients],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visits
      .filter((v) => (onlyAlerta ? v.withinRadius === false || v.alerta === true : true))
      .filter((v) => (onlyRealizadas ? v.status === "realizada" : true))
      .filter((v) => {
        const isProsp = prospectClientIds.has(v.clientId);
        if (tipo === "visitas") return !isProsp;
        if (tipo === "prospecoes") return isProsp;
        return true;
      })
      .filter((v) => {
        if (!q) return true;
        const c = clients.find((x) => x.id === v.clientId);
        return `${c?.name ?? ""} ${c?.city ?? ""}`.toLowerCase().includes(q);
      });
  }, [visits, search, onlyAlerta, onlyRealizadas, tipo, prospectClientIds, clients]);

  // agrupa por mês > semana > dia (mais recente primeiro)
  const hierarchy = useMemo(() => {
    const months = new Map<string, Map<string, Map<string, Visit[]>>>();
    for (const v of filtered) {
      const date = v.visitedAt.slice(0, 10);
      const month = date.slice(0, 7);
      const week = mondayOf(date);
      const byWeek = months.get(month) ?? new Map<string, Map<string, Visit[]>>();
      const byDay = byWeek.get(week) ?? new Map<string, Visit[]>();
      const list = byDay.get(date) ?? [];
      list.push(v);
      byDay.set(date, list);
      byWeek.set(week, byDay);
      months.set(month, byWeek);
    }
    return [...months.entries()]
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
  }, [filtered]);

  const totalProsp = useMemo(
    () => visits.filter((v) => prospectClientIds.has(v.clientId)).length,
    [visits, prospectClientIds],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visitas registradas</h1>
          <p className="text-sm text-muted-foreground">
            {visits.length} no total · {totalProsp} prospecção(ões)
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Digite o nome do cliente…"
            list="clientes-sugestoes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <datalist id="clientes-sugestoes">
            {clients.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={onlyAlerta}
            onCheckedChange={(v) => setOnlyAlerta(!!v)}
          />
          Só alertas (raio ou vendedor)
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={onlyRealizadas} onCheckedChange={(v) => setOnlyRealizadas(!!v)} />
          Só realizadas
        </label>
        <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Visitas e prospecções</SelectItem>
            <SelectItem value="visitas">Somente visitas</SelectItem>
            <SelectItem value="prospecoes">Somente prospecções</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hierarchy.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
          <CalendarX2 className="h-8 w-8" />
          <p>Nenhuma visita encontrada.</p>
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
                    {m.total} registro(s) · {m.weeks.length} semana(s)
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
                              {w.total} registro(s) · {w.days.length} dia(s)
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
                                      · {d.items.length} registro(s)
                                    </span>
                                  </div>
                                  <div className="space-y-3">
                                    {d.items.map((v) => (
                                      <VisitCard
                                        key={v.id}
                                        v={v}
                                        client={clientOf(v.clientId)}
                                        radiusM={settings.visitRadiusM}
                                        onOpen={() => setViewing(v)}
                                        onDelete={podeExcluir ? () => setToDelete(v) : undefined}
                                      />
                                    ))}
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
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-2xl overflow-y-auto overscroll-contain">
          {viewing &&
            (() => {
              const v = viewing;
              const c = clientOf(v.clientId);
              const isProsp = c?.isProspecao;
              const fotos = fotosOf(v);
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>{c?.name ?? "Cliente removido"}</DialogTitle>
                    <DialogDescription>
                      {formatDateBR(v.visitedAt.slice(0, 10))} às {horaOf(v)} ·{" "}
                      {c ? cidadeComDistancia(c) : "—"}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex flex-wrap items-center gap-2">
                    {isProsp && (
                      <Badge
                        variant="outline"
                        className="border-violet-500/40 text-violet-600 dark:text-violet-300"
                      >
                        Prospecção
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
                      {STATUS_LABEL[v.status]}
                    </Badge>
                    {v.withinRadius === false && (
                      <Badge className="bg-destructive/10 text-destructive">Fora do raio</Badge>
                    )}
                    {v.tipoContato === "telefone" && (
                      <Badge className="border border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-300">
                        <Phone className="mr-1 h-3 w-3" /> Contato via telefone
                      </Badge>
                    )}
                    {v.alerta && (
                      <Badge className="border border-destructive/50 bg-destructive/10 text-destructive">
                        Alerta do vendedor
                      </Badge>
                    )}
                  </div>

                  {c && (
                    <div className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2">
                      {c.segment && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Segmento</div>
                          <div>{c.segment}</div>
                        </div>
                      )}
                      {c.responsavel && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Responsável</div>
                          <div>{c.responsavel}</div>
                        </div>
                      )}
                      {c.contato && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Contato</div>
                          <div>{c.contato}</div>
                        </div>
                      )}
                      {c.city && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground">Cidade</div>
                          <div>{cidadeComDistancia(c)}</div>
                        </div>
                      )}
                      {c.address && (
                        <div className="sm:col-span-2">
                          <div className="text-xs font-medium text-muted-foreground">Endereço</div>
                          <div>{c.address}</div>
                        </div>
                      )}
                      {c.obs && (
                        <div className="sm:col-span-2">
                          <div className="text-xs font-medium text-muted-foreground">Observações</div>
                          <div>{c.obs}</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        {v.status === "nao_realizada" ? "Justificativa" : "O que foi feito"}
                      </div>
                      <p className="mt-0.5">{v.resultComments || "—"}</p>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Próxima visita</div>
                      <p className="mt-0.5">{v.nextActions || "—"}</p>
                    </div>
                  </div>

                  {v.withinRadius === false && v.distanceFromClientM != null && (
                    <p className="text-sm text-destructive">
                      {formatDistanceM(v.distanceFromClientM)} do endereço cadastrado (raio{" "}
                      {settings.visitRadiusM} m)
                    </p>
                  )}

                  {v.withinRadius === false && c?.geoAproximado && (
                    <p className="text-xs text-muted-foreground">
                      A coordenada deste cliente é aproximada (só a cidade), então a distância pode não ser
                      precisa.
                    </p>
                  )}

                  {v.alerta && (
                    <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
                      <b>Alerta do vendedor:</b> {v.alertaMotivo || "sem motivo informado"}
                    </p>
                  )}

                  {fotos.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">
                        Fotos ({fotos.length})
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {fotos.map((f, i) => (
                          <PhotoZoom
                            key={i}
                            src={f}
                            alt={`Foto ${i + 1}`}
                            imgClassName="h-32 w-full rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir visita?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro ({toDelete ? clientOf(toDelete.clientId)?.name : ""}) será removido do histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) deleteVisit(toDelete.id);
                setToDelete(null);
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
