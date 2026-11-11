/**
 * Date helpers. All plan dates are ISO calendar strings ("2026-11-09") with no
 * time zone. Arithmetic is done in UTC so DST changes never shift a day.
 */
export type ISODate = string;

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function toUTC(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

export function fromUTC(ms: number): ISODate {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * DAY_MS);
}

/** Whole days from a to b (b − a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(d: ISODate): number {
  const js = new Date(toUTC(d)).getUTCDay(); // 0 = Sunday
  return (js + 6) % 7;
}

export function weekdayName(d: ISODate): string {
  return WEEKDAYS[weekdayIndex(d)];
}

export function shortWeekday(d: ISODate): string {
  return weekdayName(d).slice(0, 3);
}

/** "31 Oct 2026" */
export function formatUK(d: ISODate): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

/** "31 Oct" */
export function formatUKShort(d: ISODate): string {
  const [, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS[m - 1]}`;
}

/** "Wednesday 11 Nov 2026" */
export function formatUKLong(d: ISODate): string {
  return `${weekdayName(d)} ${formatUK(d)}`;
}

export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowTime(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function isBetween(d: ISODate, start: ISODate, end: ISODate): boolean {
  return d >= start && d <= end;
}

/** Monday of the week containing d. */
export function mondayOf(d: ISODate): ISODate {
  return addDays(d, -weekdayIndex(d));
}

export function rangeDays(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
