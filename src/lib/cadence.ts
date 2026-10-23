import type { Client, Tier } from "./types";
import { cadenceFreqRS, cadenceLastAtRS } from "@/data/cadenciaRS";

const FREQ_MAP = new Map(cadenceFreqRS.map((r) => [r.key, r.freq]));
const LAST_MAP = new Map(cadenceLastAtRS.map((r) => [r.key, r.lastAt]));

/** normaliza o nome-base (mesma regra usada na carteira/segmentos) */
function keyOf(name: string): string {
  return name
    .split(" - ")[0]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Grupo por cadência: 4x/mês = A (alta), 3 = B, 2 = C, menos que 2 = D */
export function tierOfFreq(freq: number): Tier {
  if (freq >= 4) return "A";
  if (freq >= 3) return "B";
  if (freq >= 2) return "C";
  return "D";
}

export function cadenceLabel(freq: number): string {
  if (freq <= 0) return "Fora da rota";
  if (freq >= 4) return "4x/mês";
  if (freq >= 3) return "3x/mês";
  if (freq >= 2) return "2x/mês";
  if (freq === 1) return "1x/mês";
  if (freq === 0.5) return "1x/2 meses";
  return "1x/3 meses";
}

/** intervalo "ideal" entre visitas conforme a cadência (dias) */
export function intervalDays(freq: number): number {
  if (freq <= 0) return 0;
  if (freq >= 4) return 7;
  return Math.min(120, Math.max(7, Math.round(30 / freq)));
}

export function tierPriority(t: Tier): number {
  return t === "A" ? 4 : t === "B" ? 3 : t === "C" ? 2 : 1;
}

/**
 * Aplica a cadência da planilha nos clientes (frequência mensal, grupo e data
 * da última troca — só preenche/avança quando não houver data mais recente).
 */
export function applyCadenceData(clients: Client[]): Client[] {
  return clients.map((c) => {
    const k = keyOf(c.name);
    const freq = FREQ_MAP.get(k);
    const next = { ...c };
    if (freq !== undefined) {
      next.freqMonth = freq;
      next.tier = tierOfFreq(freq);
    }
    const last = LAST_MAP.get(k);
    if (last && (!next.lastCollectAt || last > next.lastCollectAt)) {
      next.lastCollectAt = last;
    }
    return next;
  });
}
