import { useMemo, useState } from 'react';
import { Card, NumInput, Page } from '../components/ui';
import { db } from '../db';
import { useFootball, useToday, useWeighIns, useWorkouts } from '../hooks';
import { PLAN } from '../plan';
import { addDays, formatUKShort, rangeDays, shortWeekday } from '../lib/dates';
import { dayPlan } from '../lib/schedule';
import { formatStLb } from '../lib/units';

export default function CatchUp({ first }: { first: boolean }) {
  const today = useToday();
  const football = useFootball();
  const weighIns = useWeighIns() ?? [];
  const workouts = useWorkouts();
  const days = useMemo(() => (today >= PLAN.startDate ? rangeDays(PLAN.startDate, today) : []), [today]);
  const [drafts, setDrafts] = useState<Record<string, number | null>>({});

  const existing = (d: string) => weighIns.filter((w) => w.date === d).sort((a, b) => (a.time < b.time ? -1 : 1))[0];

  const saveWeights = async () => {
    const rows = Object.entries(drafts).filter(([, v]) => v != null && v > 30 && v < 300);
    for (const [date, kg] of rows) await db.weighIns.add({ date, time: '07:00', kg: Math.round(kg! * 100) / 100 });
    setDrafts({});
  };

  const markDone = async (date: string, session: ReturnType<typeof dayPlan>['session']) => {
    const found = workouts.find((w) => w.date === date && w.session === session);
    if (found?.id != null) {
      await db.workouts.update(found.id, { status: found.status === 'complete' ? 'in-progress' : 'complete' });
    } else {
      await db.workouts.add({ date, session, status: 'complete', entries: [], completedAt: new Date().toISOString(), notes: 'Logged on catch-up screen' });
    }
    const h = await db.habits.get(date);
    await db.habits.put({ ...(h ?? { date }), date, sessionDone: found?.status !== 'complete' });
  };

  const finish = async () => {
    await saveWeights();
    await db.settings.update('app', { onboarded: true });
    window.location.hash = '/today';
  };

  return (
    <Page
      title={first ? 'Welcome' : 'Catch up'}
      subtitle={first ? 'Your plan and the history from 18 Oct are loaded. Add anything you have logged since Mon 9 Nov.' : 'Add weigh-ins and sessions since Mon 9 Nov 2026'}
      back={first ? undefined : '#/more'}
    >
      {days.length === 0 && <Card>The plan starts on Monday 9 Nov 2026. Nothing to catch up yet.</Card>}
      {days.length > 0 && (
        <Card className="p-0">
          <div className="px-4 pt-4">
            <h2 className="h2">Weigh-ins</h2>
            <p className="muted text-sm">Type a weight for any day. Days you've already logged show their reading.</p>
          </div>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {days.map((d) => {
              const ex = existing(d);
              return (
                <li key={d} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-24 text-sm font-semibold">{shortWeekday(d)} {formatUKShort(d)}</span>
                  {ex ? (
                    <span className="flex-1 text-right tabular-nums">{ex.kg.toFixed(2)} kg <span className="muted text-sm">{formatStLb(ex.kg)}</span></span>
                  ) : (
                    <NumInput className="flex-1" value={drafts[d] ?? null} onChange={(v) => setDrafts({ ...drafts, [d]: v })} suffix="kg" ariaLabel={`Weight on ${d}`} />
                  )}
                </li>
              );
            })}
          </ul>
          <div className="p-4">
            <button className="btn-primary w-full" onClick={saveWeights} disabled={!Object.values(drafts).some((v) => v != null)}>
              Save weigh-ins
            </button>
          </div>
        </Card>
      )}
      {days.length > 0 && (
        <Card className="p-0">
          <div className="px-4 pt-4">
            <h2 className="h2">Sessions</h2>
            <p className="muted text-sm">Tick sessions you did, or tap "sets" to log the detail for that day.</p>
          </div>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {days.filter((d) => d < addDays(today, 1)).map((d) => {
              const p = dayPlan(d, football);
              if (p.isRest) return null;
              const log = workouts.find((w) => w.date === d && w.session === p.session);
              const done = log?.status === 'complete';
              return (
                <li key={d} className="flex items-center gap-3 px-4 py-2">
                  <button onClick={() => markDone(d, p.session)} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 font-bold ${done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`} aria-label="Done">
                    {done ? '✓' : ''}
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{shortWeekday(d)} {formatUKShort(d)}</span>
                    <span className="muted block truncate text-sm">{p.title}</span>
                  </span>
                  <a className="btn-secondary min-h-[40px] px-3 text-sm" href={`#/log?date=${d}&session=${p.session}`}>Sets</a>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <button className="btn-primary w-full" onClick={finish}>
        {first ? 'Go to Today' : 'Done'}
      </button>
    </Page>
  );
}
