import type { Tier } from "./types";

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
