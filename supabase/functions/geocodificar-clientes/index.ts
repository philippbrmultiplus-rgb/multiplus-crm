/**
 * Substituída por `geocode-carteira` (versão com normalização de endereço).
 * Mantida apenas para responder 410 e não gravar coordenadas com a lógica antiga.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ error: "função descontinuada — use geocode-carteira" }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
