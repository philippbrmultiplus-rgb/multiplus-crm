import { useCallback, useEffect, useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Rocket,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useData } from "@/lib/DataContext";
import {
  addDays,
  agruparCidades,
  cidadeKey,
  DAY_NAMES,
  formatDateBR,
  formatKm,
  mondayOf,
  timeToMinutes,
  todayKey,
} from "@/lib/geo";
import { computeSchedule, newestRoute } from "@/lib/route";
import { cadenceLabel, tierOfFreq } from "@/lib/cadence";
import {
  COLETA_TEXT_TONE,
  coletaDays,
  coletaStatus,
  compareClients,
  isColetaOverdue,
  lastVisitDays,
  visitaStatus,
  VISITA_TEXT_TONE,
} from "@/components/clients/clientBits";
import { cidadeComDistancia } from "@/components/clients/clientBits";
import { ColetaBadge, TierBadge } from "@/components/clients/clientBadges";
import { RouteActivities } from "@/components/rota/RouteActivities";
import { formatDuracao, totalMinutos } from "@/lib/atividade";
import { LeafletMap } from "@/components/map/LeafletMap";
import type { Client, RouteActivity, RouteVisit, Settings, WeeklyRoute } from "@/lib/types";

const DAY_COLORS: Record<number, string> = {
  1: "#1e40af",
  2: "#2563eb",
  3: "#7c3aed",
  4: "#db2777",
  5: "#d97706",
  6: "#0ea5e9",
};

export default function RotaSemanal() {
  const {
    state,
    role,
    createEmptyWeekRoute,
    publishRoute,
    deleteRoute,
    moveRouteVisit,
    removeRouteVisit,
  } = useData();
  const { routes, routeVisits, clients, settings } = state;
  const podeEditar = role === "coordenador";

  const [weekStart, setWeekStart] = useState<string>(mondayOf(todayKey()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [addDay, setAddDay] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<RouteVisit | null>(null);
  const [askPublishEmpty, setAskPublishEmpty] = useState(false);
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const route = useMemo<WeeklyRoute | null>(() => {
    if (selectedId) return routes.find((r) => r.id === selectedId) ?? null;
    // mesma regra para todos os papéis: publicada mais recente; senão o rascunho mais recente
    return newestRoute(routes, weekStart, "publicada") ?? newestRoute(routes, weekStart);
  }, [routes, selectedId, weekStart]);

  const visits = useMemo(
    () => (route ? routeVisits.filter((rv) => rv.routeId === route.id) : []),
    [route, routeVisits],
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeRc = visits.find((rv) => rv.id === activeId);
    if (!activeRc) return;
    if (overId.startsWith("day-")) {
      const day = Number(overId.slice(4));
      const count = visits.filter((rv) => rv.day === day).length;
      moveRouteVisit(activeId, day, count);
      return;
    }
    const overRc = visits.find((rv) => rv.id === overId);
    if (!overRc) return;
    moveRouteVisit(activeId, overRc.day, overRc.position);
  };

  const handleGenerate = () => {
    const result = createEmptyWeekRoute(weekStart);
    setSelectedId(result.route.id);
    setWarnings([]);
    toast.success("Rota da semana criada (vazia).", {
      description: "Adicione os clientes dia a dia em cada coluna. Se já havia algo gerado, foi apagado.",
    });
  };

  const mapPoints = useMemo(
    () =>
      visits.flatMap((rv) => {
        const c = clients.find((x) => x.id === rv.clientId);
        if (!c || c.lat == null) return [];
        return [{ lat: c.lat, lng: c.lng, label: c.name, color: DAY_COLORS[rv.day] ?? "#1e40af" }];
      }),
    [visits, clients],
  );

  const mapPolylines = useMemo(
    () =>
      [...settings.workingDays].sort((a, b) => a - b)
        .map((day) => {
          const pts = visits
            .filter((rv) => rv.day === day)
            .sort((a, b) => a.position - b.position)
            .flatMap((rv) => {
              const c = clients.find((x) => x.id === rv.clientId);
              return c?.lat != null ? ([[c.lat, c.lng]] as [number, number][]) : [];
            });
          if (pts.length === 0) return null;
          return {
            points: [[settings.homeLat, settings.homeLng], ...pts] as [number, number][],
            color: DAY_COLORS[day] ?? "#1e40af",
          };
        })
        .filter((x): x is { points: [number, number][]; color: string } => x !== null),
    [visits, clients, settings],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rota semanal</h1>
          <p className="text-sm text-muted-foreground">
            Clientes agrupados por proximidade, priorizando maior volume. Ajuste arrastando.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-secondary/30 p-0.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setWeekStart(mondayOf(todayKey()))}
            >
              Esta semana
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              Próxima
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-44 text-center text-sm font-medium">
              Semana de {weekStart.split("-").reverse().join("/")}
            </div>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {podeEditar && (
          <Button onClick={handleGenerate}>
            <Rocket className="mr-2 h-4 w-4" /> Gerar rota da semana
          </Button>
        )}
        {route && podeEditar && (
          <>
            {route.status === "rascunho" ? (
              <Button
                variant="default"
                onClick={() => {
                  if (visits.length === 0) setAskPublishEmpty(true);
                  else publishRoute(route.id);
                }}
              >
                Publicar para o vendedor
              </Button>
            ) : (
              <Badge className="bg-primary/10 text-primary">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Publicada
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={() => deleteRoute(route.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
      </div>

      {warnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Avisos da geração</AlertTitle>
          <AlertDescription className="space-y-1">
            {warnings.map((w, i) => (
              <div key={i}>• {w}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {!route ? (
        <div className="card-soft flex flex-col items-center justify-center gap-3 p-12 text-center">
          <p className="text-muted-foreground">
            Nenhuma rota para esta semana ainda. Clique em "Gerar rota da semana" para montar a rotina de
            visitas automaticamente.
          </p>
          {podeEditar && <Button onClick={handleGenerate}>Gerar agora</Button>}
        </div>
      ) : (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 gap-3 pb-2 md:grid-cols-5">
              {settings.workingDays.sort((a, b) => a - b).map((day) => (
                <DayColumn
                  key={day}
                  day={day}
                  date={addDays(weekStart, day - 1)}
                  weekStart={weekStart}
                  visits={visits.filter((rv) => rv.day === day)}
                  activities={state.activities.filter(
                    (a) => a.weekStart === weekStart && a.day === day,
                  )}
                  clients={clients}
                  settings={settings}
                  canEdit={podeEditar}
                  onAdd={() => setAddDay(day)}
                  onRemove={(rv) => setRemoveTarget(rv)}
                />
              ))}
            </div>
          </DndContext>

          <div className="card-soft p-2">
            <LeafletMap
              height="360px"
              points={mapPoints}
              polylines={mapPolylines}
              fit
            />
            <div className="flex flex-wrap gap-3 p-2 text-xs text-muted-foreground">
              {[...settings.workingDays].sort((a, b) => a - b).map((d) => (
                <span key={d} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: DAY_COLORS[d] }} />
                  {DAY_NAMES[d]}
                </span>
              ))}
              <span className="ml-auto">Base: Porto Alegre</span>
            </div>
          </div>
        </>
      )}

      <AddClientDialog
        open={addDay !== null}
        onClose={() => setAddDay(null)}
        route={route}
        day={addDay ?? 1}
        routeClients={visits
          .filter((rv) => rv.day === (addDay ?? 1))
          .map((rv) => rv.clientId)}
        clients={clients}
      />

      <AlertDialog open={askPublishEmpty} onOpenChange={setAskPublishEmpty}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar rota sem visitas?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta rota está vazia — provavelmente porque nenhum cliente foi adicionado nos dias ainda
              (ou os clientes não têm coordenadas no mapa, impedindo o cálculo). Se publicar, o vendedor
              verá uma semana sem visitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e ajustar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (route) publishRoute(route.id);
                setAskPublishEmpty(false);
              }}
            >
              Publicar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente da rota?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `Remover ${clients.find((c) => c.id === removeTarget.clientId)?.name ?? "este cliente"} da ${DAY_NAMES[removeTarget.day]}? Ele continua cadastrado em Clientes e pode ser adicionado de novo depois.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeTarget) removeRouteVisit(removeTarget.id);
                setRemoveTarget(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DayColumn({
  day,
  date,
  weekStart,
  visits,
  activities,
  clients,
  settings,
  canEdit,
  onAdd,
  onRemove,
}: {
  day: number;
  date: string;
  weekStart: string;
  visits: RouteVisit[];
  activities: RouteActivity[];
  clients: Client[];
  settings: Settings;
  canEdit: boolean;
  onAdd: () => void;
  onRemove: (rv: RouteVisit) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` });
  const scheduled = computeSchedule(visits, clients, settings, day);
  const totalKm = scheduled.reduce((acc, s) => acc + s.travelMin, 0);
  const last = scheduled[scheduled.length - 1];
  const budget = timeToMinutes(settings.workEnd) - timeToMinutes(settings.workStart);
  const overdue = last ? last.arrivalMin + last.visitMin > budget : false;
  const extraMin = totalMinutos(activities);

  return (
    <div className="flex w-full min-w-0 flex-col">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{DAY_NAMES[day]}</div>
          <div className="text-xs text-muted-foreground">{date.split("-").reverse().join("/")}</div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>
            {visits.length} {visits.length === 1 ? "visita" : "visitas"}
          </div>
          {totalKm > 0 && <div>~{formatKm(totalKm)}</div>}
          {extraMin > 0 && (
            <div className="text-amber-600 dark:text-amber-400">
              +{formatDuracao(extraMin)} extras
            </div>
          )}
          {last && <div className={overdue ? "font-medium text-destructive" : ""}>fim {last.depClock}</div>}
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-40 flex-1 space-y-2 rounded-xl border bg-card/60 p-2 ${
          isOver ? "border-primary ring-2 ring-primary/30" : ""
        }`}
      >
        <SortableContext items={visits.map((v) => v.id)} strategy={verticalListSortingStrategy}>
          {scheduled.map((s) => (
            <RouteCard
              key={s.routeVisit.id}
              scheduled={s}
              canEdit={canEdit}
              onRemove={() => onRemove(s.routeVisit)}
            />
          ))}
        </SortableContext>
        {scheduled.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">Sem visitas</p>
        )}
        <RouteActivities weekStart={weekStart} day={day} canEdit={canEdit} />
        {canEdit && (
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onAdd}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar cliente
          </Button>
        )}
      </div>
    </div>
  );
}

function RouteCard({
  scheduled,
  canEdit,
  onRemove,
}: {
  scheduled: ScheduledVisit;
  canEdit: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scheduled.routeVisit.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const done = scheduled.routeVisit.status === "concluida";
  const missed = scheduled.routeVisit.status === "nao_realizada";
  const days = coletaDays(scheduled.client);
  const status = coletaStatus(scheduled.client);
  const vDays = lastVisitDays(scheduled.client);
  const vStatus = visitaStatus(scheduled.client);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canEdit ? { ...attributes, ...listeners } : {})}
      className={`flex flex-col rounded-lg border bg-card p-2.5 shadow-sm ${
        canEdit ? "cursor-grab active:cursor-grabbing" : ""
      } ${
        isDragging ? "opacity-60" : ""
      } ${done ? "opacity-70" : ""}`}
    >
      {/* Nome completo do cliente */}
      <div className="flex items-start gap-1.5">
        <span className="min-w-0 flex-1 break-words font-semibold leading-tight">
          {scheduled.client.name}
        </span>
        {done && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
        {missed && (
          <span className="mt-0.5 shrink-0 rounded bg-slate-500/15 px-1.5 text-[10px] text-slate-500">
            não realizada
          </span>
        )}
      </div>

      {/* Segmento em destaque */}
      {scheduled.client.segment && (
        <span className="mt-1.5 w-fit rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground">
          {scheduled.client.segment}
        </span>
      )}

      {/* Última troca e última visita em destaque */}
      <div className="mt-2 space-y-1.5 border-t pt-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Últ. troca</span>
          {days != null ? (
            <span className={`text-sm font-semibold ${COLETA_TEXT_TONE[status]}`}>
              há {days} {days === 1 ? "dia" : "dias"}
              {status === "late" ? " · atrasada" : ""}
            </span>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">sem data</span>
          )}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Últ. visita</span>
          {vDays != null ? (
            <span className={`text-sm font-semibold ${VISITA_TEXT_TONE[vStatus]}`}>
              há {vDays} {vDays === 1 ? "dia" : "dias"}
            </span>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">sem visita</span>
          )}
        </div>
      </div>

      {/* Remover apenas este cliente */}
      {canEdit && (
      <div className="mt-2 flex justify-end border-t pt-2">
        <button
          title="Remover este cliente da rota"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      )}
    </div>
  );
}

function AddClientDialog({
  open,
  onClose,
  route,
  day,
  routeClients,
  clients,
}: {
  open: boolean;
  onClose: () => void;
  route: WeeklyRoute | null;
  day: number;
  routeClients: string[];
  clients: Client[];
}) {
  const { addRouteVisit } = useData();
  const [q, setQ] = useState("");
  const [cidade, setCidade] = useState("all");
  const [segmento, setSegmento] = useState("all");
  const [grupo, setGrupo] = useState("all");
  const [situ, setSitu] = useState("todas");
  const [situVisita, setSituVisita] = useState("todas");
  const [onlyActive, setOnlyActive] = useState(true);
  const [showProsp, setShowProsp] = useState(false);

  const available = useMemo(
    () => clients.filter((c) => !routeClients.includes(c.id)),
    [clients, routeClients],
  );

  // confere se o cliente passa em TODOS os filtros atuais, exceto o informado em "ignore"
  const matchOutros = useCallback(
    (c: Client, ignore: "cidade" | "segmento" | "grupo") => {
      if (ignore !== "cidade" && cidade !== "all" && cidadeKey(c.city || "(sem cidade)") !== cidadeKey(cidade))
        return false;
      if (ignore !== "segmento" && segmento !== "all" && (c.segment || "(sem segmento)") !== segmento)
        return false;
      if (ignore !== "grupo" && grupo !== "all" && c.tier !== grupo) return false;
      if (onlyActive && !c.active) return false;
      if (situ === "atrasada" && !isColetaOverdue(c)) return false;
      if (situ === "em_dia" && (c.lastCollectAt == null || isColetaOverdue(c))) return false;
      if (situ === "sem_data" && c.lastCollectAt != null) return false;
      if (situVisita === "atrasada" && visitaStatus(c) !== "late") return false;
      if (situVisita === "em_dia" && (c.lastVisitAt == null || visitaStatus(c) === "late")) return false;
      if (situVisita === "sem_visita" && c.lastVisitAt != null) return false;
      return true;
    },
    [cidade, segmento, grupo, onlyActive, situ, situVisita],
  );

  // cidades em ordem alfabética, agrupando grafias que só diferem por maiúscula/minúscula
  const cities = useMemo(() => {
    const lista = agruparCidades(
      clients.filter((c) => matchOutros(c, "cidade")).map((c) => c.city || "(sem cidade)"),
    );
    if (cidade !== "all" && !lista.some((o) => cidadeKey(o.label) === cidadeKey(cidade))) {
      return [...lista, { label: cidade, count: 0 }].sort((a, b) =>
        a.label.localeCompare(b.label, "pt-BR"),
      );
    }
    return lista;
  }, [clients, matchOutros, cidade]);

  const segments = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clients) {
      if (!matchOutros(c, "segmento")) continue;
      const k = c.segment || "(sem segmento)";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    if (segmento !== "all" && !map.has(segmento)) map.set(segmento, 0);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [clients, matchOutros, segmento]);

  const grupoOptions = useMemo(() => {
    const tiers = new Set<string>();
    for (const c of clients) {
      if (matchOutros(c, "grupo")) tiers.add(c.tier);
    }
    const base = ["A", "B", "C", "D"] as const;
    return base.filter((t) => tiers.has(t) || grupo === t);
  }, [clients, matchOutros, grupo]);

  const options = useMemo(() => {
    const term = q.trim().toLowerCase();
    return available
      .filter((c) => (onlyActive ? c.active : true))
      .filter((c) => (grupo === "all" ? true : c.tier === grupo))
      .filter((c) => (cidade === "all" ? true : cidadeKey(c.city || "(sem cidade)") === cidadeKey(cidade)))
      .filter((c) => (segmento === "all" ? true : (c.segment || "(sem segmento)") === segmento))
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
        return visitaStatus(c) === "late";
      })
      .filter((c) =>
        term
          ? `${c.name} ${c.city} ${c.segment} ${c.address}`.toLowerCase().includes(term)
          : true,
      )
      .sort((a, b) => compareClients(a, b, "grupo"));
  }, [available, q, cidade, segmento, grupo, situ, situVisita, onlyActive]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-xl overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>Adicionar visita — {DAY_NAMES[day]}</DialogTitle>
          <DialogDescription>
            Clique nos clientes para incluir na rota — pode selecionar quantos quiser. Ao terminar este
            dia, clique em “Finalizar a rota”.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowProsp(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Nova prospecção
          </Button>
          <Button size="sm" onClick={onClose}>
            Finalizar a rota <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar cliente…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={cidade} onValueChange={setCidade}>
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
          <Select value={segmento} onValueChange={setSegmento}>
            <SelectTrigger className="w-48">
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
          <Select value={grupo} onValueChange={setGrupo}>
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
          <Select value={situVisita} onValueChange={setSituVisita}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Situação da visita" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as visitas</SelectItem>
              <SelectItem value="atrasada">Visita atrasada (&gt;30 dias)</SelectItem>
              <SelectItem value="em_dia">Visita em dia</SelectItem>
              <SelectItem value="sem_visita">Sem visita registrada</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={onlyActive} onCheckedChange={(v) => setOnlyActive(!!v)} />
            Só ativos
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {available.length > 0
            ? `${options.length} de ${available.length} clientes disponíveis`
            : "Todos os clientes da semana já estão na rota."}
        </p>
        <div className="max-h-96 space-y-1 overflow-y-auto">
          {options.map((c) => (
            <button
              key={c.id}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left text-sm hover:bg-secondary ${
                isColetaOverdue(c) ? "opt-overdue" : ""
              }`}
              onClick={() => {
                if (route) addRouteVisit(route, c.id, day);
                toast.success(`"${c.name}" adicionada à ${DAY_NAMES[day]}.`);
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{c.name}</span>
                  <TierBadge tier={c.tier} />
                  {!c.active && <Badge variant="secondary">inativo</Badge>}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="truncate">
                    {cidadeComDistancia(c)}
                    {c.segment ? ` · ${c.segment}` : ""}
                  </span>
                  <span>{cadenceLabel(c.freqMonth)}</span>
                  {c.lastCollectAt && <span>últ. troca {formatDateBR(c.lastCollectAt)}</span>}
                  <span
                    className={c.lastVisitAt ? VISITA_TEXT_TONE[visitaStatus(c)] : "text-muted-foreground"}
                    title="Última visita realizada"
                  >
                    {c.lastVisitAt
                      ? `últ. visita ${formatDateBR(c.lastVisitAt)}`
                      : "sem visita registrada"}
                  </span>
                </span>
              </span>
              <span className="shrink-0">
                <ColetaBadge c={c} withLabel />
              </span>
            </button>
          ))}
          {options.length === 0 && available.length > 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum cliente corresponde aos filtros atuais.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
      {showProsp && (
        <ProspecaoDialog
          open={showProsp}
          day={day}
          route={route}
          onClose={() => setShowProsp(false)}
        />
      )}
    </Dialog>
  );
}

const CADENCE_OPTIONS = [
  { value: "0", label: cadenceLabel(0) },
  { value: "0.33", label: cadenceLabel(0.33) },
  { value: "0.5", label: cadenceLabel(0.5) },
  { value: "1", label: cadenceLabel(1) },
  { value: "2", label: cadenceLabel(2) },
  { value: "3", label: cadenceLabel(3) },
  { value: "4", label: cadenceLabel(4) },
];

/** cria um cliente marcado como prospecção e o adiciona direto no dia da rota */
function ProspecaoDialog({
  open,
  day,
  route,
  onClose,
}: {
  open: boolean;
  day: number;
  route: WeeklyRoute | null;
  onClose: () => void;
}) {
  const { createClient, addRouteVisit } = useData();
  const [nome, setNome] = useState("Prospecção");
  const [cidade, setCidade] = useState("");
  const [endereco, setEndereco] = useState("");
  const [segmento, setSegmento] = useState("");
  const [contato, setContato] = useState("");
  const [freq, setFreq] = useState("1");
  const [obs, setObs] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  const salvar = () => {
    if (!route) {
      onClose();
      return;
    }
    const f = parseFloat(freq);
    const novo: Client = {
      id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: nome.trim() || "Prospecção",
      segment: segmento.trim(),
      address: endereco.trim(),
      city: cidade.trim(),
      state: "RS",
      active: ativo,
      total2025: 0,
      total2026: 0,
      avgMonthly: 0,
      tier: tierOfFreq(f),
      freqMonth: f,
      isProspecao: true,
      contato: contato.trim() || null,
      lastCollectAt: null,
      lastVisitAt: null,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      geocodeStatus: pos ? "ok" : "pendente",
      obs: obs.trim() || undefined,
    };
    createClient(novo);
    addRouteVisit(route, novo.id, day);
    toast.success(`Prospecção "${novo.name}" adicionada à ${DAY_NAMES[day]}.`);
    onClose();
  };

  const points = pos ? [{ lat: pos.lat, lng: pos.lng, label: nome || "Prospecção", color: "#7c3aed" }] : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-xl overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>Nova prospecção</DialogTitle>
          <DialogDescription>
            Cria um cliente marcado como "Prospecção" e já o adiciona na {DAY_NAMES[day]}. Todos os
            dados podem ser editados depois em Clientes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Prospecção — nome da empresa"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Porto Alegre" />
          </div>
          <div className="space-y-1.5">
            <Label>Contato</Label>
            <Input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="(51) 9 9999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label>Segmento</Label>
            <Input value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Construção civil…" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Endereço</Label>
            <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro" />
          </div>
          <div className="space-y-1.5">
            <Label>Cadência de visitas</Label>
            <Select value={freq} onValueChange={setFreq}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CADENCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              Ativo (entra na rota)
            </label>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Anotações da prospecção…"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Posição no mapa (opcional)</Label>
            <LeafletMap
              height="220px"
              fit={false}
              center={pos ? [pos.lat, pos.lng] : [-30.03, -51.22]}
              zoom={12}
              points={points}
              onMapClick={(lat, lng) => setPos({ lat, lng })}
            />
            <p className="text-xs text-muted-foreground">
              {pos
                ? `Coordenadas: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
                : "Clique no mapa para marcar (opcional). Sem posição, a prospecção é adicionada manualmente ao dia."}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar}>
            <UserPlus className="mr-2 h-4 w-4" /> Criar e adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
