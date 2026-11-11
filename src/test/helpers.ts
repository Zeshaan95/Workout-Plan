import { addDays, type ISODate } from '../lib/dates';
import type { DailyMap } from '../lib/weight';

export function fill(map: DailyMap, start: ISODate, end: ISODate, kg: number): DailyMap {
  for (let d = start; d <= end; d = addDays(d, 1)) map.set(d, kg);
  return map;
}
