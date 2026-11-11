import { describe, expect, it } from 'vitest';
import { addDays, weekdayIndex } from './dates';
import { dayPlan, isWaistSunday, jogTarget, weekNumber, weekPlan, weekStart, weekSunday, weekTypeFor } from './schedule';

describe('week numbers', () => {
  it('runs Monday 9 Nov 2026 to Sunday 31 Jan 2027 as weeks 1–12', () => {
    expect(weekNumber('2026-11-08')).toBeNull();
    expect(weekNumber('2026-11-09')).toBe(1);
    expect(weekNumber('2026-11-15')).toBe(1);
    expect(weekNumber('2026-11-16')).toBe(2);
    expect(weekNumber('2026-12-06')).toBe(4);
    expect(weekNumber('2027-01-03')).toBe(8);
    expect(weekNumber('2027-01-31')).toBe(12);
    expect(weekNumber('2027-02-01')).toBeNull();
  });
  it('week Sundays match the target table', () => {
    expect(weekSunday(1)).toBe('2026-11-15');
    expect(weekSunday(8)).toBe('2027-01-03');
    expect(weekSunday(12)).toBe('2027-01-31');
    expect(weekStart(7)).toBe('2026-12-21');
  });
});

describe('session for a date', () => {
  it('football week pattern', () => {
    const s = weekPlan(1).map((d) => d.session);
    expect(s).toEqual(['jog', 'strengthC', 'restCook', 'football', 'restSteps', 'strengthA', 'strengthB']);
  });
  it('no-football week swaps Thursday for the incline walk and tightens Tuesday split squats', () => {
    const wk = weekPlan(3, { 3: false });
    expect(wk.map((d) => d.session)).toEqual(['jog', 'strengthC', 'restCook', 'walk', 'restSteps', 'strengthA', 'strengthB']);
    expect(wk[3].length).toBe('50–60 min');
    expect(wk[1].notes.join(' ')).toMatch(/1 rep short/);
    expect(wk.every((d) => d.weekType === 'noFootball')).toBe(true);
    // Other weeks are unaffected
    expect(dayPlan('2026-12-03', { 3: false }).session).toBe('football');
  });
  it('defaults to football and flips per week', () => {
    expect(weekTypeFor(5, {})).toBe('football');
    expect(weekTypeFor(5, { 5: true })).toBe('football');
    expect(weekTypeFor(5, { 5: false })).toBe('noFootball');
  });
  it('today (Wed 11 Nov 2026) is a rest day with steps and cook-up', () => {
    const d = dayPlan('2026-11-11');
    expect(d.week).toBe(1);
    expect(d.session).toBe('restCook');
    expect(d.isRest).toBe(true);
  });
  it('applies pull-up test days only on Sun 22 Nov and Sun 27 Dec', () => {
    expect(dayPlan('2026-11-22').isTestDay).toBe(true);
    expect(dayPlan('2026-12-27').isTestDay).toBe(true);
    expect(dayPlan('2026-11-15').isTestDay).toBe(false);
    expect(dayPlan('2026-11-29').isTestDay).toBe(false);
    expect(dayPlan('2026-11-22').notes[0]).toMatch(/Pull-up max test/);
  });
  it('festive fortnight moves weekday sessions to 10:00–11:30 but not weekends or football', () => {
    expect(dayPlan('2026-12-18').isFestive).toBe(false);
    expect(dayPlan('2026-12-19').isFestive).toBe(true);
    expect(dayPlan('2027-01-01').isFestive).toBe(true);
    expect(dayPlan('2027-01-02').isFestive).toBe(false);
    expect(dayPlan('2026-12-21').when).toBe('10:00–11:30'); // Mon jog
    expect(dayPlan('2026-12-22').when).toBe('10:00–11:30'); // Tue strength C
    expect(dayPlan('2026-12-19').when).toBe('Morning, 08:00–10:00'); // Sat
    expect(dayPlan('2026-12-24').session).toBe('football');
    expect(dayPlan('2026-12-24').when).toBe('Evening');
    expect(dayPlan('2026-12-24', { 7: false }).session).toBe('walk');
    expect(dayPlan('2026-12-24', { 7: false }).when).toBe('10:00–11:30');
    expect(dayPlan('2027-01-11').when).toBe('After school or evening');
  });
  it('gives a valid week and session for every day of the plan', () => {
    for (let d = '2026-11-09'; d <= '2027-01-31'; d = addDays(d, 1)) {
      const p = dayPlan(d, { 2: false, 7: false, 8: false });
      expect(p.week).toBeGreaterThanOrEqual(1);
      expect(p.week).toBeLessThanOrEqual(12);
      if (weekdayIndex(d) === 3) expect(['football', 'walk']).toContain(p.session);
      if (weekdayIndex(d) === 6) expect(p.session).toBe('strengthB');
    }
  });
  it('jog progression adds about 5 min a fortnight up to 35–40', () => {
    expect(jogTarget(1)).toEqual({ min: 20, max: 25 });
    expect(jogTarget(2)).toEqual({ min: 20, max: 25 });
    expect(jogTarget(3)).toEqual({ min: 25, max: 30 });
    expect(jogTarget(5)).toEqual({ min: 30, max: 35 });
    expect(jogTarget(7)).toEqual({ min: 35, max: 40 });
    expect(jogTarget(12)).toEqual({ min: 35, max: 40 });
    expect(dayPlan('2026-11-23').length).toBe('25–30 min');
  });
  it('waist Sundays: week 1 start then every other Sunday from 22 Nov', () => {
    expect(isWaistSunday('2026-11-09')).toBe(true);
    expect(isWaistSunday('2026-11-15')).toBe(false);
    expect(isWaistSunday('2026-11-22')).toBe(true);
    expect(isWaistSunday('2026-11-29')).toBe(false);
    expect(isWaistSunday('2026-12-06')).toBe(true);
    expect(isWaistSunday('2027-01-31')).toBe(true);
  });
});
