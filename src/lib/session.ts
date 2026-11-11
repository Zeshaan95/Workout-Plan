/**
 * Builds a pre-filled workout log for a session, and the per-exercise prescription.
 */
import { BSS_REPS_SHORT, EXERCISES, PLAN, STRENGTH_SESSIONS, type ExerciseDef, type SessionId, type WeekType } from '../plan';
import type { ISODate } from './dates';
import { isPullupTestDay } from './schedule';
import {
  bodyweightProgression,
  gymProgression,
  lastTime,
  latestTestedMax,
  topSetWeight,
  type ExerciseEntry,
  type HistoryItem,
  type Suggestion,
  type WorkoutLog,
} from './workouts';

export function isStrength(s: SessionId): s is 'strengthA' | 'strengthB' | 'strengthC' {
  return s === 'strengthA' || s === 'strengthB' || s === 'strengthC';
}

/** EXERCISES keys for a session in the order they are performed (supersets interleaved by pair). */
export function sessionExerciseKeys(session: 'strengthA' | 'strengthB' | 'strengthC', date: ISODate): string[] {
  const s = STRENGTH_SESSIONS[session];
  const keys = s.format === 'supersets' ? s.supersets!.flat() : s.exercises!;
  return keys.filter((k) => !EXERCISES[k].testDayOnly || isPullupTestDay(date));
}

export interface Prescription {
  text: string;
  /** Reps to aim for per set (used as the input placeholder). */
  aim: number | null;
  aimBasis?: string;
  cue?: string;
  suggestions: Suggestion[];
  last: HistoryItem | null;
  testedMax: { reps: number; date: ISODate | null } | null;
}

export function prescription(def: ExerciseDef, date: ISODate, weekType: WeekType, logs: WorkoutLog[]): Prescription {
  const last = def.kind === 'test' ? null : lastTime(logs, def.id, date);
  const each = def.perSide ? ' each leg' : '';
  let cue = def.cue;
  if (def.id === 'bulgarianSplitSquat') {
    const n = BSS_REPS_SHORT[weekType];
    cue = `${def.cue} · stop ${n} rep${n > 1 ? 's' : ''} short (${weekType === 'football' ? 'football' : 'no-football'} week)`;
  }

  if (def.kind === 'test') {
    const prev = latestTestedMax(logs.filter((l) => l.date < date), 'pullup');
    return { text: '1 × max, strict reps only', aim: null, cue, suggestions: [], last: null, testedMax: prev };
  }

  if (def.kind === 'weighted') {
    const lastEntry = last?.entry ?? null;
    const s = gymProgression(def, lastEntry);
    return {
      text: `${def.sets} × ${def.repMin === def.repMax ? def.repMax : `${def.repMin}–${def.repMax}`}${each}`,
      aim: def.repMax ?? null,
      cue,
      suggestions: s ? [s] : [],
      last,
      testedMax: null,
    };
  }

  const testedMax = def.maxMinusOne ? latestTestedMax(logs, def.id, date) : null;
  const bw = bodyweightProgression(def, last, testedMax, date);
  const range = def.maxMinusOne ? 'max − 1' : def.repMin === def.repMax ? `${def.repMax}` : `${def.repMin}–${def.repMax}`;
  return {
    text: `${def.sets} × ${range}${each}`,
    aim: bw.aim,
    aimBasis: bw.basis,
    cue,
    suggestions: bw.suggestions,
    last,
    testedMax,
  };
}

/** A fresh log for a strength session, with sets pre-filled from last time (and +2.5 kg where rule 5 says so). */
export function buildStrengthLog(session: 'strengthA' | 'strengthB' | 'strengthC', date: ISODate, weekType: WeekType, logs: WorkoutLog[]): WorkoutLog {
  const entries: ExerciseEntry[] = sessionExerciseKeys(session, date).map((key) => {
    const def = EXERCISES[key];
    const p = prescription(def, date, weekType, logs);
    const lastEntry = p.last?.entry;
    let weight: number | null = null;
    if (def.kind === 'weighted' && lastEntry) {
      const top = topSetWeight(lastEntry);
      weight = top != null ? top + (p.suggestions.some((s) => s.kind === 'weight') ? PLAN.rules.gymIncrementKg : 0) : null;
    }
    const pack = lastEntry?.sets.find((s) => s.backpackKg)?.backpackKg ?? null;
    return {
      exerciseId: def.id,
      defKey: key,
      feetRaised: def.id === 'pushup' ? !!lastEntry?.feetRaised : undefined,
      sets: Array.from({ length: def.sets }, () => ({
        weightKg: def.kind === 'weighted' ? weight : null,
        reps: null,
        backpackKg: def.kind === 'bodyweight' ? pack : null,
        done: false,
      })),
    };
  });
  return { date, session, status: 'in-progress', startedAt: new Date().toISOString(), entries };
}

/** Superset order for Strength C: [pairIndex, setIndex, entryIndex] steps, alternating A/B. */
export function supersetSteps(log: WorkoutLog): { pair: number; set: number; entryIndex: number; label: string }[] {
  const s = STRENGTH_SESSIONS.strengthC;
  const steps: { pair: number; set: number; entryIndex: number; label: string }[] = [];
  s.supersets!.forEach(([a, b], pair) => {
    const ia = log.entries.findIndex((e) => e.defKey === a);
    const ib = log.entries.findIndex((e) => e.defKey === b);
    const n = Math.max(log.entries[ia]?.sets.length ?? 0, log.entries[ib]?.sets.length ?? 0);
    for (let set = 0; set < n; set++) {
      if (ia >= 0 && set < log.entries[ia].sets.length) steps.push({ pair, set, entryIndex: ia, label: `${pair + 1}A` });
      if (ib >= 0 && set < log.entries[ib].sets.length) steps.push({ pair, set, entryIndex: ib, label: `${pair + 1}B` });
    }
  });
  return steps;
}
