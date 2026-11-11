import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db, defaultSettings, type Settings } from './db';
import { todayISO, type ISODate } from './lib/dates';
import type { FootballMap } from './lib/schedule';
import { dailyReadings, type WeighIn } from './lib/weight';
import type { WorkoutLog } from './lib/workouts';

/** Today's date; ticks over at midnight. A `?date=` hash param or settings override can preview another date. */
export function useToday(override?: string | null): ISODate {
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    const t = setInterval(() => setToday(todayISO()), 60_000);
    const vis = () => setToday(todayISO());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return override && /^\d{4}-\d{2}-\d{2}$/.test(override) ? override : today;
}

export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get('app'), []) ?? defaultSettings();
}

export function useFootball(): FootballMap {
  const weeks = useLiveQuery(() => db.weeks.toArray(), []);
  return useMemo(() => Object.fromEntries((weeks ?? []).map((w) => [w.week, w.football])), [weeks]);
}

export async function setFootball(week: number, football: boolean) {
  await db.weeks.put({ week, football });
}

export function useWeighIns(): WeighIn[] | undefined {
  return useLiveQuery(() => db.weighIns.toArray(), []);
}

export function useDaily() {
  const w = useWeighIns();
  return useMemo(() => dailyReadings(w ?? []), [w]);
}

export function useWorkouts(): WorkoutLog[] {
  return useLiveQuery(() => db.workouts.toArray(), []) ?? [];
}
