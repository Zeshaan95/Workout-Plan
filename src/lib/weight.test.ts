import { describe, expect, it } from 'vitest';
import { PLAN } from '../plan';
import { fill } from '../test/helpers';
import { addDays } from './dates';
import { dailyReadings, nextMilestone, projectMilestones, sevenDayAverage, targetFor, weeklyLossRate, weeklyStatus } from './weight';

const seed = PLAN.seed.weighIns.map((w) => ({ date: w.date, time: '07:00', kg: w.kg }));

describe('rule 1: 7-day average', () => {
  it('uses the earliest reading of the day', () => {
    const m = dailyReadings([
      { date: '2026-11-10', time: '19:00', kg: 98 },
      { date: '2026-11-10', time: '06:45', kg: 96.8 },
    ]);
    expect(m.get('2026-11-10')).toBe(96.8);
  });
  it('averages the seed readings in the 7 days to 31 Oct', () => {
    const m = dailyReadings(seed);
    expect(sevenDayAverage(m, '2026-10-31')).toBeCloseTo((96.95 + 96.95 + 96.5 + 96.35) / 4, 6);
  });
  it('needs at least 3 readings', () => {
    const m = dailyReadings(seed);
    expect(sevenDayAverage(m, '2026-11-09')).toBeNull();
    expect(sevenDayAverage(m, '2026-10-28')).toBeNull(); // only 27 and 28 Oct
    expect(sevenDayAverage(m, '2026-10-29')).toBeCloseTo((96.95 + 96.95 + 96.5) / 3, 6);
  });
  it('drops readings older than 7 days', () => {
    const m = dailyReadings(seed);
    // window 1–7 Nov: no readings
    expect(sevenDayAverage(m, '2026-11-07')).toBeNull();
  });
});

describe('interpolated target', () => {
  it('matches the table on each Sunday', () => {
    for (const p of PLAN.targetPath) expect(targetFor(p.date)).toBeCloseTo(p.kg, 6);
  });
  it('interpolates linearly between points', () => {
    expect(targetFor('2026-11-12')).toBeCloseTo(96.25, 6);
    expect(targetFor('2027-01-01')).toBeCloseTo(88.7, 1);
    expect(targetFor('2026-12-18')).toBeCloseTo(90.69, 2);
  });
  it('is null before week 1 and holds the goal after', () => {
    expect(targetFor('2026-11-08')).toBeNull();
    expect(targetFor('2027-02-10')).toBe(84.3);
  });
});

describe('rule 2: status', () => {
  it('within ±0.5 kg is on track', () => {
    expect(weeklyStatus(95.9, 95.5)).toBe('on-track');
    expect(weeklyStatus(96.0, 95.5)).toBe('on-track');
    expect(weeklyStatus(95.0, 95.5)).toBe('on-track');
  });
  it('more than 0.5 above is behind, more than 0.5 below is ahead', () => {
    expect(weeklyStatus(96.01, 95.5)).toBe('behind');
    expect(weeklyStatus(94.99, 95.5)).toBe('ahead');
  });
});

describe('rule 3 loss rate', () => {
  it('falls back to the 97.0 kg start when there is no average 14 days earlier', () => {
    const m = fill(new Map(), '2026-11-16', '2026-11-22', 95.5);
    expect(weeklyLossRate(m, '2026-11-22')).toBeCloseTo(0.75, 6);
  });
  it('uses the 7-day average 14 days ago when present', () => {
    const m = fill(new Map(), '2026-11-09', '2026-11-15', 96.5);
    fill(m, '2026-11-23', '2026-11-29', 94.5);
    expect(weeklyLossRate(m, '2026-11-29')).toBeCloseTo(1.0, 6);
  });
  it('is null with no current average', () => {
    expect(weeklyLossRate(new Map(), '2026-11-29')).toBeNull();
  });
});

describe('rule 8: projection', () => {
  it('projects milestone dates from the 14-day trend', () => {
    const today = '2026-11-29';
    const m = new Map<string, number>();
    for (let i = 0; i < 14; i++) m.set(addDays(today, -i), 94 + i * 0.1);
    const p = projectMilestones(m, today)!;
    expect(p.slopePerDay).toBeCloseTo(-0.1, 6);
    expect(p.current).toBeCloseTo(94, 6);
    // 94 → 90.65 = 3.35 kg at 0.1/day = 34 days (rounded up)
    expect(p.milestones[0].date).toBe(addDays(today, 34));
    expect(p.milestones[1].date).toBe(addDays(today, 65));
    expect(p.milestones[2].date).toBe(addDays(today, 97));
  });
  it('returns no date when not losing, and marks reached milestones', () => {
    const today = '2026-12-20';
    const flat = fill(new Map(), '2026-12-07', today, 92);
    const p = projectMilestones(flat, today)!;
    expect(p.slopePerDay).toBeCloseTo(0, 9);
    expect(p.milestones.every((x) => x.date === null && !x.reached)).toBe(true);
  });
  it('marks reached milestones', () => {
    const today = '2026-12-20';
    const m = new Map<string, number>();
    for (let i = 0; i < 10; i++) m.set(addDays(today, -i), 90 + i * 0.1);
    const p = projectMilestones(m, today)!;
    expect(p.milestones[0].reached).toBe(true);
    expect(p.milestones[1].reached).toBe(false);
  });
  it('needs at least 4 readings', () => {
    const m = fill(new Map(), '2026-11-27', '2026-11-29', 94);
    expect(projectMilestones(m, '2026-11-29')).toBeNull();
  });
});

describe('next milestone', () => {
  it('finds the next one below the current weight', () => {
    expect(nextMilestone(95)?.kg).toBe(90.65);
    expect(nextMilestone(90.65)?.kg).toBe(87.5);
    expect(nextMilestone(84.3)).toBeNull();
  });
});
