/**
 * Metas de cada mês: o coordenador ajusta as metas diárias de um mês e elas
 * valem só para aquele mês (os outros meses ficam como estavam).
 */
import { diasUteisNoMes } from "./calendario";
import type { MetaMes, Settings } from "./types";

/** a partir deste mês o Porta a Porta passou a ter meta diária */
export const MES_INICIO_META_PAP = "2026-10";

export interface MetasDoDia {
  rollon: number;
  poli: number;
  pap: number;
  terceiro: number;
  total: number;
}

const numero = (v: number) => (Number.isFinite(v) ? v : 0);

/** metas de um dia útil no mês informado (yyyy-mm ou yyyy-mm-dd) */
export function metasDoMes(metas: MetaMes[], mes: string, settings: Settings): MetasDoDia {
  const referencia = mes.slice(0, 7);
  const doMes = metas.find((m) => m.mes.slice(0, 7) === referencia);
  if (doMes) {
    const rollon = numero(doMes.rollon);
    const poli = numero(doMes.poli);
    const pap = numero(doMes.pap);
    const terceiro = numero(doMes.terceiro);
    return { rollon, poli, pap, terceiro, total: rollon + poli + pap + terceiro };
  }

  // mês ainda sem metas cadastradas: usa o padrão das configurações
  const rollon = settings.metaDiaRollon ?? 260;
  const poli = settings.metaDiaPoli ?? 60;
  const terceiro = settings.metaDiaTerceiro ?? 8.5;
  const pap =
    referencia >= MES_INICIO_META_PAP ? (settings.metaDiaPap ?? 10) : 0;
  return { rollon, poli, pap, terceiro, total: rollon + poli + pap + terceiro };
}

/** dias úteis do mês (seg a sex, sem feriados nacionais) — mês inteiro ou até a data */
export function diasUteisDoMes(settings: Settings, mes: string, ate?: string | null): number {
  return diasUteisNoMes(mes, ate ?? null, settings.workingDays);
}

/** meta do mês = metas diárias de cada segmento × dias úteis do mês */
export function metaDoMes(
  metas: MetaMes[],
  mes: string,
  settings: Settings,
  ate?: string | null,
): number {
  const dias = diasUteisDoMes(settings, mes, ate);
  return Math.round(metasDoMes(metas, mes, settings).total * dias * 10) / 10;
}

/** soma das metas dos 12 meses do ano (cada mês com os seus dias úteis e metas) */
export function metaDoAno(metas: MetaMes[], ano: number, settings: Settings): number {
  let total = 0;
  for (let m = 1; m <= 12; m++) {
    const mes = `${ano}-${String(m).padStart(2, "0")}-01`;
    total += metaDoMes(metas, mes, settings);
  }
  return Math.round(total * 10) / 10;
}
