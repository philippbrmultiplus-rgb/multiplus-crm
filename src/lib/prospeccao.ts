import { daysSinceToday } from "@/lib/geo";
import type { ProspeccaoStatus, Visit } from "@/lib/types";

/** dias sem definição a partir dos quais a prospecção entra em alerta */
export const DIAS_SEM_DEFINICAO = 15;

/** situação exibida na tela de prospecções (inclui o alerta "sem definição") */
export type SituacaoProspeccao = ProspeccaoStatus | "sem_definicao";

/** ordem em que as situações aparecem na tela */
export const SITUACOES: SituacaoProspeccao[] = [
  "em_negociacao",
  "sem_definicao",
  "fechado",
  "proposta_recusada",
];

export const SITUACAO_LABEL: Record<SituacaoProspeccao, string> = {
  em_negociacao: "Em negociação",
  sem_definicao: `Sem definição há ${DIAS_SEM_DEFINICAO}+ dias`,
  fechado: "Fechado",
  proposta_recusada: "Proposta recusada",
};

export const SITUACAO_TONE: Record<SituacaoProspeccao, string> = {
  em_negociacao: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  sem_definicao: "border border-destructive/50 bg-destructive/10 text-destructive",
  fechado: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  proposta_recusada: "bg-muted text-muted-foreground",
};

/** dias desde o registro da prospecção (visita mais recente de cada cliente) */
export function diasRegistroPorCliente(visits: Visit[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const v of visits) {
    const d = daysSinceToday(v.visitedAt.slice(0, 10));
    if (d == null) continue;
    const atual = map.get(v.clientId);
    if (atual == null || d < atual) map.set(v.clientId, d);
  }
  return map;
}

/**
 * situação atual da prospecção: fechado/proposta recusada são finais; em negociação há
 * mais de {@link DIAS_SEM_DEFINICAO} dias vira alerta "sem definição"
 */
export function situacaoOf(
  status: ProspeccaoStatus | null | undefined,
  diasDoRegistro: number | null,
): SituacaoProspeccao {
  if (status === "fechado" || status === "proposta_recusada") return status;
  return diasDoRegistro != null && diasDoRegistro >= DIAS_SEM_DEFINICAO ? "sem_definicao" : "em_negociacao";
}
