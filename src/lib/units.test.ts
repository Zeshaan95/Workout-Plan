import { describe, expect, it } from 'vitest';
import { formatStLb, kgToLb, kgToStLb, stoneToKg } from './units';

describe('stone/kg conversion', () => {
  it('uses 1 st = 6.35029 kg and 1 kg = 2.20462 lb', () => {
    expect(stoneToKg(1)).toBeCloseTo(6.35029, 5);
    expect(kgToLb(1)).toBeCloseTo(2.20462, 5);
  });
  it('97.0 kg is 15 st 4 lb', () => {
    expect(kgToStLb(97)).toEqual({ st: 15, lb: 4, negative: false });
    expect(formatStLb(97)).toBe('15 st 4 lb');
  });
  it('milestones line up with stones down from 97 kg', () => {
    expect(97 - stoneToKg(1)).toBeCloseTo(90.65, 2);
    expect(97 - stoneToKg(1.5)).toBeCloseTo(87.5, 1);
    expect(97 - stoneToKg(2)).toBeCloseTo(84.3, 1);
  });
  it('formats small and negative amounts', () => {
    expect(formatStLb(stoneToKg(1))).toBe('1 st 0 lb');
    expect(formatStLb(1)).toBe('2 lb');
    expect(formatStLb(-6.35029)).toBe('−1 st 0 lb');
    expect(formatStLb(95.75)).toBe('15 st 1 lb');
  });
});
