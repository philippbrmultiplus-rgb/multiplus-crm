import { useMemo, useState } from "react";
import { Repeat, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useData } from "@/lib/DataContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateBR, formatNumero } from "@/lib/geo";

interface LinhaCadencia {
  id: string;
  nome: string;
  segmento: string;
  mediaDias: number;
  coletas: number;
  ultimaColeta: string | null;
  datas: string[];
}

/** janela com as datas das coletas do cliente (da mais recente para a mais antiga) */
function DatasDialog({
  linha,
  onClose,
}: {
  linha: LinhaCadencia | null;
  onClose: () => void;
}) {
  if (!linha) return null;
  const datas = [...linha.datas].sort((a, b) => (a < b ? 1 : -1));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2.5rem)] max-w-md overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>{linha.nome}</DialogTitle>
          <DialogDescription>
            {linha.segmento || "sem segmento"} · {linha.coletas}{" "}
            {linha.coletas === 1 ? "coleta" : "coletas"} · a cada {formatNumero(linha.mediaDias)} dias
          </DialogDescription>
        </DialogHeader>

        {datas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem datas registradas para este cliente.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {datas.map((d, i) => {
              const anterior = datas[i + 1];
              const intervalo = anterior
                ? Math.round(
                    (new Date(`${d}T12:00:00`).getTime() -
                      new Date(`${anterior}T12:00:00`).getTime()) /
                      86400000,
                  )
                : null;
              return (
                <li
                  key={d}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1"
                >
                  <span className="tabular-nums">{formatDateBR(d)}</span>
                  {intervalo != null && (
                    <span className="text-xs text-muted-foreground">
                      {intervalo} {intervalo === 1 ? "dia" : "dias"} desde a coleta anterior
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** tom do selo conforme a frequência: até 7 dias, até 30 dias, mais espaçada */
function tomMedia(dias: number): string {
  if (dias <= 7) return "bg-primary/10 text-primary";
  if (dias <= 30) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-destructive/10 text-destructive";
}

/** cadência de troca: de quanto em quanto tempo cada cliente costuma coletar */
export default function Cadencia() {
  const { state } = useData();
  const { clients, cadence } = state;
  const isMobile = useIsMobile();
  const [busca, setBusca] = useState("");
  const [segmento, setSegmento] = useState("all");
  const [ordem, setOrdem] = useState<"menor" | "maior" | "nome">("menor");
  // cliente aberto na janela de datas das coletas
  const [detalhe, setDetalhe] = useState<LinhaCadencia | null>(null);

  const linhas = useMemo<LinhaCadencia[]>(
    () =>
      cadence
        .filter((c) => c.clientId && c.mediaDias != null)
        .map((c) => {
          const cliente = clients.find((x) => x.id === c.clientId);
          return {
            id: c.clientId as string,
            nome: cliente?.name ?? "",
            segmento: cliente?.segment ?? "",
            mediaDias: c.mediaDias as number,
            coletas: c.coletas,
            ultimaColeta: c.ultimaColeta,
            datas: c.datas ?? [],
          };
        })
        .filter((c) => c.nome !== ""),
    [cadence, clients],
  );

  const segmentos = useMemo(() => {
    const set = new Set<string>();
    for (const l of linhas) if (l.segmento) set.add(l.segmento);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas
      .filter((l) => (segmento === "all" ? true : l.segmento === segmento))
      .filter((l) => (q ? `${l.nome} ${l.segmento}`.toLowerCase().includes(q) : true))
      .sort((a, b) =>
        ordem === "nome"
          ? a.nome.localeCompare(b.nome, "pt-BR")
          : ordem === "menor"
            ? a.mediaDias - b.mediaDias || a.nome.localeCompare(b.nome, "pt-BR")
            : b.mediaDias - a.mediaDias || a.nome.localeCompare(b.nome, "pt-BR"),
      );
  }, [linhas, busca, segmento, ordem]);

  const mediaGeral = linhas.length
    ? linhas.reduce((acc, l) => acc + l.mediaDias, 0) / linhas.length
    : 0;
  const totalColetas = linhas.reduce((acc, l) => acc + l.coletas, 0);
  const maisFrequente = [...linhas].sort((a, b) => a.mediaDias - b.mediaDias)[0];
  const maisEspacada = [...linhas].sort((a, b) => b.mediaDias - a.mediaDias)[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cadência de troca</h1>
        <p className="text-sm text-muted-foreground">
          Média de dias entre uma coleta e a seguinte, por cliente · {linhas.length} cliente(s)
          analisado(s) · base: coletas de junho a outubro/2026.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="card-soft">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="font-medium">Clientes analisados</CardDescription>
              <Repeat className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-3xl">{linhas.length}</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-xs text-muted-foreground">
            {totalColetas} coletas consideradas
          </CardContent>
        </Card>
        <Card className="card-soft">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium">Média geral</CardDescription>
            <CardTitle className="text-3xl">
              {formatNumero(mediaGeral)}{" "}
              <span className="text-base font-normal text-muted-foreground">dias</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-xs text-muted-foreground">
            tempo médio entre coletas na carteira
          </CardContent>
        </Card>
        <Card className="card-soft">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium">Mais frequente</CardDescription>
            <CardTitle className="text-lg leading-tight">
              {maisFrequente ? maisFrequente.nome : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-xs text-muted-foreground">
            {maisFrequente ? `a cada ${formatNumero(maisFrequente.mediaDias)} dias` : "sem dados"}
          </CardContent>
        </Card>
        <Card className="card-soft">
          <CardHeader className="pb-2">
            <CardDescription className="font-medium">Mais espaçada</CardDescription>
            <CardTitle className="text-lg leading-tight">
              {maisEspacada ? maisEspacada.nome : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-xs text-muted-foreground">
            {maisEspacada ? `a cada ${formatNumero(maisEspacada.mediaDias)} dias` : "sem dados"}
          </CardContent>
        </Card>
      </div>

      <div className="card-soft flex flex-wrap items-end gap-2 p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar cliente…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={segmento} onValueChange={setSegmento}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os segmentos</SelectItem>
            {segmentos.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ordem} onValueChange={(v) => setOrdem(v as typeof ordem)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Ordem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="menor">Menor média de dias (mais frequente)</SelectItem>
            <SelectItem value="maior">Maior média de dias (mais espaçada)</SelectItem>
            <SelectItem value="nome">Nome A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {filtradas.map((l) => (
            <div key={l.id} className="card-soft p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 truncate font-semibold">{l.nome}</span>
                <Badge className={tomMedia(l.mediaDias)}>
                  a cada {formatNumero(l.mediaDias)} dias
                </Badge>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="truncate">Segmento: {l.segmento || "—"}</span>
                <span className="text-right">
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    title="Ver as datas das coletas"
                    onClick={() => setDetalhe(l)}
                  >
                    {l.coletas} {l.coletas === 1 ? "coleta" : "coletas"}
                  </Button>
                </span>
                <span>
                  Última coleta: {l.ultimaColeta ? formatDateBR(l.ultimaColeta) : "—"}
                </span>
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
          <Table className="[&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-1.5 [&_thead_tr]:bg-primary [&_thead_th]:whitespace-nowrap [&_thead_th]:font-semibold [&_thead_th]:text-primary-foreground">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead className="text-center">Média de dias</TableHead>
                <TableHead className="text-center" title="Clique no número para ver as datas das coletas">
                  Coletas
                </TableHead>
                <TableHead className="text-center">Última coleta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {l.segmento || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={tomMedia(l.mediaDias)}>
                      a cada {formatNumero(l.mediaDias)} dias
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 tabular-nums"
                      title="Ver as datas das coletas"
                      onClick={() => setDetalhe(l)}
                    >
                      {l.coletas}
                    </Button>
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-sm text-muted-foreground">
                    {l.ultimaColeta ? formatDateBR(l.ultimaColeta) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {filtradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum cliente encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Card className="card-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Como é calculado</CardTitle>
          <CardDescription>
            Para cada cliente ordenamos as datas de coleta da planilha de cadência (junho a outubro de
            2026) e calculamos a média dos intervalos entre uma coleta e a seguinte. Clientes com uma
            única coleta no período não têm média e ficam fora da lista; o segmento vem do cadastro do
            cliente.
          </CardDescription>
        </CardHeader>
      </Card>

      <DatasDialog linha={detalhe} onClose={() => setDetalhe(null)} />
    </div>
  );
}
