import { useMemo, useState } from "react";
import { BarChart3, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { normalizarSegmento } from "@/lib/apresentacao";
import { diasUteisNoMes, feriadosNoMes } from "@/lib/calendario";
import { formatDateBR, formatM3, mesLabel, toLocalDateKey } from "@/lib/geo";
import { useIsMobile } from "@/hooks/use-mobile";

/** volume em m³ (sem casas decimais quando é inteiro) */
const m3 = formatM3;

const SEM_CADASTRO = "sem_cadastro";

interface Linha {
  key: string;
  nome: string;
  segmento: string;
  semCadastro: boolean;
  valores: Record<string, number>;
  total: number;
  /** média por mês considerando os meses lançados */
  media: number;
  /** quanto caiu do mês comparado para o seguinte (positivo = queda) */
  queda: number;
}

/** comparativo mensal do volume coletado (m³) por cliente */
export default function ComparativoMensal() {
  const { state } = useData();
  const { volumes, clients } = state;
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [segmento, setSegmento] = useState("all");
  const [ordem, setOrdem] = useState<"total" | "nome">("total");
  // comparação de queda entre dois meses seguidos, no formato "2026-07-01|2026-08-01"
  const [queda, setQueda] = useState("todas");
  // mês escolhido para listar do maior volume de entrada para o menor
  const [mesOrdem, setMesOrdem] = useState("todas");
  // mostra somente o mês escolhido (pode ser combinado com os demais filtros)
  const [mesFiltro, setMesFiltro] = useState("todas");

  // meses que existem na base, do mais antigo para o mais novo
  const meses = useMemo(() => [...new Set(volumes.map((v) => v.month))].sort(), [volumes]);

  // mês em andamento: os dias úteis contam só até hoje
  const hoje = toLocalDateKey(new Date().toISOString());
  const mesCorrente = hoje.slice(0, 7);

  /** colunas de meses que aparecem: todos ou só o mês filtrado */
  const mesesVisiveis = useMemo(
    () => (mesFiltro === "todas" ? meses : [mesFiltro]),
    [mesFiltro, meses],
  );

  // pares de meses seguidos para comparar a queda
  const pares = useMemo(() => meses.slice(1).map((m, i) => ({ de: meses[i], para: m })), [meses]);
  const [mesDe, mesPara] = queda === "todas" ? [null, null] : queda.split("|");
  const comparandoQueda = !!mesDe && !!mesPara;
  const comparandoMes = mesOrdem !== "todas";
  /** percentual da queda em relação ao mês comparado */
  const quedaPct = (l: Linha) =>
    !mesDe || !l.valores[mesDe] ? 0 : Math.round((l.queda / l.valores[mesDe]) * 100);

  // agrupa por cliente cadastrado (ou pela linha da planilha, quando não há cadastro)
  const linhas = useMemo<Linha[]>(() => {
    const mapa = new Map<string, Omit<Linha, "total">>();
    for (const v of volumes) {
      const key = v.clientId ?? `sem:${v.label ?? v.id}`;
      const cliente = v.clientId ? clients.find((c) => c.id === v.clientId) : undefined;
      const linha =
        mapa.get(key) ??
        {
          key,
          nome: cliente?.name ?? v.label ?? "—",
          segmento: normalizarSegmento(cliente?.segment ?? ""),
          semCadastro: !v.clientId,
          valores: {} as Record<string, number>,
        };
      linha.valores[v.month] = (linha.valores[v.month] ?? 0) + v.volumeM3;
      mapa.set(key, linha);
    }
    return [...mapa.values()].map((l) => {
      const total = meses.reduce((acc, m) => acc + (l.valores[m] ?? 0), 0);
      return {
        ...l,
        total,
        // média do volume por mês, considerando os meses lançados no comparativo
        media: meses.length ? total / meses.length : 0,
        queda: mesDe && mesPara ? (l.valores[mesDe] ?? 0) - (l.valores[mesPara] ?? 0) : 0,
      };
    });
  }, [volumes, clients, meses, mesDe, mesPara]);

  const totalGeral = useMemo(() => linhas.reduce((acc, l) => acc + l.total, 0), [linhas]);
  const totalPorMes = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const l of linhas) {
      for (const m of meses) mapa.set(m, (mapa.get(m) ?? 0) + (l.valores[m] ?? 0));
    }
    return mapa;
  }, [linhas, meses]);
  const semCadastro = useMemo(() => linhas.filter((l) => l.semCadastro).length, [linhas]);

  const segmentos = useMemo(() => {
    const set = new Set<string>();
    for (const l of linhas) if (l.segmento) set.add(l.segmento);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [linhas]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return linhas
      .filter((l) =>
        segmento === "all"
          ? true
          : segmento === SEM_CADASTRO
            ? l.semCadastro
            : l.segmento === segmento,
      )
      .filter((l) => (q ? `${l.nome} ${l.segmento}`.toLowerCase().includes(q) : true))
      // com a comparação de queda ativa entram só os clientes que caíram no mês seguinte
      .filter((l) => (comparandoQueda ? l.queda > 0 : true))
      // com um mês escolhido entram só os clientes que tiveram volume naquele mês
      .filter((l) => (comparandoMes ? (l.valores[mesOrdem] ?? 0) > 0 : true))
      .sort((a, b) => {
        // da maior queda para a menor queda
        if (comparandoQueda) return b.queda - a.queda || a.nome.localeCompare(b.nome, "pt-BR");
        // do maior volume do mês escolhido para o menor
        if (comparandoMes) {
          const va = a.valores[mesOrdem] ?? 0;
          const vb = b.valores[mesOrdem] ?? 0;
          return vb - va || a.nome.localeCompare(b.nome, "pt-BR");
        }
        return ordem === "nome"
          ? a.nome.localeCompare(b.nome, "pt-BR")
          : b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [linhas, search, segmento, ordem, comparandoQueda, comparandoMes, mesOrdem]);

  const totalFiltrado = useMemo(() => filtradas.reduce((acc, l) => acc + l.total, 0), [filtradas]);
  const mesFiltrado = (m: string) => filtradas.reduce((acc, l) => acc + (l.valores[m] ?? 0), 0);

  // total dos meses que estão visíveis
  const totalVisivel = useMemo(
    () => mesesVisiveis.reduce((acc, m) => acc + (totalPorMes.get(m) ?? 0), 0),
    [mesesVisiveis, totalPorMes],
  );

  // dias úteis somados dos meses visíveis (no mês em andamento, só até hoje)
  const diasUteisPeriodo = useMemo(
    () =>
      mesesVisiveis.reduce(
        (acc, m) =>
          acc +
          diasUteisNoMes(
            m,
            m.slice(0, 7) === mesCorrente ? hoje : null,
            state.settings.workingDays,
          ),
        0,
      ),
    [mesesVisiveis, mesCorrente, hoje, state.settings.workingDays],
  );

  const valorClasse = (valor: number | undefined) =>
    valor ? "text-center tabular-nums" : "text-center tabular-nums text-muted-foreground";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comparativo mensal</h1>
        <p className="text-sm text-muted-foreground">
          Volume coletado de cada cliente por mês (m³) e o total do período · {linhas.length} cliente(s)
          {semCadastro > 0 && ` · ${semCadastro} sem cadastro vinculado`}
          {comparandoQueda && mesDe && mesPara &&
            ` · ${filtradas.length} cliente(s) com queda de ${mesLabel(mesDe)} para ${mesLabel(mesPara)}`}
          {comparandoMes &&
            ` · ${filtradas.length} cliente(s) com volume em ${mesLabel(mesOrdem)}, do maior para o menor`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="card-soft">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="font-medium">
              {mesesVisiveis.length === 1 ? `Total de ${mesLabel(mesesVisiveis[0])}` : "Total no período"}
            </CardDescription>
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-3xl">
              {m3(totalVisivel)}{" "}
              <span className="text-base font-normal text-muted-foreground">m³</span>
            </CardTitle>
            <p className="pt-1 text-xs text-muted-foreground">
              {diasUteisPeriodo} {diasUteisPeriodo === 1 ? "dia útil" : "dias úteis"} no período
            </p>
          </CardHeader>
        </Card>
        {mesesVisiveis.map((m) => {
          const emAndamento = m.slice(0, 7) === mesCorrente;
          const diasUteis = diasUteisNoMes(m, emAndamento ? hoje : null, state.settings.workingDays);
          const feriados = feriadosNoMes(m);
          return (
            <Card key={m} className="card-soft">
              <CardHeader className="pb-2">
                <CardDescription className="font-medium">{mesLabel(m)}</CardDescription>
                <CardTitle className="text-3xl">
                  {m3(totalPorMes.get(m) ?? 0)}{" "}
                  <span className="text-base font-normal text-muted-foreground">m³</span>
                </CardTitle>
                <p className="pt-1 text-xs text-muted-foreground">
                  {diasUteis} {diasUteis === 1 ? "dia útil" : "dias úteis"}
                  {emAndamento ? ` até ${formatDateBR(hoje)}` : " no mês"}
                  {feriados.length > 0 && (
                    <span className="block text-[11px]">
                      − {feriados.length} feriado{feriados.length > 1 ? "s" : ""} (
                      {feriados.map((f) => formatDateBR(f).slice(0, 5)).join(", ")})
                    </span>
                  )}
                </p>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div className="card-soft flex flex-wrap items-end gap-2 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar cliente ou segmento…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={mesFiltro} onValueChange={setMesFiltro}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os meses</SelectItem>
            {meses.map((m) => (
              <SelectItem key={m} value={m}>
                Somente {mesLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={segmento} onValueChange={setSegmento}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os segmentos</SelectItem>
            {semCadastro > 0 && (
              <SelectItem value={SEM_CADASTRO}>Sem cadastro ({semCadastro})</SelectItem>
            )}
            {segmentos.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={queda} onValueChange={setQueda}>
          <SelectTrigger className="w-56" disabled={comparandoMes}>
            <SelectValue placeholder="Queda de volume" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Sem comparação de queda</SelectItem>
            {pares.map((p) => (
              <SelectItem key={`${p.de}|${p.para}`} value={`${p.de}|${p.para}`}>
                Queda: {mesLabel(p.de)} → {mesLabel(p.para)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mesOrdem} onValueChange={setMesOrdem}>
          <SelectTrigger className="w-60" disabled={comparandoQueda}>
            <SelectValue placeholder="Volume no mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os meses</SelectItem>
            {meses.map((m) => (
              <SelectItem key={m} value={m}>
                Maior volume em {mesLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ordem} onValueChange={(v) => setOrdem(v as "total" | "nome")}>
          <SelectTrigger className="w-48" disabled={comparandoQueda || comparandoMes}>
            <SelectValue placeholder="Ordem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="total">Maior volume no período</SelectItem>
            <SelectItem value="nome">Nome A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {filtradas.map((l) => (
            <div key={l.key} className="card-soft p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold leading-tight">{l.nome}</span>
                {l.semCadastro && (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    sem cadastro
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{l.segmento || "sem segmento"}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                {mesesVisiveis.map((m) => (
                  <div key={m} className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">{mesLabel(m)}</span>
                    <span
                      className={`tabular-nums ${
                        comparandoMes && mesOrdem === m ? "font-semibold" : ""
                      }`}
                    >
                      {m3(l.valores[m] ?? 0)}
                    </span>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-2 border-t pt-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">Total</span>
                  <span className="font-semibold tabular-nums">{m3(l.total)} m³</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">Média/mês</span>
                  <span className="font-semibold tabular-nums">{m3(l.media)} m³</span>
                </div>
                {comparandoQueda && mesDe && mesPara && (
                  <div className="flex items-baseline justify-between gap-2 border-t pt-1.5 text-destructive">
                    <span className="text-[11px] font-medium">
                      Queda {mesLabel(mesDe)} → {mesLabel(mesPara)}
                    </span>
                    <span className="font-semibold tabular-nums">
                      -{m3(l.queda)} m³ ({quedaPct(l)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtradas.length === 0 && (
            <div className="card-soft p-10 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado com os filtros atuais.
            </div>
          )}
        </div>
      ) : (
        <div className="card-soft overflow-hidden">
          <Table className="w-full table-fixed text-[11px] [&_th]:px-0.5 [&_th]:py-1 [&_td]:px-0.5 [&_td]:py-1 [&_thead_tr]:bg-primary [&_thead_th]:text-[10px] [&_thead_th]:font-semibold [&_thead_th]:text-primary-foreground">
            <colgroup>
              <col style={{ width: mesesVisiveis.length === 1 ? "38%" : "25%" }} />
              <col style={{ width: mesesVisiveis.length === 1 ? "16%" : "10%" }} />
              {mesesVisiveis.map((m) => (
                <col key={m} />
              ))}
              <col style={{ width: mesesVisiveis.length === 1 ? "16%" : "9%" }} />
              {comparandoQueda && <col style={{ width: "10%" }} />}
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-20 border-r bg-primary">Cliente</TableHead>
                <TableHead>Segmento</TableHead>
                {mesesVisiveis.map((m) => (
                  <TableHead key={m} className="text-center">
                    <span
                      title={comparandoMes && mesOrdem === m ? "Coluna usada para ordenar" : undefined}
                      className={
                        comparandoMes && mesOrdem === m
                          ? "underline decoration-2 underline-offset-2"
                          : ""
                      }
                    >
                      <span title={`${mesLabel(m)} (m³)`}>
                        {mesesVisiveis.length === 1 ? mesLabel(m) : mesLabel(m).slice(0, 3)}
                      </span>
                    </span>
                  </TableHead>
                ))}
                <TableHead className="text-center">Total</TableHead>
                {comparandoQueda && <TableHead className="text-center">Queda (m³)</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((l) => (
                <TableRow key={l.key}>
                  <TableCell className="sticky left-0 z-10 border-r bg-card font-medium">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate" title={l.nome}>
                        {l.nome}
                      </span>
                      {l.semCadastro && (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          sem cadastro
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="truncate text-[10px] text-muted-foreground">
                    {l.segmento || "—"}
                  </TableCell>
                  {mesesVisiveis.map((m) => (
                    <TableCell key={m} className={valorClasse(l.valores[m])}>
                      {m3(l.valores[m] ?? 0)}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-semibold tabular-nums">
                    {m3(l.total)}
                  </TableCell>
                  {comparandoQueda && (
                    <TableCell className="whitespace-nowrap text-center font-semibold tabular-nums text-destructive">
                      -{m3(l.queda)}{" "}
                      <span className="font-normal text-muted-foreground">({quedaPct(l)}%)</span>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filtradas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3 + mesesVisiveis.length + (comparandoQueda ? 1 : 0)}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {comparandoQueda
                      ? "Nenhum cliente com queda neste par de meses."
                      : comparandoMes
                        ? `Nenhum cliente com volume em ${mesLabel(mesOrdem)}.`
                        : "Nenhum cliente encontrado com os filtros atuais."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {filtradas.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>
                    Total · {filtradas.length} cliente(s)
                  </TableCell>
                  {mesesVisiveis.map((m) => (
                    <TableCell key={m} className="text-center font-semibold tabular-nums">
                      {m3(mesFiltrado(m))}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-semibold tabular-nums">
                    {m3(totalFiltrado)}
                  </TableCell>
                  {comparandoQueda && (
                    <TableCell className="whitespace-nowrap text-center font-semibold tabular-nums text-destructive">
                      -{m3(filtradas.reduce((acc, l) => acc + l.queda, 0))}
                    </TableCell>
                  )}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}

      <Card className="card-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">De onde vêm os números</CardTitle>
          <CardDescription>
            Volumes importados da planilha <b>PAULINIA</b>, com as coletas de julho a outubro de 2026
            já ligadas a cada cliente cadastrado — o nome exibido é o mesmo da lista de clientes e o
            segmento vem do cadastro. As linhas marcadas como <b>sem cadastro</b> ainda não têm
            cliente correspondente na base.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {volumes.length} lançamento(s) mensais carregados. Os dias úteis seguem o calendário
          nacional: de segunda a sexta, <b>sem sábados, domingos e feriados nacionais</b> — mesmo quando
          existe lançamento de coleta no sábado, ele não é contado como dia útil. No mês em andamento a
          contagem vai até hoje.
        </CardContent>
      </Card>
    </div>
  );
}
