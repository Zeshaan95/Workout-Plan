import { PLAN } from '../plan';
import { rangeDays, toUTC, type ISODate } from './dates';
import { sevenDayAverage, targetFor, type DailyMap } from './weight';
import { bestE1RM, completedSets, exerciseHistory, topSetWeight, totalReps, type WorkoutLog } from './workouts';

export interface WeightRow {
  x: number;
  date: ISODate;
  reading: number | null;
  avg: number | null;
  target: number | null;
}

/** One row per day from the first history reading to the later of today and the plan end. */
export function weightChartData(daily: DailyMap, today: ISODate): WeightRow[] {
  const first = [...daily.keys()].sort()[0] ?? PLAN.historyStart;
  const start = first < PLAN.historyStart ? first : PLAN.historyStart;
  const end = today > PLAN.endDate ? today : PLAN.endDate;
  return rangeDays(start, end).map((date) => ({
    x: toUTC(date),
    date,
    reading: daily.get(date) ?? null,
    avg: date <= today ? sevenDayAverage(daily, date) : null,
    target: date <= PLAN.endDate ? targetFor(date) : null,
  }));
}

export function liftChartData(logs: WorkoutLog[], exerciseId: string) {
  return exerciseHistory(logs, exerciseId).map((h) => ({
    x: toUTC(h.date),
    date: h.date,
    top: topSetWeight(h.entry),
    e1rm: (() => {
      const v = bestE1RM(h.entry);
      return v != null ? Math.round(v * 10) / 10 : null;
    })(),
  }));
}

export function repChartData(logs: WorkoutLog[], exerciseId: string) {
  return exerciseHistory(logs, exerciseId).map((h) => {
    const packs = completedSets(h.entry).map((s) => s.backpackKg ?? 0);
    return { x: toUTC(h.date), date: h.date, reps: totalReps(h.entry), pack: packs.length ? Math.max(...packs) : 0 };
  });
}
