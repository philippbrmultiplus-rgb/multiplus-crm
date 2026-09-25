import { useMemo, useState } from "react";
import { CalendarX2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useData } from "@/lib/DataContext";
import { DaySchedule } from "@/components/rota/DaySchedule";
import { rotaStatusDot } from "@/components/clients/clientBits";
import { VisitForm } from "@/components/visitas/VisitForm";
import { NotDoneDialog } from "@/components/visitas/NotDoneDialog";
import { DAY_NAMES, mondayOf, todayKey } from "@/lib/geo";import type { Client, RouteVisit, Visit } from "@/lib/types";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function MinhaRotaMes() {
  const { state, markRouteVisitStatus } = useData();
  const { routes, routeVisits, clients, settings, visits } = state;
  const now = new Date();
  const todayIso = todayKey();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [formClient, setFormClient] = useState<{ client: Client; routeVisitId: string } | null>(null);
  const [notDone, setNotDone] = useState<{ routeVisitId: string; clientName: string } | null>(null);

  const gridDates = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1);
    const offset = (first.getDay() + 6) % 7; // seg=0
    const start = new Date(ym.y, ym.m, 1 - offset);
    const out: string[] = [];
    for (let i = 0; i < 42; i++) out.push(toIso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
    return out;
  }, [ym]);

  const routeByWeek = useMemo(() => {
    const weeks = new Set(gridDates.map((d) => mondayOf(d)));
    const map = new Map<string, typeof routes[number]>();
    for (const r of routes) {
      if (r.status !== "publicada" || !weeks.has(r.weekStart)) continue;
      const cur = map.get(r.weekStart);
      if (!cur || r.generatedAt > cur.generatedAt) map.set(r.weekStart, r);
    }
    return map;
  }, [routes, gridDates]);

  const visitsByDate = useMemo(() => {
    const map = new Map<string, RouteVisit[]>();
    for (const d of gridDates) {
      const route = routeByWeek.get(mondayOf(d));
      if (!route) continue;
      const dow = new Date(`${d}T12:00:00`).getDay();
      const list = routeVisits
        .filter((rv) => rv.routeId === route.id && rv.day === dow)
        .sort((a, b) => a.position - b.position);
      if (list.length > 0) map.set(d, list);
    }
    return map;
  }, [gridDates, routeByWeek, routeVisits]);

  const allMonthIds = useMemo(() => {
    const set = new Set<string>();
    for (const list of visitsByDate.values()) for (const rv of list) set.add(rv.id);
    return set;
  }, [visitsByDate]);

  const recorded = useMemo(() => {
    const map = new Map<string, Visit>();
    for (const v of visits) {
      if (v.routeVisitId && allMonthIds.has(v.routeVisitId)) {
        const cur = map.get(v.routeVisitId);
        if (!cur || v.visitedAt > cur.visitedAt) map.set(v.routeVisitId, v);
      }
    }
    return map;
  }, [visits, allMonthIds]);

  const clientOf = (id: string) => clients.find((c) => c.id === id);

  const toggleNotDone = (rvId: string) => {
    const rv = routeVisits.find((x) => x.id === rvId);
    if (!rv) return;
    if (rv.status === "nao_realizada") {
      markRouteVisitStatus(rvId, "pendente");
    } else {
      const client = clients.find((c) => c.id === rv.clientId);
      setNotDone({ routeVisitId: rvId, clientName: client?.name ?? "Cliente" });
    }
  };

  const shiftMonth = (delta: number) => {
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const hasAny = gridDates.some((d) => visitsByDate.has(d));
  const openRvs = openDate ? visitsByDate.get(openDate) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Minha rota do mês</h1>
          <p className="text-sm text-muted-foreground">
            Visitas publicadas mês a mês, com status de cada dia. O que você fizer fica salvo no histórico.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-40 text-center text-sm font-medium">
            {MONTHS[ym.m]} {ym.y}
          </div>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}>
            Hoje
          </Button>
        </div>
      </div>

      <div className="card-soft p-3">
        <div className="grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <div key={d} className="pb-1 text-center text-xs font-medium text-muted-foreground">
              {DAY_NAMES[d]}
            </div>
          ))}
          {gridDates.map((d) => {
            const inMonth = d.slice(0, 7) === `${ym.y}-${String(ym.m + 1).padStart(2, "0")}`;
            const rvs = visitsByDate.get(d);
            const isToday = d === todayIso;
            return (
              <button
                key={d}
                disabled={!rvs}
                onClick={() => setOpenDate(d)}
                className={`flex min-h-20 flex-col gap-1 rounded-lg border p-1 text-left ${
                  !inMonth ? "opacity-35" : ""
                } ${isToday ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card/40"}
                  ${rvs ? "cursor-pointer hover:bg-secondary" : "cursor-default"}`}
              >
                <span
                  className={`self-end px-1 text-xs ${isToday ? "font-bold text-primary" : inMonth ? "font-medium" : ""}`}
                >
                  {Number(d.slice(8))}
                </span>
                {rvs && (
                  <div className="min-w-0 space-y-0.5">
                    {rvs.slice(0, 3).map((rv) => {
                      const c = clientOf(rv.clientId);
                      return (
                        <div key={rv.id} className="flex items-center gap-1 text-[10px] leading-tight text-foreground">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${rotaStatusDot(rv.status)}`} />
                          <span className="truncate">{c?.name ?? "—"}</span>
                        </div>
                      );
                    })}
                    {rvs.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{rvs.length - 3} visitas</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 border-t px-1 pt-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Pendente
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Concluída
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Não realizada
          </span>
        </div>
      </div>

      {!hasAny && (
        <div className="card-soft flex flex-col items-center gap-3 p-10 text-center">
          <CalendarX2 className="h-8 w-8 text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">
            Nenhuma rota publicada para este mês. As rotas publicadas pelo coordenador aparecem aqui no
            calendário.
          </p>
        </div>
      )}

      <Dialog open={!!openDate} onOpenChange={(o) => !o && setOpenDate(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {openDate ? `${DAY_NAMES[new Date(`${openDate}T12:00:00`).getDay()]} · ${openDate.split("-").reverse().join("/")}` : ""}
            </DialogTitle>
            <DialogDescription>
              {openDate && openDate <= todayIso
                ? "Visitas deste dia — você pode registrar as pendentes."
                : "Visitas previstas (registro liberado no dia)."}
            </DialogDescription>
          </DialogHeader>
          {openDate && openRvs.length > 0 ? (
            <DaySchedule
              dateIso={openDate}
              day={new Date(`${openDate}T12:00:00`).getDay()}
              visits={openRvs}
              clients={clients}
              settings={settings}
              recorded={recorded}
              canAct={openDate <= todayIso}
              onRegister={(c, rv) => {
                setFormClient({ client: c, routeVisitId: rv.id });
                setOpenDate(null);
              }}
              onNotDone={toggleNotDone}
            />
          ) : (
            <p className="py-4 text-sm text-muted-foreground">Sem visitas neste dia.</p>
          )}
        </DialogContent>
      </Dialog>

      {formClient && (
        <VisitForm
          client={formClient.client}
          routeVisitId={formClient.routeVisitId}
          onClose={() => setFormClient(null)}
        />
      )}

      {notDone && (
        <NotDoneDialog
          open
          clientName={notDone.clientName}
          onClose={() => setNotDone(null)}
          onConfirm={(reason) => markRouteVisitStatus(notDone.routeVisitId, "nao_realizada", reason)}
        />
      )}
    </div>
  );
}
