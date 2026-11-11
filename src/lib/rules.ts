/**
 * Rules 3 (adjustment advice) and 4 (week-4 check).
 */
import { PLAN } from '../plan';
import { addDays, diffDays, type ISODate } from './dates';
import { sevenDayAverage, targetFor, weeklyLossRate, type DailyMap } from './weight';

export type AdviceBand = 'not-yet' | 'no-data' | 'on-pace' | 'slow' | 'stalled' | 'too-fast' | 'other';

export interface AdviceAction {
  kind: 'addSteps' | 'cutKcal' | 'addCarbs' | 'foodAudit';
  amount?: number;
  text: string;
}

export interface Advice {
  band: AdviceBand;
  rate: number | null;
  headline: string;
  actions: AdviceAction[];
  notes: string[];
}

const NO_SIXTH_SESSION = 'Never add a sixth hard session: if you need more, add steps instead.';

function inSlowBand(rate: number | null): boolean {
  const r = PLAN.rules;
  return rate != null && rate >= r.slowMin && rate < r.onPaceMin;
}

/** Cut kcal from carbs or fat without going below the floor. Returns null if no cut is possible. */
export function kcalCut(currentKcal: number): AdviceAction | null {
  const { kcalCut: cut } = PLAN.rules;
  const floor = PLAN.dailyTargets.kcalFloor;
  const next = Math.max(floor, currentKcal - cut);
  const amount = currentKcal - next;
  if (amount <= 0) return null;
  return {
    kind: 'cutKcal',
    amount,
    text: `Cut ${amount} kcal from carbs or fat (to ${next.toLocaleString('en-GB')} kcal). Never cut protein, never below ${floor.toLocaleString('en-GB')} kcal.`,
  };
}

function stepsAction(): AdviceAction {
  const n = PLAN.rules.extraSteps;
  return { kind: 'addSteps', amount: n, text: `Add ${n.toLocaleString('en-GB')} steps a day.` };
}

export interface AdviceInput {
  daily: DailyMap;
  date: ISODate;
  liftsDown: boolean;
  currentKcal: number;
}

/** Rule 3: Sunday adjustment advice (from Sun 22 Nov 2026). */
export function adjustmentAdvice({ daily, date, liftsDown, currentKcal }: AdviceInput): Advice {
  const r = PLAN.rules;
  const notes = [NO_SIXTH_SESSION];
  if (date < r.adjustmentFrom) {
    return { band: 'not-yet', rate: null, headline: 'Adjustment advice starts on Sun 22 Nov 2026 (end of week 2).', actions: [], notes: [] };
  }
  const rate = weeklyLossRate(daily, date);
  if (rate == null) {
    return { band: 'no-data', rate, headline: 'Not enough data: log at least 3 weigh-ins this week.', actions: [], notes };
  }

  if (rate >= r.onPaceMin && rate <= r.onPaceMax) {
    return { band: 'on-pace', rate, headline: 'Right on pace. Change nothing.', actions: [], notes };
  }

  if (inSlowBand(rate)) {
    const prevDate = addDays(date, -7);
    const prevRate = prevDate >= r.adjustmentFrom ? weeklyLossRate(daily, prevDate) : null;
    if (inSlowBand(prevRate)) {
      const cut = kcalCut(currentKcal);
      const actions: AdviceAction[] = cut ? [cut] : [stepsAction()];
      return {
        band: 'slow',
        rate,
        headline: cut
          ? 'Still a little slow for a second week. Keep the extra steps and trim calories.'
          : `Still a little slow, but calories are already at the ${PLAN.dailyTargets.kcalFloor.toLocaleString('en-GB')} floor. Add steps instead.`,
        actions,
        notes,
      };
    }
    return { band: 'slow', rate, headline: 'A little slow. Add steps first.', actions: [stepsAction()], notes };
  }

  if (rate < r.slowMin) {
    const actions: AdviceAction[] = [
      { kind: 'foodAudit', text: 'Run a 3-day weigh-and-log food audit to find hidden calories.' },
      stepsAction(),
    ];
    const cut = kcalCut(currentKcal);
    if (cut) actions.push(cut);
    return { band: 'stalled', rate, headline: 'Loss has stalled. Audit first, then apply both changes.', actions, notes };
  }

  if (rate > r.tooFastOver && liftsDown) {
    return {
      band: 'too-fast',
      rate,
      headline: 'Losing fast and lifts are dropping. Fuel training.',
      actions: [{ kind: 'addCarbs', amount: r.kcalAddCarbs, text: `Add ${r.kcalAddCarbs} kcal of carbs around training.` }],
      notes,
    };
  }

  return { band: 'other', rate, headline: 'Change nothing.', actions: [], notes };
}

export interface Week4Result {
  applies: boolean;
  avg: number | null;
  target: number;
  overBy: number | null;
  /** New projected 2-stone date when pushed back. */
  newGoalDate: ISODate | null;
  message: string;
}

/** Plan pace from week 4 to the end, kg per day. */
export function planPacePerDay(): number {
  const path = PLAN.targetPath;
  const w4 = path.find((p) => p.date === PLAN.rules.week4CheckDate)!;
  const end = path[path.length - 1];
  return (w4.kg - end.kg) / diffDays(w4.date, end.date);
}

/** Rule 4: on Sun 6 Dec, if more than 2 kg above target, keep the pace and push the 2-stone date back. */
export function week4Check(daily: DailyMap): Week4Result {
  const date = PLAN.rules.week4CheckDate;
  const target = targetFor(date)!;
  const avg = sevenDayAverage(daily, date);
  if (avg == null) {
    return { applies: false, avg, target, overBy: null, newGoalDate: null, message: 'Not enough data on Sun 6 Dec for the week 4 check.' };
  }
  const overBy = avg - target;
  if (overBy <= PLAN.rules.week4ThresholdKg) {
    return { applies: false, avg, target, overBy, newGoalDate: null, message: 'Week 4 check passed: the 31 Jan 2027 goal date stands.' };
  }
  const extraDays = Math.ceil(overBy / planPacePerDay());
  const newGoalDate = addDays(PLAN.endDate, extraDays);
  return {
    applies: true,
    avg,
    target,
    overBy,
    newGoalDate,
    message: 'More than 2 kg behind: keep the same weekly pace and push the 2-stone date back. Do not cut harder.',
  };
}
