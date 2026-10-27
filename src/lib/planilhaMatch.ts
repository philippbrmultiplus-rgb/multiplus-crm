/**
 * Casamento entre o nome usado nas planilhas de coleta e o cadastro de clientes.
 * Segue as mesmas regras usadas na importação histórica, para que os números
 * continuem caindo no mesmo cliente:
 *   1. nome exato (sem acento/pontuação);
 *   2. nome exato ignorando PLN/LTDA/ME/SA;
 *   3. nome truncado (prefixo) desde que aponte para um único cliente;
 *   4. sem cadastro -> a linha fica só com o nome da planilha.
 */

export interface ClienteCasavel {
  id: string;
  name: string;
  address?: string | null;
}

export interface ClienteIndexado extends ClienteCasavel {
  strict: string;
  loose: string;
}

function baseNorm(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loose(texto: string): string {
  return baseNorm(texto)
    .replace(/\b(PLN|PNL|LTDA|ME|EIRELI|SA)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** cliente mais completo (endereço mais detalhado) e, no empate, o de menor número */
function melhor(candidatos: ClienteIndexado[]): ClienteIndexado {
  const indice = (id: string) => Number(id.replace(/\D/g, "")) || 0;
  return [...candidatos].sort(
    (a, b) =>
      (b.address ?? "").length - (a.address ?? "").length ||
      indice(a.id) - indice(b.id) ||
      a.id.localeCompare(b.id),
  )[0];
}

export function indexarClientes(clientes: ClienteCasavel[]): ClienteIndexado[] {
  return clientes.map((c) => ({ ...c, strict: baseNorm(c.name), loose: loose(c.name) }));
}

export function casarCliente(nome: string, indice: ClienteIndexado[]): string | null {
  if (!nome) return null;
  const exato = baseNorm(nome);
  const amplo = loose(nome);

  for (const campo of ["strict", "loose"] as const) {
    const chave = campo === "strict" ? exato : amplo;
    if (!chave) continue;
    const candidatos = indice.filter((c) => c[campo] === chave);
    const ids = new Set(candidatos.map((c) => c.id));
    if (ids.size === 1) return candidatos[0].id;
    if (ids.size > 1) return melhor(candidatos).id;
  }

  if (amplo.length >= 5) {
    const candidatos = indice.filter(
      (c) => !!c.loose && (c.loose.startsWith(amplo) || amplo.startsWith(c.loose)),
    );
    const ids = new Set(candidatos.map((c) => c.id));
    if (ids.size === 1) return candidatos[0].id;
  }

  return null;
}
