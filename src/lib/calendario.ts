/** dias úteis do calendário da rota (segunda a sexta, salvo configuração em contrário) */
export const DIAS_UTEIS_PADRAO = [1, 2, 3, 4, 5];

/** domingo da Páscoa (algoritmo de Meeus/Jones/Butcher) */
function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function iso(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function somarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * 86400000);
}

/**
 * Feriados nacionais brasileiros (leis federais) do ano informado, no formato yyyy-mm-dd.
 * Inclui os móveis que dependem da Páscoa (Sexta-feira Santa).
 * Carnaval e Corpus Christi são pontos facultativos e não entram na lista.
 */
export function feriadosNacionais(ano: number): string[] {
  const pascoa = domingoDePascoa(ano);
  return [
    `${ano}-01-01`, // Confraternização Universal
    iso(somarDias(pascoa, -2)), // Sexta-feira Santa
    `${ano}-04-21`, // Tiradentes
    `${ano}-05-01`, // Dia do Trabalho
    `${ano}-09-07`, // Independência
    `${ano}-10-12`, // Nossa Senhora Aparecida
    `${ano}-11-02`, // Finados
    `${ano}-11-15`, // Proclamação da República
    `${ano}-11-20`, // Consciência Negra (nacional desde 2024)
    `${ano}-12-25`, // Natal
  ];
}

/**
 * Conta os dias úteis de um mês (`yyyy-mm-01`) pelo calendário nacional:
 * de segunda a sexta, sem os feriados nacionais. Sábados e domingos nunca contam,
 * mesmo que existam lançamentos de coleta nesses dias.
 * Quando `ate` cai dentro desse mês, conta só até essa data (mês em andamento).
 */
export function diasUteisNoMes(
  mes: string,
  ate?: string | null,
  diasDaSemana: number[] = DIAS_UTEIS_PADRAO,
  considerarFeriados = true,
): number {
  const [ano, numeroMes] = mes.slice(0, 7).split("-").map(Number);
  if (!ano || !numeroMes) return 0;
  const ultimoDia = new Date(Date.UTC(ano, numeroMes, 0)).getUTCDate();
  const limite =
    ate && ate.slice(0, 7) === mes.slice(0, 7) ? Math.min(Number(ate.slice(8, 10)), ultimoDia) : ultimoDia;
  const dias = new Set(diasDaSemana);
  const feriados = new Set(considerarFeriados ? feriadosNacionais(ano) : []);
  let total = 0;
  for (let dia = 1; dia <= limite; dia++) {
    const data = new Date(Date.UTC(ano, numeroMes - 1, dia));
    if (!dias.has(data.getUTCDay())) continue;
    if (feriados.has(iso(data))) continue;
    total += 1;
  }
  return total;
}

/** feriados nacionais que caíram em dia útil no mês (para mostrar na tela) */
export function feriadosNoMes(mes: string): string[] {
  const [ano, numeroMes] = mes.slice(0, 7).split("-").map(Number);
  if (!ano || !numeroMes) return [];
  return feriadosNacionais(ano).filter((data) => {
    if (Number(data.slice(5, 7)) !== numeroMes) return false;
    const diaDaSemana = new Date(`${data}T00:00:00Z`).getUTCDay();
    return diaDaSemana >= 1 && diaDaSemana <= 5;
  });
}

/**
 * Dias úteis entre duas datas (yyyy-mm-dd), inclusive, pelo calendário nacional:
 * segunda a sexta, sem feriados. Sábados e domingos nunca contam.
 */
export function diasUteisNoPeriodo(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  let total = 0;
  const cursor = new Date(`${inicio}T00:00:00Z`);
  const limite = new Date(`${fim}T00:00:00Z`).getTime();
  const feriados = new Set(feriadosNacionais(cursor.getUTCFullYear()).concat(
    feriadosNacionais(cursor.getUTCFullYear() + 1),
  ));
  while (cursor.getTime() <= limite) {
    const diaSemana = cursor.getUTCDay();
    if (diaSemana >= 1 && diaSemana <= 5 && !feriados.has(iso(cursor))) total += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return total;
}
