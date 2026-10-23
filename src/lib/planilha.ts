import type { ClientCadence, MonthlyVolume } from "./types";

/** uma coleta da planilha: [data, volume em m³, nº de lançamentos do dia] */
type ColetaBruta = [string, number, number];

interface ClientePlanilha {
  nome: string;
  /** id do cliente cadastrado; null quando a linha da planilha não tem cadastro */
  cliente: string | null;
  coletas: ColetaBruta[];
}

interface ArquivoPlanilha {
  origem?: string;
  periodo?: [string, string];
  gerado_em?: string;
  clientes: ClientePlanilha[];
}

export interface ColetaPlanilha {
  clientId: string;
  collectDate: string;
  volume: number;
  trocas: number;
}

export interface DadosPlanilha {
  volumes: MonthlyVolume[];
  cadence: ClientCadence[];
  coletas: ColetaPlanilha[];
  /** última coleta da planilha, por cliente cadastrado */
  ultimaColeta: Record<string, string>;
  /** nomes da planilha que não têm cliente vinculado na carteira */
  semCadastro: string[];
  periodo: [string, string] | null;
  totalColetas: number;
}

/** planilha de coletas (PAULINIA.xlsx), publicada junto com o app */
const URL_PLANILHA = "/pln-planilha.json";

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** média de dias entre uma coleta e a seguinte (null quando só há uma coleta) */
function mediaDeDias(datas: string[]): number | null {
  if (datas.length < 2) return null;
  let total = 0;
  for (let i = 1; i < datas.length; i++) total += diasEntre(datas[i - 1], datas[i]);
  return Math.round((total / (datas.length - 1)) * 10) / 10;
}

interface Grupo {
  nome: string;
  cliente: string | null;
  /** índice do nome sem cadastro (identificador estável das linhas mensais) */
  indice: number;
  dias: Map<string, { volume: number; trocas: number }>;
}

/** agrupa as coletas por cliente cadastrado (ou pelo nome da planilha, sem cadastro) */
function agrupar(arquivo: ArquivoPlanilha): Map<string, Grupo> {
  const grupos = new Map<string, Grupo>();
  let semCadastro = 0;
  for (const linha of arquivo.clientes) {
    if (!linha || !Array.isArray(linha.coletas)) continue;
    const chave = linha.cliente ? `cli:${linha.cliente}` : `sem:${linha.nome}`;
    const grupo =
      grupos.get(chave) ??
      ({
        nome: linha.nome,
        cliente: linha.cliente ?? null,
        indice: linha.cliente ? 0 : semCadastro++,
        dias: new Map(),
      } satisfies Grupo);
    for (const [data, volume, trocas] of linha.coletas) {
      const dia = String(data).slice(0, 10);
      const atual = grupo.dias.get(dia);
      if (atual) {
        atual.volume += Number(volume) || 0;
        atual.trocas += Number(trocas) || 1;
      } else {
        grupo.dias.set(dia, { volume: Number(volume) || 0, trocas: Number(trocas) || 1 });
      }
    }
    grupos.set(chave, grupo);
  }
  return grupos;
}

/** converte a planilha em volumes mensais, cadência, histórico de coletas e última data */
export function calcularDados(arquivo: ArquivoPlanilha): DadosPlanilha {
  const volumes: MonthlyVolume[] = [];
  const cadence: ClientCadence[] = [];
  const coletas: ColetaPlanilha[] = [];
  const ultimaColeta: Record<string, string> = {};
  const semCadastro: string[] = [];
  let totalColetas = 0;

  for (const grupo of agrupar(arquivo).values()) {
    const datas = [...grupo.dias.keys()].sort();
    const id = grupo.cliente ?? `sem-${grupo.indice}`;
    const prefixo = grupo.cliente ? `vol-${grupo.cliente}` : `vol-sem-${grupo.indice}`;

    const porMes = new Map<string, number>();
    for (const data of datas) {
      const mes = `${data.slice(0, 7)}-01`;
      porMes.set(mes, (porMes.get(mes) ?? 0) + grupo.dias.get(data)!.volume);
      if (grupo.cliente) {
        coletas.push({
          clientId: grupo.cliente,
          collectDate: data,
          volume: Math.round(grupo.dias.get(data)!.volume * 100) / 100,
          trocas: grupo.dias.get(data)!.trocas,
        });
      }
    }
    for (const [mes, volume] of porMes) {
      volumes.push({
        id: `${prefixo}-${mes}`,
        clientId: grupo.cliente,
        label: grupo.cliente ? null : grupo.nome,
        month: mes,
        volumeM3: Math.round(volume * 100) / 100,
      });
    }

    cadence.push({
      clientId: grupo.cliente,
      nomePlanilha: grupo.nome,
      mediaDias: mediaDeDias(datas),
      coletas: datas.length,
      ultimaColeta: datas.length ? datas[datas.length - 1] : null,
      datas,
    });

    totalColetas += datas.length;
    if (grupo.cliente) ultimaColeta[grupo.cliente] = datas[datas.length - 1];
    else semCadastro.push(grupo.nome);
    void id;
  }

  volumes.sort((a, b) => (a.id < b.id ? -1 : 1));
  cadence.sort((a, b) => (a.nomePlanilha ?? "").localeCompare(b.nomePlanilha ?? "", "pt-BR"));

  return {
    volumes,
    cadence,
    coletas,
    ultimaColeta,
    semCadastro,
    periodo: arquivo.periodo ?? null,
    totalColetas,
  };
}

/** busca a planilha publicada com o app e devolve os dados já calculados */
export async function carregarPlanilha(): Promise<DadosPlanilha | null> {
  try {
    const res = await fetch(URL_PLANILHA);
    if (!res.ok) return null;
    const arquivo = (await res.json()) as ArquivoPlanilha;
    if (!arquivo || !Array.isArray(arquivo.clientes)) return null;
    return calcularDados(arquivo);
  } catch (err) {
    console.warn("planilha de coletas não pôde ser lida:", err);
    return null;
  }
}
