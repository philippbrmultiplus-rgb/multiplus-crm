import { useMemo, useState } from "react";
import { CalendarRange, Download, FileText, Loader2, Presentation, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlideFrame, SlideView } from "@/components/apresentacao/SlideView";
import { useData } from "@/lib/DataContext";
import { construirApresentacao, mesesComVolume, nomeMesCurto } from "@/lib/apresentacao";
import { montarSlides } from "@/lib/apresentacaoSlides";
import { formatM3, mesLabel, toLocalDateKey } from "@/lib/geo";

/** apresentação mensal gerada a partir dos dados do app */
export default function ApresentacaoMensal() {
  const { state } = useData();
  const hoje = toLocalDateKey(new Date().toISOString());

  const meses = useMemo(() => {
    const lista = mesesComVolume(state.volumes);
    return lista.length > 0 ? [...lista].reverse() : [`${hoje.slice(0, 7)}-01`];
  }, [state.volumes, hoje]);

  // o mês escolhido é opcional: sem escolha, usa o mês corrente (ou o último com lançamento)
  const [mesEscolhido, setMesEscolhido] = useState<string | null>(null);
  const mes =
    mesEscolhido ??
    meses.find((m) => m.slice(0, 7) === hoje.slice(0, 7)) ??
    meses[0] ??
    `${hoje.slice(0, 7)}-01`;

  const [gerando, setGerando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [slides, setSlides] = useState<ReturnType<typeof montarSlides> | null>(null);
  const [resumo, setResumo] = useState<ReturnType<typeof construirApresentacao> | null>(null);

  const gerar = () => {
    setGerando(true);
    try {
      const dados = construirApresentacao(state, mes);
      setResumo(dados);
      setSlides(montarSlides(dados));
      toast.success(`Apresentação de ${mesLabel(mes)} gerada para prévia.`);
    } catch (erro) {
      console.error(erro);
      toast.error("Não foi possível montar a apresentação deste mês.");
    } finally {
      setGerando(false);
    }
  };

  const baixarPowerPoint = async () => {
    if (!slides || !resumo) return;
    setBaixando(true);
    try {
      const { gerarPptx } = await import("@/lib/apresentacaoPptx");
      const nome = `apresentacao-paulinia-${resumo.mesNome.toLowerCase()}-${resumo.ano}.pptx`;
      await gerarPptx(slides, nome);
      toast.success("PowerPoint gerado. Abra o arquivo no PowerPoint para editar.");
    } catch (erro) {
      console.error(erro);
      toast.error("Não foi possível gerar o arquivo do PowerPoint.");
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Apresentação mensal</h1>
        <p className="text-sm text-muted-foreground">
          Monta a apresentação do mês com os números do app, no formato usado nos relatórios da diretoria.
        </p>
      </div>

      <Card className="card-soft">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Presentation className="h-4 w-4 text-primary" />
            Gerar apresentação do mês
          </CardTitle>
          <CardDescription>
            Escolha o mês, confira a prévia e depois baixe o arquivo para editar no PowerPoint.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-56">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Mês</label>
            <Select
              value={mes}
              onValueChange={(v) => {
                setMesEscolhido(v);
                setSlides(null);
                setResumo(null);
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent>
                {meses.map((m) => (
                  <SelectItem key={m} value={m}>
                    {nomeMesCurto(m)}/{m.slice(0, 4)}
                    {m.slice(0, 7) === hoje.slice(0, 7) ? " (em andamento)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={gerar} disabled={gerando}>
            {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Gerar apresentação
          </Button>
          {slides && (
            <Button variant="outline" onClick={baixarPowerPoint} disabled={baixando}>
              {baixando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Baixar PowerPoint
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="font-normal">
              <CalendarRange className="mr-1 h-3 w-3" />
              {meses.length} mês(es) com lançamento
            </Badge>
            <Badge variant="secondary" className="font-normal">
              <FileText className="mr-1 h-3 w-3" />
              {state.clients.length} clientes na base
            </Badge>
          </div>
        </CardContent>
      </Card>

      {!slides && (
        <Card className="card-soft">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Presentation className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Escolha o mês e clique em “Gerar apresentação”.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              A prévia usa os volumes, clientes e metas já cadastrados. O arquivo do PowerPoint sai com as mesmas
              páginas, pronto para editar textos, gráficos e imagens.
            </p>
          </CardContent>
        </Card>
      )}

      {slides && resumo && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="card-soft">
              <CardHeader className="pb-1">
                <CardDescription>Volume do mês</CardDescription>
                <CardTitle className="text-2xl">
                  {formatM3(Math.round(resumo.total * 10) / 10)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">m³</span>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="card-soft">
              <CardHeader className="pb-1">
                <CardDescription>Atingimento da meta</CardDescription>
                <CardTitle className="text-2xl">
                  {resumo.atingimento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    de {formatM3(resumo.meta)} m³
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="card-soft">
              <CardHeader className="pb-1">
                <CardDescription>Dias úteis</CardDescription>
                <CardTitle className="text-2xl">
                  {resumo.diasUteis}
                  {resumo.parcial && (
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      de {resumo.diasUteisMes}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="card-soft">
              <CardHeader className="pb-1">
                <CardDescription>Clientes atendidos</CardDescription>
                <CardTitle className="text-2xl">{resumo.clientesAtendidos}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {slides.length} slides · {resumo.mesNome} de {resumo.ano} · confira a prévia antes de baixar
            </p>
            <Button variant="outline" size="sm" onClick={baixarPowerPoint} disabled={baixando}>
              {baixando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Baixar PowerPoint
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {slides.map((slide, i) => (
              <div key={i} className="space-y-1.5">
                <SlideFrame>
                  <SlideView slide={slide} />
                </SlideFrame>
                <p className="px-1 text-xs text-muted-foreground">
                  {i + 1}/{slides.length} ·{" "}
                  {slide.tipo === "segmentos"
                    ? slide.titulo
                    : slide.tipo === "capa"
                      ? "Capa"
                      : slide.tipo === "volume"
                        ? "Volume de entrada"
                        : slide.tipo === "top10"
                          ? "Top 10 clientes do mês"
                          : slide.tipo === "comparativo"
                            ? "Comparativo mensal"
                            : slide.tipo === "forecast"
                              ? "Forecast 2026"
                              : slide.tipo === "resultado"
                                ? "Resultado comercial"
                                : slide.tipo === "obrigado"
                                  ? "Obrigado"
                                  : slide.titulo}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
