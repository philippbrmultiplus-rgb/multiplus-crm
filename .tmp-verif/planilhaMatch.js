/**
 * Casamento entre o nome usado nas planilhas de coleta e o cadastro de clientes.
 * Segue as mesmas regras usadas na importação histórica, para que os números
 * continuem caindo no mesmo cliente:
 *   1. nome exato (sem acento/pontuação);
 *   2. nome exato ignorando PLN/LTDA/ME/SA;
 *   3. nome truncado (prefixo) desde que aponte para um único cliente;
 *   4. sem cadastro -> a linha fica só com o nome da planilha.
 */
function baseNorm(texto) {
    return texto
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function loose(texto) {
    return baseNorm(texto)
        .replace(/\b(PLN|PNL|LTDA|ME|EIRELI|SA)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
/** cliente mais completo (endereço mais detalhado) e, no empate, o de menor número */
function melhor(candidatos) {
    const indice = (id) => Number(id.replace(/\D/g, "")) || 0;
    return [...candidatos].sort((a, b) => (b.address ?? "").length - (a.address ?? "").length ||
        indice(a.id) - indice(b.id) ||
        a.id.localeCompare(b.id))[0];
}
export function indexarClientes(clientes) {
    return clientes.map((c) => ({ ...c, strict: baseNorm(c.name), loose: loose(c.name) }));
}
export function casarCliente(nome, indice) {
    if (!nome)
        return null;
    const exato = baseNorm(nome);
    const amplo = loose(nome);
    for (const campo of ["strict", "loose"]) {
        const chave = campo === "strict" ? exato : amplo;
        if (!chave)
            continue;
        const candidatos = indice.filter((c) => c[campo] === chave);
        const ids = new Set(candidatos.map((c) => c.id));
        if (ids.size === 1)
            return candidatos[0].id;
        if (ids.size > 1)
            return melhor(candidatos).id;
    }
    if (amplo.length >= 5) {
        const candidatos = indice.filter((c) => !!c.loose && (c.loose.startsWith(amplo) || amplo.startsWith(c.loose)));
        const ids = new Set(candidatos.map((c) => c.id));
        if (ids.size === 1)
            return candidatos[0].id;
    }
    return null;
}
/**
 * Planilhas em que o mesmo cliente aparece com vários endereços (ex.: as cooperativas
 * HAVILA): usa a coluna de endereço para escolher qual cadastro recebe cada lançamento.
 * Só devolve cliente quando o endereço aponta para um único cadastro.
 */
export function casarClientePeloEndereco(clienteColuna, endereco, indice) {
    const tokensEndereco = loose(endereco)
        .split(" ")
        .filter((t) => t.length > 2);
    if (tokensEndereco.length === 0)
        return null;
    const tokensCliente = loose(clienteColuna)
        .split(" ")
        .filter((t) => t.length > 2 && t !== "COOPERATIVA");
    let candidatos = indice.filter((c) => tokensEndereco.every((t) => c.loose.includes(t)));
    if (tokensCliente.length > 0) {
        candidatos = candidatos.filter((c) => tokensCliente.some((t) => c.loose.includes(t)));
    }
    const ids = new Set(candidatos.map((c) => c.id));
    return ids.size === 1 ? candidatos[0].id : null;
}
