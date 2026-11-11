import { describe, expect, it } from 'vitest';
import { PLAN } from '../plan';
import { habitResults, weeklyAdherence } from './habits';

const t = PLAN.dailyTargets;

describe('habits', () => {
  it('checks each habit against the daily targets', () => {
    const r = habitResults({ date: '2026-11-10', kcal: 1880, protein: 165, steps: 12500, waterL: 2.5, sleepH: 7, creatine: true, sessionDone: true }, t, false);
    expect(Object.values(r).every(Boolean)).toBe(true);
    const bad = habitResults({ date: '2026-11-10', kcal: 1700, protein: 150, steps: 9000, waterL: 2, sleepH: 6 }, t, true);
    expect(bad).toEqual({ kcal: false, protein: false, steps: false, water: false, sleep: false, creatine: false, session: null });
    expect(habitResults({ date: 'x', kcal: 1950 }, t, true).kcal).toBe(false);
  });
  it('weekly adherence counts only days up to today and skips session on rest days', () => {
    const habits = [
      { date: '2026-11-09', kcal: 1900, protein: 170, steps: 12000, waterL: 3, sleepH: 8, creatine: true, sessionDone: true },
      { date: '2026-11-10', kcal: 1900, protein: 170, steps: 12000, waterL: 3, sleepH: 8, creatine: true, sessionDone: false },
    ];
    // Mon (7 applicable) + Tue (7) + Wed rest day (6) = 20; met 7 + 6 + 0 = 13
    const a = weeklyAdherence('2026-11-09', '2026-11-11', habits, t, {});
    expect(a).toEqual({ met: 13, possible: 20, pct: 65 });
  });
});
