import { cidadeComDistancia } from "@/components/clients/clientBits";
import { useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Search,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/lib/DataContext";
import { addDays, DAY_NAMES, formatDateBR, mondayOf, todayKey } from "@/lib/geo";
import { computeSchedule } from "@/lib/route";
import { cadenceLabel } from "@/lib/cadence";
import { ColetaBadge, TierBadge, VisitaBadge } from "@/components/clients/clientBadges";
import { VisitForm } from "@/components/visitas/VisitForm";
import { NotDoneDialog } from "@/components/visitas/NotDoneDialog";
import { ProspectVisitDialog } from "@/components/visitas/ProspectVisitDialog";
import { PhoneContactDialog } from "@/components/visitas/PhoneContactDialog";
import { PhotoZoom } from "@/components/visitas/PhotoZoom";
import { RouteActivities } from "@/components/rota/RouteActivities";
import { formatDuracao, totalMinutos } from "@/lib/atividade";
import { toast } from "sonner";
import type { Client, RouteVisit, WeeklyRoute } from "@/lib/types";

/** segunda a sexta — os mesmos dias que entram na rota do coordenador */
const DIAS_DE_ROTA = [1, 2, 3, 4, 5];

export default function MinhaRota() {
  const { state, markRouteVisitStatus, addRouteVisit } = useData();
  const { routes, routeVisits, clients, visits } = state;
  const [formClient, setFormClient] = useState<{ client: Client; routeVisitId: string | null } | null>(null);
  const [notDone, setNotDone] = useState<{ client: Client; routeVisitId: string } | null>(null);
  const [phoneContact, setPhoneContact] = useState<{ client: Client; routeVisitId: string } | null>(
    null,
  );
  const [prospectOpen, setProspectOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

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

  const dayActivities = useMemo(
    () => state.activities.filter((a) => a.weekStart === weekStart && a.day === day),
    [state.activities, weekStart, day],
  );
  const extraMin = totalMinutos(dayActivities);
  const podeLancarAtividade = DIAS_DE_ROTA.includes(day);

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
            pode registrar uma prospecção normalmente e lançar atividades extras do dia.
          </p>
        </div>

        {podeLancarAtividade && (
          <Card className="card-soft">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Atividades extras
                de hoje
              </CardTitle>
              <CardDescription>
                Viagem, manutenção do carro, reunião na empresa, prospecção fora de cliente… informe o
                tempo gasto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RouteActivities weekStart={weekStart} day={day} canEdit showEmpty />
            </CardContent>
          </Card>
        )}
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
            {extraMin > 0 ? ` · +${formatDuracao(extraMin)} em atividades extras` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar cliente
          </Button>
          <Button variant="outline" onClick={() => setProspectOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Nova prospecção
          </Button>
        </div>
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
                        {cidadeComDistancia(s.client)} · {s.client.address || "sem endereço"}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPhoneContact({ client: s.client, routeVisitId: s.routeVisit.id })
                        }
                      >
                        <Phone className="mr-1.5 h-4 w-4" /> Contato via telefone
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
                    <PhotoZoom
                      src={recorded.photoData}
                      alt="Comprovante"
                      imgClassName="h-28 w-40 rounded-lg object-cover"
                    />
                    <span className="mt-1 flex items-center gap-1 text-xs text-primary">
                      Clique na foto para ampliar
                    </span>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {podeLancarAtividade && (
        <Card className="card-soft">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Atividades extras
              de hoje
            </CardTitle>
            <CardDescription>
              Viagem, manutenção do carro, reunião na empresa, prospecção fora de cliente… informe o tempo
              gasto para o coordenador acompanhar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RouteActivities weekStart={weekStart} day={day} canEdit showEmpty />
          </CardContent>
        </Card>
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

      {phoneContact && (
        <PhoneContactDialog
          client={phoneContact.client}
          routeVisitId={phoneContact.routeVisitId}
          onClose={() => setPhoneContact(null)}
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

      {addOpen && route && (
        <AddExistingDialog
          route={route}
          day={day}
          usedIds={new Set(dayVisits.map((rv) => rv.clientId))}
          clients={clients}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

/** Vendedor inclui clientes JÁ EXISTENTES na rota do dia (não pode excluir) */
function AddExistingDialog({
  route,
  day,
  usedIds,
  clients,
  onClose,
}: {
  route: WeeklyRoute;
  day: number;
  usedIds: Set<string>;
  clients: Client[];
  onClose: () => void;
}) {
  const { addRouteVisit } = useData();
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const options = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clients
      .filter((c) => !usedIds.has(c.id))
      .filter((c) => (onlyActive ? c.active : true))
      .filter((c) =>
        term ? `${c.name} ${c.city} ${c.segment} ${c.address}`.toLowerCase().includes(term) : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 200);
  }, [clients, usedIds, onlyActive, q]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-xl overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>Adicionar cliente à {DAY_NAMES[day]}</DialogTitle>
          <DialogDescription>
            Inclua clientes já cadastrados na sua rota de hoje. Pode adicionar quantos quiser — a
            exclusão de clientes é feita somente pelo coordenador.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar cliente por nome, cidade ou segmento…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={onlyActive} onCheckedChange={(v) => setOnlyActive(!!v)} />
            Só ativos
          </label>
        </div>

        <p className="text-xs text-muted-foreground">
          {options.length} cliente(s) disponível(is)
        </p>

        <div className="max-h-96 space-y-1 overflow-y-auto">
          {options.map((c) => (
            <button
              key={c.id}
              className="flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left text-sm hover:bg-secondary"
              onClick={() => {
                addRouteVisit(route, c.id, day);
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
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <ColetaBadge c={c} />
                {c.lastVisitAt && <VisitaBadge c={c} />}
              </span>
            </button>
          ))}
          {options.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum cliente disponível com os filtros atuais.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
