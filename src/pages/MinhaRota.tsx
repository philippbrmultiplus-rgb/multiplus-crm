import { useMemo, useState } from "react";
import { CalendarCheck2, CheckCircle2, ExternalLink, MapPin, Navigation, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/lib/DataContext";
import { addDays, DAY_NAMES, formatDateBR, mondayOf, todayKey } from "@/lib/geo";
import { computeSchedule } from "@/lib/route";
import { ColetaBadge } from "@/components/clients/clientBadges";
import { VisitForm } from "@/components/visitas/VisitForm";
import { NotDoneDialog } from "@/components/visitas/NotDoneDialog";
import { ProspectVisitDialog } from "@/components/visitas/ProspectVisitDialog";
import type { Client, RouteVisit } from "@/lib/types";

export default function MinhaRota() {
  const { state, markRouteVisitStatus } = useData();
  const { routes, routeVisits, clients, visits } = state;
  const [formClient, setFormClient] = useState<{ client: Client; routeVisitId: string | null } | null>(null);
  const [notDone, setNotDone] = useState<{ client: Client; routeVisitId: string } | null>(null);
  const [prospectOpen, setProspectOpen] = useState(false);

  const weekStart = mondayOf(todayKey());
  const today = new Date();
  const day = today.getDay(); // 0=dom, 1=seg ... 6=sáb
  const todayIso = todayKey();

  const route = useMemo(
    () =>
      routes
        .filter((r) => r.weekStart === weekStart && r.status === "publicada")
        .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1))[0] ?? null,
    [routes, weekStart],
  );

  const dayVisits = useMemo(
    () => (route ? routeVisits.filter((rv) => rv.routeId === route.id && rv.day === day) : []),
    [route, routeVisits, day],
  );

  const scheduled = useMemo(
    () => computeSchedule(dayVisits, clients, state.settings, day),
    [dayVisits, clients, state.settings, day],
  );

  const visitByRouteVisit = (id: string | null) => visits.find((v) => v.routeVisitId === id);

  if (day === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setProspectOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Nova prospecção
          </Button>
        </div>
        <div className="flex h-40 items-center justify-center">
          <p className="text-muted-foreground">Domingo — sem visitas programadas.</p>
        </div>
        {prospectOpen && (
          <ProspectVisitDialog open day={1} routeId={null} onClose={() => setProspectOpen(false)} />
        )}
      </div>
    );
  }

  if (!route) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setProspectOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Nova prospecção
          </Button>
        </div>
        <div className="card-soft flex flex-col items-center gap-2 p-12 text-center">
          <CalendarCheck2 className="h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Sem rota publicada</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            O coordenador ainda não publicou a rota desta semana ({formatDateBR(weekStart)}). Você ainda
            pode registrar uma prospecção normalmente.
          </p>
        </div>
        {prospectOpen && (
          <ProspectVisitDialog
            open
            day={[1, 2, 3, 4, 5].includes(day) ? day : 1}
            routeId={null}
            onClose={() => setProspectOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Minha rota de hoje</h1>
          <p className="text-sm text-muted-foreground">
            {DAY_NAMES[day]}, {formatDateBR(todayIso)} · {scheduled.length} visitas
          </p>
        </div>
        <Button variant="outline" onClick={() => setProspectOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Nova prospecção
        </Button>
      </div>

      {scheduled.length === 0 ? (
        <div className="card-soft p-10 text-center text-muted-foreground">
          Nenhuma visita programada para hoje. Bom descanso!
        </div>
      ) : (
        <div className="space-y-3">
          {scheduled.map((s) => {
            const recorded = visitByRouteVisit(s.routeVisit.id);
            const done = s.routeVisit.status === "concluida";
            const missed = s.routeVisit.status === "nao_realizada";
            const statusPill = done ? (
              <Badge className="bg-primary/10 text-primary">Concluída</Badge>
            ) : missed ? (
              <Badge className="bg-slate-500/10 text-slate-600 dark:text-slate-300">Não realizada</Badge>
            ) : (
              <Badge variant="outline">Pendente</Badge>
            );
            return (
              <Card key={s.routeVisit.id} className={`card-soft ${done || missed ? "opacity-80" : ""}`}>
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-2">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-12 w-12 flex-col items-center justify-center rounded-xl text-center ${
                        done ? "bg-primary/10 text-primary" : missed ? "bg-slate-500/10" : "bg-secondary text-foreground"
                      }`}
                    >
                      <span className="text-[10px] uppercase">chegada</span>
                      <span className="text-sm font-bold leading-none">{s.arrivalClock}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{s.client.name}</CardTitle>
                        {done && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                      <CardDescription className="line-clamp-2">
                        {s.client.city} · {s.client.address || "sem endereço"}
                      </CardDescription>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {s.client.tier === "A" && <Badge className="tier-badge-a">Grupo A</Badge>}
                        <Badge variant="outline">~{s.travelMin} min de deslocamento</Badge>
                        {s.client.lastCollectAt && <ColetaBadge c={s.client} />}
                      </div>
                    </div>
                  </div>
                  {statusPill}
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2 pb-3">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${s.client.lat},${s.client.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation className="mr-1.5 h-4 w-4" /> Navegar até o cliente
                    </a>
                  </Button>
                  {!done && !missed && (
                    <>
                      <Button size="sm" onClick={() => setFormClient({ client: s.client, routeVisitId: s.routeVisit.id })}>
                        <MapPin className="mr-1.5 h-4 w-4" /> Registrar visita
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNotDone({ client: s.client, routeVisitId: s.routeVisit.id })}
                      >
                        Não deu para visitar
                      </Button>
                    </>
                  )}
                  {missed && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markRouteVisitStatus(s.routeVisit.id, "pendente")}
                    >
                      Reabrir
                    </Button>
                  )}
                  {recorded && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {recorded.status === "realizada"
                        ? "Visita realizada"
                        : recorded.status === "nao_encontrado"
                          ? "Não encontrado"
                          : recorded.status === "nao_realizada"
                            ? "Não realizada"
                            : "Recusado"}
                      {recorded.gpsLat == null
                        ? " · sem confirmação de GPS"
                        : recorded.distanceFromClientM != null && ` · ${Math.round(recorded.distanceFromClientM)} m do endereço`}
                    </span>
                  )}
                </CardContent>
                {recorded && recorded.resultComments && (
                  <CardContent className="border-t pt-3 text-sm">
                    <div className="font-medium">O que foi feito</div>
                    <p className="mt-0.5 text-muted-foreground">{recorded.resultComments}</p>
                    {recorded.nextActions && (
                      <>
                        <div className="mt-2 font-medium">Próxima visita</div>
                        <p className="mt-0.5 text-muted-foreground">{recorded.nextActions}</p>
                      </>
                    )}
                  </CardContent>
                )}
                {recorded?.photoData && (
                  <CardContent className="pb-3">
                    <a href={recorded.photoData} target="_blank" rel="noreferrer">
                      <img
                        src={recorded.photoData}
                        alt="Comprovante"
                        className="h-28 w-40 rounded-lg object-cover"
                       
                      />
                      <span className="mt-1 flex items-center gap-1 text-xs text-primary">
                        <ExternalLink className="h-3 w-3" /> Ver comprovante
                      </span>
                    </a>
                  </CardContent>
                )}
              </Card>
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

      {notDone && (
        <NotDoneDialog
          open
          clientName={notDone.client.name}
          onClose={() => setNotDone(null)}
          onConfirm={(reason) => markRouteVisitStatus(notDone.routeVisitId, "nao_realizada", reason)}
        />
      )}

      {prospectOpen && (
        <ProspectVisitDialog
          open
          day={[1, 2, 3, 4, 5].includes(day) ? day : 1}
          routeId={route?.id ?? null}
          onClose={() => setProspectOpen(false)}
        />
      )}
    </div>
  );
}
