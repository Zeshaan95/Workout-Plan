import { PLAN } from '../plan';

const { kgPerStone, lbPerKg } = PLAN.units;

export function kgToLb(kg: number): number {
  return kg * lbPerKg;
}

export function stoneToKg(st: number): number {
  return st * kgPerStone;
}

/** Split kg into whole stones and pounds (pounds rounded to the nearest whole pound). */
export function kgToStLb(kg: number): { st: number; lb: number; negative: boolean } {
  const negative = kg < 0;
  const totalLb = Math.round(Math.abs(kgToLb(kg)));
  return { st: Math.floor(totalLb / 14), lb: totalLb % 14, negative };
}

/** "15 st 4 lb" */
export function formatStLb(kg: number): string {
  const { st, lb, negative } = kgToStLb(kg);
  const sign = negative ? '−' : '';
  if (st === 0) return `${sign}${lb} lb`;
  return `${sign}${st} st ${lb} lb`;
}

export function formatKg(kg: number, dp = 1): string {
  return `${kg.toFixed(dp)} kg`;
}

export function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
