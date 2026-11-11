import { describe, expect, it } from 'vitest';
import { addDays, diffDays, formatUK, formatUKLong, weekdayIndex } from './dates';

describe('dates', () => {
  it('formats UK style', () => {
    expect(formatUK('2026-10-31')).toBe('31 Oct 2026');
    expect(formatUKLong('2026-11-11')).toBe('Wednesday 11 Nov 2026');
  });
  it('does day arithmetic across month, year and DST boundaries', () => {
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(diffDays('2026-11-09', '2027-01-31')).toBe(83);
  });
  it('Monday is 0, Sunday is 6', () => {
    expect(weekdayIndex('2026-11-09')).toBe(0);
    expect(weekdayIndex('2026-11-15')).toBe(6);
    expect(weekdayIndex('2027-01-31')).toBe(6);
  });
});
