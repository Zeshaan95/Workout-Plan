import { useLiveQuery } from 'dexie-react-hooks';
import HabitsForm from '../components/HabitsForm';
import { Card, Page } from '../components/ui';
import { db } from '../db';
import { useFootball, useSettings, useToday } from '../hooks';
import { addDays, formatUK, mondayOf, shortWeekday } from '../lib/dates';
import { HABIT_LABELS, habitResults, weeklyAdherence, type HabitKey } from '../lib/habits';
import { dayPlan } from '../lib/schedule';

export default function Habits({ date: dateParam }: { date?: string | null }) {
  const today = useToday();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const football = useFootball();
  const targets = useSettings().targets;
  const monday = mondayOf(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const habits = useLiveQuery(() => db.habits.where('date').between(monday, days[6], true, true).toArray(), [monday]) ?? [];
  const asOf = date < today ? days[6] : today;
  const adherence = weeklyAdherence(monday, asOf < days[6] ? asOf : days[6], habits, targets, football);
  const plan = dayPlan(date, football);

  return (
    <Page title="Daily habits" subtitle={formatUK(date)} back="#/more">
      <div className="flex gap-2">
        <a className="btn-secondary flex-1" href={`#/habits?date=${addDays(date, -1)}`}>‹ Previous day</a>
        <a className="btn-secondary flex-1" href={`#/habits?date=${addDays(date, 1)}`}>Next day ›</a>
      </div>
      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="h2">This week's adherence</h2>
          <span className="text-3xl font-bold tabular-nums">{adherence.pct != null ? `${adherence.pct}%` : '—'}</span>
        </div>
        <p className="muted text-sm">{adherence.met} of {adherence.possible} habits met so far (Mon–Sun). Blank entries count as missed.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr>
                <th />
                {days.map((d) => (
                  <th key={d} className={`px-1 font-semibold ${d === date ? 'text-emerald-600' : ''}`}>
                    <a href={`#/habits?date=${d}`}>{shortWeekday(d).slice(0, 2)}</a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(HABIT_LABELS) as HabitKey[]).map((k) => (
                <tr key={k}>
                  <td className="py-1 pr-2 text-left">{HABIT_LABELS[k]}</td>
                  {days.map((d) => {
                    if (d > today) return <td key={d} className="text-slate-300 dark:text-slate-700">·</td>;
                    const r = habitResults(habits.find((h) => h.date === d), targets, dayPlan(d, football).isRest)[k];
                    return <td key={d} className={r ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}>{r === null ? '–' : r ? '✓' : '○'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h2 className="h2 mb-1">{date === today ? 'Today' : formatUK(date)}</h2>
        <HabitsForm date={date} isRestDay={plan.isRest} />
      </Card>
      <Card>
        <h2 className="h2 mb-1">Other daily targets</h2>
        <p className="muted text-sm">Fat about {targets.fat} g · carbs about {targets.carbs} g (mostly around training) · fibre {targets.fibre} g or more · protein about 40 g × 4 meals.</p>
      </Card>
    </Page>
  );
}
