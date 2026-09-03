import { intervalDays } from "@/lib/cadence";
import { daysSinceToday } from "@/lib/geo";
import type { Client, Tier } from "@/lib/types";

export const TIER_LABEL: Record<Tier, string> = {
  A: "Grupo A · alta prioridade (4x/mês)",
  B: "Grupo B · 3x/mês",
  C: "Grupo C · 2x/mês",
  D: "Grupo D · <2x/mês",
};

/** A vem primeiro (maior prioridade). */
export const TIER_RANK: Record<Tier, number> = { A: 0, B: 1, C: 2, D: 3 };

export function tierBadgeClass(t: Tier): string {
  return t === "A"
    ? "tier-badge-a"
    : t === "B"
      ? "tier-badge-b"
      : t === "C"
        ? "tier-badge-c"
        : "tier-badge-d";
}

export function coletaDays(c: Client): number | null {
  return daysSinceToday(c.lastCollectAt);
}

/** Cliente está com a coleta atrasada (dias desde a última troca >= intervalo da cadência). */
export function isColetaOverdue(c: Client): boolean {
  if (c.freqMonth <= 0) return false;
  const days = coletaDays(c);
  return days != null && days >= intervalDays(c.freqMonth);
}

export type ClientSort = "grupo" | "atraso" | "volume" | "nome";

function daysRank(c: Client): number {
  const d = coletaDays(c);
  return d == null ? -1 : d;
}

/** compara para colocar A no topo e, dentro de cada grupo, quem está há mais tempo sem coleta primeiro */
export function compareClients(a: Client, b: Client, sort: ClientSort): number {
  switch (sort) {
    case "atraso":
      return daysRank(b) - daysRank(a) || TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.avgMonthly - a.avgMonthly;
    case "volume":
      return b.avgMonthly - a.avgMonthly || TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.name.localeCompare(b.name, "pt-BR");
    case "nome":
      return a.name.localeCompare(b.name, "pt-BR") || TIER_RANK[a.tier] - TIER_RANK[b.tier];
    case "grupo":
    default:
      return (
        TIER_RANK[a.tier] - TIER_RANK[b.tier] ||
        daysRank(b) - daysRank(a) ||
        b.avgMonthly - a.avgMonthly ||
        a.name.localeCompare(b.name, "pt-BR")
      );
  }
}
