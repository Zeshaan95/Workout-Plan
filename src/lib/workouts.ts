/**
 * Workout log types plus progression (rules 5 & 6) and the strength warning (rule 7).
 */
import { COMPOUND_LIFTS, EXERCISES, PLAN, type ExerciseDef, type SessionId } from '../plan';
import { diffDays, type ISODate } from './dates';
import { weekNumber } from './schedule';

export interface SetLog {
  weightKg?: number | null;
  reps?: number | null;
  backpackKg?: number | null;
  done?: boolean;
}

export interface ExerciseEntry {
  /** Logged exercise id (ExerciseDef.id, shared across A/C variants). */
  exerciseId: string;
  /** Key in EXERCISES for the template this entry came from. */
  defKey?: string;
  sets: SetLog[];
  feetRaised?: boolean;
  /** Optional manually recorded max (dips, push-ups). */
  testMax?: number | null;
}

export interface WorkoutLog {
  id?: number;
  date: ISODate;
  session: SessionId;
  status: 'in-progress' | 'complete';
  startedAt?: string;
  completedAt?: string;
  durationMin?: number | null;
  distanceKm?: number | null;
  notes?: string;
  entries: ExerciseEntry[];
}

export function completedSets(e: ExerciseEntry): SetLog[] {
  return e.sets.filter((s) => s.reps != null && s.reps > 0);
}

export function topSetWeight(e: ExerciseEntry): number | null {
  const ws = completedSets(e)
    .map((s) => s.weightKg)
    .filter((w): w is number => w != null && w > 0);
  return ws.length ? Math.max(...ws) : null;
}

export function totalReps(e: ExerciseEntry): number {
  return completedSets(e).reduce((a, s) => a + (s.reps ?? 0), 0);
}

/** Epley estimated 1RM. */
export function epley1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

export function bestE1RM(e: ExerciseEntry): number | null {
  let best: number | null = null;
  for (const s of completedSets(e)) {
    if (s.weightKg && s.reps) {
      const v = epley1RM(s.weightKg, s.reps);
      if (best == null || v > best) best = v;
    }
  }
  return best;
}

export interface HistoryItem {
  date: ISODate;
  session: SessionId;
  entry: ExerciseEntry;
}

/** All logged entries for an exercise id, oldest first. Includes in-progress logs before `before`. */
export function exerciseHistory(logs: WorkoutLog[], exerciseId: string, before?: ISODate): HistoryItem[] {
  return logs
    .filter((l) => (before ? l.date < before : true))
    .slice()
    .sort((a, b) => (a.date === b.date ? (a.id ?? 0) - (b.id ?? 0) : a.date < b.date ? -1 : 1))
    .flatMap((l) =>
      l.entries
        .filter((e) => e.exerciseId === exerciseId && completedSets(e).length > 0)
        .map((entry) => ({ date: l.date, session: l.session, entry })),
    );
}

export function lastTime(logs: WorkoutLog[], exerciseId: string, before: ISODate): HistoryItem | null {
  const h = exerciseHistory(logs, exerciseId, before);
  return h.length ? h[h.length - 1] : null;
}

/** Latest tested max: pull-ups from the max test (fallback: previous best 7); others from a recorded testMax. */
export function latestTestedMax(logs: WorkoutLog[], exerciseId: string, onOrBefore?: ISODate): { reps: number; date: ISODate | null } | null {
  const sorted = logs
    .filter((l) => (onOrBefore ? l.date <= onOrBefore : true))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id ?? 0) - (a.id ?? 0)));
  for (const l of sorted) {
    for (const e of l.entries) {
      if (exerciseId === 'pullup' && e.exerciseId === 'pullupTest') {
        const r = e.sets[0]?.reps;
        if (r != null && r > 0) return { reps: r, date: l.date };
      }
      if (e.exerciseId === exerciseId && e.testMax != null && e.testMax > 0) {
        return { reps: e.testMax, date: l.date };
      }
    }
  }
  if (exerciseId === 'pullup') return { reps: PLAN.previousPullupBest, date: null };
  return null;
}

export function pullupTestHistory(logs: WorkoutLog[]): { date: ISODate; reps: number }[] {
  return logs
    .flatMap((l) =>
      l.entries
        .filter((e) => e.exerciseId === 'pullupTest' && e.sets[0]?.reps)
        .map((e) => ({ date: l.date, reps: e.sets[0].reps! })),
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

export interface Suggestion {
  /** Short badge text, e.g. "+2.5 kg". */
  badge: string;
  detail: string;
  kind: 'weight' | 'reps' | 'backpack' | 'feetRaised';
}

/** Rule 5: every working set hit the top of the range → add 2.5 kg (or the next dumbbell). */
export function gymProgression(def: ExerciseDef, last: ExerciseEntry | null): Suggestion | null {
  if (def.kind !== 'weighted' || !last || def.repMax == null) return null;
  const sets = completedSets(last);
  if (sets.length < def.sets) return null;
  if (!sets.every((s) => (s.reps ?? 0) >= def.repMax!)) return null;
  const top = topSetWeight(last);
  const inc = PLAN.rules.gymIncrementKg;
  return {
    kind: 'weight',
    badge: `+${inc} kg`,
    detail: top != null
      ? `All sets hit ${def.repMax}. Try ${+(top + inc).toFixed(2)} kg (or the next dumbbell) this session.`
      : `All sets hit ${def.repMax}. Add ${inc} kg (or move to the next dumbbell).`,
  };
}

/** True when `today` falls in a later plan week than `prev` (outside the plan: 7+ days later). */
export function isNewWeek(prev: ISODate, today: ISODate): boolean {
  const a = weekNumber(prev);
  const b = weekNumber(today);
  if (a != null && b != null) return b > a;
  return diffDays(prev, today) >= 7;
}

export interface BodyweightAim {
  /** Reps per set to aim for (null = no basis yet). */
  aim: number | null;
  basis: string;
  suggestions: Suggestion[];
}

/** Rule 6: +1 rep per set each week; backpack past 12 (split squats, pull-ups); feet raised past 20 (push-ups); max-minus-one from the latest tested max. */
export function bodyweightProgression(
  def: ExerciseDef,
  last: HistoryItem | null,
  testedMax: { reps: number; date: ISODate | null } | null,
  today: ISODate,
): BodyweightAim {
  const suggestions: Suggestion[] = [];
  let aim: number | null = null;
  let basis = '';

  const lastSets = last ? completedSets(last.entry) : [];
  const lastMin = lastSets.length ? Math.min(...lastSets.map((s) => s.reps ?? 0)) : null;
  const lastMax = lastSets.length ? Math.max(...lastSets.map((s) => s.reps ?? 0)) : null;
  const newWeek = last ? isNewWeek(last.date, today) : false;

  if (def.maxMinusOne && testedMax) {
    aim = testedMax.reps - 1;
    basis = `Tested max ${testedMax.reps} − 1`;
  }
  if (lastMin != null) {
    const progressed = newWeek ? lastMin + 1 : lastMin;
    if (aim == null || progressed > aim) {
      aim = progressed;
      basis = newWeek ? `Last time ${lastMin}/set + 1` : `Same as earlier this week (${lastMin}/set)`;
    }
    if (newWeek) {
      suggestions.push({ kind: 'reps', badge: '+1 rep', detail: `Add a rep per set: aim for ${lastMin + 1} per set while form stays strict.` });
    }
  }
  if (aim == null && def.repMin != null) {
    aim = def.repMin;
    basis = `Plan range ${def.repMin}–${def.repMax}`;
  }

  if (def.backpackAfter != null && lastMax != null && lastMax > def.backpackAfter) {
    const pack = lastSets.find((s) => s.backpackKg)?.backpackKg;
    suggestions.push({
      kind: 'backpack',
      badge: pack ? 'Heavier pack' : 'Add backpack',
      detail: pack
        ? `Past ${def.backpackAfter} reps with ${pack} kg: add a little more to the backpack.`
        : `Past ${def.backpackAfter} reps: add a loaded backpack, starting at 2.5–5 kg.`,
    });
  }
  if (def.feetRaisedAfter != null && lastMax != null && lastMax > def.feetRaisedAfter && !last?.entry.feetRaised) {
    suggestions.push({ kind: 'feetRaised', badge: 'Feet raised', detail: `Past ${def.feetRaisedAfter} reps: raise your feet on a step.` });
  }
  return { aim, basis, suggestions };
}

// ---------------------------------------------------------------------------
// Rule 7: strength warning
// ---------------------------------------------------------------------------

export interface StrengthSeries {
  exerciseId: string;
  name: string;
  metric: 'top-set kg' | 'total reps';
  values: { date: ISODate; value: number }[];
}

export function strengthSeries(logs: WorkoutLog[]): StrengthSeries[] {
  const out: StrengthSeries[] = [];
  for (const id of COMPOUND_LIFTS) {
    const values = exerciseHistory(logs.filter((l) => l.status === 'complete'), id)
      .map((h) => ({ date: h.date, value: topSetWeight(h.entry) }))
      .filter((v): v is { date: ISODate; value: number } => v.value != null);
    out.push({ exerciseId: id, name: EXERCISES[id].name, metric: 'top-set kg', values });
  }
  const pull = exerciseHistory(logs.filter((l) => l.status === 'complete'), 'pullup').map((h) => ({
    date: h.date,
    value: totalReps(h.entry),
  }));
  out.push({ exerciseId: 'pullup', name: 'Pull-ups', metric: 'total reps', values: pull });
  return out;
}

/** Dropped two sessions in a row (v[n-2] < v[n-3] and v[n-1] < v[n-2]). */
export function droppedTwiceInARow(values: number[]): boolean {
  const n = values.length;
  if (n < 3) return false;
  return values[n - 2] < values[n - 3] && values[n - 1] < values[n - 2];
}

export function strengthWarnings(logs: WorkoutLog[]): StrengthSeries[] {
  return strengthSeries(logs).filter((s) => droppedTwiceInARow(s.values.map((v) => v.value)));
}

/** "Lifts going down" for rule 3: latest session lower than the one before, on any tracked lift. */
export function liftsGoingDown(logs: WorkoutLog[]): boolean {
  return strengthSeries(logs).some((s) => {
    const v = s.values.map((x) => x.value);
    return v.length >= 2 && v[v.length - 1] < v[v.length - 2];
  });
}
