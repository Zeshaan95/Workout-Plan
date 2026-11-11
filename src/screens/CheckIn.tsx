import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Card, NumInput, Page, Stat, StatusPill } from '../components/ui';
import { db, type BodyComp, type CheckIn as CheckInRow } from '../db';
import { useDaily, useSettings, useToday, useWorkouts } from '../hooks';
import { PLAN } from '../plan';
import { addDays, formatUK, formatUKShort, weekdayIndex } from '../lib/dates';
import { adjustmentAdvice, week4Check, type AdviceAction } from '../lib/rules';
import { isWaistSunday, weekNumber, weekSunday } from '../lib/schedule';
import { formatStLb } from '../lib/units';
import { sevenDayAverage, STATUS_LABEL, targetFor, weeklyStatus } from '../lib/weight';
import { liftsGoingDown, strengthWarnings } from '../lib/workouts';

const SUNDAYS = [PLAN.waist.baselineDate, ...Array.from({ length: PLAN.totalWeeks }, (_, i) => weekSunday(i + 1))];

const BODY_FIELDS: [keyof BodyComp, string, string][] = [
  ['bodyFatPct', 'Body fat', '%'],
  ['subcutaneousFatPct', 'Subcutaneous fat', '%'],
  ['visceralFat', 'Visceral fat', ''],
  ['muscleMassKg', 'Muscle mass', 'kg'],
  ['skeletalMusclePct', 'Skeletal muscle', '%'],
  ['boneMassKg', 'Bone mass', 'kg'],
  ['fatFreeMassKg', 'Fat-free mass', 'kg'],
  ['bmrKcal', 'BMR', 'kcal'],
  ['bodyWaterPct', 'Body water', '%'],
  ['proteinPct', 'Protein', '%'],
  ['metabolicAge', 'Metabolic age', ''],
  ['bmi', 'BMI', ''],
];

function snapToSunday(d: string): string {
  if (d === PLAN.waist.baselineDate) return d;
  if (d < PLAN.startDate) return SUNDAYS[1];
  if (d > PLAN.endDate) return PLAN.endDate;
  return addDays(d, 6 - weekdayIndex(d));
}

export default function CheckIn({ date: dateParam }: { date?: string | null }) {
  const today = useToday();
  const date = snapToSunday(dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today);
  const daily = useDaily();
  const logs = useWorkouts();
  const settings = useSettings();
  const saved = useLiveQuery(() => db.checkIns.get(date), [date]);
  const body = useLiveQuery(() => db.bodyComps.where('date').equals(date).first(), [date]);
  const [draft, setDraft] = useState<CheckInRow>({ date });
  const [bodyDraft, setBodyDraft] = useState<BodyComp>({ date });
  const [flash, setFlash] = useState('');

  useEffect(() => setDraft(saved ?? { date }), [saved, date]);
  useEffect(() => setBodyDraft(body ?? { date }), [body, date]);

  const isBaseline = date === PLAN.waist.baselineDate;
  const week = weekNumber(date);
  const avg = sevenDayAverage(daily, date);
  const target = targetFor(date);
  const status = avg != null && target != null ? weeklyStatus(avg, target) : null;
  const advice = adjustmentAdvice({ daily, date, liftsDown: liftsGoingDown(logs.filter((l) => l.date <= date)), currentKcal: settings.targets.kcal });
  const w4 = date >= PLAN.rules.week4CheckDate ? week4Check(daily) : null;
  const warnings = strengthWarnings(logs.filter((l) => l.date <= date));
  const waistDue = isWaistSunday(date);
  const applied = draft.appliedActions ?? [];

  const save = async () => {
    const row: CheckInRow = {
      ...draft,
      date,
      avg7: avg,
      target,
      status: status ? STATUS_LABEL[status] : null,
      advice: [advice.headline, ...advice.actions.map((a) => a.text)].join(' '),
      savedAt: new Date().toISOString(),
    };
    await db.checkIns.put(row);
    const hasBody = BODY_FIELDS.some(([k]) => bodyDraft[k] != null);
    if (hasBody) {
      if (bodyDraft.id != null) await db.bodyComps.put({ ...bodyDraft, date });
      else await db.bodyComps.add({ ...bodyDraft, date, weightKg: bodyDraft.weightKg ?? daily.get(date) ?? null });
    }
    setFlash('Check-in saved');
    setTimeout(() => setFlash(''), 2000);
  };

  const apply = async (a: AdviceAction) => {
    const t = { ...settings.targets };
    if (a.kind === 'addSteps') t.steps += a.amount ?? 0;
    if (a.kind === 'cutKcal') t.kcal = Math.max(t.kcalFloor, t.kcal - (a.amount ?? 0));
    if (a.kind === 'addCarbs') {
      t.kcal += a.amount ?? 0;
      t.carbs += Math.round((a.amount ?? 0) / 4);
    }
    if (a.kind === 'foodAudit') {
      await db.settings.update('app', { auditStart: addDays(date, 1) });
    } else {
      await db.settings.update('app', { targets: t });
    }
    const next = { ...draft, date, appliedActions: [...applied, a.kind] };
    setDraft(next);
    await db.checkIns.put(next);
  };

  return (
    <Page title={isBaseline ? 'Week 1 start' : `Check-in · week ${week}`} subtitle={`${isBaseline ? 'Monday' : 'Sunday'} ${formatUK(date)}`} back="#/more">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {SUNDAYS.map((d, i) => (
          <a key={d} ref={d === date ? (el) => el?.scrollIntoView({ inline: 'center', block: 'nearest' }) : undefined} href={`#/checkin?date=${d}`} className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${d === date ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {i === 0 ? 'Start' : `W${i}`} · {formatUKShort(d)}
          </a>
        ))}
      </div>

      <Card>
        <div className="flex items-start justify-between">
          <Stat big label="7-day average" value={avg != null ? avg.toFixed(2) : '—'} sub={avg != null ? `kg · ${formatStLb(avg)}` : 'Not enough data'} />
          {!isBaseline && <StatusPill status={status} />}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Stat label="Target" value={target != null ? target.toFixed(1) : '—'} sub="kg" />
          <Stat label="Difference" value={avg != null && target != null ? `${avg - target > 0 ? '+' : ''}${(avg - target).toFixed(2)}` : '—'} sub="kg vs target (±0.5 = on track)" />
        </div>
      </Card>

      {!isBaseline && (
        <Card>
          <h2 className="h2">Adjustment advice</h2>
          {advice.rate != null && <div className="muted text-sm">Loss rate: {advice.rate.toFixed(2)} kg/week (7-day average 14 days ago − today, ÷ 2)</div>}
          <p className="mt-2 font-semibold">{advice.headline}</p>
          {advice.actions.length > 0 && (
            <ul className="mt-2 space-y-2">
              {advice.actions.map((a) => (
                <li key={a.kind} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <span className="flex-1 text-sm">{a.text}</span>
                  {applied.includes(a.kind) ? (
                    <span className="text-sm font-semibold text-emerald-600">Applied ✓</span>
                  ) : (
                    <button className="btn-secondary min-h-[40px] px-3 text-sm" onClick={() => apply(a)}>
                      {a.kind === 'foodAudit' ? 'Start audit' : 'Apply'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {advice.notes.map((n) => (
            <p key={n} className="muted mt-2 text-xs">{n}</p>
          ))}
          <p className="muted mt-1 text-xs">
            Current targets: {settings.targets.kcal.toLocaleString('en-GB')} kcal · {settings.targets.steps.toLocaleString('en-GB')} steps
          </p>
        </Card>
      )}

      {w4 && (
        <Card className={w4.applies ? 'bg-amber-50 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900' : ''}>
          <h2 className="h2">Week 4 check (Sun 6 Dec)</h2>
          <p className="mt-1 text-sm">{w4.message}</p>
          {w4.avg != null && (
            <p className="muted mt-1 text-sm">
              Average {w4.avg.toFixed(2)} kg vs target {w4.target.toFixed(1)} kg ({w4.overBy! > 0 ? '+' : ''}
              {w4.overBy!.toFixed(2)} kg)
            </p>
          )}
          {w4.newGoalDate && <p className="mt-2 text-lg font-bold">New projected 2-stone date: {formatUK(w4.newGoalDate)}</p>}
        </Card>
      )}

      {warnings.length > 0 && (
        <Card className="bg-amber-50 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900">
          <div className="font-semibold">Check food and sleep</div>
          <div className="text-sm">{warnings.map((w) => w.name).join(', ')}: dropped two sessions in a row.</div>
        </Card>
      )}

      <Card>
        <label className="block">
          <span className="label">Waist (cm){waistDue ? ' · due today' : ' · optional this week (every other Sunday from 22 Nov)'}</span>
          <NumInput value={draft.waistCm} onChange={(v) => setDraft({ ...draft, waistCm: v })} suffix="cm" ariaLabel="Waist in cm" />
        </label>
        <details className="mt-3">
          <summary className="cursor-pointer font-semibold">Body composition (optional)</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {BODY_FIELDS.map(([k, label, unit]) => (
              <label key={k}>
                <span className="label">{label}</span>
                <NumInput value={(bodyDraft[k] as number | null | undefined) ?? null} onChange={(v) => setBodyDraft({ ...bodyDraft, [k]: v })} suffix={unit} ariaLabel={label} />
              </label>
            ))}
          </div>
        </details>
        <label className="mt-3 block">
          <span className="label">Notes</span>
          <textarea className="input min-h-[90px] py-2 text-base" value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </label>
      </Card>

      <button className="btn-primary w-full" onClick={save}>
        {flash || (saved?.savedAt ? 'Update check-in' : 'Save check-in')}
      </button>
    </Page>
  );
}
