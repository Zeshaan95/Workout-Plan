import { useEffect, useMemo, useRef, useState } from 'react';
import RestTimer, { type TimerState } from '../components/RestTimer';
import { Badge, Card, NumInput, Page } from '../components/ui';
import { db } from '../db';
import { useFootball, useToday, useWorkouts } from '../hooks';
import { EXERCISES, SESSION_LABELS, STRENGTH_SESSIONS, type ExerciseDef, type SessionId } from '../plan';
import { formatUK, formatUKShort, weekdayName } from '../lib/dates';
import { dayPlan, jogTarget, weekNumber } from '../lib/schedule';
import { buildStrengthLog, isStrength, prescription, supersetSteps, type Prescription } from '../lib/session';
import { completedSets, type ExerciseEntry, type SetLog, type WorkoutLog } from '../lib/workouts';

const ALL_SESSIONS: SessionId[] = ['strengthA', 'strengthB', 'strengthC', 'jog', 'football', 'walk'];

function lastSummary(p: Prescription, def: ExerciseDef): string | null {
  if (!p.last) return null;
  const sets = completedSets(p.last.entry);
  const body = sets
    .map((s) => {
      if (def.kind === 'weighted') return `${s.weightKg ?? '?'}×${s.reps}`;
      return `${s.reps}${s.backpackKg ? `+${s.backpackKg}kg` : ''}`;
    })
    .join(', ');
  return `Last time (${formatUKShort(p.last.date)}): ${body}${p.last.entry.feetRaised ? ' · feet raised' : ''}`;
}

function SetRow({
  def,
  set,
  index,
  aim,
  label,
  active,
  onChange,
  onDone,
}: {
  def: ExerciseDef;
  set: SetLog;
  index: number;
  aim: number | null;
  label?: string;
  active?: boolean;
  onChange: (s: SetLog) => void;
  onDone: () => void;
}) {
  const weighted = def.kind === 'weighted';
  return (
    <div className={`flex items-center gap-2 rounded-xl px-1 py-1 ${active ? 'bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900' : ''}`}>
      <span className="w-9 shrink-0 text-center text-sm font-semibold text-slate-500">{label ?? index + 1}</span>
      {weighted ? (
        <NumInput className="flex-1" value={set.weightKg} onChange={(v) => onChange({ ...set, weightKg: v })} suffix="kg" ariaLabel={`Set ${index + 1} weight`} />
      ) : (
        <NumInput className="w-28 shrink-0" value={set.backpackKg} onChange={(v) => onChange({ ...set, backpackKg: v })} placeholder="+pack" suffix="kg" ariaLabel={`Set ${index + 1} backpack kg`} />
      )}
      <span className="muted text-sm">×</span>
      <NumInput className="flex-1" decimal={false} value={set.reps} onChange={(v) => onChange({ ...set, reps: v })} placeholder={aim != null ? String(aim) : ''} suffix="reps" ariaLabel={`Set ${index + 1} reps`} />
      <button
        type="button"
        onClick={() => {
          if (set.done) onChange({ ...set, done: false });
          else onDone();
        }}
        aria-label={set.done ? 'Undo set' : 'Set done'}
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${set.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}
      >
        ✓
      </button>
    </div>
  );
}

function ExerciseHeader({ def, p }: { def: ExerciseDef; p: Prescription }) {
  const last = lastSummary(p, def);
  return (
    <div className="mb-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold">{def.name}</h3>
        {def.compound && <Badge tone="slate">Compound</Badge>}
        {p.suggestions.map((s) => (
          <Badge key={s.badge} tone="emerald">
            ▲ {s.badge}
          </Badge>
        ))}
      </div>
      <div className="muted text-sm">
        {p.text}
        {p.aim != null && def.kind !== 'weighted' ? ` · aim ${p.aim}/set` : ''}
        {def.kind === 'test' ? ` · ${def.restLabel}` : ` · rest ${def.restLabel}`}
      </div>
      {p.cue && <div className="text-sm text-slate-600 dark:text-slate-300">{p.cue}</div>}
      {p.aimBasis && def.kind !== 'weighted' && <div className="muted text-xs">Aim: {p.aimBasis}</div>}
      {last && <div className="mt-1 text-sm font-medium text-sky-700 dark:text-sky-300">{last}</div>}
      {!last && def.kind !== 'test' && <div className="muted mt-1 text-sm">No previous log for this exercise.</div>}
      {p.suggestions.map((s) => (
        <div key={s.detail} className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
          {s.detail}
        </div>
      ))}
    </div>
  );
}

function ExtraControls({ def, entry, onEntry, p }: { def: ExerciseDef; entry: ExerciseEntry; onEntry: (e: ExerciseEntry) => void; p: Prescription }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <button className="btn-secondary min-h-[40px] px-3 text-sm" onClick={() => onEntry({ ...entry, sets: [...entry.sets, { ...entry.sets[entry.sets.length - 1], reps: null, done: false }] })}>
        + Set
      </button>
      {entry.sets.length > 1 && (
        <button className="btn-secondary min-h-[40px] px-3 text-sm" onClick={() => onEntry({ ...entry, sets: entry.sets.slice(0, -1) })}>
          − Set
        </button>
      )}
      {def.feetRaisedAfter != null && (
        <label className="flex min-h-[40px] items-center gap-2 rounded-xl bg-slate-100 px-3 dark:bg-slate-800">
          <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={!!entry.feetRaised} onChange={(e) => onEntry({ ...entry, feetRaised: e.target.checked })} />
          Feet raised
        </label>
      )}
      {def.maxMinusOne && def.id !== 'pullup' && (
        <label className="flex items-center gap-2">
          <span className="muted">Tested max</span>
          <NumInput className="w-24" decimal={false} value={entry.testMax ?? null} onChange={(v) => onEntry({ ...entry, testMax: v })} placeholder={p.testedMax ? String(p.testedMax.reps) : '—'} ariaLabel="Tested max" />
        </label>
      )}
      {def.id === 'pullup' && p.testedMax && (
        <span className="muted">
          Tested max {p.testedMax.reps}
          {p.testedMax.date ? ` (${formatUKShort(p.testedMax.date)})` : ' (previous best)'}
        </span>
      )}
    </div>
  );
}

function CardioForm({ log, onChange, session, date }: { log: WorkoutLog; onChange: (l: WorkoutLog) => void; session: SessionId; date: string }) {
  const week = weekNumber(date);
  const jt = week ? jogTarget(week) : null;
  return (
    <Card>
      <div className="grid grid-cols-2 gap-3">
        <label className={session === 'jog' || session === 'walk' ? '' : 'col-span-2'}>
          <span className="label">Duration</span>
          <NumInput decimal={false} value={log.durationMin} onChange={(v) => onChange({ ...log, durationMin: v })} suffix="min" ariaLabel="Duration in minutes" placeholder={session === 'jog' && jt ? `${jt.min}` : session === 'walk' ? '55' : '60'} />
        </label>
        {(session === 'jog' || session === 'walk') && (
          <label>
            <span className="label">Distance{session === 'walk' ? ' (optional)' : ''}</span>
            <NumInput value={log.distanceKm} onChange={(v) => onChange({ ...log, distanceKm: v })} suffix="km" ariaLabel="Distance in km" />
          </label>
        )}
      </div>
      {session === 'jog' && jt && (
        <p className="muted mt-2 text-sm">
          This week: {jt.min}–{jt.max} min at a conversational pace (or 4 min jog / 1 min walk). +5 min each fortnight, cap 35–40. Never more than 2 runs a week.
        </p>
      )}
      {session === 'walk' && <p className="muted mt-2 text-sm">50–60 min incline treadmill walk or a long brisk outdoor walk. Once Monday's jog is a comfortable 30 min, this can be a second easy jog.</p>}
    </Card>
  );
}

export default function Logger({ date: dateParam, session: sessionParam }: { date?: string | null; session?: string | null }) {
  const today = useToday();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const football = useFootball();
  const plan = dayPlan(date, football);
  const session: SessionId | null = (ALL_SESSIONS as string[]).includes(sessionParam ?? '') ? (sessionParam as SessionId) : plan.isRest ? null : plan.session;
  const allLogs = useWorkouts();
  const history = useMemo(() => allLogs.filter((l) => l.date < date), [allLogs, date]);

  const [logState, setLog] = useState<WorkoutLog | null>(null);
  // Ignore a stale log from the previous date/session during the render before the load effect runs.
  const log = logState && logState.date === date && logState.session === session ? logState : null;
  const [timer, setTimer] = useState<TimerState | null>(null);
  const idRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancel = false;
    setLog(null);
    idRef.current = undefined;
    if (!session) return;
    (async () => {
      const existing = (await db.workouts.where('date').equals(date).toArray()).find((w) => w.session === session);
      if (cancel) return;
      if (existing) {
        idRef.current = existing.id;
        setLog(existing);
        return;
      }
      const all = await db.workouts.toArray();
      const fresh: WorkoutLog = isStrength(session)
        ? buildStrengthLog(session, date, plan.weekType, all)
        : { date, session, status: 'in-progress', startedAt: new Date().toISOString(), entries: [] };
      if (!cancel) setLog(fresh);
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, session]);

  // Writes are queued so the first add finishes before later puts reuse its id.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const persist = (next: WorkoutLog): Promise<void> => {
    setLog(next);
    queue.current = queue.current.then(async () => {
      const { id: _id, ...rest } = next;
      void _id;
      if (idRef.current == null) idRef.current = await db.workouts.add(rest);
      else await db.workouts.put({ ...rest, id: idRef.current });
    });
    return queue.current;
  };

  const updateEntry = (i: number, e: ExerciseEntry) => {
    if (!log) return;
    const entries = log.entries.slice();
    entries[i] = e;
    persist({ ...log, entries });
  };

  const markSet = (i: number, si: number, aim: number | null, restSec: number, label: string) => {
    if (!log) return;
    const e = log.entries[i];
    const sets = e.sets.slice();
    sets[si] = { ...sets[si], reps: sets[si].reps ?? aim, done: true };
    updateEntry(i, { ...e, sets });
    setTimer({ endAt: Date.now() + restSec * 1000, total: restSec, label });
  };

  const complete = async () => {
    if (!log) return;
    const next: WorkoutLog = { ...log, status: log.status === 'complete' ? 'in-progress' : 'complete', completedAt: new Date().toISOString() };
    await persist(next);
    if (next.status === 'complete') {
      const h = await db.habits.get(date);
      await db.habits.put({ ...(h ?? { date }), date, sessionDone: true });
      setTimer(null);
    }
  };

  const remove = async () => {
    if (idRef.current != null && confirm('Delete this session log?')) {
      await db.workouts.delete(idRef.current);
      window.location.hash = '/today';
    }
  };

  const strength = session && isStrength(session) ? STRENGTH_SESSIONS[session] : null;
  const defFor = (e: ExerciseEntry) => EXERCISES[e.defKey ?? e.exerciseId] ?? Object.values(EXERCISES).find((d) => d.id === e.exerciseId)!;
  const presFor = (e: ExerciseEntry) => prescription(defFor(e), date, plan.weekType, history);

  // Next undone superset step, for highlighting.
  const steps = log && session === 'strengthC' ? supersetSteps(log) : [];
  const nextStep = steps.find((s) => !log!.entries[s.entryIndex].sets[s.set].done);

  return (
    <Page
      title={session ? SESSION_LABELS[session] : 'Log a session'}
      subtitle={`${weekdayName(date)} ${formatUK(date)}${plan.week ? ` · week ${plan.week}` : ''}${log?.status === 'complete' ? ' · complete ✓' : ''}`}
      back="#/today"
    >
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {ALL_SESSIONS.map((s) => (
          <a
            key={s}
            href={`#/log?date=${date}&session=${s}`}
            className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${s === session ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800'} ${!plan.isRest && s === plan.session && s !== session ? 'ring-2 ring-emerald-500' : ''}`}
          >
            {SESSION_LABELS[s].replace(' (gym)', '').replace(' (garage)', '')}
          </a>
        ))}
      </div>
      {!session && <Card>Rest day: {plan.title}. Pick a session above if you trained anyway.</Card>}
      {session && plan.session !== session && !plan.isRest && <p className="muted text-sm">Planned today: {plan.title}</p>}
      {plan.isTestDay && session === 'strengthB' && <Card className="bg-sky-50 ring-sky-200 dark:bg-sky-950/40 dark:ring-sky-900"><b>Pull-up test day.</b> Do the max test first, before any other sets. Strict reps only.</Card>}

      {strength && (
        <details className="card">
          <summary className="cursor-pointer font-semibold">
            Warm-up & rules · {strength.location}
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {strength.warmUp.map((w) => <li key={w}>{w}</li>)}
          </ul>
          <ul className="muted mt-2 list-disc space-y-1 pl-5 text-sm">
            {[...strength.rules, ...(strength.progression ?? [])].map((r) => <li key={r}>{r}</li>)}
          </ul>
        </details>
      )}

      {log && strength?.format === 'straight' &&
        log.entries.map((e, i) => {
          const def = defFor(e);
          const p = presFor(e);
          if (def.kind === 'test') {
            return (
              <Card key={i} className="ring-sky-300 dark:ring-sky-800">
                <ExerciseHeader def={def} p={p} />
                <div className="muted mb-2 text-sm">Previous: {p.testedMax?.reps ?? '—'} strict reps{p.testedMax?.date ? ` (${formatUKShort(p.testedMax.date)})` : ' (previous best)'}</div>
                <label className="flex items-center gap-3">
                  <span className="font-medium">Strict reps</span>
                  <NumInput className="flex-1" decimal={false} value={e.sets[0]?.reps} onChange={(v) => updateEntry(i, { ...e, sets: [{ reps: v, done: v != null }] })} ariaLabel="Pull-up max test reps" />
                </label>
                {e.sets[0]?.reps ? <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">Working sets today: 4 × {e.sets[0].reps - 1}</p> : null}
              </Card>
            );
          }
          // Pull-ups after a same-day test use the new max.
          const testToday = log.entries.find((x) => x.exerciseId === 'pullupTest')?.sets[0]?.reps;
          const aim = def.id === 'pullup' && testToday ? Math.max(testToday - 1, p.aim ?? 0) : p.aim;
          return (
            <Card key={i}>
              <ExerciseHeader def={def} p={{ ...p, aim }} />
              <div className="space-y-1">
                {e.sets.map((s, si) => (
                  <SetRow key={si} def={def} set={s} index={si} aim={aim} onChange={(ns) => updateEntry(i, { ...e, sets: e.sets.map((x, k) => (k === si ? ns : x)) })} onDone={() => markSet(i, si, aim, def.restSec, `${def.name} (${def.restLabel})`)} />
                ))}
              </div>
              <ExtraControls def={def} entry={e} onEntry={(ne) => updateEntry(i, ne)} p={p} />
            </Card>
          );
        })}

      {log && strength?.format === 'supersets' &&
        strength.supersets!.map(([a, b], pair) => {
          const ia = log.entries.findIndex((e) => e.defKey === a);
          const ib = log.entries.findIndex((e) => e.defKey === b);
          const pairSteps = steps.filter((s) => s.pair === pair);
          return (
            <Card key={pair}>
              <div className="muted mb-2 text-xs font-semibold uppercase tracking-wide">Superset {pair + 1} · alternate, rest 60–90 s between</div>
              {[ia, ib].map((idx, k) => {
                const e = log.entries[idx];
                const def = defFor(e);
                const p = presFor(e);
                return (
                  <div key={idx} className={k === 1 ? 'mt-3 border-t border-slate-100 pt-3 dark:border-slate-800' : ''}>
                    <div className="mb-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">{pair + 1}{k === 0 ? 'A' : 'B'}</div>
                    <ExerciseHeader def={def} p={p} />
                    <ExtraControls def={def} entry={e} onEntry={(ne) => updateEntry(idx, ne)} p={p} />
                  </div>
                );
              })}
              <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                {pairSteps.map((st) => {
                  const e = log.entries[st.entryIndex];
                  const def = defFor(e);
                  const p = presFor(e);
                  const isNext = nextStep && nextStep.entryIndex === st.entryIndex && nextStep.set === st.set;
                  return (
                    <div key={`${st.entryIndex}-${st.set}`}>
                      <div className="muted pl-11 text-[11px]">{def.name} · set {st.set + 1}</div>
                      <SetRow
                        def={def}
                        set={e.sets[st.set]}
                        index={st.set}
                        label={st.label}
                        aim={p.aim}
                        active={!!isNext}
                        onChange={(ns) => updateEntry(st.entryIndex, { ...e, sets: e.sets.map((x, k) => (k === st.set ? ns : x)) })}
                        onDone={() => markSet(st.entryIndex, st.set, p.aim, strength.supersetRestSec ?? def.restSec, `then ${nextLabel(log, steps, st)}`)}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}

      {log && session && !strength && <CardioForm log={log} onChange={persist} session={session} date={date} />}

      {log && (
        <Card>
          <label>
            <span className="label">Notes</span>
            <textarea className="input min-h-[80px] py-2 text-base" value={log.notes ?? ''} onChange={(e) => persist({ ...log, notes: e.target.value })} />
          </label>
        </Card>
      )}

      {log && (
        <div className="flex gap-2">
          <button className={`${log.status === 'complete' ? 'btn-secondary' : 'btn-primary'} flex-1`} onClick={complete}>
            {log.status === 'complete' ? 'Reopen session' : 'Mark session complete'}
          </button>
          {idRef.current != null && (
            <button className="btn-secondary text-rose-600" onClick={remove}>
              Delete
            </button>
          )}
        </div>
      )}

      <div className={timer ? 'h-24' : ''} />
      <RestTimer timer={timer} onChange={setTimer} />
    </Page>
  );
}

function nextLabel(log: WorkoutLog, steps: ReturnType<typeof supersetSteps>, cur: { entryIndex: number; set: number }): string {
  const i = steps.findIndex((s) => s.entryIndex === cur.entryIndex && s.set === cur.set);
  const n = steps.slice(i + 1).find((s) => !log.entries[s.entryIndex].sets[s.set].done);
  if (!n) return 'finish';
  const def = EXERCISES[log.entries[n.entryIndex].defKey ?? ''];
  return `${n.label} ${def?.name ?? ''}`;
}
