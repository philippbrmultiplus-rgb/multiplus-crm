import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/lib/DataContext";
import { carregarNomesDaBase, type LancamentoPlanilha } from "@/lib/planilha";
import { lerPlanilhaDeAtualizacao, type LeituraPlanilha } from "@/lib/planilhaExcel";
import { casarCliente, indexarClientes } from "@/lib/planilhaMatch";
import { formatDateBR, formatM3 } from "@/lib/geo";

/**
 * Envio da planilha semanal de números (colunas Data | Cliente | Volume).
 * Os lançamentos enviados ficam gravados na nuvem e são aplicados ao comparativo
 * mensal, à cadência, à última troca de cada cliente e ao histórico.
 */
export function AtualizacaoPlanilha() {
  const { state, enviarAtualizacaoPlanilha } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [leitura, setLeitura] = useState<LeituraPlanilha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [base, setBase] = useState<Record<string, string | null>>({});

  useEffect(() => {
    void carregarNomesDaBase().then(setBase);
  }, []);

  const indice = useMemo(() => indexarClientes(state.clients), [state.clients]);

  const resumo = useMemo(() => {
    if (!leitura) return null;
    const nomes = new Set(leitura.lancamentos.map((l) => l.nome));
    const semCadastro: string[] = [];
    for (const nome of nomes) {
      const vinculado = nome in base ? base[nome] : casarCliente(nome, indice);
      if (!vinculado) semCadastro.push(nome.trim());
    }
    return {
      clientes: nomes.size,
      semCadastro,
      volume: leitura.lancamentos.reduce((acc, l) => acc + l.volume, 0),
    };
  }, [leitura, base, indice]);

  const limpar = () => {
    setLeitura(null);
    setNomeArquivo("");
    setErro(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onArquivo = async (arquivo: File | null) => {
    if (!arquivo) return;
    setErro(null);
    setLeitura(null);
    setNomeArquivo(arquivo.name);
    setLendo(true);
    try {
      const resultado = await lerPlanilhaDeAtualizacao(arquivo);
      if (resultado.lancamentos.length === 0) {
        setErro(
          "Nenhum lançamento encontrado. Confira se o arquivo tem as colunas Data, Cliente e Volume.",
        );
      } else {
        setLeitura(resultado);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setLendo(false);
    }
  };

  const aplicar = () => {
    if (!leitura) return;
    setEnviando(true);
    void enviarAtualizacaoPlanilha(leitura.lancamentos as LancamentoPlanilha[])
      .then((falha) => {
        if (!falha) {
          limpar();
        } else {
          setErro(falha);
        }
      })
      .finally(() => setEnviando(false));
  };

  return (
    <Card className="card-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="h-4 w-4" /> Atualização semanal da planilha
        </CardTitle>
        <CardDescription>
          Envie a planilha de números da semana (colunas <b>Data</b>, <b>Cliente</b> e{" "}
          <b>Volume</b>, como a PAULINIA). Pode enviar só os dias novos: o app soma no comparativo
          mensal, recalcula a cadência de trocas, atualiza a última troca de cada cliente e acrescenta
          as datas no histórico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={lendo || enviando} onClick={() => fileRef.current?.click()}>
            {lendo ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Escolher planilha (.xlsx)
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => void onArquivo(e.target.files?.[0] ?? null)}
          />
          {nomeArquivo && (
            <span className="min-w-0 truncate text-xs text-muted-foreground">{nomeArquivo}</span>
          )}
        </div>

        {erro && (
          <p className="flex items-start gap-2 rounded-md bg-destructive/10 px-2 py-1.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
          </p>
        )}

        {leitura && resumo && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge className="bg-primary/10 text-primary">
                {leitura.lancamentos.length}{" "}
                {leitura.lancamentos.length === 1 ? "lançamento" : "lançamentos"}
              </Badge>
              <Badge variant="outline">{resumo.clientes} cliente(s)</Badge>
              <Badge variant="outline">{formatM3(resumo.volume)} m³</Badge>
              {leitura.periodo && (
                <span className="text-xs text-muted-foreground">
                  {formatDateBR(leitura.periodo[0])} a {formatDateBR(leitura.periodo[1])}
                </span>
              )}
              {leitura.ignoradas > 0 && (
                <span className="text-xs text-muted-foreground">
                  {leitura.ignoradas} linha(s) de cabeçalho/total ignorada(s)
                </span>
              )}
            </div>

            {resumo.semCadastro.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <b>{resumo.semCadastro.length} nome(s)</b> ainda sem cliente vinculado na carteira
                (entram como <b>sem cadastro</b> no comparativo):{" "}
                {resumo.semCadastro.slice(0, 6).join(", ")}
                {resumo.semCadastro.length > 6 && "…"}
              </p>
            )}

            <div className="max-h-48 overflow-y-auto overscroll-contain rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Data</th>
                    <th className="px-2 py-1 text-left font-medium">Cliente</th>
                    <th className="px-2 py-1 text-right font-medium">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {leitura.lancamentos.slice(0, 40).map((l, i) => (
                    <tr key={`${l.nome}-${l.data}-${i}`} className="border-t">
                      <td className="whitespace-nowrap px-2 py-1 tabular-nums">
                        {formatDateBR(l.data)}
                      </td>
                      <td className="px-2 py-1">{l.nome.trim()}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{formatM3(l.volume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {leitura.lancamentos.length > 40 && (
              <p className="text-xs text-muted-foreground">
                Mostrando os 40 primeiros — a atualização aplica todos os{" "}
                {leitura.lancamentos.length} lançamentos.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button disabled={enviando} onClick={aplicar}>
                {enviando ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Aplicar atualização
              </Button>
              <Button variant="ghost" disabled={enviando} onClick={limpar}>
                <X className="mr-2 h-4 w-4" /> Descartar
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Já enviadas antes? Reenviar o mesmo arquivo não duplica nada — os números de cada dia são
          substituídos pelos valores do arquivo mais recente.
        </p>
      </CardContent>
    </Card>
  );
}
