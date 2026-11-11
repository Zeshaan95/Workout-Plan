import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import HabitsForm from '../components/HabitsForm';
import { Badge, Card, NumInput, Page, Stat, StatusPill, Toggle } from '../components/ui';
import { db } from '../db';
import { setFootball, useDaily, useFootball, useToday, useWorkouts } from '../hooks';
import { PLAN, SESSION_LABELS } from '../plan';
import { diffDays, formatUK, formatUKLong, formatUKShort, nowTime, shortWeekday, weekdayIndex } from '../lib/dates';
import { dayPlan, daysLeft, weekIsFestive, weekPlan } from '../lib/schedule';
import { formatStLb } from '../lib/units';
import { nextMilestone, sevenDayAverage, targetFor, weeklyStatus } from '../lib/weight';
import { strengthWarnings } from '../lib/workouts';

function QuickWeigh({ date }: { date: string }) {
  const [kg, setKg] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const todays = useLiveQuery(() => db.weighIns.where('date').equals(date).toArray(), [date]);
  const first = todays?.slice().sort((a, b) => (a.time < b.time ? -1 : 1))[0];

  const save = async () => {
    if (kg == null || kg < 30 || kg > 300) return;
    await db.weighIns.add({ date, time: nowTime(), kg: Math.round(kg * 100) / 100 });
    setSaved(kg);
    setKg(null);
  };

  return (
    <Card>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex items-end gap-3"
      >
        <label className="flex-1">
          <span className="label">Weigh-in</span>
          <NumInput value={kg} onChange={setKg} placeholder={first ? first.kg.toFixed(2) : '96.50'} ariaLabel="Weight in kg" suffix="kg" className="[&_input]:h-14 [&_input]:text-2xl [&_input]:font-semibold" />
        </label>
        <button className="btn-primary h-14 w-24" disabled={kg == null}>
          Save
        </button>
      </form>
      <div className="muted mt-2 text-sm">
        {saved != null ? (
          <span className="font-medium text-emerald-600 dark:text-emerald-400">Saved {saved.toFixed(2)} kg ({formatStLb(saved)})</span>
        ) : first ? (
          <>Today: {first.kg.toFixed(2)} kg at {first.time} ({formatStLb(first.kg)}){todays!.length > 1 ? ` · ${todays!.length} readings, earliest counts` : ''}</>
        ) : (
          'Not weighed yet today. Weigh first thing, after the loo.'
        )}
      </div>
    </Card>
  );
}

export default function Today({ dateOverride }: { dateOverride?: string | null }) {
  const today = useToday(dateOverride);
  const football = useFootball();
  const daily = useDaily();
  const workouts = useWorkouts();
  const plan = dayPlan(today, football);
  const week = plan.week;

  const avg = sevenDayAverage(daily, today);
  const target = targetFor(today);
  const status = avg != null && target != null ? weeklyStatus(avg, target) : null;
  const latest = useMemo(() => {
    const ds = [...daily.keys()].filter((d) => d <= today).sort();
    return ds.length ? daily.get(ds[ds.length - 1])! : null;
  }, [daily, today]);
  const current = avg ?? latest;
  const next = current != null ? nextMilestone(current) : null;
  const warnings = strengthWarnings(workouts);
  const doneToday = workouts.filter((w) => w.date === today && w.status === 'complete');
  const inProgress = workouts.find((w) => w.date === today && w.status === 'in-progress');

  const beforeStart = today < PLAN.startDate;
  const afterEnd = today > PLAN.endDate;

  return (
    <Page
      title={formatUKLong(today)}
      subtitle={
        week ? (
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Week {week} of 12</span>
        ) : beforeStart ? (
          `Plan starts Monday ${formatUK(PLAN.startDate)} (${diffDays(today, PLAN.startDate)} days)`
        ) : (
          'Plan complete'
        )
      }
      right={dateOverride ? <a className="btn-secondary min-h-[36px] text-sm" href="#/today">Real today</a> : undefined}
    >
      <QuickWeigh date={today} />

      {warnings.length > 0 && (
        <Card className="bg-amber-50 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900">
          <div className="font-semibold text-amber-800 dark:text-amber-300">Check food and sleep</div>
          <div className="text-sm text-amber-800/80 dark:text-amber-300/80">
            {warnings.map((w) => w.name).join(', ')} {warnings.length > 1 ? 'have' : 'has'} dropped two sessions in a row.
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-start justify-between">
          <Stat
            big
            label="7-day average"
            value={avg != null ? `${avg.toFixed(2)}` : '—'}
            sub={avg != null ? `kg · ${formatStLb(avg)}` : 'Not enough data (need 3 readings in 7 days)'}
          />
          <StatusPill status={status} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Stat label="Target today" value={target != null ? target.toFixed(1) : '—'} sub="kg" />
          <Stat label={next ? `To ${next.label.replace(' down', '')}` : 'Goal'} value={current != null && next ? (current - next.kg).toFixed(1) : '✓'} sub={next ? `kg to ${next.kg}` : 'reached'} />
          <Stat label="To 84.3 kg" value={current != null ? Math.max(0, current - PLAN.goalKg).toFixed(1) : '—'} sub={`kg · ${daysLeft(today)} days left`} />
        </div>
      </Card>

      {!afterEnd && (
        <Card>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="muted text-xs font-medium uppercase tracking-wide">Today's session</span>
            {plan.isTestDay && <Badge tone="sky">Pull-up test day</Badge>}
            {plan.isFestive && <Badge tone="rose">Festive fortnight</Badge>}
            {plan.weekType === 'noFootball' && <Badge tone="amber">No-football week</Badge>}
          </div>
          <div className="text-xl font-bold">{plan.title}</div>
          {!plan.isRest && (
            <div className="muted mt-0.5">
              {plan.length} · {plan.when}
            </div>
          )}
          {plan.isRest && <div className="muted mt-0.5">Hit your {PLAN.dailyTargets.steps.toLocaleString('en-GB')} steps.</div>}
          {plan.notes.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {plan.notes.map((n) => (
                <li key={n} className="flex gap-2">
                  <span className="text-emerald-500">•</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            {!plan.isRest && (
              <a className="btn-primary flex-1" href={`#/log?date=${today}&session=${plan.session}`}>
                {doneToday.some((w) => w.session === plan.session) ? 'Done ✓ · view' : inProgress ? 'Continue session' : 'Start session'}
              </a>
            )}
            <a className="btn-secondary flex-1" href={`#/log?date=${today}`}>
              {plan.isRest ? 'Log a session' : 'Other session'}
            </a>
          </div>
        </Card>
      )}

      {week && (
        <Card>
          <Toggle
            checked={plan.weekType === 'football'}
            onChange={(v) => setFootball(week, v)}
            label="Football this Thursday?"
            sub={plan.weekType === 'football' ? 'Thursday: football, 60 min' : 'Thursday: 50–60 min incline walk; Tue split squats to 1 short'}
          />
          {weekIsFestive(week) && <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">{PLAN.festive.note}</p>}
          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {weekPlan(week, football).map((d) => {
              const done = workouts.some((w) => w.date === d.date && w.status === 'complete');
              const isToday = d.date === today;
              return (
                <a
                  key={d.date}
                  href={`#/plan?week=${week}`}
                  className={`rounded-lg px-0.5 py-1.5 ${isToday ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950' : 'bg-slate-50 dark:bg-slate-800/60'}`}
                >
                  <div className="text-[11px] font-semibold">{shortWeekday(d.date)}</div>
                  <div className="text-[10px] leading-tight opacity-80">{shortLabel(d.session)}</div>
                  <div className="text-xs">{done ? '✓' : d.isTestDay ? '★' : ' '}</div>
                </a>
              );
            })}
          </div>
        </Card>
      )}

      {weekdayIndex(today) === 6 && week && (
        <a href={`#/checkin?date=${today}`} className="card block bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-900">
          <div className="font-semibold">Sunday check-in · week {week}</div>
          <div className="muted text-sm">Status, waist and adjustment advice →</div>
        </a>
      )}

      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="h2">Today's habits</h2>
          <a href={`#/habits?date=${today}`} className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            Week view ›
          </a>
        </div>
        <HabitsForm date={today} isRestDay={plan.isRest} compact />
      </Card>

      <p className="muted pb-2 text-center text-xs">
        Goal: 2 stone down (84.3 kg) by Sunday {formatUKShort(PLAN.endDate)} 2027
      </p>
    </Page>
  );
}

function shortLabel(s: keyof typeof SESSION_LABELS): string {
  return { jog: 'Jog', strengthC: 'Str C', restCook: 'Rest', football: 'Footy', restSteps: 'Rest', strengthA: 'Str A', strengthB: 'Str B', walk: 'Walk' }[s];
}
