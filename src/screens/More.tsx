import { Card, LinkRow, Page } from '../components/ui';
import { useToday } from '../hooks';
import { PLAN } from '../plan';
import { addDays, formatUK, weekdayIndex } from '../lib/dates';
import { weekNumber } from '../lib/schedule';

export default function More() {
  const today = useToday();
  const week = weekNumber(today);
  const lastSunday = weekdayIndex(today) === 6 ? today : addDays(today, -(weekdayIndex(today) + 1));
  const nextSunday = addDays(today, 6 - weekdayIndex(today));
  const checkDate = today < PLAN.startDate ? PLAN.targetPath[1].date : today > PLAN.endDate ? PLAN.endDate : nextSunday;
  return (
    <Page title="More">
      <Card className="divide-y divide-slate-100 py-1 dark:divide-slate-800">
        <LinkRow href={`#/checkin?date=${checkDate}`} title="Weekly check-in" sub={`Sunday ${formatUK(checkDate)}${lastSunday >= PLAN.startDate ? '' : ''}`} />
        <LinkRow href={`#/plan${week ? `?week=${week}` : ''}`} title="Plan by week" sub="All 12 weeks, football switch per week" />
        <LinkRow href="#/habits" title="Daily habits" sub="Calories, protein, steps, water, sleep · adherence" />
        <LinkRow href="#/audit" title="Food audit" sub="3-day weigh-and-log to find hidden calories" />
        <LinkRow href="#/catchup" title="Catch up" sub="Add weigh-ins and sessions since 9 Nov" />
        <LinkRow href="#/settings" title="Settings" sub="Targets, height, backup, reset" />
      </Card>
    </Page>
  );
}
