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
import { diasUteisNoPeriodo, feriadosNoMes } from "@/lib/calendario";
import { formatM3, mesLabel, toLocalDateKey } from "@/lib/geo";

/** grupos do acompanhamento: os tipos de cada segmento entram juntos */
const GRUPOS = [
  { chave: "rollon", label: "Rollon", prefixo: "Rollon", meta: "metaDiaRollon" as const },
  { chave: "poli", label: "Poli", prefixo: "Poli", meta: "metaDiaPoli" as const },
  { chave: "pap", label: "P. a Porta", prefixo: "Porta a Porta", meta: null },
  { chave: "terceiro", label: "Terceiro", prefixo: "Terceiro", meta: "metaDiaTerceiro" as const },
] as const;

type ChaveGrupo = (typeof GRUPOS)[number]["chave"];
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

const vazio = (): ValoresDia => ({ rollon: 0, poli: 0, pap: 0, terceiro: 0 });

/** acompanhamento diário das metas por segmento logístico */
export default function MetaDiaria() {
  const { state, role, updateSettings } = useData();
  const { settings, clients } = state;
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

  const metas = {
    rollon: settings.metaDiaRollon ?? 260,
    poli: settings.metaDiaPoli ?? 60,
    terceiro: settings.metaDiaTerceiro ?? 8.5,
  };
  const metaDiaTotal = metas.rollon + metas.poli + metas.terceiro;
  /** meta diária de cada grupo (Porta a Porta não tem meta) */
  const metaDoGrupo: Record<ChaveGrupo, number> = {
    rollon: metas.rollon,
    poli: metas.poli,
    pap: 0,
    terceiro: metas.terceiro,
  };
  const metaMes = settings.metaMes ?? 6000;

  const segmentoPorCliente = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of clients) mapa.set(c.id, c.segment || "");
    return mapa;
  }, [clients]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from("coletas")
      .select("client_id, collect_date, volume_m3")
      .gte("collect_date", inicio)
      .lte("collect_date", fim);
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
    setPorDia(acumulado);
    setCarregando(false);
  }, [inicio, fim, segmentoPorCliente]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const feriados = useMemo(() => new Set(feriadosNoMes(inicio)), [inicio]);

  /** dias do mês com marcação de dia útil (seg a sex, sem feriados) */
  const dias = useMemo(() => {
    const lista: Array<{ dia: number; data: string; semana: number; util: boolean; passado: boolean }> = [];
    for (let dia = 1; dia <= ultimoDia; dia++) {
      const data = `${mes}-${String(dia).padStart(2, "0")}`;
      const diaSemana = new Date(`${data}T00:00:00Z`).getUTCDay();
      lista.push({
        dia,
        data,
        semana: Math.floor((dia - 1) / 7) + 1,
        util: diaSemana >= 1 && diaSemana <= 5 && !feriados.has(data),
        passado: data <= hoje,
      });
    }
    return lista;
  }, [mes, ultimoDia, feriados, hoje]);

  const totalDoDia = (valores: ValoresDia | undefined) =>
    valores ? valores.rollon + valores.poli + valores.pap + valores.terceiro : 0;

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

  const semanas = useMemo(() => {
    const mapa = new Map<number, { valores: ValoresDia; diasUteis: number; total: number }>();
    for (const d of dias) {
      const semana = mapa.get(d.semana) ?? { valores: vazio(), diasUteis: 0, total: 0 };
      const valores = porDia[d.data] ?? vazio();
      for (const g of GRUPOS) semana.valores[g.chave] += valores[g.chave];
      semana.total += totalDoDia(valores);
      // dias úteis da semana (só os que já aconteceram no mês em andamento)
      if (d.util && (!emAndamento || d.passado)) semana.diasUteis += 1;
      mapa.set(d.semana, semana);
    }
    return mapa;
  }, [dias, porDia, emAndamento]);

  const pct = (valor: number, meta: number) => (meta > 0 ? Math.round((valor / meta) * 1000) / 10 : 0);

  const tom = (valor: number, meta: number): string => {
    const p = pct(valor, meta);
    if (p >= 100) return "text-primary";
    if (p >= 90) return "text-amber-600 dark:text-amber-400";
    return "text-destructive";
  };

  const metaAcumulada = metaDiaTotal * diasUteisMes;
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
            {emAndamento && " (mês em andamento)"}
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <CardDescription className="font-medium">Metas diárias acumuladas</CardDescription>
            <CardTitle className="text-3xl">
              {formatM3(metaAcumulada)} <span className="text-base font-normal text-muted-foreground">m³</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {diasUteisMes} dia(s) útil(eis) × {formatM3(metaDiaTotal)} m³
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
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Rollon", chave: "metaDiaRollon" as const, valor: metas.rollon, atual: porSegmento.rollon },
            { label: "Poli", chave: "metaDiaPoli" as const, valor: metas.poli, atual: porSegmento.poli },
            {
              label: "Terceiro",
              chave: "metaDiaTerceiro" as const,
              valor: metas.terceiro,
              atual: porSegmento.terceiro,
            },
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
              Porta a Porta: sem meta ({formatM3(porSegmento.pap)} m³ no mês)
            </p>
          </div>
        </div>
      </div>

      <div className="card-soft overflow-x-auto">
        <Table className="[&_th]:whitespace-nowrap [&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-1 [&_thead_tr]:bg-primary [&_thead_th]:font-semibold [&_thead_th]:text-primary-foreground">
          <TableHeader>
            <TableRow>
              <TableHead>Dia</TableHead>
              <TableHead className="text-center">Sem.</TableHead>
              <TableHead className="text-center">Rollon</TableHead>
              <TableHead className="text-center">Poli</TableHead>
              <TableHead className="text-center">P. a Porta</TableHead>
              <TableHead className="text-center">Terceiro</TableHead>
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
                  <TableCell className="text-center text-xs text-muted-foreground">S{d.semana}</TableCell>
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
            {[...semanas.entries()].map(([semana, dados]) => {
              const metaSemana = metaDiaTotal * dados.diasUteis;
              return (
                <TableRow key={`semana-${semana}`} className="bg-secondary/60 font-semibold">
                  <TableCell>Semana {semana}</TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {dados.diasUteis} dia(s)
                  </TableCell>
                  {GRUPOS.map((g) => {
                    const valor = dados.valores[g.chave];
                    const meta = metaDoGrupo[g.chave] * dados.diasUteis;
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
                  <TableCell className="text-center tabular-nums">{formatM3(dados.total)}</TableCell>
                  <TableCell className={`text-center tabular-nums ${metaSemana ? tom(dados.total, metaSemana) : ""}`}>
                    {metaSemana ? `${pct(dados.total, metaSemana)}%` : "—"}
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
