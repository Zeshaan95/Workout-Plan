import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../plan';
import {
  bodyweightProgression,
  droppedTwiceInARow,
  epley1RM,
  gymProgression,
  lastTime,
  latestTestedMax,
  liftsGoingDown,
  strengthWarnings,
  type WorkoutLog,
} from './workouts';

const sets = (w: number | null, reps: number[]) => reps.map((r) => ({ weightKg: w, reps: r, done: true }));

function log(date: string, session: WorkoutLog['session'], entries: WorkoutLog['entries']): WorkoutLog {
  return { date, session, status: 'complete', entries };
}

describe('Epley 1RM', () => {
  it('weight × (1 + reps/30)', () => {
    expect(epley1RM(100, 5)).toBeCloseTo(116.667, 3);
    expect(epley1RM(60, 1)).toBe(60);
  });
});

describe('rule 5: gym progression', () => {
  const squat = EXERCISES.backSquat;
  it('suggests +2.5 kg when every working set hits the top of the range', () => {
    const s = gymProgression(squat, { exerciseId: 'backSquat', sets: sets(80, [8, 8, 8]) });
    expect(s?.badge).toBe('+2.5 kg');
    expect(s?.detail).toMatch(/82\.5 kg/);
  });
  it('no suggestion if any set falls short or sets are missing', () => {
    expect(gymProgression(squat, { exerciseId: 'backSquat', sets: sets(80, [8, 8, 7]) })).toBeNull();
    expect(gymProgression(squat, { exerciseId: 'backSquat', sets: sets(80, [8, 8]) })).toBeNull();
    expect(gymProgression(squat, null)).toBeNull();
  });
  it('fixed-rep accessories use their single target (split squats 10 each leg)', () => {
    expect(gymProgression(EXERCISES.dbSplitSquat, { exerciseId: 'dbSplitSquat', sets: sets(16, [10, 10, 10]) })).not.toBeNull();
  });
  it('ignores bodyweight moves', () => {
    expect(gymProgression(EXERCISES.pullup, { exerciseId: 'pullup', sets: sets(null, [9, 9, 9, 9]) })).toBeNull();
  });
});

describe('rule 6: bodyweight progression', () => {
  it('pull-ups: max-minus-one from previous best of 7 before any test', () => {
    const max = latestTestedMax([], 'pullup');
    expect(max).toEqual({ reps: 7, date: null });
    expect(bodyweightProgression(EXERCISES.pullup, null, max, '2026-11-10').aim).toBe(6);
  });
  it('uses the latest tested max', () => {
    const logs = [
      log('2026-11-22', 'strengthB', [{ exerciseId: 'pullupTest', sets: [{ reps: 9 }] }]),
      log('2026-12-27', 'strengthB', [{ exerciseId: 'pullupTest', sets: [{ reps: 11 }] }]),
    ];
    expect(latestTestedMax(logs, 'pullup')?.reps).toBe(11);
    expect(latestTestedMax(logs, 'pullup', '2026-12-01')?.reps).toBe(9);
    expect(bodyweightProgression(EXERCISES.pullup, null, latestTestedMax(logs, 'pullup'), '2026-12-29').aim).toBe(10);
  });
  it('+1 rep per set in a new week, not within the same week', () => {
    const logs = [log('2026-11-10', 'strengthC', [{ exerciseId: 'pikePushup', sets: sets(null, [9, 9, 8]) }])];
    const last = lastTime(logs, 'pikePushup', '2026-11-17');
    const nextWeek = bodyweightProgression(EXERCISES.pikePushup, last, null, '2026-11-17');
    expect(nextWeek.aim).toBe(9);
    expect(nextWeek.suggestions.map((s) => s.kind)).toContain('reps');
    const sameWeek = bodyweightProgression(EXERCISES.pikePushup, last, null, '2026-11-14');
    expect(sameWeek.aim).toBe(8);
    expect(sameWeek.suggestions).toEqual([]);
  });
  it('suggests a backpack once split squats or pull-ups pass 12 reps', () => {
    const logs = [log('2026-11-10', 'strengthC', [{ exerciseId: 'bulgarianSplitSquat', sets: sets(null, [13, 12, 12]) }])];
    const p = bodyweightProgression(EXERCISES.bulgarianSplitSquat, lastTime(logs, 'bulgarianSplitSquat', '2026-11-17'), null, '2026-11-17');
    expect(p.suggestions.map((s) => s.kind)).toContain('backpack');
    const at12 = [log('2026-11-10', 'strengthC', [{ exerciseId: 'bulgarianSplitSquat', sets: sets(null, [12, 12, 12]) }])];
    expect(bodyweightProgression(EXERCISES.bulgarianSplitSquat, lastTime(at12, 'bulgarianSplitSquat', '2026-11-17'), null, '2026-11-17').suggestions.map((s) => s.kind)).not.toContain('backpack');
  });
  it('suggests feet-raised push-ups once past 20', () => {
    const logs = [log('2026-11-10', 'strengthC', [{ exerciseId: 'pushup', sets: sets(null, [21, 18, 16, 15]) }])];
    const p = bodyweightProgression(EXERCISES.pushup, lastTime(logs, 'pushup', '2026-11-17'), null, '2026-11-17');
    expect(p.suggestions.map((s) => s.kind)).toContain('feetRaised');
    const raised = [log('2026-11-10', 'strengthC', [{ exerciseId: 'pushup', feetRaised: true, sets: sets(null, [21]) }])];
    expect(bodyweightProgression(EXERCISES.pushup, lastTime(raised, 'pushup', '2026-11-17'), null, '2026-11-17').suggestions.map((s) => s.kind)).not.toContain('feetRaised');
  });
  it('dips use a recorded max when there is one', () => {
    const logs = [log('2026-11-15', 'strengthB', [{ exerciseId: 'dip', testMax: 10, sets: sets(null, [9, 9, 8]) }])];
    expect(latestTestedMax(logs, 'dip')?.reps).toBe(10);
    expect(latestTestedMax([], 'dip')).toBeNull();
  });
});

describe('rule 7: strength warning', () => {
  it('flags two drops in a row', () => {
    expect(droppedTwiceInARow([80, 77.5, 75])).toBe(true);
    expect(droppedTwiceInARow([80, 77.5, 80])).toBe(false);
    expect(droppedTwiceInARow([80, 80, 77.5])).toBe(false);
    expect(droppedTwiceInARow([80, 77.5])).toBe(false);
  });
  it('watches top-set load on compound lifts', () => {
    const logs = [
      log('2026-11-14', 'strengthA', [{ exerciseId: 'backSquat', sets: sets(80, [6, 6, 6]) }]),
      log('2026-11-21', 'strengthA', [{ exerciseId: 'backSquat', sets: sets(77.5, [6, 6, 6]) }]),
      log('2026-11-28', 'strengthA', [{ exerciseId: 'backSquat', sets: sets(75, [6, 6, 6]) }]),
    ];
    expect(strengthWarnings(logs).map((s) => s.exerciseId)).toEqual(['backSquat']);
    expect(liftsGoingDown(logs)).toBe(true);
  });
  it('watches total pull-up reps across sessions', () => {
    const logs = [
      log('2026-11-10', 'strengthC', [{ exerciseId: 'pullup', sets: sets(null, [6, 6, 6, 6]) }]),
      log('2026-11-15', 'strengthB', [{ exerciseId: 'pullup', sets: sets(null, [6, 6, 5, 5]) }]),
      log('2026-11-17', 'strengthC', [{ exerciseId: 'pullup', sets: sets(null, [6, 5, 5, 5]) }]),
    ];
    expect(strengthWarnings(logs).map((s) => s.exerciseId)).toEqual(['pullup']);
  });
  it('ignores non-compound accessories and in-progress sessions', () => {
    const logs = [
      log('2026-11-14', 'strengthA', [{ exerciseId: 'legCurl', sets: sets(40, [12]) }]),
      log('2026-11-21', 'strengthA', [{ exerciseId: 'legCurl', sets: sets(35, [12]) }]),
      log('2026-11-28', 'strengthA', [{ exerciseId: 'legCurl', sets: sets(30, [12]) }]),
    ];
    expect(strengthWarnings(logs)).toEqual([]);
    expect(liftsGoingDown([])).toBe(false);
  });
});
