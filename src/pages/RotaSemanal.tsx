import { useEffect, useMemo, useState } from "react";
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
  GripVertical,
  Plus,
  Rocket,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useData } from "@/lib/DataContext";
import { addDays, DAY_NAMES, formatDateBR, formatKm, mondayOf, timeToMinutes, todayKey } from "@/lib/geo";
import { computeSchedule } from "@/lib/route";
import { cadenceLabel } from "@/lib/cadence";
import {
  COLETA_TEXT_TONE,
  coletaDays,
  coletaStatus,
  compareClients,
  isColetaOverdue,
} from "@/components/clients/clientBits";
import { ColetaBadge, TierBadge } from "@/components/clients/clientBadges";
import { LeafletMap } from "@/components/map/LeafletMap";
import { VisitForm } from "@/components/visitas/VisitForm";
import type { Client, RouteVisit, ScheduledVisit, Settings, WeeklyRoute } from "@/lib/types";

const DAY_COLORS: Record<number, string> = {
  1: "#0f766e",
  2: "#2563eb",
  3: "#7c3aed",
  4: "#db2777",
  5: "#d97706",
  6: "#16a34a",
};

export default function RotaSemanal() {
  const { state, generateRoute, saveRoutePlan, publishRoute, deleteRoute, moveRouteVisit } = useData();
  const { routes, routeVisits, clients, settings } = state;

  const [weekStart, setWeekStart] = useState<string>(mondayOf(todayKey()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [addDay, setAddDay] = useState<number | null>(null);
  const [finalize, setFinalize] = useState<ScheduledVisit | null>(null);
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const route = useMemo<WeeklyRoute | null>(() => {
    if (selectedId) return routes.find((r) => r.id === selectedId) ?? null;
    const weekRoutes = routes.filter((r) => r.weekStart === weekStart);
    return (
      weekRoutes.find((r) => r.status === "publicada") ??
      [...weekRoutes].sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1))[0] ??
      null
    );
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
    const result = generateRoute(weekStart);
    saveRoutePlan(result.route, result.routeVisits);
    setSelectedId(result.route.id);
    setWarnings(result.warnings);
  };

  const mapPoints = useMemo(
    () =>
      visits.flatMap((rv) => {
        const c = clients.find((x) => x.id === rv.clientId);
        if (!c || c.lat == null) return [];
        return [{ lat: c.lat, lng: c.lng, label: c.name, color: DAY_COLORS[rv.day] ?? "#0f766e" }];
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
            color: DAY_COLORS[day] ?? "#0f766e",
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
          <Button variant="outline" onClick={() => setWeekStart(mondayOf(todayKey()))}>
            Hoje
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleGenerate}>
          <Rocket className="mr-2 h-4 w-4" /> Gerar rota da semana
        </Button>
        {route && (
          <>
            {route.status === "rascunho" ? (
              <Button variant="default" onClick={() => publishRoute(route.id)}>
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
          <Button onClick={handleGenerate}>Gerar agora</Button>
        </div>
      ) : (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {settings.workingDays.sort((a, b) => a - b).map((day) => (
                <DayColumn
                  key={day}
                  day={day}
                  date={addDays(weekStart, day - 1)}
                  visits={visits.filter((rv) => rv.day === day)}
                  clients={clients}
                  settings={settings}
                  onAdd={() => setAddDay(day)}
                  onFinalize={(s) => setFinalize(s)}
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
        routeId={route?.id ?? ""}
        day={addDay ?? 1}
        routeClients={visits.map((rv) => rv.clientId)}
        clients={clients}
      />

      {finalize && (
        <VisitForm
          client={finalize.client}
          routeVisitId={finalize.routeVisit.id}
          onClose={() => setFinalize(null)}
        />
      )}
    </div>
  );
}

function DayColumn({
  day,
  date,
  visits,
  clients,
  settings,
  onAdd,
  onFinalize,
}: {
  day: number;
  date: string;
  visits: RouteVisit[];
  clients: Client[];
  settings: Settings;
  onAdd: () => void;
  onFinalize: (s: ScheduledVisit) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}` });
  const scheduled = computeSchedule(visits, clients, settings, day);
  const totalKm = scheduled.reduce((acc, s) => acc + s.travelMin, 0);
  const last = scheduled[scheduled.length - 1];
  const budget = timeToMinutes(settings.workEnd) - timeToMinutes(settings.workStart);
  const overdue = last ? last.arrivalMin + last.visitMin > budget : false;

  return (
    <div className="flex min-w-64 max-w-64 flex-col">
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
            <RouteCard key={s.routeVisit.id} scheduled={s} onFinalize={onFinalize} />
          ))}
        </SortableContext>
        {scheduled.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">Sem visitas</p>
        )}
        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar cliente
        </Button>
      </div>
    </div>
  );
}

function RouteCard({ scheduled, onFinalize }: { scheduled: ScheduledVisit; onFinalize: (s: ScheduledVisit) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scheduled.routeVisit.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const done = scheduled.routeVisit.status === "concluida";
  const missed = scheduled.routeVisit.status === "nao_realizada";
  const days = coletaDays(scheduled.client);
  const status = coletaStatus(scheduled.client);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex cursor-grab items-start gap-2 rounded-lg border bg-card p-2 text-sm shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-60" : ""
      } ${done ? "opacity-70" : ""}`}
    >
      <div className="mt-0.5 flex flex-col items-center gap-1">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {scheduled.arrivalClock}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{scheduled.client.name}</span>
          {done && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />}
          {missed && <span className="shrink-0 rounded bg-slate-500/15 px-1 text-[10px] text-slate-500">não realizada</span>}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {scheduled.client.city} · ~{scheduled.travelMin} min de deslocamento
        </div>
        {days != null && (
          <div
            className={`mt-0.5 text-[11px] ${COLETA_TEXT_TONE[status]} ${
              status === "late" ? "font-medium" : ""
            }`}
          >
            última troca há {days} {days === 1 ? "dia" : "dias"}
            {status === "late" ? " (atrasada)" : ""}
          </div>
        )}
        {scheduled.client.tier === "A" && <Badge className="tier-badge-a mt-1">Grupo A</Badge>}
      </div>
      {!done && !missed && (
        <button
          title="Registrar/finalizar esta visita"
          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onFinalize(scheduled);
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function AddClientDialog({
  open,
  onClose,
  routeId,
  day,
  routeClients,
  clients,
}: {
  open: boolean;
  onClose: () => void;
  routeId: string;
  day: number;
  routeClients: string[];
  clients: Client[];
}) {
  const { addRouteVisit } = useData();
  const [q, setQ] = useState("");
  const [grupo, setGrupo] = useState("all");
  const [situ, setSitu] = useState("todas");

  const available = useMemo(
    () => clients.filter((c) => !routeClients.includes(c.id)),
    [clients, routeClients],
  );

  const options = useMemo(() => {
    const term = q.trim().toLowerCase();
    return available
      .filter((c) => (grupo === "all" ? true : c.tier === grupo))
      .filter((c) => {
        if (situ === "todas") return true;
        if (situ === "sem_data") return c.lastCollectAt == null;
        if (situ === "em_dia") return c.lastCollectAt != null && !isColetaOverdue(c);
        return isColetaOverdue(c);
      })
      .filter((c) =>
        term
          ? `${c.name} ${c.city} ${c.segment} ${c.address}`.toLowerCase().includes(term)
          : true,
      )
      .sort((a, b) => compareClients(a, b, "grupo"));
  }, [available, q, grupo, situ]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar visita — {DAY_NAMES[day]}</DialogTitle>
          <DialogDescription>
            Escolha um cliente para incluir manualmente na rota. Prioridade A e coletas atrasadas vêm
            primeiro e ficam destacadas em vermelho.
          </DialogDescription>
        </DialogHeader>
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
          <Select value={grupo} onValueChange={setGrupo}>
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
                if (routeId) addRouteVisit(routeId, c.id, day);
                onClose();
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
                    {c.city}
                    {c.segment ? ` · ${c.segment}` : ""}
                  </span>
                  <span>{cadenceLabel(c.freqMonth)}</span>
                  {c.lastCollectAt && <span>últ. troca {formatDateBR(c.lastCollectAt)}</span>}
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
    </Dialog>
  );
}
