import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  MapPinOff,
  Route as RouteIcon,
  Target,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/DataContext";
import { addDays, mondayOf, todayKey } from "@/lib/geo";
import { newestRoute } from "@/lib/route";

export default function Dashboard() {
  const { state } = useData();
  const { clients, visits, routes, routeVisits } = state;

  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);
  const weekStart = mondayOf(todayKey());
  const publishedRoute = newestRoute(routes, weekStart, "publicada");
  const plannedCount = useMemo(
    () => routeVisits.filter((rv) => rv.routeId === publishedRoute?.id).length,
    [routeVisits, publishedRoute],
  );
  const doneCount = useMemo(
    () => routeVisits.filter((rv) => rv.routeId === publishedRoute?.id && rv.status === "concluida").length,
    [routeVisits, publishedRoute],
  );
  const visitsThisWeek = useMemo(
    () =>
      visits.filter((v) => {
        const k = v.visitedAt.slice(0, 10);
        return k >= weekStart && k < addDays(weekStart, 7);
      }),
    [visits, weekStart],
  );
  const outOfRadius = useMemo(() => visits.filter((v) => !v.withinRadius), [visits]);
  const noCoords = useMemo(() => activeClients.filter((c) => c.lat == null), [activeClients]);
  const drafts = useMemo(() => routes.filter((r) => r.status === "rascunho"), [routes]);

  const tierCount = useMemo(() => {
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    activeClients.forEach((c) => {
      if (c.freqMonth > 0) counts[c.tier]++;
    });
    return counts;
  }, [activeClients]);

  // Prospecções (atualiza sozinho: os clientes vêm em tempo real)
  const prospectStats = useMemo(() => {
    const all = clients.filter((c) => c.isProspecao);
    const em = all.filter((c) => (c.prospeccaoStatus ?? "em_negociacao") === "em_negociacao").length;
    const fechado = all.filter((c) => c.prospeccaoStatus === "fechado").length;
    const perdido = all.filter((c) => c.prospeccaoStatus === "perdido").length;
    const total = all.length;
    const pct = (n: number) => (total ? (n / total) * 100 : 0);
    const pEm = pct(em);
    const pFe = pct(fechado);
    return {
      total,
      em,
      fechado,
      perdido,
      taxa: total ? Math.round((fechado / total) * 100) : 0,
      gradient: `conic-gradient(#f59e0b 0% ${pEm}%, #10b981 ${pEm}% ${pEm + pFe}%, #ef4444 ${
        pEm + pFe
      }% 100%)`,
      rows: [
        { label: "Em negociação", value: em, color: "#f59e0b" },
        { label: "Fechadas", value: fechado, color: "#10b981" },
        { label: "Perdidas", value: perdido, color: "#ef4444" },
      ],
    };
  }, [clients]);

  const stats = [
    {
      label: "Clientes ativos",
      value: activeClients.length,
      icon: Users,
      sub: `${tierCount.A} no grupo A (4x/mês)`,
      href: "/clientes",
    },
    {
      label: "Rota da semana",
      value: publishedRoute ? `${doneCount}/${plannedCount}` : "—",
      icon: RouteIcon,
      sub: publishedRoute
        ? doneCount === plannedCount && plannedCount > 0
          ? "Rota concluída"
          : `${plannedCount - doneCount} pendentes`
        : "Nenhuma rota publicada",
      href: "/rota",
    },
    {
      label: "Visitas na semana",
      value: visitsThisWeek.length,
      icon: CalendarCheck2,
      sub: `${visits.length} no total`,
      href: "/visitas",
    },
    {
      label: "Alertas",
      value: outOfRadius.length + noCoords.length,
      icon: MapPinOff,
      sub: `${outOfRadius.length} fora do raio · ${noCoords.length} sem coordenadas`,
      href: outOfRadius.length > 0 ? "/visitas?alerta=raio" : "/clientes",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visão geral</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe a cobertura de visitas da região Sul.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="card-soft">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="font-medium">{s.label}</CardDescription>
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-3xl">{s.value}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <p className="text-xs text-muted-foreground">{s.sub}</p>
              <Button asChild variant="link" size="sm" className="mt-1 h-auto p-0">
                <Link to={s.href}>
                  Abrir <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card-soft">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-primary" /> Prospecções
              </CardTitle>
              <CardDescription>
                Prospecções registradas e taxa de conversão — atualiza automaticamente.
              </CardDescription>
            </div>
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <Link to="/prospeccoes">
                Abrir prospecções <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {prospectStats.total === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma prospecção registrada ainda. Assim que o vendedor (ou você) registrar uma, o
              gráfico aparece aqui automaticamente.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              <div
                className="relative h-40 w-40 shrink-0 rounded-full"
                style={{ background: prospectStats.gradient }}
              >
                <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-card text-center">
                  <span className="text-3xl font-bold">{prospectStats.taxa}%</span>
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    taxa de conversão
                  </span>
                </div>
              </div>

              <div className="grid min-w-56 flex-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Total de prospecções</div>
                  <div className="text-2xl font-bold">{prospectStats.total}</div>
                </div>
                {prospectStats.rows.map((r) => (
                  <div key={r.label} className="rounded-lg border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                      {r.label}
                    </div>
                    <div className="text-2xl font-bold">{r.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="card-soft lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Cobertura da semana</CardTitle>
            <CardDescription>
              Rota publicada de {weekStart.split("-").reverse().join("/")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {publishedRoute ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-end gap-2">
                  <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
                      style={{ width: plannedCount ? `${(doneCount / plannedCount) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-sm font-semibold">
                    {plannedCount ? Math.round((doneCount / plannedCount) * 100) : 0}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                  {[1, 2, 3, 4, 5].map((d) => {
                    const total = routeVisits.filter((rv) => rv.routeId === publishedRoute.id && rv.day === d).length;
                    const done = routeVisits.filter(
                      (rv) => rv.routeId === publishedRoute.id && rv.day === d && rv.status === "concluida",
                    ).length;
                    return (
                      <div key={d} className="rounded-lg border p-2 text-center">
                        <div className="text-[11px] text-muted-foreground">Dia {d}</div>
                        <div className="text-sm font-semibold">
                          {done}/{total}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-secondary/60 p-3 text-sm text-muted-foreground">
                <RouteIcon className="h-4 w-4" />
                Nenhuma rota publicada para esta semana.
                <Button asChild variant="link" size="sm" className="ml-auto h-auto p-0">
                  <Link to="/rota">Gerar rota</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader>
            <CardTitle className="text-base">Carteira por grupo de cadência</CardTitle>
            <CardDescription>Visitas necessárias por mês (planilha de cadência)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(
              [
                ["A", "4x/mês", "tier-badge-a"],
                ["B", "3x/mês", "tier-badge-b"],
                ["C", "2x/mês", "tier-badge-c"],
                ["D", "<2x/mês", "tier-badge-d"],
              ] as const
            ).map(([t, label, cls]) => {
              const n = tierCount[t];
              const total = activeClients.length || 1;
              return (
                <div key={t} className="flex items-center gap-3">
                  <Badge className={cls}>
                    {label}
                  </Badge>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(n / total) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-medium">{n}</span>
                </div>
              );
            })}
            <p className="pt-1 text-xs text-muted-foreground">
              Clientes sem data de última troca também só entram na rota quando a cadência indicar.
              Ajuste em "Clientes".
            </p>
          </CardContent>
        </Card>
      </div>

      {(drafts.length > 0 || outOfRadius.length > 0 || noCoords.length > 0) && (
        <Card className="card-soft border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Atenção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {drafts.length > 0 && (
              <p>
                Existem {drafts.length} rota(s) em rascunho sem publicação.
                <Button asChild variant="link" size="sm" className="ml-1 h-auto p-0">
                  <Link to="/rota">Revisar</Link>
                </Button>
              </p>
            )}
            {outOfRadius.length > 0 && (
              <p>
                {outOfRadius.length} visita(s) registrada(s) com localização distante do endereço cadastrado
                (possível fraude ou endereço desatualizado).
                <Button asChild variant="link" size="sm" className="ml-1 h-auto p-0">
                  <Link to="/visitas?alerta=raio">Ver</Link>
                </Button>
              </p>
            )}
            {noCoords.length > 0 && (
              <p>
                {noCoords.length} cliente(s) ativo(s) sem coordenadas — não entram na rota automática.
                <Button asChild variant="link" size="sm" className="ml-1 h-auto p-0">
                  <Link to="/clientes">Geocodificar</Link>
                </Button>
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
