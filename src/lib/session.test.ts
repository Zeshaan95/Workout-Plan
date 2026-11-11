import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../plan';
import { buildStrengthLog, prescription, sessionExerciseKeys, supersetSteps } from './session';
import type { WorkoutLog } from './workouts';

describe('session templates', () => {
  it('Strength B includes the pull-up max test first, on test days only', () => {
    expect(sessionExerciseKeys('strengthB', '2026-11-22')[0]).toBe('pullupTest');
    expect(sessionExerciseKeys('strengthB', '2026-12-27')[0]).toBe('pullupTest');
    expect(sessionExerciseKeys('strengthB', '2026-11-15')).toEqual(['pullup', 'dbBench', 'ohp', 'cableRow', 'dip']);
  });
  it('Strength A is the five lower-body exercises in order', () => {
    expect(sessionExerciseKeys('strengthA', '2026-11-14')).toEqual(['backSquat', 'rdl', 'dbSplitSquat', 'legCurl', 'hangingLegRaiseA']);
  });
  it('Strength C alternates within each superset', () => {
    const log = buildStrengthLog('strengthC', '2026-11-10', 'football', []);
    const steps = supersetSteps(log).map((s) => `${s.label}:${log.entries[s.entryIndex].exerciseId}:${s.set + 1}`);
    expect(steps.slice(0, 4)).toEqual(['1A:pullup:1', '1B:pushup:1', '1A:pullup:2', '1B:pushup:2']);
    expect(steps).toHaveLength(8 + 6 + 6);
    expect(steps[8]).toBe('2A:bulgarianSplitSquat:1');
  });
  it('Bulgarian split squat cue follows the week type', () => {
    expect(prescription(EXERCISES.bulgarianSplitSquat, '2026-11-10', 'football', []).cue).toMatch(/stop 2 reps short/);
    expect(prescription(EXERCISES.bulgarianSplitSquat, '2026-11-10', 'noFootball', []).cue).toMatch(/stop 1 rep short/);
  });
  it('pre-fills last weight, adding 2.5 kg when every set hit the top of the range', () => {
    const prev: WorkoutLog[] = [
      { date: '2026-11-14', session: 'strengthA', status: 'complete', entries: [
        { exerciseId: 'backSquat', sets: [8, 8, 8].map((r) => ({ weightKg: 80, reps: r })) },
        { exerciseId: 'rdl', sets: [8, 7, 7].map((r) => ({ weightKg: 70, reps: r })) },
      ] },
    ];
    const log = buildStrengthLog('strengthA', '2026-11-21', 'football', prev);
    expect(log.entries[0].sets.map((s) => s.weightKg)).toEqual([82.5, 82.5, 82.5]);
    expect(log.entries[1].sets[0].weightKg).toBe(70);
    expect(log.entries[2].sets[0].weightKg).toBeNull();
  });
  it('pull-up aim is tested max − 1', () => {
    const p = prescription(EXERCISES.pullupC, '2026-11-10', 'football', []);
    expect(p.aim).toBe(6);
    expect(p.text).toBe('4 × max − 1');
  });
});
