import type { Client } from "./types";
import { segmentosRS } from "@/data/segmentosRS";

/** remove acentos, caixa alta e colapsa espaços */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

const SEGMENT_LABELS: Record<string, string> = {
  ROLLON: "Roll-on",
  POLI: "Poli",
  "PORTA A PORTA": "Porta a porta",
  ESPORÁDICO: "Esporádico",
  ESPORADICO: "Esporádico",
  TERCEIRO: "Terceiro",
  "CARREGAMENTO NA HORA": "Carregamento na hora",
};

export function cleanSegmento(raw: string): string {
  const key = norm(raw);
  return SEGMENT_LABELS[key] ?? raw.trim();
}

/** nome-base de uma linha da planilha (parte antes de " - cidade/rua"). */
export function baseNameOf(raw: string): string {
  let s = raw.split(" - ")[0].trim();
  // remove cidade/estado colados ao nome (ex.: "DECORACOES-POA", "-POA.")
  s = s.replace(/\s*[-–]\s*(POA\.?|PR|RS|PORTO ALEGRE)$/i, "").trim();
  return norm(s);
}

/** trecho de rua da linha da planilha (para desempatar duplicados). */
function streetHint(raw: string): string {
  const parts = raw.split(" - ").slice(1);
  const tail = parts
    .filter((p) => !/^(POA\.?|PR|RS|PORTO ALEGRE|CO COMERCIAL|CL COLETA|RP COLETA \d|BY C JUDITE|QÇ|HT|ZÁ|ESPORÁDICO)/i.test(norm(p)))
    .join(" ");
  return norm(tail);
}

function cityOf(raw: string): string {
  if (/PORTO ALEGRE/i.test(raw)) return "POA";
  if (/\bPOA\.?\b/i.test(raw)) return "POA";
  if (/ - PR /i.test(raw)) return "PR";
  return "POA";
}

interface Row {
  key: string;
  segmento: string;
  raw: string;
}

function buildRows(): Row[] {
  const rows: Row[] = [];
  for (const r of segmentosRS) {
    const key = baseNameOf(r.cliente);
    if (!key || key.length < 3) continue;
    rows.push({ key, segmento: cleanSegmento(r.segmento), raw: r.cliente });
  }
  return rows;
}

/**
 * Atualiza o segmento dos clientes existentes conforme as planilhas e inclui
 * clientes que aparecem nelas mas ainda não estão na carteira. Idempotente.
 */
export function applySegmentData(clients: Client[]): Client[] {
  const rows = buildRows();
  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byKey.has(r.key)) byKey.set(r.key, []);
    byKey.get(r.key)!.push(r);
  }

  const updated = clients.map((c) => ({ ...c }));
  const present = new Set(updated.map((c) => norm(c.name)));

  for (const c of updated) {
    const candidates = byKey.get(norm(c.name));
    if (!candidates) continue;
    let best = candidates[0];
    let bestScore = -1;
    const haystack = norm(`${c.address} ${c.city}`);
    for (const cand of candidates) {
      const hint = streetHint(cand.raw);
      let score = 0;
      if (hint) {
        for (const word of hint.split(" ")) {
          if (word.length > 3 && haystack.includes(word)) score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    if (best.segmento) c.segment = best.segmento;
  }

  // inclui clientes das planilhas que não existem na carteira
  let idx = 0;
  for (const [key, cands] of byKey) {
    if (present.has(key)) continue;
    const row = cands[0];
    const street = streetHint(row.raw);
    updated.push({
      id: `cli-seg-${idx}-${Date.now().toString(36)}`,
      name: key,
      segment: row.segmento,
      address: street || "",
      city: cityOf(row.raw),
      state: "RS",
      active: true,
      total2025: 0,
      total2026: 0,
      avgMonthly: 0,
      tier: "C",
      freqMonth: 0.5,
      lat: null,
      lng: null,
      geocodeStatus: "pendente",
    });
    present.add(key);
    idx++;
  }

  return updated;
}
