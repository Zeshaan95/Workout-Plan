import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useSettings } from '../hooks';
import type { ISODate } from '../lib/dates';
import { habitResults, type HabitDay } from '../lib/habits';
import { NumInput } from './ui';

function Tick({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="w-6 text-center text-slate-300 dark:text-slate-600">–</span>;
  return <span className={`w-6 text-center text-lg ${ok ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>{ok ? '✓' : '○'}</span>;
}

export default function HabitsForm({ date, isRestDay, compact }: { date: ISODate; isRestDay: boolean; compact?: boolean }) {
  const t = useSettings().targets;
  const h = useLiveQuery(() => db.habits.get(date), [date]);
  const save = (patch: Partial<HabitDay>) => db.habits.put({ ...(h ?? { date }), ...patch, date });
  const res = habitResults(h, t, isRestDay);

  const numRow = (key: keyof HabitDay, label: string, target: string, ok: boolean | null, decimal: boolean, suffix: string) => (
    <div className="flex items-center gap-3 py-1.5">
      <Tick ok={ok} />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        <div className="muted text-xs">{target}</div>
      </div>
      <NumInput
        className="w-32"
        decimal={decimal}
        suffix={suffix}
        ariaLabel={label}
        value={(h?.[key] as number | null | undefined) ?? null}
        onChange={(v) => save({ [key]: v } as Partial<HabitDay>)}
      />
    </div>
  );

  const tickRow = (key: 'creatine' | 'sessionDone', label: string, sub: string, ok: boolean | null) => (
    <button type="button" onClick={() => save({ [key]: !h?.[key] })} className="flex min-h-[52px] w-full items-center gap-3 py-1.5 text-left" disabled={ok === null}>
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 text-sm font-bold ${h?.[key] ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
        {h?.[key] ? '✓' : ''}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        <span className="muted block text-xs">{ok === null ? 'Rest day' : sub}</span>
      </span>
    </button>
  );

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {numRow('kcal', 'Calories', `${t.kcal.toLocaleString('en-GB')} kcal (never below ${t.kcalFloor.toLocaleString('en-GB')})`, h?.kcal != null ? res.kcal : false, false, 'kcal')}
      {numRow('protein', 'Protein', `${t.proteinMin}–${t.proteinMax} g`, res.protein, false, 'g')}
      {numRow('steps', 'Steps', `${t.steps.toLocaleString('en-GB')}`, res.steps, false, '')}
      {numRow('waterL', 'Water', `${t.waterMin}–${t.waterMax} L`, res.water, true, 'L')}
      {numRow('sleepH', 'Sleep', `${t.sleepMin}–${t.sleepMax} hours`, res.sleep, true, 'h')}
      {tickRow('creatine', 'Creatine', 'Daily, no stopping mid-plan', res.creatine)}
      {!compact || !isRestDay ? tickRow('sessionDone', 'Session done', "Today's planned session", res.session) : null}
    </div>
  );
}
