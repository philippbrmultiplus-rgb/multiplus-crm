import type { LancamentoPlanilha } from "./planilha";

export interface LeituraPlanilha {
  lancamentos: LancamentoPlanilha[];
  /** linhas ignoradas (cabeçalho, linha de total ou sem data/cliente) */
  ignoradas: number;
  /** primeira e última data encontradas no arquivo */
  periodo: [string, string] | null;
}

/** converte a célula em data ISO (yyyy-mm-dd) */
function dataISO(valor: unknown): string | null {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    return valor.toISOString().slice(0, 10);
  }
  if (typeof valor === "number" && valor > 20000) {
    // data do Excel (número de dias desde 30/12/1899)
    return new Date(Date.UTC(1899, 11, 30) + valor * 86400000).toISOString().slice(0, 10);
  }
  if (typeof valor === "string") {
    const texto = valor.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
    const brasileira = texto.match(/^(\d{2})[/.-](\d{2})[/.-](\d{4})$/);
    if (brasileira) return `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}`;
  }
  return null;
}

/** volume da célula: vazio vira 0 e texto com vírgula é aceito */
function volumeNumero(valor: unknown): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  if (typeof valor === "string") {
    const texto = valor.replace(/\s|R\$/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    const numero = Number.parseFloat(texto);
    return Number.isFinite(numero) ? numero : 0;
  }
  return 0;
}

/**
 * Lê a planilha de atualização (colunas Data | Cliente | Volume, como a PAULINIA)
 * e agrupa os lançamentos por cliente e dia.
 */
export async function lerPlanilhaDeAtualizacao(arquivo: File): Promise<LeituraPlanilha> {
  const XLSX = await import("xlsx");
  const conteudo = await arquivo.arrayBuffer();
  const pasta = XLSX.read(conteudo, { cellDates: true });
  const aba = pasta.Sheets[pasta.SheetNames[0]];
  if (!aba) throw new Error("O arquivo não tem nenhuma aba que dê para ler.");

  const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, {
    header: 1,
    raw: true,
    blankrows: false,
  }) as unknown[][];

  const agrupado = new Map<string, LancamentoPlanilha>();
  let ignoradas = 0;
  for (const linha of linhas) {
    const data = dataISO(linha?.[0]);
    const nome = typeof linha?.[1] === "string" ? linha[1] : "";
    if (!data || !nome.trim()) {
      ignoradas += 1;
      continue;
    }
    const chave = `${nome}|${data}`;
    const atual = agrupado.get(chave);
    if (atual) {
      atual.volume = Math.round((atual.volume + volumeNumero(linha[2])) * 100) / 100;
      atual.trocas += 1;
    } else {
      agrupado.set(chave, {
        nome,
        data,
        volume: Math.round(volumeNumero(linha[2]) * 100) / 100,
        trocas: 1,
      });
    }
  }

  const lancamentos = [...agrupado.values()].sort((a, b) =>
    a.data === b.data ? a.nome.localeCompare(b.nome, "pt-BR") : a.data < b.data ? -1 : 1,
  );
  const datas = [...new Set(lancamentos.map((l) => l.data))].sort();

  return {
    lancamentos,
    ignoradas,
    periodo: datas.length ? [datas[0], datas[datas.length - 1]] : null,
  };
}
