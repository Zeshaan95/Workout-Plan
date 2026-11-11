import { describe, expect, it } from 'vitest';
import { PLAN } from '../plan';
import { weightChartData } from './charts';
import { dailyReadings } from './weight';

describe('weight chart data', () => {
  const daily = dailyReadings(PLAN.seed.weighIns.map((w) => ({ ...w, time: '07:00' })));
  const rows = weightChartData(daily, '2026-11-11');
  const at = (d: string) => rows.find((r) => r.date === d)!;
  it('spans the history start to the plan end', () => {
    expect(rows[0].date).toBe('2026-10-18');
    expect(rows[rows.length - 1].date).toBe('2027-01-31');
  });
  it('plots every seed reading as a dot', () => {
    for (const w of PLAN.seed.weighIns) expect(at(w.date).reading).toBe(w.kg);
    expect(rows.filter((r) => r.reading != null)).toHaveLength(6);
  });
  it('target line follows the path from 9 Nov only', () => {
    expect(at('2026-11-08').target).toBeNull();
    for (const p of PLAN.targetPath) expect(at(p.date).target).toBeCloseTo(p.kg, 6);
  });
  it('7-day average line only where there is enough data, up to today', () => {
    expect(at('2026-10-29').avg).toBeCloseTo(96.8, 6);
    expect(at('2026-11-09').avg).toBeNull();
    expect(at('2026-12-01').avg).toBeNull();
  });
});
