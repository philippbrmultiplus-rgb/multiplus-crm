/**
 * Slides da apresentação mensal, no formato do modelo em PowerPoint.
 * A mesma lista alimenta a prévia na tela e o arquivo .pptx.
 */
import type { ApresentacaoMensal, SegmentoResumo } from "./apresentacao";
import { formatM3 } from "./geo";

export type Slide =
  | { tipo: "capa" }
  | {
      tipo: "volume";
      mesNome: string;
      ano: number;
      meta: number;
      total: number;
      atingimento: number;
      parcial: boolean;
      corteEm: string | null;
    }
  | {
      tipo: "metas";
      mesNome: string;
      ano: number;
      /** meta do mês (soma dos segmentos) */
      total: number;
      /** volume realizado no mês */
      realizado: number;
      diasUteis: number;
      segmentos: { nome: string; dia: number; meta: number; realizado: number }[];
    }
  | {
      tipo: "segmentos";
      titulo: string;
      subtitulo: string;
      selo: string;
      meses: string[];
      dados: SegmentoResumo[];
      nota: string;
    }
  | {
      tipo: "top10";
      subtitulo: string;
      clientes: ApresentacaoMensal["top10"];
    }
  | {
      tipo: "comparativo";
      subtitulo: string;
      selo: string;
      meses: ApresentacaoMensal["comparativo"];
      nota: string;
    }
  | {
      tipo: "cacambas";
      titulo: string;
      subtitulo: string;
      tipoNome: string;
      total: number;
      clientes: number;
      estoques: number;
      manutencao: number;
      caminhoes: number;
      segmentos: { nome: string; qtd: number }[];
    }
  | {
      tipo: "comparativoAnual";
      subtitulo: string;
      meses: ApresentacaoMensal["comparativoAnual"]["meses"];
      total2025: number;
      total2026: number;
      crescimentoTotal: number | null;
    }
  | {
      tipo: "forecast";
      cards: { rotulo: string; valor: string; detalhe: string }[];
      barra: { rotulo: string; valor: string }[];
      participacao: { nome: string; valor: number }[];
    }
  | {
      tipo: "filaCacambas";
      titulo: string;
      subtitulo: string;
      linhas: { cliente: string; cidade: string; volume: number; distanciaKm: number | null }[];
      total: number;
    }
  | {
      tipo: "tabela";
      titulo: string;
      subtitulo: string;
      colunas: string[];
      linhas: string[][];
      rodape: string;
      nota?: string;
    }
  | {
      tipo: "resultado";
      subtitulo: string;
      cards: { rotulo: string; valor: string; detalhe: string }[];
      segmentos: SegmentoResumo[];
      nota: string;
    }
  | { tipo: "obrigado" };

const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const m3 = (n: number) => `${formatM3(Math.round(n * 10) / 10)} m³`;

function destaque(dados: SegmentoResumo[]): string {
  const maior = dados[0];
  if (!maior) return "Sem volume lançado no mês.";
  const variacao = maior.variacao;
  return `Maior segmento: ${maior.nome} com ${m3(maior.atual)} (${pct(variacao)} sobre o mês anterior).`;
}

export function montarSlides(dados: ApresentacaoMensal): Slide[] {
  const mesRef = dados.mesNome.toLowerCase();
  const anteriores = dados.meses.slice(0, -1);
  const rotuloAnterior = anteriores[anteriores.length - 1]?.nomeCurto?.toLowerCase() ?? "o mês anterior";
  const slides: Slide[] = [];

  slides.push({ tipo: "capa" });
  slides.push({
    tipo: "volume",
    mesNome: dados.mesNome.toUpperCase(),
    ano: dados.ano,
    meta: dados.meta,
    total: dados.total,
    atingimento: dados.atingimento,
    parcial: dados.parcial,
    corteEm: dados.corteEm,
  });

  slides.push({
    tipo: "metas",
    mesNome: dados.mesNome.toUpperCase(),
    ano: dados.ano,
    total: dados.meta,
    realizado: dados.total,
    diasUteis: dados.diasUteisMes,
    segmentos: dados.metasSegmentos.map((m) => ({
      nome: m.nome,
      dia: m.dia,
      meta: m.meta,
      realizado: dados.grupos.find((g) => g.nome === m.nome)?.atual ?? 0,
    })),
  });

  slides.push({
    tipo: "segmentos",
    titulo: "Representação por segmento comercial",
    subtitulo: `Volume por mês (m³) e a variação de ${rotuloAnterior} para ${mesRef}`,
    selo: m3(dados.total),
    meses: dados.meses.map((m) => m.nomeCurto),
    dados: dados.comerciais,
    nota: destaque(dados.comerciais),
  });

  slides.push({
    tipo: "segmentos",
    titulo: "Representação por segmento logístico",
    subtitulo: `Volume por mês (m³) e a variação de ${rotuloAnterior} para ${mesRef}`,
    selo: m3(dados.total),
    meses: dados.meses.map((m) => m.nomeCurto),
    dados: dados.logisticos,
    nota: destaque(dados.logisticos),
  });

  for (const grupo of dados.grupos) {
    if (grupo.atual <= 0 && grupo.anterior <= 0) continue;
    slides.push({
      tipo: "segmentos",
      titulo: `Representação por segmento comercial - ${grupo.nome}`,
      subtitulo: `Volume por mês (m³) · ${mesRef}: ${m3(grupo.atual)}`,
      selo: m3(grupo.atual),
      meses: dados.meses.map((m) => m.nomeCurto),
      dados: grupo.segmentos,
      nota:
        grupo.segmentos.length > 0
          ? destaque(grupo.segmentos)
          : `Sem volume lançado em ${dados.mesNome} para este grupo.`,
    });
  }

  if (dados.top10.length > 0) {
    slides.push({
      tipo: "top10",
      subtitulo: `${dados.mesNome} · os ${dados.top10.length} maior(es) somam ${m3(
        dados.top10.reduce((acc, c) => acc + c.atual, 0),
      )} (${Math.round(
        (dados.top10.reduce((acc, c) => acc + c.atual, 0) / (dados.total || 1)) * 100,
      )}% do volume do mês)`,
      clientes: dados.top10,
    });
  }

  slides.push({
    tipo: "comparativoAnual",
    subtitulo: "Volume mensal (m³) · 2025 na coluna amarela e 2026 na azul · dias úteis de cada mês e crescimento",
    meses: dados.comparativoAnual.meses,
    total2025: dados.comparativoAnual.total2025,
    total2026: dados.comparativoAnual.total2026,
    crescimentoTotal: dados.comparativoAnual.crescimentoTotal,
  });

  slides.push({
    tipo: "forecast",
    cards: [
      {
        rotulo: `REALIZADO ${dados.forecast.mesInicio.toUpperCase()}–${dados.forecast.mesFim.toUpperCase()}`,
        valor: m3(dados.forecast.realizado),
        detalhe: `${dados.forecast.meses} meses somados`,
      },
      {
        rotulo: "MÉDIA MENSAL",
        valor: m3(dados.forecast.mediaMensal),
        detalhe: "média dos meses da base",
      },
      {
        rotulo: "PROJEÇÃO DO ANO",
        valor: m3(dados.forecast.projecao),
        detalhe: `meta anual: ${formatM3(dados.forecast.metaAnual)} m³`,
      },
    ],
    barra: [
      { rotulo: "META ANUAL (metas diárias × dias úteis)", valor: m3(dados.forecast.metaAnual) },
      { rotulo: "REALIZADO NO PERÍODO", valor: m3(dados.forecast.realizado) },
      { rotulo: "FALTANTE PARA A META", valor: m3(dados.forecast.faltante) },
    ],
    participacao: dados.forecast.porMes.map((m) => ({ nome: m.nome.slice(0, 3), valor: m.valor })),
  });

  if (dados.cacambas && (dados.cacambas.rollon.total > 0 || dados.cacambas.poli.total > 0)) {
    const tipos = [
      { chave: "rollon" as const, nome: "Rollon 26 m³", rotulo: "Rollon" },
      { chave: "poli" as const, nome: "Poli 5 m³", rotulo: "Poli" },
    ];
    for (const t of tipos) {
      const d = dados.cacambas[t.chave];
      if (d.total <= 0) continue;
      slides.push({
        tipo: "cacambas",
        titulo: `Distribuição de caçamba por segmento - ${t.rotulo}`,
        subtitulo: `${t.nome} · quantidades de ${dados.mesNome}`,
        tipoNome: t.nome,
        total: d.total,
        clientes: d.clientes,
        estoques: d.estoques,
        manutencao: d.manutencao,
        caminhoes: d.caminhoes,
        segmentos: d.segmentos,
      });
    }
  }

  if (dados.filaManual.length > 0) {
    slides.push({
      tipo: "filaCacambas",
      titulo: "Fila de espera - caçamba de 26 m³",
      subtitulo: `Clientes aguardando caçamba · ${dados.mesNome}`,
      linhas: dados.filaManual,
      total: dados.filaManual.reduce((acc, l) => acc + l.volume, 0),
    });
  } else if (dados.filaEspera.length > 0) {
    slides.push({
      tipo: "tabela",
      titulo: "Fila de espera",
      subtitulo: `Clientes que coletaram em ${rotuloAnterior} e não tiveram coleta em ${mesRef}`,
      colunas: ["Cliente", "Cidade", "Segmento", `Volume ${rotuloAnterior} (m³)`],
      linhas: dados.filaEspera
        .slice(0, 12)
        .map((c) => [c.nome, c.cidade || "—", c.segmento || "—", formatM3(Math.round(c.volume * 10) / 10)]),
      rodape: `Total de ${dados.filaEspera.length} cliente(s) · ${formatM3(
        Math.round(dados.filaEspera.reduce((acc, c) => acc + c.volume, 0) * 10) / 10,
      )} m³ no mês anterior`,
      nota:
        dados.filaEspera.length > 12
          ? `Listando os 12 maiores volumes de ${dados.filaEspera.length} clientes.`
          : undefined,
    });
  }

  if (dados.novos.length > 0) {
    slides.push({
      tipo: "tabela",
      titulo: `Clientes que começaram a coletar em ${mesRef}`,
      subtitulo: "Primeira coleta registrada no mês",
      colunas: ["Cliente", "Cidade", "Segmento", "Volume no mês (m³)"],
      linhas: dados.novos
        .slice(0, 12)
        .map((c) => [c.nome, c.cidade || "—", c.segmento || "—", formatM3(Math.round(c.volume * 10) / 10)]),
      rodape: `${dados.novos.length} cliente(s) novo(s) · ${formatM3(
        Math.round(dados.novos.reduce((acc, c) => acc + c.volume, 0) * 10) / 10,
      )} m³`,
      nota: dados.novos.length > 12 ? `Listando os 12 maiores de ${dados.novos.length} clientes.` : undefined,
    });
  }

  slides.push({
    tipo: "resultado",
    subtitulo: `Clientes novos, volume e valores a receber · ${mesRef}`,
    cards: [
      {
        rotulo: "CLIENTES NOVOS",
        valor: `${dados.resultado.clientesNovos}`,
        detalhe: `${m3(dados.resultado.volumeNovos)} coletados`,
      },
      {
        rotulo: "CLIENTES ATENDIDOS",
        valor: `${dados.resultado.clientesAtendidos}`,
        detalhe: `${dados.resultado.clientesAReceber} com valor a receber`,
      },
      {
        rotulo: "VOLUME DO MÊS",
        valor: m3(dados.total),
        detalhe: `${dados.atingimento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da meta de ${formatM3(
          dados.meta,
        )} m³`,
      },
    ],
    segmentos: dados.comerciais.slice(0, 6),
    nota: `A receber no cadastro: ${dados.resultado.aReceber.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })} · ${dados.resultado.clientesAReceber} cliente(s).`,
  });

  slides.push({ tipo: "obrigado" });
  return slides;
}

/* ---------- medidas compartilhadas entre a prévia e o PowerPoint ---------- */

/** largura e altura do slide em polegadas (16:9) */
export const SLIDE_L = 13.333;
export const SLIDE_A = 7.5;
/** pixels por polegada na prévia (o PowerPoint usa polegadas) */
export const PX = 96;

/** pt (PowerPoint) -> px (prévia) */
export const ptPx = (pt: number) => (pt * PX) / 72;

/** o título encolhe quando é longo para não encostar no selo da direita */
export function tamanhoTitulo(texto: string): number {
  // encolhe o título (Arial Narrow) até caber na faixa antes do selo da direita
  const larguraA26pt = Math.max(1, texto.length) * 0.0074 * 26;
  return Math.max(17, Math.min(26, (7.6 / larguraA26pt) * 26));
}

export const CORES = {
  navy: "#0B1F3A",
  navy3: "#244678",
  azul: "#1B6FD0",
  azulClaro: "#BDD3EE",
  tinta: "#11223D",
  cinza: "#5E6B80",
  claro: "#ECF2FA",
  fundo: "#F7F9FC",
  linha: "#E2E8F0",
  branco: "#FFFFFF",
  verde: "#149E60",
  vermelho: "#C52F3F",
  dourado: "#E8B50C",
  prata: "#A8B3C2",
  bronze: "#C07A45",
  serie: ["#4B5CF5", "#5ED2D8", "#0B3D91"],
};
