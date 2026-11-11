import { describe, expect, it } from 'vitest';
import { fill } from '../test/helpers';
import { adjustmentAdvice, kcalCut, planPacePerDay, week4Check } from './rules';

const base = { liftsDown: false, currentKcal: 1900 };

describe('rule 3: adjustment advice', () => {
  it('does not advise before Sun 22 Nov 2026', () => {
    const m = fill(new Map(), '2026-11-09', '2026-11-15', 96);
    expect(adjustmentAdvice({ ...base, daily: m, date: '2026-11-15' }).band).toBe('not-yet');
  });
  it('reports not enough data without a 7-day average', () => {
    expect(adjustmentAdvice({ ...base, daily: new Map(), date: '2026-11-22' }).band).toBe('no-data');
  });
  it('0.9–1.4 kg/week: change nothing', () => {
    const m = fill(new Map(), '2026-11-16', '2026-11-22', 95.0); // (97 − 95) / 2 = 1.0
    const a = adjustmentAdvice({ ...base, daily: m, date: '2026-11-22' });
    expect(a.band).toBe('on-pace');
    expect(a.actions).toEqual([]);
    const edge = adjustmentAdvice({ ...base, daily: fill(new Map(), '2026-11-16', '2026-11-22', 94.2), date: '2026-11-22' });
    expect(edge.rate).toBeCloseTo(1.4, 6);
    expect(edge.band).toBe('on-pace');
  });
  it('0.5 to under 0.9: add 2,000 steps first', () => {
    const m = fill(new Map(), '2026-11-16', '2026-11-22', 95.5); // 0.75
    const a = adjustmentAdvice({ ...base, daily: m, date: '2026-11-22' });
    expect(a.band).toBe('slow');
    expect(a.actions.map((x) => x.kind)).toEqual(['addSteps']);
    expect(a.actions[0].amount).toBe(2000);
  });
  it('still in the slow band the following Sunday: cut 150 kcal (never protein, never below 1,750)', () => {
    const m = fill(new Map(), '2026-11-09', '2026-11-15', 96.5);
    fill(m, '2026-11-16', '2026-11-22', 95.5); // 22 Nov: (97 − 95.5)/2 = 0.75
    fill(m, '2026-11-23', '2026-11-29', 94.9); // 29 Nov: (96.5 − 94.9)/2 = 0.8
    const a = adjustmentAdvice({ ...base, daily: m, date: '2026-11-29' });
    expect(a.band).toBe('slow');
    expect(a.actions.map((x) => x.kind)).toEqual(['cutKcal']);
    expect(a.actions[0].amount).toBe(150);
    expect(a.actions[0].text).toMatch(/Never cut protein/);
    const atFloor = adjustmentAdvice({ ...base, currentKcal: 1750, daily: m, date: '2026-11-29' });
    expect(atFloor.actions.map((x) => x.kind)).toEqual(['addSteps']);
  });
  it('under 0.5: food audit then both changes', () => {
    const m = fill(new Map(), '2026-11-16', '2026-11-22', 96.6); // 0.2
    const a = adjustmentAdvice({ ...base, daily: m, date: '2026-11-22' });
    expect(a.band).toBe('stalled');
    expect(a.actions.map((x) => x.kind)).toEqual(['foodAudit', 'addSteps', 'cutKcal']);
  });
  it('over 1.5 with lifts going down: add 150 kcal carbs; otherwise change nothing', () => {
    const m = fill(new Map(), '2026-11-16', '2026-11-22', 93.8); // 1.6
    const down = adjustmentAdvice({ ...base, liftsDown: true, daily: m, date: '2026-11-22' });
    expect(down.band).toBe('too-fast');
    expect(down.actions[0]).toMatchObject({ kind: 'addCarbs', amount: 150 });
    const up = adjustmentAdvice({ ...base, daily: m, date: '2026-11-22' });
    expect(up.band).toBe('other');
    expect(up.actions).toEqual([]);
  });
  it('anything else (e.g. 1.45 kg/week) changes nothing', () => {
    const m = fill(new Map(), '2026-11-16', '2026-11-22', 94.1);
    expect(adjustmentAdvice({ ...base, daily: m, date: '2026-11-22' }).band).toBe('other');
  });
  it('never suggests a sixth hard session', () => {
    const m = fill(new Map(), '2026-11-16', '2026-11-22', 96.6);
    const a = adjustmentAdvice({ ...base, daily: m, date: '2026-11-22' });
    const text = [a.headline, ...a.actions.map((x) => x.text)].join(' ').toLowerCase();
    expect(text).not.toMatch(/add (a|another) (session|workout)/);
    expect(a.notes.join(' ')).toMatch(/Never add a sixth hard session/);
  });
  it('kcal cut respects the floor', () => {
    expect(kcalCut(1900)?.amount).toBe(150);
    expect(kcalCut(1800)?.amount).toBe(50);
    expect(kcalCut(1750)).toBeNull();
  });
});

describe('rule 4: week 4 check', () => {
  it('passes when within 2 kg of target', () => {
    const r = week4Check(fill(new Map(), '2026-11-30', '2026-12-06', 94.0));
    expect(r.applies).toBe(false);
  });
  it('more than 2 kg above: keep the pace and push the 2-stone date back', () => {
    const r = week4Check(fill(new Map(), '2026-11-30', '2026-12-06', 95.0));
    expect(r.applies).toBe(true);
    expect(r.overBy).toBeCloseTo(2.6, 6);
    // pace (92.4 − 84.3) / 56 days ≈ 0.1446 kg/day → 18 more days
    expect(planPacePerDay()).toBeCloseTo(8.1 / 56, 9);
    expect(r.newGoalDate).toBe('2027-02-18');
    expect(r.message).toMatch(/Do not cut harder/);
  });
  it('exactly 2 kg above does not trigger', () => {
    expect(week4Check(fill(new Map(), '2026-11-30', '2026-12-06', 94.4)).applies).toBe(false);
  });
});
