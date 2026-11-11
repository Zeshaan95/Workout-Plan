import { PLAN, type DailyTargets } from '../plan';
import { addDays, type ISODate } from './dates';
import { dayPlan, type FootballMap } from './schedule';

export interface HabitDay {
  date: ISODate;
  kcal?: number | null;
  protein?: number | null;
  steps?: number | null;
  waterL?: number | null;
  sleepH?: number | null;
  sessionDone?: boolean;
  creatine?: boolean;
}

export type HabitKey = 'kcal' | 'protein' | 'steps' | 'water' | 'sleep' | 'creatine' | 'session';

export const HABIT_LABELS: Record<HabitKey, string> = {
  kcal: 'Calories',
  protein: 'Protein',
  steps: 'Steps',
  water: 'Water',
  sleep: 'Sleep',
  creatine: 'Creatine',
  session: 'Session done',
};

/** Whether each habit was met; `null` = not applicable (e.g. session on a rest day). */
export function habitResults(h: HabitDay | undefined, t: DailyTargets, isRestDay: boolean): Record<HabitKey, boolean | null> {
  return {
    kcal: h?.kcal != null ? h.kcal >= t.kcalFloor && h.kcal <= t.kcal : false,
    protein: h?.protein != null ? h.protein >= t.proteinMin : false,
    steps: h?.steps != null ? h.steps >= t.steps : false,
    water: h?.waterL != null ? h.waterL >= t.waterMin : false,
    sleep: h?.sleepH != null ? h.sleepH >= t.sleepMin : false,
    creatine: !!h?.creatine,
    session: isRestDay ? null : !!h?.sessionDone,
  };
}

/** Weekly adherence: met ÷ applicable habits across the days of the week up to `today`. */
export function weeklyAdherence(
  weekStartDate: ISODate,
  today: ISODate,
  habits: HabitDay[],
  t: DailyTargets,
  football: FootballMap,
): { met: number; possible: number; pct: number | null } {
  let met = 0;
  let possible = 0;
  const byDate = new Map(habits.map((h) => [h.date, h]));
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStartDate, i);
    if (d > today) break;
    const res = habitResults(byDate.get(d), t, dayPlan(d, football).isRest);
    for (const v of Object.values(res)) {
      if (v === null) continue;
      possible++;
      if (v) met++;
    }
  }
  return { met, possible, pct: possible ? Math.round((met / possible) * 100) : null };
}

export function defaultTargets(): DailyTargets {
  return { ...PLAN.dailyTargets };
}
