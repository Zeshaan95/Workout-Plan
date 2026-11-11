import { PLAN, WEEK_TYPES, type DayPlanDef, type SessionId, type WeekType } from '../plan';
import { addDays, diffDays, isBetween, weekdayIndex, type ISODate } from './dates';

/** Week number 1–12 for a date, or null if outside the plan. */
export function weekNumber(date: ISODate): number | null {
  const d = diffDays(PLAN.startDate, date);
  if (d < 0) return null;
  const w = Math.floor(d / 7) + 1;
  return w > PLAN.totalWeeks ? null : w;
}

export function weekStart(week: number): ISODate {
  return addDays(PLAN.startDate, (week - 1) * 7);
}

/** The Sunday check-in that ends a plan week. */
export function weekSunday(week: number): ISODate {
  return addDays(weekStart(week), 6);
}

export function isFestive(date: ISODate): boolean {
  return isBetween(date, PLAN.festive.start, PLAN.festive.end);
}

export function isPullupTestDay(date: ISODate): boolean {
  return PLAN.pullupTestDays.includes(date);
}

export function isWaistSunday(date: ISODate): boolean {
  if (date === PLAN.waist.baselineDate) return true;
  const d = diffDays(PLAN.waist.firstSunday, date);
  return d >= 0 && d % PLAN.waist.everyDays === 0 && date <= PLAN.endDate;
}

/** Football defaults to yes unless the week has been switched off. */
export type FootballMap = Record<number, boolean | undefined>;

export function weekTypeFor(week: number | null, football: FootballMap): WeekType {
  if (week == null) return 'football';
  return football[week] === false ? 'noFootball' : 'football';
}

/** Jog target in minutes for a plan week: +5 min every fortnight, capped. */
export function jogTarget(week: number): { min: number; max: number } {
  const j = PLAN.jog;
  const steps = Math.floor((Math.max(week, 1) - 1) / j.everyWeeks);
  return {
    min: Math.min(j.startMin + steps * j.stepMin, j.capMin),
    max: Math.min(j.startMax + steps * j.stepMin, j.capMax),
  };
}

export interface DayPlan extends DayPlanDef {
  date: ISODate;
  week: number | null;
  weekType: WeekType;
  isTestDay: boolean;
  isFestive: boolean;
  isRest: boolean;
  notes: string[];
}

const REST: SessionId[] = ['restCook', 'restSteps'];

/** The session for any date, with week type, test days and the festive fortnight applied. */
export function dayPlan(date: ISODate, football: FootballMap = {}): DayPlan {
  const week = weekNumber(date);
  const weekType = weekTypeFor(week, football);
  const dow = weekdayIndex(date);
  const base = WEEK_TYPES[weekType][dow];
  const festive = isFestive(date);
  const testDay = isPullupTestDay(date) && base.session === 'strengthB';
  const notes = [...(base.notes ?? [])];
  let when = base.when;
  let length = base.length;

  if (festive && dow <= 4 && PLAN.festive.movableSessions.includes(base.session)) {
    when = PLAN.festive.weekdayTime;
    notes.push('Festive fortnight: weekday sessions move to 10:00–11:30');
  }
  if (base.session === 'jog' && week != null) {
    const t = jogTarget(week);
    length = `${t.min}–${t.max} min`;
    if (week <= PLAN.jog.everyWeeks) notes.push(PLAN.jog.startNote);
    notes.push(`Jog progression: aim for ${t.min}–${t.max} min this week (cap 35–40 min)`);
  }
  if (testDay) {
    notes.unshift(`Pull-up max test today: do it first, before any other sets, strict reps only (previous best ${PLAN.previousPullupBest})`);
  }

  return {
    ...base,
    when,
    length,
    date,
    week,
    weekType,
    isTestDay: testDay,
    isFestive: festive,
    isRest: REST.includes(base.session),
    notes,
  };
}

export function weekPlan(week: number, football: FootballMap = {}): DayPlan[] {
  const start = weekStart(week);
  return Array.from({ length: 7 }, (_, i) => dayPlan(addDays(start, i), football));
}

/** Week overlaps the festive fortnight (used to nudge the football switch). */
export function weekIsFestive(week: number): boolean {
  const s = weekStart(week);
  const e = weekSunday(week);
  return s <= PLAN.festive.end && e >= PLAN.festive.start;
}

export function daysLeft(today: ISODate): number {
  return Math.max(0, diffDays(today, PLAN.endDate));
}
