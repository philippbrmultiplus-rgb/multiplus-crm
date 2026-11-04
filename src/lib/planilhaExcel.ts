import { casarClientePeloEndereco, indexarClientes, type ClienteCasavel } from "./planilhaMatch";
import type { LancamentoPlanilha } from "./planilha";

export interface LeituraPlanilha {
  lancamentos: LancamentoPlanilha[];
  /** linhas ignoradas (cabeçalho, linha de total ou sem data/cliente) */
  ignoradas: number;
  /** primeira e última data encontradas no arquivo */
  periodo: [string, string] | null;
}

/** texto sem acento e em maiúsculas, para comparar cabeçalhos */
function base(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
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
 *
 * Quando existe a coluna de endereço (ex.: as cooperativas HAVILA têm 4 endereços no
 * mesmo nome), o endereço é usado para achar o cadastro certo e o lançamento entra no
 * nome do cliente, em vez de ficar como "sem cadastro".
 */
export async function lerPlanilhaDeAtualizacao(
  arquivo: File,
  clientes: ClienteCasavel[] = [],
): Promise<LeituraPlanilha> {
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

  // cabeçalho pode ou não existir; quando existe, achamos as colunas pelo nome
  const cabecalho = (linhas[0] ?? []).map((c) => (typeof c === "string" ? base(c) : ""));
  const colunaDe = (nome: string) => {
    const i = cabecalho.findIndex((c) => c.includes(nome));
    return i >= 0 ? i : null;
  };
  const idxData = colunaDe("DATA") ?? 0;
  const idxCliente = colunaDe("CLIENTE") ?? 1;
  // a coluna de endereço aparece como "ENDEREÇO", "Tp.End." (planilha da Paulínia) ou "Tipo"
  const idxEndereco = colunaDe("ENDERECO") ?? colunaDe("TP.END") ?? colunaDe("TP END") ?? colunaDe("TIPO END");
  const idxVolume = colunaDe("VOLUME") ?? (idxEndereco != null ? idxEndereco + 1 : 2);
  const temCabecalho = colunaDe("DATA") != null || colunaDe("CLIENTE") != null;

  const indiceClientes = clientes.length > 0 ? indexarClientes(clientes) : [];
  const agrupado = new Map<string, LancamentoPlanilha>();
  let ignoradas = 0;
  for (const linha of temCabecalho ? linhas.slice(1) : linhas) {
    const data = dataISO(linha?.[idxData]);
    const clienteColuna = typeof linha?.[idxCliente] === "string" ? (linha[idxCliente] as string) : "";
    if (!data || !clienteColuna.trim()) {
      ignoradas += 1;
      continue;
    }
    const endereco =
      idxEndereco != null && typeof linha?.[idxEndereco] === "string"
        ? (linha[idxEndereco] as string).trim()
        : "";

    // nome que identifica o lançamento: o cliente do cadastro quando o endereço indica qual é
    let nome = clienteColuna;
    if (endereco && indiceClientes.length > 0) {
      const id = casarClientePeloEndereco(clienteColuna, endereco, indiceClientes);
      const cliente = id ? indiceClientes.find((c) => c.id === id) : undefined;
      if (cliente) nome = cliente.name;
    }

    const chave = `${nome}|${data}`;
    const atual = agrupado.get(chave);
    const volume = volumeNumero(linha[idxVolume]);
    if (atual) {
      atual.volume = Math.round((atual.volume + volume) * 100) / 100;
      atual.trocas += 1;
    } else {
      agrupado.set(chave, {
        nome,
        data,
        volume: Math.round(volume * 100) / 100,
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
