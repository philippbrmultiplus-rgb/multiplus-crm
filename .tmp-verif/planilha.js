import { supabase } from "./stub.js";
import { casarCliente, indexarClientes } from "./planilhaMatch.js";
/** planilha de coletas (PAULINIA.xlsx), publicada junto com o app */
const URL_PLANILHA = "/pln-planilha.json";
function diasEntre(a, b) {
    return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}
/** média de dias entre uma coleta e a seguinte (null quando só há uma coleta) */
function mediaDeDias(datas) {
    if (datas.length < 2)
        return null;
    let total = 0;
    for (let i = 1; i < datas.length; i++)
        total += diasEntre(datas[i - 1], datas[i]);
    return Math.round((total / (datas.length - 1)) * 10) / 10;
}
/**
 * Identificador estável a partir do nome da planilha: como ele não depende da posição,
 * incluir nomes novos em uma atualização não desloca as linhas que já existem.
 */
function slugDoNome(nome) {
    return nome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
/** agrupa as coletas por nome da planilha, aplicando antes as atualizações enviadas */
/**
 * Junta a planilha base com os lançamentos enviados pelo app: o que veio depois
 * manda nas datas que ele cobre, as demais datas continuam como estavam.
 */
function coletasPorNome(arquivo, lancamentos) {
    const porNome = new Map();
    const diasDe = (nome) => {
        const atual = porNome.get(nome);
        if (atual)
            return atual;
        const novo = new Map();
        porNome.set(nome, novo);
        return novo;
    };
    for (const linha of arquivo.clientes) {
        if (!linha || !Array.isArray(linha.coletas))
            continue;
        const dias = diasDe(linha.nome);
        for (const [data, volume, trocas] of linha.coletas) {
            const dia = String(data).slice(0, 10);
            const atual = dias.get(dia);
            if (atual) {
                atual.volume += Number(volume) || 0;
                atual.trocas += Number(trocas) || 1;
            }
            else {
                dias.set(dia, { volume: Number(volume) || 0, trocas: Number(trocas) || 1 });
            }
        }
    }
    for (const l of lancamentos) {
        const dia = String(l.data).slice(0, 10);
        if (!l.nome || !dia)
            continue;
        diasDe(l.nome).set(dia, {
            volume: Number(l.volume) || 0,
            trocas: Math.max(1, Number(l.trocas) || 1),
        });
    }
    return porNome;
}
/** converte a planilha (base + atualizações enviadas no app) em volumes, cadência e histórico */
export function calcularDados(arquivo, lancamentos = [], clientes = []) {
    const volumes = [];
    const cadence = [];
    const coletas = [];
    const ultimaColeta = {};
    const semCadastro = [];
    const porNome = [];
    let totalColetas = 0;
    // nome da planilha -> cliente do cadastro (a planilha base já vem resolvida; nomes
    // novos das atualizações são casados na hora, com os clientes carregados no app)
    const clienteDoNome = new Map();
    for (const linha of arquivo.clientes)
        clienteDoNome.set(linha.nome, linha.cliente ?? null);
    const indice = clientes.length > 0 ? indexarClientes(clientes) : [];
    const grupos = new Map();
    for (const [nome, dias] of coletasPorNome(arquivo, lancamentos)) {
        // o vínculo gravado na planilha base vale quando existe; se o cliente foi
        // cadastrado/renomeado depois (ou é nome novo), casa na hora com a carteira
        const daBase = clienteDoNome.get(nome) ?? null;
        const cliente = daBase ?? (indice.length > 0 ? casarCliente(nome, indice) : null);
        const chave = cliente ? `cli:${cliente}` : `sem:${nome}`;
        const grupo = grupos.get(chave) ?? { nome, cliente, dias: new Map() };
        for (const [dia, valor] of dias) {
            const atual = grupo.dias.get(dia);
            if (atual) {
                atual.volume += valor.volume;
                atual.trocas += valor.trocas;
            }
            else {
                grupo.dias.set(dia, { ...valor });
            }
        }
        grupos.set(chave, grupo);
    }
    for (const grupo of grupos.values()) {
        const datas = [...grupo.dias.keys()].sort();
        const prefixo = grupo.cliente ? `vol-${grupo.cliente}` : `vol-sem-${slugDoNome(grupo.nome)}`;
        const porMes = new Map();
        for (const data of datas) {
            const mes = `${data.slice(0, 7)}-01`;
            porMes.set(mes, (porMes.get(mes) ?? 0) + grupo.dias.get(data).volume);
            if (grupo.cliente) {
                coletas.push({
                    clientId: grupo.cliente,
                    collectDate: data,
                    volume: Math.round(grupo.dias.get(data).volume * 100) / 100,
                    trocas: grupo.dias.get(data).trocas,
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
        for (const [dia, valor] of grupo.dias) {
            porNome.push({
                nome: grupo.nome,
                data: dia,
                volume: Math.round(valor.volume * 100) / 100,
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
        if (grupo.cliente)
            ultimaColeta[grupo.cliente] = datas[datas.length - 1];
        else
            semCadastro.push(grupo.nome);
    }
    volumes.sort((a, b) => (a.id < b.id ? -1 : 1));
    cadence.sort((a, b) => (a.nomePlanilha ?? "").localeCompare(b.nomePlanilha ?? "", "pt-BR"));
    return {
        volumes,
        cadence,
        coletas,
        ultimaColeta,
        semCadastro,
        porNome,
        versao: arquivo.versao ?? null,
        periodo: arquivo.periodo ?? null,
        totalColetas,
    };
}
/** nome da planilha -> cliente vinculado, conforme a planilha base do app */
export async function carregarNomesDaBase() {
    try {
        const res = await fetch(URL_PLANILHA);
        if (!res.ok)
            return {};
        const arquivo = (await res.json());
        const mapa = {};
        for (const linha of arquivo?.clientes ?? [])
            mapa[linha.nome] = linha.cliente ?? null;
        return mapa;
    }
    catch {
        return {};
    }
}
/** lançamentos das atualizações semanais enviadas pelo app */
export async function carregarLancamentos() {
    const { data, error } = await supabase
        .from("planilha_lancamentos")
        .select("nome_planilha, collect_date, volume_m3, trocas");
    if (error) {
        console.warn("lançamentos da planilha:", error.message);
        return [];
    }
    return (data ?? []).map((r) => {
        const row = r;
        return {
            nome: String(row.nome_planilha ?? ""),
            data: String(row.collect_date ?? "").slice(0, 10),
            volume: Number(row.volume_m3 ?? 0),
            trocas: Number(row.trocas ?? 1) || 1,
        };
    });
}
/**
 * Busca a planilha base publicada com o app, junta as atualizações semanais
 * enviadas e devolve os números já calculados.
 */
export async function carregarPlanilha(clientes = []) {
    try {
        const res = await fetch(URL_PLANILHA);
        if (!res.ok)
            return null;
        const arquivo = (await res.json());
        if (!arquivo || !Array.isArray(arquivo.clientes))
            return null;
        const lancamentos = await carregarLancamentos();
        return calcularDados(arquivo, lancamentos, clientes);
    }
    catch (err) {
        console.warn("planilha de coletas não pôde ser lida:", err);
        return null;
    }
}
