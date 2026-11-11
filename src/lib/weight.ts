import { PLAN } from '../plan';
import { addDays, diffDays, toUTC, type ISODate } from './dates';

export interface WeighIn {
  id?: number;
  date: ISODate;
  /** "HH:mm" */
  time: string;
  kg: number;
  note?: string;
}

export type DailyMap = Map<ISODate, number>;

/** Rule 1: one reading per day — the earliest. */
export function dailyReadings(weighIns: WeighIn[]): DailyMap {
  const best = new Map<ISODate, WeighIn>();
  for (const w of weighIns) {
    const cur = best.get(w.date);
    if (!cur || (w.time || '99:99') < (cur.time || '99:99')) best.set(w.date, w);
  }
  const out: DailyMap = new Map();
  [...best.keys()].sort().forEach((d) => out.set(d, best.get(d)!.kg));
  return out;
}

/** Rule 1: mean of daily readings in the 7 days ending on `date`; null if fewer than 3. */
export function sevenDayAverage(daily: DailyMap, date: ISODate): number | null {
  const { avgWindowDays, avgMinReadings } = PLAN.rules;
  const vals: number[] = [];
  for (let i = 0; i < avgWindowDays; i++) {
    const v = daily.get(addDays(date, -i));
    if (v != null) vals.push(v);
  }
  if (vals.length < avgMinReadings) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Linearly interpolated 7-day-average target. Null before the plan start; goal weight after the end. */
export function targetFor(date: ISODate): number | null {
  const path = PLAN.targetPath;
  if (date < path[0].date) return null;
  const last = path[path.length - 1];
  if (date >= last.date) return last.kg;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (date >= a.date && date <= b.date) {
      const span = diffDays(a.date, b.date);
      const t = diffDays(a.date, date) / span;
      return a.kg + (b.kg - a.kg) * t;
    }
  }
  return null;
}

export type Status = 'on-track' | 'behind' | 'ahead';

/** Rule 2. */
export function weeklyStatus(avg: number, target: number): Status {
  const diff = avg - target;
  const tol = PLAN.rules.statusToleranceKg + 1e-9;
  if (diff > tol) return 'behind';
  if (diff < -tol) return 'ahead';
  return 'on-track';
}

export const STATUS_LABEL: Record<Status, string> = {
  'on-track': 'On track',
  behind: 'Behind',
  ahead: 'Ahead',
};

/** Rule 3 loss rate in kg/week; null if there is no 7-day average today. */
export function weeklyLossRate(daily: DailyMap, date: ISODate): number | null {
  const now = sevenDayAverage(daily, date);
  if (now == null) return null;
  const before = sevenDayAverage(daily, addDays(date, -14)) ?? PLAN.startKg;
  return (before - now) / 2;
}

export interface Projection {
  /** kg per day (negative = losing). */
  slopePerDay: number;
  /** Trend value today. */
  current: number;
  milestones: { id: string; label: string; kg: number; date: ISODate | null; reached: boolean }[];
}

/** Rule 8: least-squares trend over the last 14 days of daily readings. */
export function projectMilestones(daily: DailyMap, today: ISODate): Projection | null {
  const { projectionWindowDays, projectionMinReadings } = PLAN.rules;
  const pts: [number, number][] = [];
  for (let i = 0; i < projectionWindowDays; i++) {
    const d = addDays(today, -i);
    const v = daily.get(d);
    if (v != null) pts.push([-i, v]);
  }
  if (pts.length < projectionMinReadings) return null;
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p[0], 0) / n;
  const my = pts.reduce((a, p) => a + p[1], 0) / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of pts) {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  const current = my + slope * (0 - mx);
  return {
    slopePerDay: slope,
    current,
    milestones: PLAN.milestones.map((m) => {
      if (current <= m.kg) return { ...m, date: null, reached: true };
      if (slope >= 0) return { ...m, date: null, reached: false };
      const days = Math.ceil((current - m.kg) / -slope);
      return { ...m, date: addDays(today, days), reached: false };
    }),
  };
}

/** Next milestone not yet reached at `kg`. */
export function nextMilestone(kg: number) {
  return PLAN.milestones.find((m) => kg > m.kg) ?? null;
}

/** Points for charts: x = UTC ms. */
export function chartX(date: ISODate): number {
  return toUTC(date);
}

/** BMI from weight and height. */
export function bmi(kg: number, heightCm: number): number {
  const m = heightCm / 100;
  return kg / (m * m);
}
