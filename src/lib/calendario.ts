/** dias úteis do calendário da rota (segunda a sexta, salvo configuração em contrário) */
export const DIAS_UTEIS_PADRAO = [1, 2, 3, 4, 5];

/**
 * Conta os dias úteis de um mês (`yyyy-mm-01`).
 * Quando `ate` cai dentro desse mês, conta só até essa data (mês em andamento).
 */
export function diasUteisNoMes(
  mes: string,
  ate?: string | null,
  diasDaSemana: number[] = DIAS_UTEIS_PADRAO,
): number {
  const [ano, numeroMes] = mes.slice(0, 7).split("-").map(Number);
  if (!ano || !numeroMes) return 0;
  const ultimoDia = new Date(Date.UTC(ano, numeroMes, 0)).getUTCDate();
  const limite =
    ate && ate.slice(0, 7) === mes.slice(0, 7) ? Math.min(Number(ate.slice(8, 10)), ultimoDia) : ultimoDia;
  const dias = new Set(diasDaSemana);
  let total = 0;
  for (let dia = 1; dia <= limite; dia++) {
    if (dias.has(new Date(Date.UTC(ano, numeroMes - 1, dia)).getUTCDay())) total += 1;
  }
  return total;
}
