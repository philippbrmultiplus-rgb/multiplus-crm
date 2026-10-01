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
import { addDays, daysSinceToday, formatDateBR, mondayOf, todayKey } from "@/lib/geo";
import {
  coletaDays,
  coletaStatus,
  COLETA_BADGE_TONE,
  isColetaOverdue,
  lastVisitDays,
  visitaStatus,
  VISITA_BADGE_TONE,
} from "@/components/clients/clientBits";
import { cidadeComDistancia } from "@/components/clients/clientBits";
import { newestRoute } from "@/lib/route";
import type { Client } from "@/lib/types";

/** lista compacta de clientes com dias sem coleta e sem visita */
function AtencaoList({ items, total }: { items: Client[]; total: number }) {
  return (
    <div className="mt-2 space-y-1.5">
      {items.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="min-w-0 flex-1">
            <span className="truncate font-medium">{c.name}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">
              {c.tier}
              {` · ${cidadeComDistancia(c)}`}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <Badge className={COLETA_BADGE_TONE[coletaStatus(c)]} title="Dias sem coleta">
              {coletaDays(c) == null ? "sem coleta" : `${coletaDays(c)}d sem coleta`}
            </Badge>
            <Badge className={VISITA_BADGE_TONE[visitaStatus(c)]} title="Dias sem visita">
              {lastVisitDays(c) == null ? "sem visita" : `${lastVisitDays(c)}d sem visita`}
            </Badge>
          </span>
        </div>
      ))}
      {total > items.length && (
        <p className="text-xs text-muted-foreground">… e mais {total - items.length} cliente(s).</p>
      )}
    </div>
  );
}

/** barra de cobertura (percentual de clientes atingidos no mês) */
function CoberturaBarra({
  label,
  n,
  total,
  pct,
  semLabel,
}: {
  label: string;
  n: number;
  total: number;
  pct: number;
  semLabel: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-semibold">
          {pct}%{" "}
          <span className="text-xs font-normal text-muted-foreground">
            ({n} de {total})
          </span>
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {total - n} cliente(s) {semLabel} no mês.
      </p>
    </div>
  );
}

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
  const drafts = useMemo(() => routes.filter((r) => r.status === "rascunho"), [routes]);
  const alertaVisits = useMemo(() => visits.filter((v) => v.alerta), [visits]);

  // clientes que precisam de atenção (ativos, fora as prospecções)
  const atencao = useMemo(() => {
    const base = clients.filter((c) => c.active && !c.isProspecao);
    const dv = (c: (typeof base)[number]) => (c.lastVisitAt ? daysSinceToday(c.lastVisitAt) : null);
    const semVisita = base
      .filter((c) => {
        const d = dv(c);
        return d == null || d > 30;
      })
      .sort((a, b) => (dv(b) ?? 9999) - (dv(a) ?? 9999));
    const semColeta = base.filter((c) => isColetaOverdue(c)).sort((a, b) => (coletaDays(b) ?? 0) - (coletaDays(a) ?? 0));
    const risco = base
      .filter((c) => {
        const d = dv(c);
        return isColetaOverdue(c) && (d == null || d > 30);
      })
      .sort((a, b) => (coletaDays(b) ?? 0) - (coletaDays(a) ?? 0));
    return { semVisita, semColeta, risco };
  }, [clients]);

  // cobertura da carteira no mês corrente (clientes ativos, fora as prospecções)
  const cobertura = useMemo(() => {
    const hoje = todayKey();
    const inicioMes = `${hoje.slice(0, 7)}-01`;
    const base = clients.filter((c) => c.active && !c.isProspecao);
    const visitados = new Set(
      visits
        .filter((v) => v.status !== "nao_realizada" && v.visitedAt.slice(0, 10) >= inicioMes)
        .map((v) => v.clientId),
    );
    const comVisita = base.filter((c) => visitados.has(c.id)).length;
    const comColeta = base.filter(
      (c) => c.lastCollectAt != null && c.lastCollectAt.slice(0, 10) >= inicioMes,
    ).length;
    const total = base.length;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
    return {
      total,
      comVisita,
      comColeta,
      pctVisita: pct(comVisita),
      pctColeta: pct(comColeta),
      mesLabel: new Date(`${inicioMes}T12:00:00`).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    };
  }, [clients, visits]);

  const grupoA = useMemo(
    () => activeClients.filter((c) => c.freqMonth > 0 && c.tier === "A").length,
    [activeClients],
  );

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
      gradient: `conic-gradient(#f59e0b 0% ${pEm}%, #3b82f6 ${pEm}% ${pEm + pFe}%, #ef4444 ${
        pEm + pFe
      }% 100%)`,
      rows: [
        { label: "Em negociação", value: em, color: "#f59e0b" },
        { label: "Fechadas", value: fechado, color: "#3b82f6" },
        { label: "Perdidas", value: perdido, color: "#ef4444" },
      ],
    };
  }, [clients]);

  const stats = [
    {
      label: "Clientes ativos",
      value: activeClients.length,
      icon: Users,
      sub: `${grupoA} no grupo A (4x/mês)`,
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
      value: outOfRadius.length + alertaVisits.length,
      icon: MapPinOff,
      sub: `${outOfRadius.length} fora do raio · ${alertaVisits.length} alerta(s) do vendedor`,
      href: alertaVisits.length > 0 || outOfRadius.length > 0 ? "/visitas" : "/clientes",
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
          <CardTitle className="text-base">Cobertura da carteira — {cobertura.mesLabel}</CardTitle>
          <CardDescription>
            Clientes ativos (fora as prospecções) com pelo menos uma visita registrada e uma coleta no
            mês. Visitas "não realizada" não contam como cobertura.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CoberturaBarra
            label="Com visita no mês"
            n={cobertura.comVisita}
            total={cobertura.total}
            pct={cobertura.pctVisita}
            semLabel="sem visita"
          />
          <CoberturaBarra
            label="Com coleta no mês"
            n={cobertura.comColeta}
            total={cobertura.total}
            pct={cobertura.pctColeta}
            semLabel="sem coleta"
          />
        </CardContent>
      </Card>

      <Card className="card-soft">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Clientes que precisam de atenção
              </CardTitle>
              <CardDescription>
                Clientes ativos sem visita recente, com coleta atrasada ou nas duas situações (risco).
              </CardDescription>
            </div>
            <Button asChild variant="link" size="sm" className="h-auto p-0">
              <Link to="/clientes">
                Abrir clientes <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Em risco */}
          <Link
            to="/clientes?situ=atrasada&situVisita=sem_ou_atrasada"
            className="block rounded-lg border border-destructive/30 bg-destructive/5 p-3 transition-colors hover:bg-destructive/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-destructive">
                Em risco — coleta atrasada + sem visita há mais de 30 dias
              </span>
              <span className="flex items-center gap-2">
                <span className="text-lg font-bold text-destructive">{atencao.risco.length}</span>
                <span className="text-xs text-destructive underline underline-offset-2">ver lista</span>
              </span>
            </div>
            {atencao.risco.length > 0 ? (
              <AtencaoList items={atencao.risco.slice(0, 6)} total={atencao.risco.length} />
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Nenhum cliente nesta situação. </p>
            )}
          </Link>

          <div className="grid gap-4 lg:grid-cols-2">
            <Link
              to="/clientes?situVisita=sem_ou_atrasada"
              className="block rounded-lg border p-3 transition-colors hover:bg-secondary/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">Sem visita há mais de 30 dias</span>
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold">{atencao.semVisita.length}</span>
                  <span className="text-xs text-primary underline underline-offset-2">ver lista</span>
                </span>
              </div>
              {atencao.semVisita.length > 0 ? (
                <AtencaoList items={atencao.semVisita.slice(0, 6)} total={atencao.semVisita.length} />
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Todos visitados recentemente.</p>
              )}
            </Link>

            <Link
              to="/clientes?situ=atrasada"
              className="block rounded-lg border p-3 transition-colors hover:bg-secondary/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">Coleta atrasada (mais de 30 dias)</span>
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold">{atencao.semColeta.length}</span>
                  <span className="text-xs text-primary underline underline-offset-2">ver lista</span>
                </span>
              </div>
              {atencao.semColeta.length > 0 ? (
                <AtencaoList items={atencao.semColeta.slice(0, 6)} total={atencao.semColeta.length} />
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Nenhuma coleta atrasada.</p>
              )}
            </Link>
          </div>
        </CardContent>
      </Card>

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

      {(drafts.length > 0 || outOfRadius.length > 0 || alertaVisits.length > 0) && (
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
            {alertaVisits.length > 0 && (
              <div className="space-y-1">
                <p>{alertaVisits.length} alerta(s) registrado(s) pelo(s) vendedor(es):</p>
                <ul className="ml-1 space-y-1">
                  {alertaVisits.slice(0, 5).map((v) => {
                    const c = clients.find((x) => x.id === v.clientId);
                    return (
                      <li key={v.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                        <span className="font-medium">{c?.name ?? "Cliente removido"}</span>
                        <span className="text-muted-foreground">
                          {formatDateBR(v.visitedAt.slice(0, 10))}
                        </span>
                        <span className="text-destructive">{v.alertaMotivo || "sem motivo informado"}</span>
                      </li>
                    );
                  })}
                </ul>
                {alertaVisits.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    … e mais {alertaVisits.length - 5} alerta(s).
                  </p>
                )}
                <Button asChild variant="link" size="sm" className="h-auto p-0">
                  <Link to="/visitas">Ver visitas</Link>
                </Button>
              </div>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
