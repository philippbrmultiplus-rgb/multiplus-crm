/**
 * Números da apresentação mensal: lê o que já está no app (volumes, clientes,
 * cadência e pagamentos) e monta o retrato do mês escolhido.
 */
import { diasUteisNoMes } from "./calendario";
import { metaDoAno, metaDoMes } from "./metas";
import { formatDateBR } from "./geo";
import { toLocalDateKey } from "./geo";
import type { AppState, Client, MonthlyVolume } from "./types";

export const NOMES_MES = [
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

const SEM_CADASTRO = "Sem cadastro";

export interface ValorMes {
  mes: string;
  valor: number;
}

export interface SegmentoResumo {
  nome: string;
  /** um valor por mês comparado, em ordem cronológica */
  valores: ValorMes[];
  atual: number;
  anterior: number;
  /** variação % do mês anterior para o mês da apresentação */
  variacao: number;
  /** fatia do mês da apresentação (%) */
  participacao: number;
}

export interface GrupoResumo {
  nome: string;
  atual: number;
  anterior: number;
  variacao: number;
  segmentos: SegmentoResumo[];
}

export interface TopCliente {
  nome: string;
  atual: number;
  anterior: number;
  variacao: number;
  participacao: number;
}

export interface MesComparativo {
  mes: string;
  nome: string;
  valor: number;
  diasUteis: number;
  diasUteisMes: number;
  parcial: boolean;
  atingimento: number;
  meta: number;
}

export interface ClienteVolume {
  nome: string;
  cidade: string;
  segmento: string;
  volume: number;
}

export interface ApresentacaoMensal {
  mes: string;
  mesNome: string;
  ano: number;
  meta: number;
  total: number;
  anterior: number;
  variacao: number;
  atingimento: number;
  diasUteis: number;
  diasUteisMes: number;
  parcial: boolean;
  corteEm: string | null;
  clientesAtendidos: number;
  meses: { mes: string; nome: string; nomeCurto: string }[];
  comerciais: SegmentoResumo[];
  logisticos: SegmentoResumo[];
  grupos: GrupoResumo[];
  top10: TopCliente[];
  comparativo: MesComparativo[];
  forecast: {
    realizado: number;
    mediaMensal: number;
    projecao: number;
    metaAnual: number;
    faltante: number;
    /** período somado no realizado (janeiro até o mês da apresentação) */
    mesInicio: string;
    mesFim: string;
    meses: number;
    porMes: { nome: string; valor: number }[];
  };
  filaEspera: ClienteVolume[];
  novos: ClienteVolume[];
  resultado: {
    clientesNovos: number;
    volumeNovos: number;
    clientesAtendidos: number;
    aReceber: number;
    clientesAReceber: number;
  };
}

/** meses com lançamento, do mais antigo para o mais novo (yyyy-mm-01) */
export function mesesComVolume(volumes: MonthlyVolume[]): string[] {
  return [...new Set(volumes.map((v) => v.month))].sort();
}

export function nomeMesCurto(mes: string): string {
  const [, m] = mes.split("-").map(Number);
  return NOMES_MES[(m || 1) - 1];
}

/** valor em R$ de um texto como "R$ 800,00" (0 quando não dá para ler) */
function valorEmReais(texto: string | null | undefined): number {
  const limpo = String(texto ?? "").replace(/\s/g, "");
  const achado = limpo.match(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?/);
  if (!achado) return 0;
  const inteiro = Number(achado[1].replace(/\./g, ""));
  const centavos = Number(achado[2] ?? 0);
  return inteiro + centavos / 100;
}

function grupoDoSegmento(segmento: string): string | null {
  const seg = (segmento || "").trim();
  if (seg.startsWith("Rollon")) return "Rollon";
  if (seg.startsWith("Poli")) return "Poli";
  if (seg.startsWith("Porta a Porta")) return "Porta a Porta";
  if (seg.startsWith("Terceiro")) return "Terceiro";
  return null;
}

interface Linha {
  chave: string;
  nome: string;
  cidade: string;
  segmento: string;
  comercial: string;
  valores: Map<string, number>;
}

function montarLinhas(volumes: MonthlyVolume[], clients: Client[]): Linha[] {
  const porCliente = new Map<string, Client>();
  for (const c of clients) porCliente.set(c.id, c);

  const mapa = new Map<string, Linha>();
  for (const v of volumes) {
    const chave = v.clientId ?? `sem:${v.label ?? v.id}`;
    const cliente = v.clientId ? porCliente.get(v.clientId) : undefined;
    let linha = mapa.get(chave);
    if (!linha) {
      linha = {
        chave,
        nome: cliente?.name ?? v.label ?? SEM_CADASTRO,
        cidade: cliente?.city ?? "",
        segmento: cliente?.segment?.trim() || "Sem segmento",
        comercial: cliente?.segmentoComercial?.trim() || "Sem segmento",
        valores: new Map(),
      };
      mapa.set(chave, linha);
    }
    linha.valores.set(v.month, (linha.valores.get(v.month) ?? 0) + v.volumeM3);
  }
  return [...mapa.values()];
}

function resumirPorCampo(
  linhas: Linha[],
  campo: "segmento" | "comercial",
  meses: string[],
  totalMes: number,
): SegmentoResumo[] {
  const mapa = new Map<string, number[]>();
  for (const l of linhas) {
    const nome = l[campo];
    const valores = mapa.get(nome) ?? meses.map(() => 0);
    meses.forEach((m, i) => {
      valores[i] += l.valores.get(m) ?? 0;
    });
    mapa.set(nome, valores);
  }
  return [...mapa.entries()]
    .map(([nome, valores]) => {
      const atual = valores[valores.length - 1] ?? 0;
      const anterior = valores[valores.length - 2] ?? 0;
      return {
        nome,
        valores: meses.map((mes, i) => ({ mes, valor: Math.round(valores[i] * 10) / 10 })),
        atual,
        anterior,
        variacao: anterior > 0 ? ((atual - anterior) / anterior) * 100 : atual > 0 ? 100 : 0,
        participacao: totalMes > 0 ? (atual / totalMes) * 100 : 0,
      };
    })
    .sort((a, b) => b.atual - a.atual || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** monta todos os números da apresentação do mês pedido (yyyy-mm-01) */
export function construirApresentacao(state: AppState, mes: string): ApresentacaoMensal {
  const hoje = toLocalDateKey(new Date().toISOString());
  const mesAtual = hoje.slice(0, 7);
  const alvo = mes.slice(0, 10);
  const [ano, numeroMes] = alvo.split("-").map(Number);

  const todos = mesesComVolume(state.volumes);
  // o comparativo dos slides usa os 3 últimos meses (2 anteriores + o mês da apresentação)
  const anteriores = todos.filter((m) => m < alvo).slice(-2);
  const mesesBase = [...anteriores, alvo];
  const parcial = alvo.slice(0, 7) === mesAtual;

  const linhas = montarLinhas(state.volumes, state.clients);
  const totalDoMes = (m: string) => linhas.reduce((acc, l) => acc + (l.valores.get(m) ?? 0), 0);

  const total = totalDoMes(alvo);
  const anterior = totalDoMes(anteriores[anteriores.length - 1] ?? "");
  // meta do mês = metas diárias de cada segmento × dias úteis do mês
  const meta = metaDoMes(state.metas ?? [], alvo, state.settings);

  const diasUteisMes = diasUteisNoMes(alvo, null, state.settings.workingDays);
  const diasUteis = diasUteisNoMes(alvo, parcial ? hoje : null, state.settings.workingDays);

  const comerciais = resumirPorCampo(linhas, "comercial", mesesBase, total);
  const logisticos = resumirPorCampo(linhas, "segmento", mesesBase, total);

  const grupos: GrupoResumo[] = ["Rollon", "Poli", "Porta a Porta", "Terceiro"].map((nome) => {
    const doGrupo = linhas.filter((l) => grupoDoSegmento(l.segmento) === nome);
    const atual = doGrupo.reduce((acc, l) => acc + (l.valores.get(alvo) ?? 0), 0);
    const antes = doGrupo.reduce((acc, l) => acc + (l.valores.get(anteriores[anteriores.length - 1] ?? "") ?? 0), 0);
    return {
      nome,
      atual,
      anterior: antes,
      variacao: antes > 0 ? ((atual - antes) / antes) * 100 : atual > 0 ? 100 : 0,
      segmentos: resumirPorCampo(doGrupo, "comercial", mesesBase, atual).filter((s) => s.atual > 0),
    };
  });

  const top10: TopCliente[] = linhas
    .map((l) => {
      const atual = l.valores.get(alvo) ?? 0;
      const antes = l.valores.get(anteriores[anteriores.length - 1] ?? "") ?? 0;
      return {
        nome: l.nome,
        atual,
        anterior: antes,
        variacao: antes > 0 ? ((atual - antes) / antes) * 100 : atual > 0 ? 100 : 0,
        participacao: total > 0 ? (atual / total) * 100 : 0,
      };
    })
    .filter((c) => c.atual > 0)
    .sort((a, b) => b.atual - a.atual || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, 10);

  const comparativo: MesComparativo[] = mesesBase.map((m) => {
    const emAndamento = m.slice(0, 7) === mesAtual;
    const valor = totalDoMes(m);
    // cada mês tem a própria meta (os dias úteis mudam e o Porta a Porta entra em outubro)
    const metaDoPeriodo = metaDoMes(state.metas ?? [], m, state.settings);
    return {
      mes: m,
      nome: nomeMesCurto(m),
      valor,
      diasUteis: diasUteisNoMes(m, emAndamento ? hoje : null, state.settings.workingDays),
      diasUteisMes: diasUteisNoMes(m, null, state.settings.workingDays),
      parcial: emAndamento,
      atingimento: metaDoPeriodo > 0 ? (valor / metaDoPeriodo) * 100 : 0,
      meta: metaDoPeriodo,
    };
  });

  // forecast: soma todos os meses do ano até o mês da apresentação
  const mesesDoAno = todos.filter((m) => m >= `${ano}-01-01` && m <= alvo);
  const realizado = mesesDoAno.reduce((acc, m) => acc + totalDoMes(m), 0);
  const mediaMensal = mesesDoAno.length ? realizado / mesesDoAno.length : 0;
  const projecao = mediaMensal * 12;

  const filaEspera: ClienteVolume[] = linhas
    .filter((l) => (l.valores.get(alvo) ?? 0) <= 0 && (l.valores.get(anteriores[anteriores.length - 1] ?? "") ?? 0) > 0)
    .map((l) => ({
      nome: l.nome,
      cidade: l.cidade,
      segmento: l.segmento,
      volume: l.valores.get(anteriores[anteriores.length - 1] ?? "") ?? 0,
    }))
    .sort((a, b) => b.volume - a.volume || a.nome.localeCompare(b.nome, "pt-BR"));

  const novos: ClienteVolume[] = linhas
    .filter((l) => {
      const primeiro = [...l.valores.keys()].sort()[0];
      return primeiro === alvo && (l.valores.get(alvo) ?? 0) > 0;
    })
    .map((l) => ({
      nome: l.nome,
      cidade: l.cidade,
      segmento: l.segmento,
      volume: l.valores.get(alvo) ?? 0,
    }))
    .sort((a, b) => b.volume - a.volume || a.nome.localeCompare(b.nome, "pt-BR"));

  const idsAReceber = new Set<string>();
  let aReceber = 0;
  for (const p of state.payments) {
    const modalidade = String(p.modalidade ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (!p.clientId || !/a\s*receber/i.test(modalidade)) continue;
    idsAReceber.add(p.clientId);
    aReceber += valorEmReais(p.valor);
  }

  return {
    mes: alvo,
    mesNome: NOMES_MES[(numeroMes || 1) - 1],
    ano,
    meta,
    total,
    anterior,
    variacao: anterior > 0 ? ((total - anterior) / anterior) * 100 : 0,
    atingimento: meta > 0 ? (total / meta) * 100 : 0,
    diasUteis,
    diasUteisMes,
    parcial,
    corteEm: parcial ? formatDateBR(hoje) : null,
    clientesAtendidos: linhas.filter((l) => (l.valores.get(alvo) ?? 0) > 0).length,
    meses: mesesBase.map((m) => ({
      mes: m,
      nome: `${nomeMesCurto(m)}/${m.slice(0, 4)}`,
      nomeCurto: nomeMesCurto(m),
    })),
    comerciais,
    logisticos,
    grupos,
    top10,
    comparativo,
    forecast: {
      realizado,
      mediaMensal,
      projecao,
      metaAnual: metaDoAno(state.metas ?? [], ano, state.settings),
      faltante: Math.max(0, metaDoAno(state.metas ?? [], ano, state.settings) - realizado),
      mesInicio: mesesDoAno.length ? nomeMesCurto(mesesDoAno[0]) : nomeMesCurto(alvo),
      mesFim: nomeMesCurto(alvo),
      meses: mesesDoAno.length,
      porMes: mesesDoAno.map((m) => ({ nome: nomeMesCurto(m), valor: totalDoMes(m) })),
    },
    filaEspera,
    novos,
    resultado: {
      clientesNovos: novos.length,
      volumeNovos: novos.reduce((acc, n) => acc + n.volume, 0),
      clientesAtendidos: linhas.filter((l) => (l.valores.get(alvo) ?? 0) > 0).length,
      aReceber,
      clientesAReceber: idsAReceber.size,
    },
  };
}
