import { CheckCircle2, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColetaBadge, TierBadge } from "@/components/clients/clientBadges";
import { computeSchedule } from "@/lib/route";
import type { Client, RouteVisit, Settings, Visit } from "@/lib/types";

export interface ScheduleRowProps {
  dateIso: string;
  day: number;
  visits: RouteVisit[];
  clients: Client[];
  settings: Settings;
  recorded: Map<string, Visit>;
  canAct: boolean;
  onRegister: (client: Client, routeVisit: RouteVisit) => void;
  onNotDone: (routeVisitId: string) => void;
}

export function DaySchedule({
  dateIso,
  day,
  visits,
  clients,
  settings,
  recorded,
  canAct,
  onRegister,
  onNotDone,
}: ScheduleRowProps) {
  const scheduled = computeSchedule(visits, clients, settings, day);
  if (scheduled.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem visitas programadas.</p>;
  }
  return (
    <div className="space-y-2">
      {scheduled.map((s) => {
        const done = s.routeVisit.status === "concluida";
        const missed = s.routeVisit.status === "nao_realizada";
        const rec = recorded.get(s.routeVisit.id);
        return (
          <div
            key={s.routeVisit.id}
            className={`flex items-center gap-2 rounded-lg border bg-card p-2 text-sm ${done || missed ? "opacity-75" : ""}`}
          >
            <span className="flex shrink-0 flex-col items-center text-[11px] leading-tight text-muted-foreground">
              <Clock className="mb-0.5 h-3.5 w-3.5" />
              {s.arrivalClock}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-medium">{s.client.name}</span>
                {done ? (
                  <Badge className="bg-primary/10 text-primary">Concluída</Badge>
                ) : missed ? (
                  <Badge variant="secondary">Não realizada</Badge>
                ) : (
                  <Badge variant="outline">Pendente</Badge>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="truncate">
                  {s.client.city}
                  {s.client.address ? ` · ${s.client.address}` : ""}
                </span>
                {s.travelMin > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" /> ~{s.travelMin} min
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <TierBadge tier={s.client.tier} />
                {s.client.lastCollectAt && <ColetaBadge c={s.client} />}
              </div>
              {rec && (
                <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                  <CheckCircle2 className="h-3 w-3" /> Visita registrada em {new Date(rec.visitedAt).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
            {canAct && !done && !missed && (
              <div className="flex shrink-0 flex-col gap-1">
                <Button size="sm" onClick={() => onRegister(s.client, s.routeVisit)}>
                  Registrar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onNotDone(s.routeVisit.id)}>
                  Não deu
                </Button>
              </div>
            )}
            {missed && canAct && (
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => onNotDone(s.routeVisit.id)}>
                Reabrir
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
