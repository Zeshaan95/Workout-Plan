import { Badge, Card, Page, Toggle } from '../components/ui';
import { setFootball, useFootball, useToday, useWorkouts } from '../hooks';
import { PLAN } from '../plan';
import { formatUKShort, shortWeekday } from '../lib/dates';
import { weekIsFestive, weekNumber, weekPlan, weekStart, weekSunday } from '../lib/schedule';

export default function PlanView({ week: weekParam }: { week?: string | null }) {
  const today = useToday();
  const football = useFootball();
  const workouts = useWorkouts();
  const week = Math.min(12, Math.max(1, Number(weekParam) || weekNumber(today) || 1));
  const days = weekPlan(week, football);
  const target = PLAN.targetPath.find((p) => p.week === week);

  return (
    <Page title={`Week ${week} of 12`} subtitle={`${formatUKShort(weekStart(week))} – ${formatUKShort(weekSunday(week))} · target ${target?.kg} kg`} back="#/more">
      <div className="flex gap-2">
        <a className={`btn-secondary flex-1 ${week <= 1 ? 'pointer-events-none opacity-40' : ''}`} href={`#/plan?week=${week - 1}`}>‹ Week {week - 1}</a>
        <a className={`btn-secondary flex-1 ${week >= 12 ? 'pointer-events-none opacity-40' : ''}`} href={`#/plan?week=${week + 1}`}>Week {week + 1} ›</a>
      </div>
      <Card>
        <Toggle checked={days[0].weekType === 'football'} onChange={(v) => setFootball(week, v)} label="Football this Thursday?" sub="Switch off for a no-football week" />
        {weekIsFestive(week) && <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">{PLAN.festive.note}</p>}
        {target?.note && <p className="muted mt-2 text-sm">{target.note}</p>}
      </Card>
      <Card className="p-0">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {days.map((d) => {
            const done = workouts.some((w) => w.date === d.date && w.status === 'complete');
            return (
              <li key={d.date}>
                <a href={d.isRest ? `#/today?date=${d.date}` : `#/log?date=${d.date}&session=${d.session}`} className={`block px-4 py-3 ${d.date === today ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-sm font-semibold">{shortWeekday(d.date)} {formatUKShort(d.date)}</span>
                    <span className="min-w-0 flex-1 font-medium">{d.title}</span>
                    {done && <span className="text-emerald-500">✓</span>}
                  </div>
                  <div className="ml-[4.5rem] mt-0.5 flex flex-wrap items-center gap-1.5">
                    {!d.isRest && <span className="muted text-sm">{d.length} · {d.when}</span>}
                    {d.isTestDay && <Badge tone="sky">Pull-up test</Badge>}
                    {d.isFestive && <Badge tone="rose">Festive</Badge>}
                  </div>
                  {d.notes.length > 0 && <ul className="muted ml-[4.5rem] mt-1 list-disc pl-4 text-xs">{d.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
                </a>
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="muted text-center text-xs">Tap a day to log it, or a rest day to preview its Today screen.</p>
    </Page>
  );
}
