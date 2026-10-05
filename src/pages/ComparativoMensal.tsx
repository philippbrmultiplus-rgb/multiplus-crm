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
import { useIsMobile } from "@/hooks/use-mobile";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "2026-07-01" -> "Julho/2026" */
function mesLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MESES[(m || 1) - 1]}/${y}`;
}

/** volume em m³ (sem casas decimais quando é inteiro) */
function m3(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

const SEM_CADASTRO = "sem_cadastro";

interface Linha {
  key: string;
  nome: string;
  segmento: string;
  semCadastro: boolean;
  valores: Record<string, number>;
  total: number;
}

/** comparativo mensal do volume coletado (m³) por cliente */
export default function ComparativoMensal() {
  const { state } = useData();
  const { volumes, clients } = state;
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [segmento, setSegmento] = useState("all");
  const [ordem, setOrdem] = useState<"total" | "nome">("total");

  // meses que existem na base, do mais antigo para o mais novo
  const meses = useMemo(() => [...new Set(volumes.map((v) => v.month))].sort(), [volumes]);

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
          segmento: cliente?.segment ?? "",
          semCadastro: !v.clientId,
          valores: {} as Record<string, number>,
        };
      linha.valores[v.month] = (linha.valores[v.month] ?? 0) + v.volumeM3;
      mapa.set(key, linha);
    }
    return [...mapa.values()].map((l) => ({
      ...l,
      total: meses.reduce((acc, m) => acc + (l.valores[m] ?? 0), 0),
    }));
  }, [volumes, clients, meses]);

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
      .sort((a, b) =>
        ordem === "nome" ? a.nome.localeCompare(b.nome, "pt-BR") : b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"),
      );
  }, [linhas, search, segmento, ordem]);

  const totalFiltrado = useMemo(() => filtradas.reduce((acc, l) => acc + l.total, 0), [filtradas]);
  const mesFiltrado = (m: string) => filtradas.reduce((acc, l) => acc + (l.valores[m] ?? 0), 0);

  const valorClasse = (valor: number | undefined) =>
    valor ? "text-right tabular-nums" : "text-right tabular-nums text-muted-foreground";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comparativo mensal</h1>
        <p className="text-sm text-muted-foreground">
          Volume coletado de cada cliente por mês (m³) e o total do período · {linhas.length} cliente(s)
          {semCadastro > 0 && ` · ${semCadastro} sem cadastro vinculado`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="card-soft">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="font-medium">Total no período</CardDescription>
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-3xl">
              {m3(totalGeral)}{" "}
              <span className="text-base font-normal text-muted-foreground">m³</span>
            </CardTitle>
          </CardHeader>
        </Card>
        {meses.map((m) => (
          <Card key={m} className="card-soft">
            <CardHeader className="pb-2">
              <CardDescription className="font-medium">{mesLabel(m)}</CardDescription>
              <CardTitle className="text-3xl">
                {m3(totalPorMes.get(m) ?? 0)}{" "}
                <span className="text-base font-normal text-muted-foreground">m³</span>
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
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
        <Select value={ordem} onValueChange={(v) => setOrdem(v as "total" | "nome")}>
          <SelectTrigger className="w-48">
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
                {meses.map((m) => (
                  <div key={m} className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">{mesLabel(m)}</span>
                    <span className="tabular-nums">{m3(l.valores[m] ?? 0)}</span>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-2 border-t pt-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">Total</span>
                  <span className="font-semibold tabular-nums">{m3(l.total)} m³</span>
                </div>
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
        <div className="card-soft overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Segmento</TableHead>
                {meses.map((m) => (
                  <TableHead key={m} className="whitespace-nowrap text-right">
                    {mesLabel(m)} (m³)
                  </TableHead>
                ))}
                <TableHead className="whitespace-nowrap text-right">Total (m³)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((l) => (
                <TableRow key={l.key}>
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate">{l.nome}</span>
                      {l.semCadastro && (
                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          sem cadastro
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.segmento || "—"}
                  </TableCell>
                  {meses.map((m) => (
                    <TableCell key={m} className={valorClasse(l.valores[m])}>
                      {m3(l.valores[m] ?? 0)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold tabular-nums">
                    {m3(l.total)}
                  </TableCell>
                </TableRow>
              ))}
              {filtradas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={3 + meses.length}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Nenhum cliente encontrado com os filtros atuais.
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
                  {meses.map((m) => (
                    <TableCell key={m} className="text-right font-semibold tabular-nums">
                      {m3(mesFiltrado(m))}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold tabular-nums">
                    {m3(totalFiltrado)}
                  </TableCell>
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
            Volumes importados da planilha <b>Entrada POA</b> (julho, agosto e setembro de 2026), já
            ligados a cada cliente cadastrado — o nome exibido é o mesmo da lista de clientes e o segmento
            vem do cadastro. As linhas marcadas como <b>sem cadastro</b> ainda não têm cliente
            correspondente na base.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {volumes.length} lançamento(s) mensais carregados.
        </CardContent>
      </Card>
    </div>
  );
}
