import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  Plus,
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
import { NewAlertDialog } from "@/components/alerts/NewAlertDialog";
import { newestRoute } from "@/lib/route";
import {
  DIAS_SEM_DEFINICAO,
  diasRegistroPorCliente,
  situacaoOf,
  type SituacaoProspeccao,
} from "@/lib/prospeccao";
import type { Client } from "@/lib/types";

/** segmentos que entram na cobertura da carteira */
const SEGMENTOS_COBERTURA = new Set([
  "ROLLON",
  "ROLLON/ CARREGAMENTO NA HORA",
  "POLI",
  "TERCEIRO",
]);

/** compara segmento ignorando acentos, maiúsculas e espaços repetidos */
function normSegmento(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

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
  const { state, role } = useData();
  const { clients, visits, routes, routeVisits, alerts } = state;
  const [novoAlerta, setNovoAlerta] = useState(false);

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
    const base = clients.filter(
      (c) => c.active && !c.isProspecao && SEGMENTOS_COBERTURA.has(normSegmento(c.segment)),
    );
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
    const dias = diasRegistroPorCliente(visits);
    const conta = (s: SituacaoProspeccao) =>
      all.filter((c) => situacaoOf(c.prospeccaoStatus, dias.get(c.id) ?? null) === s).length;
    const em = conta("em_negociacao");
    const semDefinicao = conta("sem_definicao");
    const fechado = conta("fechado");
    const recusada = conta("proposta_recusada");
    const total = all.length;
    const pct = (n: number) => (total ? (n / total) * 100 : 0);
    const pEm = pct(em);
    const pSem = pct(semDefinicao);
    const pFe = pct(fechado);
    return {
      total,
      taxa: total ? Math.round((fechado / total) * 100) : 0,
      gradient: `conic-gradient(#ef4444 0% ${pSem}%, #f59e0b ${pSem}% ${pEm}%, #3b82f6 ${pEm}% ${
        pEm + pFe
      }%, #64748b ${pEm + pFe}% 100%)`,
      rows: [
        {
          situ: "em_negociacao" as SituacaoProspeccao,
          label: `Em negociação (até ${DIAS_SEM_DEFINICAO} dias)`,
          value: em,
          color: "#f59e0b",
        },
        {
          situ: "sem_definicao" as SituacaoProspeccao,
          label: `Sem definição há ${DIAS_SEM_DEFINICAO}+ dias`,
          value: semDefinicao,
          color: "#ef4444",
        },
        {
          situ: "fechado" as SituacaoProspeccao,
          label: "Fechadas",
          value: fechado,
          color: "#3b82f6",
        },
        {
          situ: "proposta_recusada" as SituacaoProspeccao,
          label: "Propostas recusadas",
          value: recusada,
          color: "#64748b",
        },
      ],
    };
  }, [clients, visits]);

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
      sub: `${
        publishedRoute
          ? doneCount === plannedCount && plannedCount > 0
            ? "Rota concluída"
            : `${plannedCount - doneCount} pendentes`
          : "Nenhuma rota publicada"
      }${drafts.length > 0 ? ` · ${drafts.length} rascunho(s)` : ""}`,
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
      value: alerts.length + alertaVisits.length,
      icon: AlertTriangle,
      sub: `${alerts.length} da equipe · ${alertaVisits.length} na visita`,
      href: "/alertas",
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
            Clientes ativos dos segmentos <b>Rollon</b>, <b>Rollon/Carregamento na hora</b>,{" "}
            <b>Poli</b> e <b>Terceiro</b> com pelo menos uma visita registrada e uma coleta no mês. Visitas "não realizada" não contam como cobertura.
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
                Prospecções registradas e taxa de conversão — clique em uma situação para ver somente
                aqueles clientes.
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
                  <Link
                    key={r.situ}
                    to={`/prospeccoes?situ=${r.situ}`}
                    className={`block rounded-lg border p-3 transition-colors hover:bg-secondary/40 ${
                      r.situ === "sem_definicao" && r.value > 0
                        ? "border-destructive/40 bg-destructive/5"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                        {r.label}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold">{r.value}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(alerts.length > 0 || alertaVisits.length > 0) && (
        <Card className="card-soft border-destructive/30">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Alertas
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {role === "coordenador" && (
                  <Button size="sm" variant="outline" onClick={() => setNovoAlerta(true)}>
                    <Plus className="mr-1.5 h-4 w-4" /> Novo alerta
                  </Button>
                )}
                <Button asChild variant="link" size="sm" className="h-auto p-0">
                  <Link to="/alertas">
                    Ver todos <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </div>
            <CardDescription>
              Alertas apontados pelo coordenador ou pelo vendedor, sem precisar de visita. As visitas
              fora do raio aparecem na aba <b>Visitas</b>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {alerts.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-destructive">
                  {alerts.length} alerta(s) registrado(s) pela equipe:
                </p>
                <ul className="ml-1 space-y-1">
                  {alerts.slice(0, 5).map((a) => {
                    const c = clients.find((x) => x.id === a.clientId);
                    return (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-baseline gap-x-2 rounded-md bg-destructive/10 px-2 py-1 text-xs"
                      >
                        <span className="font-medium">{c?.name ?? "Cliente removido"}</span>
                        <span className="text-destructive">{a.motivo}</span>
                        <span className="text-muted-foreground">{a.createdByName || "equipe"}</span>
                      </li>
                    );
                  })}
                </ul>
                {alerts.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    … e mais {alerts.length - 5} alerta(s).
                  </p>
                )}
              </div>
            )}
            {alertaVisits.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium text-destructive">
                  {alertaVisits.length} alerta(s) do(s) vendedor(es):
                </p>
                <ul className="ml-1 space-y-1">
                  {alertaVisits.slice(0, 5).map((v) => {
                    const c = clients.find((x) => x.id === v.clientId);
                    return (
                      <li
                        key={v.id}
                        className="flex flex-wrap items-baseline gap-x-2 rounded-md bg-destructive/10 px-2 py-1 text-xs"
                      >
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
          </CardContent>
        </Card>
      )}

      <NewAlertDialog open={novoAlerta} onClose={() => setNovoAlerta(false)} />
    </div>
  );
}
