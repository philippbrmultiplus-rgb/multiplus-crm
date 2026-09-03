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

export type ColetaStatus = "sem" | "ok" | "warn" | "late";

/**
 * Faixa de cor por dias sem coleta (regra definida pelo coordenador):
 * até 20 dias = verde (ok), 21 a 30 = laranja (warn), acima de 30 = vermelho (late).
 */
export function coletaStatus(c: Client): ColetaStatus {
  const d = coletaDays(c);
  if (d == null) return "sem";
  if (d > 30) return "late";
  if (d > 20) return "warn";
  return "ok";
}

/** chip colorido (badge) para a situação da coleta */
export const COLETA_BADGE_TONE: Record<ColetaStatus, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  late: "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
  sem: "",
};

/** badge outline (borda + texto coloridos) */
export const COLETA_OUTLINE_TONE: Record<ColetaStatus, string> = {
  ok: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  warn: "border-amber-500/40 text-amber-700 dark:text-amber-300",
  late: "border-destructive/40 text-destructive",
  sem: "",
};

/** texto simples colorido (ex.: linha de detalhe do cartão) */
export const COLETA_TEXT_TONE: Record<ColetaStatus, string> = {
  ok: "text-emerald-700 dark:text-emerald-300",
  warn: "text-amber-600 dark:text-amber-400",
  late: "text-destructive",
  sem: "text-muted-foreground",
};

/** atrasada = acima de 30 dias sem coleta */
export function isColetaOverdue(c: Client): boolean {
  return coletaStatus(c) === "late";
}

/** cor de "bolinha" para status de visita em calendários/listas */
export function rotaStatusDot(status: string): string {
  if (status === "concluida") return "bg-emerald-500";
  if (status === "nao_realizada") return "bg-slate-400";
  return "bg-amber-400";
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
