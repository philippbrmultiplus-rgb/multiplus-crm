import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Target, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useData } from "@/lib/DataContext";
import { carregarPlanilha } from "@/lib/planilha";
import { diasUteisNoPeriodo, feriadosNoMes } from "@/lib/calendario";
import { formatM3, mesLabel, toLocalDateKey } from "@/lib/geo";

/** grupos do acompanhamento: os tipos de cada segmento entram juntos */
const GRUPOS = [
  { chave: "rollon", label: "Rollon", prefixo: "Rollon", meta: "metaDiaRollon" as const },
  { chave: "poli", label: "Poli", prefixo: "Poli", meta: "metaDiaPoli" as const },
  { chave: "pap", label: "P. a Porta", prefixo: "Porta a Porta", meta: null },
  { chave: "terceiro", label: "Terceiro", prefixo: "Terceiro", meta: "metaDiaTerceiro" as const },
  // lançamentos da planilha sem cliente vinculado: entram no total (como no comparativo),
  // mas não têm meta porque não pertencem a um segmento logístico
  { chave: "semCadastro", label: "Sem cadastro", prefixo: "", meta: null },
] as const;

type ChaveGrupo = (typeof GRUPOS)[number]["chave"];

/** a partir deste mês o Porta a Porta passou a ter meta diária */
const MES_INICIO_META_PAP = "2026-10";
type ValoresDia = Record<ChaveGrupo, number>;

const DIA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function grupoDoSegmento(segmento: string): ChaveGrupo | null {
  const seg = (segmento || "").trim();
  if (seg.startsWith("Rollon")) return "rollon";
  if (seg.startsWith("Poli")) return "poli";
  if (seg.startsWith("Porta a Porta")) return "pap";
  if (seg.startsWith("Terceiro")) return "terceiro";
  // outros segmentos não entram no acompanhamento
  return null;
}

const vazio = (): ValoresDia => ({ rollon: 0, poli: 0, pap: 0, terceiro: 0, semCadastro: 0 });

/** cor da célula conforme o atingimento (verde ≥100%, âmbar ≥90%, vermelho abaixo) */
function classeCelula(valor: number, meta: number): string {
  if (meta <= 0) return "bg-muted/40 text-muted-foreground";
  const atingido = (valor / meta) * 100;
  if (atingido >= 100) return "bg-emerald-600 text-white";
  if (atingido >= 90) return "bg-amber-500 text-amber-950";
  return "bg-rose-600 text-white";
}

/** acompanhamento diário das metas por segmento logístico */
export default function MetaDiaria() {
  const { state, role, updateSettings } = useData();
  const { settings, clients, volumes } = state;
  const hoje = toLocalDateKey(new Date().toISOString());
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [porDia, setPorDia] = useState<Record<string, ValoresDia>>({});
  const [carregando, setCarregando] = useState(false);
  const podeEditar = role === "coordenador";

  const inicio = `${mes}-01`;
  const [ano, numeroMes] = mes.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, numeroMes, 0)).getUTCDate();
  const fim = `${mes}-${String(ultimoDia).padStart(2, "0")}`;
  const emAndamento = mes === hoje.slice(0, 7);

  // o Porta a Porta passou a ter meta a partir de outubro/2026
  const papComMeta = mes >= MES_INICIO_META_PAP;
  const metas = {
    rollon: settings.metaDiaRollon ?? 260,
    poli: settings.metaDiaPoli ?? 60,
    terceiro: settings.metaDiaTerceiro ?? 8.5,
    pap: papComMeta ? (settings.metaDiaPap ?? 10) : 0,
  };
  const metaDiaTotal = metas.rollon + metas.poli + metas.terceiro + metas.pap;
  /** meta diária de cada grupo (Porta a Porta só entra de outubro em diante) */
  const metaDoGrupo: Record<ChaveGrupo, number> = {
    rollon: metas.rollon,
    poli: metas.poli,
    pap: metas.pap,
    terceiro: metas.terceiro,
    semCadastro: 0,
  };
  const metaMes = settings.metaMes ?? 6000;

  const segmentoPorCliente = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of clients) mapa.set(c.id, c.segment || "");
    return mapa;
  }, [clients]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data, error }, planilha] = await Promise.all([
      supabase
        .from("coletas")
        .select("client_id, collect_date, volume_m3")
        .gte("collect_date", inicio)
        .lte("collect_date", fim),
      carregarPlanilha(clients),
    ]);
    if (error) {
      console.error("acompanhamento diário:", error.message);
      setPorDia({});
      setCarregando(false);
      return;
    }
    const acumulado: Record<string, ValoresDia> = {};
    for (const linha of data ?? []) {
      const row = linha as Record<string, unknown>;
      const dia = String(row.collect_date ?? "").slice(0, 10);
      if (!dia) continue;
      const grupo = grupoDoSegmento(segmentoPorCliente.get(String(row.client_id)) ?? "");
      if (!grupo) continue;
      const valores = acumulado[dia] ?? vazio();
      valores[grupo] += Number(row.volume_m3 ?? 0);
      acumulado[dia] = valores;
    }

    // o comparativo mensal soma TODAS as linhas da planilha, inclusive as que não têm
    // cliente vinculado ("sem cadastro"). Aqui elas entram num grupo próprio, sem meta,
    // para o total do mês fechar com o comparativo.
    const semCadastro = new Set(
      volumes
        .filter((v) => v.month === inicio && !v.clientId && v.label)
        .map((v) => v.label as string),
    );
    if (planilha && semCadastro.size > 0) {
      for (const item of planilha.porNome) {
        if (!semCadastro.has(item.nome)) continue;
        if (item.data < inicio || item.data > fim) continue;
        const valores = acumulado[item.data] ?? vazio();
        valores.semCadastro += item.volume;
        acumulado[item.data] = valores;
      }
    }

    setPorDia(acumulado);
    setCarregando(false);
  }, [inicio, fim, segmentoPorCliente, volumes, clients]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const feriados = useMemo(() => new Set(feriadosNoMes(inicio)), [inicio]);

  /** dias do mês com marcação de dia útil (seg a sex, sem feriados) */
  const dias = useMemo(() => {
    const lista: Array<{
      dia: number;
      data: string;
      /** semana do calendário (segunda a sábado); domingo não entra em semana */
      semana: number | null;
      util: boolean;
      passado: boolean;
    }> = [];
    let semana = 0;
    for (let dia = 1; dia <= ultimoDia; dia++) {
      const data = `${mes}-${String(dia).padStart(2, "0")}`;
      const diaSemana = new Date(`${data}T00:00:00Z`).getUTCDay();
      // domingo não faz parte da semana de trabalho (a semana vai de segunda a sábado)
      if (diaSemana !== 0) {
        // começa semana 1 no primeiro dia do mês e uma nova semana em cada segunda-feira
        if (dia === 1 || diaSemana === 1) semana += 1;
      }
      lista.push({
        dia,
        data,
        semana: diaSemana === 0 ? null : semana,
        util: diaSemana >= 1 && diaSemana <= 5 && !feriados.has(data),
        passado: data <= hoje,
      });
    }
    return lista;
  }, [mes, ultimoDia, feriados, hoje]);

  const totalDoDia = (valores: ValoresDia | undefined) =>
    valores ? GRUPOS.reduce((acc, g) => acc + valores[g.chave], 0) : 0;

  const totalMes = useMemo(
    () => Object.values(porDia).reduce((acc, v) => acc + totalDoDia(v), 0),
    [porDia],
  );

  const porSegmento = useMemo(() => {
    const soma = vazio();
    for (const v of Object.values(porDia)) {
      for (const g of GRUPOS) soma[g.chave] += v[g.chave];
    }
    return soma;
  }, [porDia]);

  const diasUteisMes = useMemo(
    () => diasUteisNoPeriodo(inicio, emAndamento ? hoje : fim),
    [inicio, fim, emAndamento, hoje],
  );

  const pct = (valor: number, meta: number) => (meta > 0 ? Math.round((valor / meta) * 1000) / 10 : 0);

  const tom = (valor: number, meta: number): string => {
    const p = pct(valor, meta);
    if (p >= 100) return "text-primary";
    if (p >= 90) return "text-amber-600 dark:text-amber-400";
    return "text-destructive";
  };

  /** dias de cada semana, com o período para mostrar no cartão */
  const semanasDetalhadas = useMemo(() => {
    const mapa = new Map<number, { dias: typeof dias; valores: ValoresDia; diasUteis: number; total: number }>();
    for (const d of dias) {
      if (d.semana == null) continue;
      const item = mapa.get(d.semana) ?? { dias: [], valores: vazio(), diasUteis: 0, total: 0 };
      const valores = porDia[d.data] ?? vazio();
      for (const g of GRUPOS) item.valores[g.chave] += valores[g.chave];
      item.total += totalDoDia(valores);
      if (d.util && (!emAndamento || d.passado)) item.diasUteis += 1;
      item.dias.push(d);
      mapa.set(d.semana, item);
    }
    return [...mapa.entries()].sort((a, b) => a[0] - b[0]);
  }, [dias, porDia, emAndamento]);

  const mesAnterior = () => {
    const d = new Date(Date.UTC(ano, numeroMes - 2, 1));
    setMes(d.toISOString().slice(0, 7));
  };
  const mesSeguinte = () => {
    const d = new Date(Date.UTC(ano, numeroMes, 1));
    setMes(d.toISOString().slice(0, 7));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Acompanhamento Meta</h1>
          <p className="text-sm text-muted-foreground">
            Volume coletado por dia e por semana, comparado com a meta de cada segmento
            {emAndamento && " (mês em andamento)"} · o total do mês fecha com o comparativo mensal
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={mesAnterior} title="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-28 text-center text-sm font-semibold">{mesLabel(inicio)}</span>
          <Button variant="outline" size="icon" onClick={mesSeguinte} title="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {carregando && <Loader2 className="ml-1 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="card-soft">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium">Total do mês</CardDescription>
            <CardTitle className="text-3xl">
              {formatM3(totalMes)} <span className="text-base font-normal text-muted-foreground">m³</span>
            </CardTitle>
            <p className={`text-xs font-medium ${tom(totalMes, metaMes)}`}>
              {pct(totalMes, metaMes)}% da meta de {formatM3(metaMes)} m³
            </p>
          </CardHeader>
        </Card>
        <Card className="card-soft">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 font-medium">
              <Target className="h-3.5 w-3.5 text-primary" /> Meta do mês
            </CardDescription>
            <CardTitle className="text-3xl">
              {formatM3(metaMes)} <span className="text-base font-normal text-muted-foreground">m³</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              faltam {formatM3(Math.max(0, metaMes - totalMes))} m³
            </p>
          </CardHeader>
        </Card>
        <Card className="card-soft">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium">Média por dia útil</CardDescription>
            <CardTitle className="text-3xl">
              {formatM3(diasUteisMes ? totalMes / diasUteisMes : 0)}{" "}
              <span className="text-base font-normal text-muted-foreground">m³</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">meta diária: {formatM3(metaDiaTotal)} m³</p>
          </CardHeader>
        </Card>
      </div>

      {/* metas por segmento */}
      <div className="card-soft p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">Metas por dia útil</span>
          <span className="text-xs text-muted-foreground">
            Rollon junta Rollon + Rollon/Carregamento na hora · Poli junta todos os Poli
            {papComMeta ? " · Porta a Porta com meta desde outubro/2026" : ""}
          </span>
        </div>
        <div className={`grid gap-3 sm:grid-cols-2 ${papComMeta ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
          {[
            { label: "Rollon", chave: "metaDiaRollon" as const, valor: metas.rollon, atual: porSegmento.rollon },
            { label: "Poli", chave: "metaDiaPoli" as const, valor: metas.poli, atual: porSegmento.poli },
            {
              label: "Terceiro",
              chave: "metaDiaTerceiro" as const,
              valor: metas.terceiro,
              atual: porSegmento.terceiro,
            },
            ...(papComMeta
              ? [
                  {
                    label: "P. a Porta",
                    chave: "metaDiaPap" as const,
                    valor: metas.pap,
                    atual: porSegmento.pap,
                  },
                ]
              : []),
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <Label className="text-xs">{item.label} (m³/dia)</Label>
              {podeEditar ? (
                <Input
                  type="number"
                  step="0.5"
                  value={item.valor}
                  onChange={(e) => updateSettings({ [item.chave]: Number(e.target.value) || 0 })}
                />
              ) : (
                <p className="text-lg font-semibold">{formatM3(item.valor)}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                no mês: {formatM3(item.atual)} m³
              </p>
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs">Meta do mês (m³)</Label>
            {podeEditar ? (
              <Input
                type="number"
                step="100"
                value={metaMes}
                onChange={(e) => updateSettings({ metaMes: Number(e.target.value) || 0 })}
              />
            ) : (
              <p className="text-lg font-semibold">{formatM3(metaMes)}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              {papComMeta
                ? `Porta a Porta: meta de ${formatM3(metas.pap)} m³/dia desde outubro/2026 (${formatM3(
                    porSegmento.pap,
                  )} m³ no mês)`
                : `Porta a Porta: sem meta (${formatM3(porSegmento.pap)} m³ no mês)`}
            </p>
            {porSegmento.semCadastro > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Sem cadastro: {formatM3(porSegmento.semCadastro)} m³ no mês (entra no total, não na meta)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* uma semana por quadrante, no formato da planilha */}
      <div className="space-y-3">
        {semanasDetalhadas.map(([semana, dados]) => {
          const metaSemana = metaDiaTotal * dados.diasUteis;
          const atingido = pct(dados.total, metaSemana);
          const primeiro = dados.dias[0]?.data ?? "";
          const ultimo = dados.dias[dados.dias.length - 1]?.data ?? "";
          const periodo =
            primeiro && ultimo
              ? `${primeiro.slice(8, 10)}/${primeiro.slice(5, 7)} a ${ultimo.slice(8, 10)}/${ultimo.slice(5, 7)}`
              : "";
          return (
            <Card key={`semana-${semana}`} className="card-soft">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Semana {semana}</CardTitle>
                    <CardDescription>
                      {periodo} · {dados.diasUteis} dia(s) útil(eis) · meta {formatM3(metaSemana)} m³
                    </CardDescription>
                  </div>
                  <Badge
                    className={
                      atingido >= 100
                        ? "bg-emerald-600 text-white"
                        : atingido >= 90
                          ? "bg-amber-500 text-amber-950"
                          : "bg-rose-600 text-white"
                    }
                  >
                    {atingido}% da meta da semana
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[760px] border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-primary px-2 py-1.5 text-left font-semibold text-primary-foreground">
                        Segmento
                      </th>
                      {dados.dias.map((d) => (
                        <th
                          key={d.data}
                          className={`px-2 py-1.5 text-center font-semibold ${
                            d.util
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {d.data.slice(8, 10)}/{d.data.slice(5, 7)}
                          <span className="block text-[9px] font-normal">
                            {DIA_SEMANA[new Date(`${d.data}T00:00:00Z`).getUTCDay()]}
                            {!d.util && (feriados.has(d.data) ? " · feriado" : "")}
                          </span>
                        </th>
                      ))}
                      <th className="bg-primary px-2 py-1.5 text-center font-semibold text-primary-foreground">
                        Total semana
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {GRUPOS.map((g) => {
                      const metaDia = metaDoGrupo[g.chave];
                      const metaTotal = metaDia * dados.diasUteis;
                      const valorTotal = dados.valores[g.chave];
                      return (
                        <tr key={g.chave} className="border-t">
                          <td className="sticky left-0 z-10 bg-card px-2 py-1 text-left font-medium">
                            {g.label}
                          </td>
                          {dados.dias.map((d) => {
                            const valor = (porDia[d.data] ?? vazio())[g.chave];
                            const meta = d.util ? metaDia : 0;
                            return (
                              <td
                                key={d.data}
                                className={`border-l px-1 py-1 text-center ${classeCelula(valor, meta)}`}
                              >
                                <span className="block font-semibold tabular-nums">
                                  {valor ? formatM3(valor) : "—"}
                                </span>
                                {meta > 0 && (
                                  <span className="block text-[10px] opacity-90">{pct(valor, meta)}%</span>
                                )}
                              </td>
                            );
                          })}
                          <td
                            className={`border-l px-1 py-1 text-center ${classeCelula(valorTotal, metaTotal)}`}
                          >
                            <span className="block font-semibold tabular-nums">
                              {formatM3(valorTotal)}
                            </span>
                            {metaTotal > 0 && (
                              <span className="block text-[10px] opacity-90">
                                {pct(valorTotal, metaTotal)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t bg-secondary/40 font-semibold">
                      <td className="sticky left-0 z-10 bg-secondary/40 px-2 py-1 text-left">
                        Total do dia
                      </td>
                      {dados.dias.map((d) => {
                        const valores = porDia[d.data] ?? vazio();
                        const total = totalDoDia(valores);
                        const meta = d.util ? metaDiaTotal : 0;
                        return (
                          <td
                            key={d.data}
                            className={`border-l px-1 py-1 text-center ${classeCelula(total, meta)}`}
                          >
                            <span className="block font-semibold tabular-nums">
                              {total ? formatM3(total) : "—"}
                            </span>
                            {meta > 0 && (
                              <span className="block text-[10px] opacity-90">{pct(total, meta)}%</span>
                            )}
                          </td>
                        );
                      })}
                      <td
                        className={`border-l px-1 py-1 text-center ${classeCelula(dados.total, metaSemana)}`}
                      >
                        <span className="block font-semibold tabular-nums">{formatM3(dados.total)}</span>
                        {metaSemana > 0 && (
                          <span className="block text-[10px] opacity-90">{atingido}%</span>
                        )}
                      </td>
                    </tr>
                    <tr className="text-[10px] text-muted-foreground">
                      <td className="sticky left-0 z-10 bg-card px-2 py-1 text-left">Meta do dia</td>
                      {dados.dias.map((d) => (
                        <td key={d.data} className="border-l px-1 py-1 text-center tabular-nums">
                          {d.util ? formatM3(metaDiaTotal) : "—"}
                        </td>
                      ))}
                      <td className="border-l px-1 py-1 text-center tabular-nums">
                        {formatM3(metaSemana)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <details className="card-soft p-3">
        <summary className="cursor-pointer select-none text-sm font-medium">
          Ver o mês dia a dia (detalhado por segmento)
        </summary>
        <div className="mt-3 overflow-x-auto">
        <Table className="[&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-1 [&_thead_tr]:bg-primary [&_thead_th]:font-semibold [&_thead_th]:text-primary-foreground">
          <TableHeader>
            <TableRow>
              <TableHead>Dia</TableHead>
              <TableHead className="text-center">Sem.</TableHead>
              <TableHead className="text-center">Rollon</TableHead>
              <TableHead className="text-center">Poli</TableHead>
              <TableHead className="text-center">P. a Porta</TableHead>
              <TableHead className="text-center">Terceiro</TableHead>
              <TableHead className="text-center">Sem cadastro</TableHead>
              <TableHead className="text-center">Total dia</TableHead>
              <TableHead className="text-center">% meta dia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dias.map((d) => {
              const valores = porDia[d.data] ?? vazio();
              const total = totalDoDia(valores);
              const metaDia = d.util ? metaDiaTotal : 0;
              return (
                <TableRow
                  key={d.data}
                  className={d.util ? "" : "bg-muted/40 text-muted-foreground"}
                >
                  <TableCell className="whitespace-nowrap font-medium">
                    {d.dia} · {DIA_SEMANA[new Date(`${d.data}T00:00:00Z`).getUTCDay()]}
                    {!d.util && (
                      <span className="ml-1 text-[10px]">({feriados.has(d.data) ? "feriado" : "sem meta"})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {d.semana ? `S${d.semana}` : "—"}
                  </TableCell>
                  {GRUPOS.map((g) => {
                    const valor = valores[g.chave];
                    const meta = d.util ? metaDoGrupo[g.chave] : 0;
                    return (
                      <TableCell key={g.chave} className="text-center tabular-nums">
                        <span className="block font-medium">{valor ? formatM3(valor) : "—"}</span>
                        {valor > 0 && meta > 0 && (
                          <span className={`block text-[10px] ${tom(valor, meta)}`}>
                            {pct(valor, meta)}%
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-semibold tabular-nums">
                    {total ? formatM3(total) : "—"}
                  </TableCell>
                  <TableCell className={`text-center tabular-nums ${metaDia ? tom(total, metaDia) : ""}`}>
                    {metaDia ? `${pct(total, metaDia)}%` : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Total do mês</TableCell>
              {GRUPOS.map((g) => (
                <TableCell key={g.chave} className="text-center font-semibold tabular-nums">
                  {formatM3(porSegmento[g.chave])}
                </TableCell>
              ))}
              <TableCell className="text-center font-semibold tabular-nums">{formatM3(totalMes)}</TableCell>
              <TableCell className={`text-center font-semibold tabular-nums ${tom(totalMes, metaMes)}`}>
                {pct(totalMes, metaMes)}%
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
        </div>
      </details>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Rollon", valor: porSegmento.rollon, meta: metas.rollon * diasUteisMes },
          { label: "Poli", valor: porSegmento.poli, meta: metas.poli * diasUteisMes },
          { label: "Terceiro", valor: porSegmento.terceiro, meta: metas.terceiro * diasUteisMes },
          { label: "Porta a Porta", valor: porSegmento.pap, meta: 0 },
        ].map((item) => {
          const atingido = pct(item.valor, item.meta);
          const Icone = item.meta === 0 ? Target : atingido >= 100 ? TrendingUp : TrendingDown;
          return (
            <Card key={item.label} className="card-soft">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center justify-between gap-2 font-medium">
                  {item.label}
                  <Icone
                    className={`h-3.5 w-3.5 ${
                      item.meta === 0
                        ? "text-muted-foreground"
                        : atingido >= 100
                          ? "text-primary"
                          : "text-destructive"
                    }`}
                  />
                </CardDescription>
                <CardTitle className="text-2xl">
                  {formatM3(item.valor)} <span className="text-base font-normal text-muted-foreground">m³</span>
                </CardTitle>
                <p className={`text-xs ${item.meta ? tom(item.valor, item.meta) : "text-muted-foreground"}`}>
                  {item.meta
                    ? `${atingido}% da meta acumulada (${formatM3(item.meta)} m³)`
                    : "sem meta definida"}
                </p>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <Card className="card-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Como a conta é feita</CardTitle>
          <CardDescription>
            Cada coleta da planilha entra no dia e no segmento do cliente. Rollon soma Rollon +
            Rollon/Carregamento na hora; Poli soma todos os tipos de Poli; Porta a Porta idem. O
            percentual abaixo de cada número é o atingimento do dia naquele segmento. Sábados, domingos e
            feriados nacionais não contam como dia útil, então as metas do dia e da semana só valem para os
            dias úteis. Volumes de outros segmentos não entram nesta tela.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Meta/dia: Rollon {formatM3(metas.rollon)}</Badge>
          <Badge variant="outline">Poli {formatM3(metas.poli)}</Badge>
          <Badge variant="outline">Terceiro {formatM3(metas.terceiro)}</Badge>
          <Badge variant="outline">Total {formatM3(metaDiaTotal)} m³/dia útil</Badge>
          <Badge variant="outline">Mês: {formatM3(metaMes)} m³</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
