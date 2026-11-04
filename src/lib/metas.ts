/** Metas do acompanhamento: metas diárias por segmento e a meta do mês. */
import { diasUteisNoMes } from "./calendario";
import type { Settings } from "./types";

/** a partir deste mês o Porta a Porta passou a ter meta diária */
export const MES_INICIO_META_PAP = "2026-10";

export interface MetasDoDia {
  rollon: number;
  poli: number;
  pap: number;
  terceiro: number;
  total: number;
}

/** metas de um dia útil no mês informado (yyyy-mm ou yyyy-mm-dd) */
export function metasDoDia(settings: Settings, mes: string): MetasDoDia {
  const referencia = mes.slice(0, 7);
  const rollon = settings.metaDiaRollon ?? 260;
  const poli = settings.metaDiaPoli ?? 60;
  const terceiro = settings.metaDiaTerceiro ?? 8.5;
  const pap = referencia >= MES_INICIO_META_PAP ? (settings.metaDiaPap ?? 10) : 0;
  return { rollon, poli, pap, terceiro, total: rollon + poli + pap + terceiro };
}

/** dias úteis do mês (seg a sex, sem feriados nacionais) — mês inteiro ou até a data */
export function diasUteisDoMes(settings: Settings, mes: string, ate?: string | null): number {
  return diasUteisNoMes(mes, ate ?? null, settings.workingDays);
}

/** meta do mês = metas diárias de cada segmento × dias úteis do mês */
export function metaDoMes(settings: Settings, mes: string, ate?: string | null): number {
  const dias = diasUteisDoMes(settings, mes, ate);
  return Math.round(metasDoDia(settings, mes).total * dias * 10) / 10;
}

/** soma das metas dos 12 meses do ano (dias úteis mudam de mês para mês) */
export function metaDoAno(settings: Settings, ano: number): number {
  let total = 0;
  for (let m = 1; m <= 12; m++) {
    const mes = `${ano}-${String(m).padStart(2, "0")}-01`;
    total += metaDoMes(settings, mes);
  }
  return Math.round(total * 10) / 10;
}
