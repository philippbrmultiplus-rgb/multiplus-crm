import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA = "MultiplusPortoAlegre/1.0 (geocodificacao interna)";

/** cidades que na planilha aparecem abreviadas */
const CIDADE: Record<string, string> = {
  POA: "Porto Alegre",
  "2 IRMAOS": "Dois Irmãos",
  "2 IRMÃOS": "Dois Irmãos",
  ESTANCIA: "Estância Velha",
  "NOVA HAMBURGO": "Novo Hamburgo",
  CACHOEIRINHA: "Cachoeirinha",
  GRAVATAI: "Gravataí",
  "SAO LEOPOLDO": "São Leopoldo",
  CANOAS: "Canoas",
  SAPUCAIA: "Sapucaia do Sul",
};

function limpar(endereco: string): string {
  return endereco
    .replace(/^endere[çc]o:\s*/i, "")
    .replace(/[–—]/g, ",")
    .replace(/cep\s*:?\s*\d{5}-?\d{3}/gi, "")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
}

function cidadeDe(cidade: string): string {
  const c = cidade.trim();
  const chave = c.toUpperCase();
  return CIDADE[chave] ?? c;
}

async function buscar(endereco: string): Promise<{ lat: number; lng: number } | null> {
  if (endereco.replace(/\s|,|-/g, "").length <= 6) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${
      encodeURIComponent(endereco)
    }`;
    const res = await fetch(url, { headers: { "Accept-Language": "pt-BR", "User-Agent": UA } });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data || !data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const offset = Number(body.offset ?? 0);
    const limit = Math.min(Number(body.limit ?? 20), 40);
    const dry = body.dry === true;

    // ferramenta de manutenção: exige confirmação explícita no corpo da chamada
    if (body.confirm !== "geocode-carteira") {
      return new Response(JSON.stringify({ error: "confirmacao obrigatoria" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const { data: clientes, error } = await db
      .from("clients")
      .select("id,name,address,city,state,lat,lng,geocodificacao:geocode_status,geo_aproximado")
      .not("address", "is", null)
      .neq("address", "")
      .order("id")
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("leitura de clientes falhou:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultados: Array<Record<string, unknown>> = [];

    for (const c of clientes ?? []) {
      const endereco = limpar(String(c.address ?? ""));
      const cidade = cidadeDe(String(c.city ?? ""));
      const uf = String(c.state ?? "RS").trim() || "RS";
      const temCoordenada = c.lat != null && c.lng != null;

      if (endereco.replace(/\s|,|-/g, "").length <= 6) {
        resultados.push({ id: c.id, nome: c.name, acao: "sem endereco" });
        continue;
      }

      // 1) endereço completo (normalmente já traz cidade/UF/CEP)
      // 2) endereço + cidade + UF
      // 3) endereço + Brasil
      const tentativas = [
        `${endereco}, Brasil`,
        `${endereco}, ${cidade}, ${uf}, Brasil`,
        `${endereco}, ${cidade}`,
      ];

      let achou: { lat: number; lng: number; nivel: string } | null = null;
      for (const q of tentativas) {
        const pos = await buscar(q);
        await esperar(1100);
        if (pos) {
          achou = { ...pos, nivel: "exato" };
          break;
        }
      }

      // 4) só a cidade — usado apenas quando o cliente ainda não tem coordenada
      if (!achou && !temCoordenada) {
        const pos = await buscar(`${cidade}, ${uf}, Brasil`);
        await esperar(1100);
        if (pos) achou = { ...pos, nivel: "cidade" };
      }

      if (!achou) {
        resultados.push({ id: c.id, nome: c.name, acao: temCoordenada ? "mantido" : "nao encontrado" });
        continue;
      }

      if (dry) {
        resultados.push({ id: c.id, nome: c.name, acao: achou.nivel, lat: achou.lat, lng: achou.lng });
        continue;
      }

      const { error: upErr } = await db
        .from("clients")
        .update({
          lat: achou.lat,
          lng: achou.lng,
          geocode_status: "ok",
          geo_aproximado: achou.nivel === "cidade",
          updated_at: new Date().toISOString(),
        })
        .eq("id", c.id);

      if (upErr) {
        console.error("gravar coordenadas falhou:", c.id, upErr.message);
        resultados.push({ id: c.id, nome: c.name, acao: `erro: ${upErr.message}` });
        continue;
      }
      resultados.push({ id: c.id, nome: c.name, acao: achou.nivel, lat: achou.lat, lng: achou.lng });
    }

    const conta = (a: string) => resultados.filter((r) => r.acao === a).length;
    return new Response(
      JSON.stringify({
        processados: resultados.length,
        exatos: conta("exato"),
        porCidade: conta("cidade"),
        mantidos: conta("mantido"),
        naoEncontrados: conta("nao encontrado"),
        resultados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("erro inesperado:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
