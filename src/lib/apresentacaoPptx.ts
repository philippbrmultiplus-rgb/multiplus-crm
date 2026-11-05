/** Gera o arquivo .pptx (editável no PowerPoint) a partir dos mesmos slides da prévia. */
import { CORES, SLIDE_A, SLIDE_L, tamanhoTitulo, type Slide } from "./apresentacaoSlides";

const hex = (cor: string) => cor.replace("#", "").toUpperCase();
const num = (n: number, casas = 1) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });

const cacheImagens = new Map<string, string>();

/** baixa a imagem e devolve em base64 (o PowerPoint recebe a imagem embutida) */
async function imagemBase64(url: string): Promise<string> {
  const pronto = cacheImagens.get(url);
  if (pronto) return pronto;
  const resposta = await fetch(url);
  const blob = await resposta.blob();
  const dados = await new Promise<string>((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result));
    leitor.onerror = () => rejeitar(new Error("imagem"));
    leitor.readAsDataURL(blob);
  });
  cacheImagens.set(url, dados);
  return dados;
}

export async function gerarPptx(slides: Slide[], nomeArquivo: string): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: SLIDE_L, height: SLIDE_A });
  pptx.layout = "WIDE";
  pptx.author = "Multiplus Paulínia";
  pptx.company = "Multiplus";
  pptx.title = nomeArquivo.replace(/\.pptx$/i, "");

  const novoSlide = (fundo = CORES.fundo) => {
    const s = pptx.addSlide();
    s.background = { color: hex(fundo) };
    return s;
  };

  const logoAzul = await imagemBase64("/apresentacao/logo-azul.png");
  const logoBranco = await imagemBase64("/apresentacao/logo-branco.png");
  const logotipo = (s: ReturnType<typeof novoSlide>, escuro = false) => {
    s.addImage({ data: escuro ? logoBranco : logoAzul, x: 0.75, y: 6.98, w: 1.05, h: 0.41 });
  };

  const cabecalho = (s: ReturnType<typeof novoSlide>, titulo: string, subtitulo?: string, selo?: string) => {
    const tam = tamanhoTitulo(titulo);
    s.addText(titulo.toUpperCase(), {
      x: 0.75,
      y: 0.28,
      w: 7.75,
      h: 0.7,
      fontSize: tam,
      bold: true,
      color: hex(CORES.navy),
      fontFace: "Arial Narrow",
      valign: "middle",
    });
    if (subtitulo) {
      s.addText(subtitulo, { x: 0.75, y: 0.96, w: 10.2, h: 0.3, fontSize: 10.5, color: hex(CORES.cinza) });
    }
    if (selo) {
      s.addShape(pptx.ShapeType.roundRect, { x: 8.55, y: 0.24, w: 4.05, h: 0.92, fill: { color: hex(CORES.navy3) }, line: { color: hex(CORES.navy3) }, rectRadius: 0.44 });
      s.addText(selo, { x: 8.7, y: 0.24, w: 3.75, h: 0.92, align: "right", valign: "middle", fontSize: 19, bold: true, color: "FFFFFF" });
    }
  };

  const cartao = (
    s: ReturnType<typeof novoSlide>,
    x: number,
    y: number,
    rotulo: string,
    valor: string,
    detalhe: string,
    cor: string,
  ) => {
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: 3.7, h: 2.0, fill: { color: "FFFFFF" }, line: { color: hex(CORES.linha) }, rectRadius: 0.16 });
    s.addShape(pptx.ShapeType.rect, { x, y, w: 3.7, h: 0.14, fill: { color: hex(cor) }, line: { color: hex(cor) } });
    s.addText(rotulo, { x: x + 0.3, y: y + 0.28, w: 3.1, h: 0.28, fontSize: 8.5, bold: true, color: hex(CORES.cinza), charSpacing: 1 });
    s.addText(valor, { x: x + 0.3, y: y + 0.58, w: 3.2, h: 0.7, fontSize: 21, bold: true, color: hex(CORES.navy) });
    s.addText(detalhe, { x: x + 0.3, y: y + 1.34, w: 3.1, h: 0.4, fontSize: 9, color: hex(CORES.cinza) });
  };

  for (const slide of slides) {
    if (slide.tipo === "capa" || slide.tipo === "obrigado") {
      const s = novoSlide(CORES.navy);
      const dados = await imagemBase64(
        slide.tipo === "capa" ? "/apresentacao/capa-paulinia.jpg" : "/apresentacao/obrigado.jpg",
      );
      s.addImage({ data: dados, x: 0, y: 0, w: SLIDE_L, h: SLIDE_A });
      continue;
    }

    if (slide.tipo === "volume") {
      const s = novoSlide(CORES.navy);
      s.addImage({ data: await imagemBase64("/apresentacao/capa-volume.jpg"), x: 0, y: 0, w: SLIDE_L, h: SLIDE_A });
      s.addText(slide.mesNome, {
        x: 0,
        y: 2.1,
        w: SLIDE_L * 0.5752,
        h: 0.9,
        align: "center",
        valign: "middle",
        fontSize: 50.2,
        bold: true,
        color: "FFFFFF",
      });
      s.addText(`Meta: ${num(slide.meta, 0)} m³`, {
        x: 2.04,
        y: 3.77,
        w: 6.6,
        h: 0.85,
        valign: "middle",
        fontSize: 43,
        bold: true,
        color: "FFFFFF",
      });
      s.addText(
        [
          { text: "Volume atingido: ", options: { fontSize: 34, color: "B2B2AF" } },
          { text: `${num(slide.total)} m³`, options: { fontSize: 43, bold: true, color: "FFFFFF" } },
        ],
        { x: 2.04, y: 4.78, w: 7.5, h: 0.85, valign: "middle" },
      );
      s.addText(`${num(slide.atingimento, 0)}%`, {
        x: 2.32,
        y: 5.75,
        w: 3.2,
        h: 0.85,
        valign: "middle",
        fontSize: 43,
        bold: true,
        color: "FFFFFF",
      });
      if (slide.parcial && slide.corteEm) {
        s.addText(`Mês em andamento · dados até ${slide.corteEm}`, { x: 0.75, y: 6.95, w: 6, h: 0.3, fontSize: 9, color: "BDD3EE" });
      }

      continue;
    }

    if (slide.tipo === "metas") {
      const s = novoSlide(CORES.navy);
      s.addText("— META MENSAL POR SEGMENTO —", {
        x: 0.85, y: 0.72, w: 8, h: 0.3, fontSize: 11.5, bold: true, color: "6FA8F5", charSpacing: 2,
      });
      s.addText(slide.mesNome, { x: 0.85, y: 1.05, w: 8, h: 0.9, fontSize: 40, bold: true, color: "FFFFFF" });
      s.addText(`— ${slide.ano} —`, { x: 0.85, y: 1.95, w: 6, h: 0.4, fontSize: 20, bold: true, color: "2F7DE1" });

      // logo branco no canto superior direito, igual ao das capas
      s.addImage({ data: await imagemBase64("/apresentacao/logo-branco.png"), x: 7.23, y: 0.42, w: 5.6, h: 1.72 });

      const cards = slide.segmentos.slice(0, 4);
      const largura = 3.05;
      const vao = 0.22;
      const inicioCards = (13.333 - (cards.length * largura + (cards.length - 1) * vao)) / 2;
      cards.forEach((item, i) => {
        const x = inicioCards + i * (largura + vao);
        const pctv = item.meta > 0 ? (item.realizado / item.meta) * 100 : 0;
        const cor = pctv >= 100 ? hex(CORES.verde) : pctv >= 90 ? hex(CORES.dourado) : "FF8F9B";
        s.addShape(pptx.ShapeType.roundRect, {
          x, y: 2.95, w: largura, h: 2.35,
          fill: { color: "14304F" }, line: { color: "2A4870" }, rectRadius: 0.12,
        });
        s.addText(item.nome.toUpperCase(), { x: x + 0.24, y: 3.15, w: largura - 0.48, h: 0.3, fontSize: 12.5, bold: true, color: "FFFFFF" });
        s.addText(`${num(item.dia)} m³ por dia útil`, { x: x + 0.24, y: 3.45, w: largura - 0.48, h: 0.25, fontSize: 10, color: "9CC0F0" });
        s.addText(num(Math.round(item.meta * 10) / 10), { x: x + 0.24, y: 3.78, w: largura - 0.48, h: 0.55, fontSize: 28, bold: true, color: "FFFFFF" });
        s.addText("m³ de meta no mês", { x: x + 0.24, y: 4.32, w: largura - 0.48, h: 0.22, fontSize: 10, color: "9CC0F0" });
        s.addText(
          [
            { text: "realizado ", options: { fontSize: 9, color: "9CC0F0" } },
            { text: num(Math.round(item.realizado * 10) / 10), options: { fontSize: 13, bold: true, color: "FFFFFF" } },
            { text: `  ${num(pctv)}%`, options: { fontSize: 11, bold: true, color: cor } },
          ],
          { x: x + 0.24, y: 4.6, w: largura - 0.48, h: 0.3, valign: "middle" },
        );
      });

      const pctTotal = slide.total > 0 ? (slide.realizado / slide.total) * 100 : 0;
      const corTotal = pctTotal >= 100 ? hex(CORES.verde) : pctTotal >= 90 ? hex(CORES.dourado) : "FF8F9B";
      s.addText(
        [
          { text: "META DO MÊS   ", options: { fontSize: 12, bold: true, color: "9CC0F0", charSpacing: 1.2 } },
          { text: `${num(Math.round(slide.total * 10) / 10)} m³`, options: { fontSize: 34, bold: true, color: hex(CORES.dourado) } },
          { text: `   · realizado ${num(Math.round(slide.realizado * 10) / 10)} m³`, options: { fontSize: 12, color: "9CC0F0" } },
          { text: `   ${num(pctTotal)}%`, options: { fontSize: 15, bold: true, color: corTotal } },
          { text: `   · ${slide.diasUteis} dias úteis`, options: { fontSize: 11, color: "9CC0F0" } },
        ],
        { x: 0.85, y: 5.5, w: 11.8, h: 0.6, valign: "middle" },
      );
      logotipo(s, true);
      continue;
    }

    if (slide.tipo === "segmentos") {
      const s = novoSlide();
      cabecalho(s, slide.titulo, slide.subtitulo, slide.selo);

      const rotulos = slide.dados.map((d) =>
        slide.meses.length > 1 ? `${d.nome}\n${d.variacao > 0 ? "+" : ""}${num(d.variacao)}%` : d.nome,
      );
      const meses = slide.meses;
      const series = meses.map((mes, i) => ({
        name: mes,
        labels: rotulos,
        values: slide.dados.map((d) => Number((d.valores[i]?.valor ?? 0).toFixed(1))),
      }));
      const maior = Math.max(1, ...slide.dados.flatMap((d) => d.valores.map((v) => v.valor)));

      s.addChart(pptx.ChartType.bar, series, {
        x: 0.75,
        y: 1.3,
        w: 11.8,
        h: 3.85,
        barDir: "col",
        barGrouping: "clustered",
        barGapWidthPct: 55,
        chartColors: [hex(CORES.serie[0]), hex(CORES.serie[1]), hex(CORES.serie[2])],
        showLegend: true,
        legendPos: "t",
        legendFontSize: 11,
        showValue: true,
        dataLabelFontSize: 8,
        dataLabelFormatCode: "#,##0",
        catAxisLabelFontSize: 9,
        valAxisLabelFontSize: 9,
        valAxisMaxVal: Math.ceil((maior * 1.25) / 100) * 100,
        valAxisMinVal: 0,
        valGridLine: { color: "E7ECF4", size: 1 },
        catAxisLineShow: false,
        valAxisLineShow: false,
        layout: { x: 0, y: 0, w: 1, h: 1 },
      });

      const total = slide.dados.reduce((acc, d) => acc + d.atual, 0) || 1;
      s.addShape(pptx.ShapeType.roundRect, { x: 0.75, y: 5.55, w: 11.8, h: 0.42, fill: { color: "F1F5FB" }, line: { color: "F1F5FB" }, rectRadius: 0.2 });
      s.addText(
        [
          { text: `PARTICIPAÇÃO EM ${meses[meses.length - 1].toUpperCase()}   `, options: { fontSize: 7.5, bold: true, color: hex(CORES.cinza) } },
          {
            text: slide.dados
              .map((d) => `${d.nome} ${Math.round((d.atual / total) * 100)}%`)
              .join(" · "),
            options: { fontSize: 8.3, bold: true, color: hex(CORES.navy) },
          },
        ],
        { x: 0.95, y: 5.55, w: 11.4, h: 0.42, valign: "middle" },
      );

      s.addText(slide.nota, { x: 0.75, y: 6.3, w: 11.8, h: 0.35, fontSize: 9.5, bold: true, color: hex(CORES.cinza) });
      logotipo(s);
      continue;
    }

    if (slide.tipo === "top10") {
      const s = novoSlide();
      s.addText("TOP 10 — CLIENTES DO MÊS", {
        x: 0,
        y: 0.24,
        w: SLIDE_L,
        h: 0.5,
        align: "center",
        fontSize: 26,
        bold: true,
        color: hex(CORES.navy),
        fontFace: "Arial Narrow",
      });
      s.addText(slide.subtitulo, { x: 0, y: 0.75, w: SLIDE_L, h: 0.3, align: "center", fontSize: 10, color: hex(CORES.cinza) });

      const podio = [
        { cliente: slide.clientes[0], cor: CORES.dourado, trofeu: "/apresentacao/trofeu1.png" },
        { cliente: slide.clientes[1], cor: CORES.prata, trofeu: "/apresentacao/trofeu2.png" },
        { cliente: slide.clientes[2], cor: CORES.bronze, trofeu: "/apresentacao/trofeu3.png" },
      ].filter((p) => p.cliente);

      for (let i = 0; i < podio.length; i++) {
        const p = podio[i];
        const x = 0.67 + i * 4.07;
        const y = 1.22;
        s.addShape(pptx.ShapeType.roundRect, { x, y, w: 3.85, h: 2.35, fill: { color: "FFFFFF" }, line: { color: hex(CORES.linha) }, rectRadius: 0.16 });
        s.addShape(pptx.ShapeType.rect, { x, y, w: 3.85, h: 0.12, fill: { color: hex(p.cor) }, line: { color: hex(p.cor) } });
        s.addImage({ data: await imagemBase64(p.trofeu), x: x + 1.52, y: y + 0.2, w: 0.8, h: 0.78 });
        s.addText(p.cliente.nome, { x: x + 0.15, y: y + 1.0, w: 3.55, h: 0.3, align: "center", fontSize: 12.5, bold: true, color: hex(CORES.navy) });
        s.addText(`${num(p.cliente.atual)} m³`, { x: x + 0.15, y: y + 1.3, w: 3.55, h: 0.36, align: "center", fontSize: 19, bold: true, color: hex(CORES.azul) });
        const variacao = p.cliente.variacao;
        const etiqueta = `${variacao > 0 ? "+" : ""}${num(variacao)}%`;
        s.addShape(pptx.ShapeType.roundRect, {
          x: x + 1.925 - (0.115 * etiqueta.length + 0.26) / 2,
          y: y + 1.7,
          w: 0.115 * etiqueta.length + 0.26,
          h: 0.26,
          fill: { color: variacao >= 0 ? "E6F6EE" : "FCECEE" },
          line: { color: variacao >= 0 ? "E6F6EE" : "FCECEE" },
          rectRadius: 0.12,
        });
        s.addText(etiqueta, {
          x: x + 1.925 - (0.115 * etiqueta.length + 0.26) / 2,
          y: y + 1.7,
          w: 0.115 * etiqueta.length + 0.26,
          h: 0.26,
          align: "center",
          valign: "middle",
          fontSize: 9.5,
          bold: true,
          color: hex(variacao >= 0 ? CORES.verde : CORES.vermelho),
        });
        s.addText(`${num(p.cliente.participacao)}% do mês`, {
          x: x + 0.15,
          y: y + 2.0,
          w: 3.55,
          h: 0.22,
          align: "center",
          fontSize: 9.5,
          bold: true,
          color: hex(CORES.cinza),
        });
      }
      logotipo(s);

      s.addText("4º AO 10º", { x: 0.72, y: 3.72, w: 3, h: 0.24, fontSize: 8.5, bold: true, color: hex(CORES.cinza) });
      slide.clientes.slice(3).forEach((c, i) => {
        const y = 4 + i * 0.435;
        s.addShape(pptx.ShapeType.roundRect, {
          x: 0.67,
          y,
          w: 11.99,
          h: 0.39,
          fill: { color: i % 2 === 0 ? "FFFFFF" : "F3F7FC" },
          line: { color: i % 2 === 0 ? "FFFFFF" : "F3F7FC" },
          rectRadius: 0.14,
        });
        s.addShape(pptx.ShapeType.ellipse, { x: 0.83, y: y + 0.09, w: 0.21, h: 0.21, fill: { color: hex(CORES.azulClaro) }, line: { color: hex(CORES.azulClaro) } });
        s.addText(String(i + 4), { x: 0.83, y: y + 0.09, w: 0.21, h: 0.21, align: "center", valign: "middle", fontSize: 8.5, bold: true, color: hex(CORES.navy) });
        s.addText(c.nome, { x: 1.22, y, w: 5.4, h: 0.39, valign: "middle", fontSize: 11, bold: true, color: hex(CORES.tinta) });
        s.addText(`${num(c.atual)} m³`, { x: 6.6, y, w: 2.4, h: 0.39, valign: "middle", align: "right", fontSize: 11.5, bold: true, color: hex(CORES.navy) });
        s.addText(`${c.variacao > 0 ? "+" : ""}${num(c.variacao)}%`, {
          x: 9.1,
          y,
          w: 1.5,
          h: 0.39,
          valign: "middle",
          align: "right",
          fontSize: 10.5,
          bold: true,
          color: hex(c.variacao >= 0 ? CORES.verde : CORES.vermelho),
        });
        s.addText(`${num(c.participacao)}%`, {
          x: 10.7,
          y,
          w: 1.3,
          h: 0.39,
          valign: "middle",
          align: "right",
          fontSize: 10.5,
          bold: true,
          color: hex(CORES.cinza),
        });
      });
      continue;
    }

    if (slide.tipo === "comparativo") {
      const s = novoSlide();
      cabecalho(s, "Comparativo de volume mensal 2026", slide.subtitulo, slide.selo);

      s.addChart(
        pptx.ChartType.bar,
        [
          { name: "Meta (m³)", labels: slide.meses.map((m) => m.nome), values: slide.meses.map((m) => Math.round(m.meta)) },
          { name: "Realizado (m³)", labels: slide.meses.map((m) => m.nome), values: slide.meses.map((m) => Math.round(m.valor)) },
        ],
        {
          x: 0.75,
          y: 1.3,
          w: 8.0,
          h: 4.9,
          barDir: "col",
          barGrouping: "clustered",
          barGapWidthPct: 70,
          chartColors: ["D9E2F2", "0B3D91"],
          showLegend: true,
          legendPos: "t",
          legendFontSize: 11,
          showValue: true,
          dataLabelFontSize: 9,
          dataLabelFormatCode: "#,##0",
          catAxisLabelFontSize: 10,
          valAxisLabelFontSize: 9.5,
          valAxisMaxVal: Math.ceil((Math.max(1, ...slide.meses.map((m) => Math.max(m.meta, m.valor))) * 1.15) / 500) * 500,
          valAxisMinVal: 0,
          valGridLine: { color: "E7ECF4", size: 1 },
          catAxisLineShow: false,
          valAxisLineShow: false,
        },
      );

      s.addText("ATINGIMENTO POR MÊS", { x: 9.1, y: 1.35, w: 3.6, h: 0.26, fontSize: 8.5, bold: true, color: hex(CORES.cinza) });
      slide.meses.forEach((m, i) => {
        const y = 1.7 + i * 0.95;
        const cor = m.atingimento >= 100 ? CORES.verde : m.atingimento >= 90 ? CORES.dourado : CORES.vermelho;
        s.addText(m.nome, { x: 9.1, y, w: 1.9, h: 0.24, fontSize: 10, bold: true, color: hex(CORES.cinza) });
        s.addText(`${num(m.atingimento)}%`, { x: 11.0, y, w: 1.7, h: 0.24, align: "right", fontSize: 11, bold: true, color: hex(cor) });
        s.addText(m.parcial ? `${m.diasUteis} de ${m.diasUteisMes} dias úteis` : `${m.diasUteis} dias úteis`, {
          x: 9.1,
          y: y + 0.22,
          w: 2.4,
          h: 0.2,
          fontSize: 7.5,
          bold: true,
          color: hex(CORES.azul),
        });
        s.addShape(pptx.ShapeType.roundRect, { x: 9.1, y: y + 0.47, w: 3.6, h: 0.1, fill: { color: "E7ECF4" }, line: { color: "E7ECF4" }, rectRadius: 0.05 });
        s.addShape(pptx.ShapeType.roundRect, {
          x: 9.1,
          y: y + 0.47,
          w: Math.max(0.1, 3.6 * Math.min(1, m.atingimento / 110)),
          h: 0.1,
          fill: { color: hex(cor) },
          line: { color: hex(cor) },
          rectRadius: 0.05,
        });
      });

      s.addShape(pptx.ShapeType.roundRect, { x: 0.75, y: 6.32, w: 11.9, h: 0.5, fill: { color: "FFFFFF" }, line: { color: hex(CORES.linha) }, rectRadius: 0.2 });
      s.addText(slide.nota, { x: 0.95, y: 6.32, w: 11.5, h: 0.5, valign: "middle", fontSize: 8.5, color: hex(CORES.cinza) });
      logotipo(s);
      continue;
    }

    if (slide.tipo === "comparativoAnual") {
      const s = novoSlide();
      cabecalho(s, "Comparativo de volume mensal 2025 x 2026", slide.subtitulo);

      // legenda
      s.addShape(pptx.ShapeType.ellipse, { x: 0.75, y: 1.52, w: 0.12, h: 0.12, fill: { color: hex(CORES.azul) }, line: { color: hex(CORES.azul) } });
      s.addText("2026 (m³)", { x: 0.92, y: 1.44, w: 1.2, h: 0.26, fontSize: 9, bold: true, color: hex(CORES.tinta) });
      s.addShape(pptx.ShapeType.ellipse, { x: 2.0, y: 1.52, w: 0.12, h: 0.12, fill: { color: hex(CORES.dourado) }, line: { color: hex(CORES.dourado) } });
      s.addText("2025 (m³)", { x: 2.17, y: 1.44, w: 1.2, h: 0.26, fontSize: 9, bold: true, color: hex(CORES.tinta) });

      // área do gráfico desenhada em formas: permite os valores na diagonal
      const plotX = 0.75;
      const plotW = 7.85;
      const plotY = 1.95;
      const plotH = 4.3;
      const base = plotY + plotH;
      const maior = Math.max(1, ...slide.meses.flatMap((m) => [m.v2025, m.v2026]));
      const topo = Math.ceil((maior * 1.22) / 500) * 500;
      const passo = plotW / 12;
      const barra = 0.25;

      for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
        const y = base - plotH * frac;
        s.addShape(pptx.ShapeType.rect, {
          x: plotX, y, w: plotW, h: 0.01,
          fill: { color: frac === 0 ? "C9D6EA" : "E7ECF4" }, line: { color: frac === 0 ? "C9D6EA" : "E7ECF4" },
        });
        s.addText(String(Math.round(topo * frac)), {
          x: 0.02, y: y - 0.11, w: 0.66, h: 0.22, align: "right", fontSize: 8, color: hex(CORES.cinza),
        });
      }

      slide.meses.forEach((m, i) => {
        const centro = plotX + passo * (i + 0.5);
        const barras = [
          { valor: m.v2025, cor: CORES.dourado, desloc: -barra - 0.02 },
          { valor: m.v2026, cor: CORES.azul, desloc: 0.02 },
        ];
        for (const b of barras) {
          if (b.valor <= 0) continue;
          const altura = (b.valor / topo) * plotH;
          s.addShape(pptx.ShapeType.rect, {
            x: centro + b.desloc, y: base - altura, w: barra, h: altura,
            fill: { color: hex(b.cor) }, line: { color: hex(b.cor) },
          });
          s.addText(String(Math.round(b.valor)), {
            x: centro + b.desloc + barra / 2 - 0.35,
            y: base - altura - 0.42,
            w: 0.7,
            h: 0.22,
            align: "center",
            fontSize: 8,
            bold: true,
            color: hex(CORES.tinta),
            rotate: -45,
          });
        }
        s.addText(m.nome, {
          x: centro - 0.32, y: base + 0.06, w: 0.64, h: 0.24,
          align: "center", fontSize: 10, bold: true, color: hex(CORES.navy),
        });
      });

      const celula = (texto: string, opcoes: Record<string, unknown> = {}) => ({ text: texto, options: opcoes });
      const linhas: { text: string; options?: Record<string, unknown> }[][] = [
        ["MÊS", "DIAS 25/26", "Δ%"].map((t, i) =>
          celula(t, { bold: true, color: "FFFFFF", fill: { color: hex(CORES.navy3) }, fontSize: 9.5, align: i === 0 ? "left" : "right" }),
        ),
        ...slide.meses.map((m) => {
          const cor = m.crescimento == null ? hex(CORES.cinza) : m.crescimento >= 0 ? hex(CORES.verde) : hex(CORES.vermelho);
          return [
            celula(m.nome, { bold: true, color: hex(CORES.navy), fontSize: 10, fill: { color: "FFFFFF" } }),
            celula(`${m.dias2025} / ${m.dias2026}`, { color: hex(CORES.cinza), fontSize: 10, align: "right", fill: { color: "FFFFFF" } }),
            celula(m.crescimento == null ? "—" : `${m.crescimento > 0 ? "+" : ""}${num(m.crescimento)}%`, {
              bold: true, color: cor, fontSize: 10, align: "right", fill: { color: "FFFFFF" },
            }),
          ];
        }),
        [
          celula("Total", { bold: true, color: hex(CORES.navy), fontSize: 10, fill: { color: "F1F5FB" } }),
          celula(`${num(Math.round(slide.total2025))} / ${num(Math.round(slide.total2026))}`, {
            color: hex(CORES.cinza), fontSize: 10, align: "right", fill: { color: "F1F5FB" },
          }),
          celula(
            slide.crescimentoTotal == null ? "—" : `${slide.crescimentoTotal > 0 ? "+" : ""}${num(slide.crescimentoTotal)}%`,
            {
              bold: true,
              color: (slide.crescimentoTotal ?? 0) >= 0 ? hex(CORES.verde) : hex(CORES.vermelho),
              fontSize: 10, align: "right", fill: { color: "F1F5FB" },
            },
          ),
        ],
      ];
      s.addTable(linhas as never, {
        x: 9.05, y: 1.3, w: 3.6,
        colW: [1.0, 1.4, 1.2],
        border: { type: "solid", color: "E2E8F0", pt: 0.5 },
        rowH: 0.36,
        valign: "middle",
        margin: 0.03,
      });
      logotipo(s);
      continue;
    }

    if (slide.tipo === "forecast") {
      const s = novoSlide();
      cabecalho(s, "Forecast — 2026", "Realizado no período, média mensal e projeção do ano");
      slide.cards.forEach((c, i) => cartao(s, 0.75 + i * 4, 1.6, c.rotulo, c.valor, c.detalhe, [CORES.azul, CORES.navy3, CORES.dourado][i]));
      s.addShape(pptx.ShapeType.roundRect, { x: 0.75, y: 4.0, w: 11.8, h: 1.1, fill: { color: "FFFFFF" }, line: { color: hex(CORES.linha) }, rectRadius: 0.16 });
      slide.barra.forEach((b, i) => {
        s.addText(b.rotulo, { x: 1.0 + i * 3.9, y: 4.18, w: 3.6, h: 0.26, fontSize: 8.5, bold: true, color: hex(CORES.cinza) });
        s.addText(b.valor, { x: 1.0 + i * 3.9, y: 4.45, w: 3.6, h: 0.4, fontSize: 16, bold: true, color: hex(i === 2 ? CORES.vermelho : CORES.navy) });
      });
      const total = slide.participacao.reduce((acc, p) => acc + p.valor, 0) || 1;
      s.addShape(pptx.ShapeType.roundRect, { x: 0.75, y: 5.4, w: 11.8, h: 0.42, fill: { color: "F1F5FB" }, line: { color: "F1F5FB" }, rectRadius: 0.2 });
      s.addText(
        [
          { text: "PARTICIPAÇÃO NO REALIZADO   ", options: { fontSize: 7.5, bold: true, color: hex(CORES.cinza) } },
          {
            text: slide.participacao.map((p) => `${p.nome} ${Math.round((p.valor / total) * 100)}%`).join(" · "),
            options: { fontSize: 8.3, bold: true, color: hex(CORES.navy) },
          },
        ],
        { x: 0.95, y: 5.4, w: 11.4, h: 0.42, valign: "middle" },
      );
      logotipo(s);
      continue;
    }

    if (slide.tipo === "tabela") {
      const s = novoSlide();
      cabecalho(s, slide.titulo, slide.subtitulo);
      const linhas: { text: string; options?: Record<string, unknown> }[][] = [
        slide.colunas.map((c, i) => ({
          text: c,
          options: { bold: true, color: "FFFFFF", fill: { color: hex(CORES.navy3) }, align: i === 0 ? "left" : "right" },
        })),
        ...slide.linhas.map((linha, i) =>
          linha.map((v, j) => ({
            text: v,
            options: {
              fill: { color: i % 2 === 0 ? "FFFFFF" : "F1F5FB" },
              align: j === 0 ? "left" : "right",
              bold: j > 0,
              color: hex(j === 0 ? CORES.tinta : CORES.navy),
            },
          })),
        ),
      ];
      s.addTable(linhas as never, {
        x: 0.75,
        y: 1.45,
        w: 11.8,
        colW: [5.2, 2.2, 2.4, 2.0],
        fontSize: 10,
        border: { type: "solid", color: "E2E8F0", pt: 1 },
        rowH: 0.33,
        valign: "middle",
        margin: 0.08,
      });
      s.addText(slide.rodape, { x: 0.75, y: 5.2, w: 11.8, h: 0.3, fontSize: 11, bold: true, color: hex(CORES.navy) });
      if (slide.nota) s.addText(slide.nota, { x: 0.75, y: 5.55, w: 11.8, h: 0.3, fontSize: 9.5, bold: true, color: hex(CORES.cinza) });
      logotipo(s);
      continue;
    }

    // resultado comercial
    const s = novoSlide();
    cabecalho(s, "Resultado comercial do mês", slide.subtitulo);
    slide.cards.forEach((c, i) => cartao(s, 0.75 + i * 4, 1.6, c.rotulo, c.valor, c.detalhe, [CORES.azul, CORES.dourado, CORES.navy3][i]));

    const totalSeg = slide.segmentos.reduce((acc, seg) => acc + seg.atual, 0) || 1;
    s.addText("PARTICIPAÇÃO DOS SEGMENTOS", { x: 0.75, y: 3.95, w: 6, h: 0.26, fontSize: 8.5, bold: true, color: hex(CORES.cinza) });
    slide.segmentos.forEach((seg, i) => {
      const y = 4.28 + i * 0.32;
      const fatia = (seg.atual / totalSeg) * 100;
      s.addShape(pptx.ShapeType.roundRect, { x: 0.75, y, w: 7.6, h: 0.24, fill: { color: "E7ECF4" }, line: { color: "E7ECF4" }, rectRadius: 0.1 });
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.75,
        y,
        w: Math.max(0.05, 7.6 * (fatia / 100)),
        h: 0.24,
        fill: { color: hex(["0B3D91", "1B6FD0", "4B5CF5", "5ED2D8", "8FA8E8", "C9D6EE"][i % 6]) },
        line: { color: hex(["0B3D91", "1B6FD0", "4B5CF5", "5ED2D8", "8FA8E8", "C9D6EE"][i % 6]) },
        rectRadius: 0.1,
      });
      s.addText(seg.nome, { x: 8.5, y: y - 0.03, w: 2.6, h: 0.3, fontSize: 10, bold: true, color: hex(CORES.tinta) });
      s.addText(`${num(seg.atual)} m³ · ${Math.round(fatia)}%`, { x: 11.0, y: y - 0.03, w: 1.6, h: 0.3, align: "right", fontSize: 10, bold: true, color: hex(CORES.navy) });
    });
    s.addText(slide.nota, { x: 0.75, y: 6.3, w: 11.8, h: 0.35, fontSize: 9.5, bold: true, color: hex(CORES.cinza) });
    logotipo(s);
  }

  await pptx.writeFile({ fileName: nomeArquivo });
}
