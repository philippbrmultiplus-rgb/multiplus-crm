import { useMemo, useState } from "react";
import { CalendarX2, ChevronLeft, ChevronRight, Info, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useData } from "@/lib/DataContext";
import { DaySchedule } from "@/components/rota/DaySchedule";
import { VisitForm } from "@/components/visitas/VisitForm";
import { ProspectVisitDialog } from "@/components/visitas/ProspectVisitDialog";
import { NotDoneDialog } from "@/components/visitas/NotDoneDialog";
import { VisitDetailsDialog } from "@/components/visitas/VisitDetailsDialog";
import {
  addDays,
  DAY_NAMES,
  formatDateBR,
  mondayOf,
  todayKey,
} from "@/lib/geo";
import type { Client, RouteVisit, Visit } from "@/lib/types";

export default function MinhaRotaSemana() {
  const { state, markRouteVisitStatus } = useData();
  const { routes, routeVisits, clients, settings, visits } = state;
  const todayIso = todayKey();
  const [weekStart, setWeekStart] = useState<string>(mondayOf(todayIso));
  const [formClient, setFormClient] = useState<{ client: Client; routeVisitId: string } | null>(null);
  const [prospectDay, setProspectDay] = useState<number | null>(null);
  const [notDone, setNotDone] = useState<{ routeVisitId: string; clientName: string } | null>(null);
  const [detail, setDetail] = useState<{ client: Client; visit: Visit } | null>(null);

  const route = useMemo(() => {
    const week = routes.filter((r) => r.weekStart === weekStart && r.status === "publicada");
    return week.sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1))[0] ?? null;
  }, [routes, weekStart]);

  const routeVisitIds = useMemo(
    () => (route ? new Set(routeVisits.filter((rv) => rv.routeId === route.id).map((rv) => rv.id)) : new Set<string>()),
    [route, routeVisits],
  );

  const recorded = useMemo(() => {
    const map = new Map<string, Visit>();
    for (const v of visits) {
      if (v.routeVisitId && routeVisitIds.has(v.routeVisitId)) {
        const cur = map.get(v.routeVisitId);
        if (!cur || v.visitedAt > cur.visitedAt) map.set(v.routeVisitId, v);
      }
    }
    return map;
  }, [visits, routeVisitIds]);

  const days = useMemo(
    () => [...(settings.workingDays as number[])].sort((a, b) => a - b),
    [settings.workingDays],
  );

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

  const isCurrentWeek = weekStart === mondayOf(todayIso);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Minha rota da semana</h1>
          <p className="text-sm text-muted-foreground">
            Planejamento publicado pelo coordenador para {formatDateBR(weekStart)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-40 text-center text-sm font-medium">
            Semana de {weekStart.split("-").reverse().join("/")}
          </div>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setWeekStart(mondayOf(todayIso))}>
            Hoje
          </Button>
        </div>
      </div>

      {!route ? (
        <div className="card-soft flex flex-col items-center gap-3 p-12 text-center">
          <CalendarX2 className="h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Sem rota publicada</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {isCurrentWeek
              ? "O coordenador ainda não publicou a rota desta semana. Assim que publicar, o plano completo aparecerá aqui."
              : "Não existe rota publicada para esta semana."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {isCurrentWeek && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Dica</AlertTitle>
              <AlertDescription>
                Você pode registrar as visitas da semana diretamente aqui (foto e observações). As
                visitas já realizadas ficam salvas e aparecem também na visão do mês.
              </AlertDescription>
            </Alert>
          )}
          {days.map((day) => {
            const dateIso = addDays(weekStart, day - 1);
            const dayVisits = routeVisits.filter((rv) => rv.routeId === route.id && rv.day === day);
            const canAct = dateIso <= todayIso;
            return (
              <section key={day} className="card-soft p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">{DAY_NAMES[day]}</h2>
                  <div className="flex flex-wrap items-center justify-end gap-2 text-right">
                    <div className="text-xs text-muted-foreground">
                      <div>{dateIso.split("-").reverse().join("/")}</div>
                      <div>
                        {dayVisits.filter((v) => v.status === "concluida").length}/{dayVisits.length} concluídas
                        {!canAct && " · bloqueado para registro"}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProspectDay(day)}
                      title="Registrar um cliente novo prospectado neste dia"
                    >
                      <UserPlus className="mr-1.5 h-4 w-4" /> Nova prospecção
                    </Button>
                  </div>
                </div>
                <DaySchedule
                  dateIso={dateIso}
                  day={day}
                  visits={dayVisits}
                  clients={clients}
                  settings={settings}
                  recorded={recorded}
                  canAct={canAct}
                  onRegister={(c, rv) => setFormClient({ client: c, routeVisitId: rv.id })}
                  onNotDone={toggleNotDone}
                  onOpenDetails={(client, visit) => setDetail({ client, visit })}
                />
              </section>
            );
          })}
        </div>
      )}

      {formClient && (
        <VisitForm
          client={formClient.client}
          routeVisitId={formClient.routeVisitId}
          onClose={() => setFormClient(null)}
        />
      )}

      {prospectDay != null && route && (
        <ProspectVisitDialog
          open
          day={prospectDay}
          routeId={route.id}
          onClose={() => setProspectDay(null)}
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

      {detail && (
        <VisitDetailsDialog
          client={detail.client}
          visit={detail.visit}
          radiusM={settings.visitRadiusM}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
