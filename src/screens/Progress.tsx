import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, Page } from '../components/ui';
import { useDaily, useToday, useWorkouts } from '../hooks';
import { BODYWEIGHT_MOVES, GYM_LIFTS, PLAN, exerciseName } from '../plan';
import { liftChartData, repChartData, weightChartData } from '../lib/charts';
import { formatUK, formatUKShort, fromUTC, toUTC } from '../lib/dates';
import { formatStLb } from '../lib/units';
import { projectMilestones } from '../lib/weight';
import { pullupTestHistory } from '../lib/workouts';

const C = {
  dot: '#64748b',
  avg: '#059669',
  target: '#0284c7',
  grid: 'rgba(148,163,184,0.25)',
  festive: 'rgba(244,63,94,0.10)',
  milestone: '#a855f7',
};

const tickDate = (x: number) => formatUKShort(fromUTC(x));
const axisProps = { tick: { fontSize: 11, fill: '#94a3b8' }, stroke: '#94a3b8' };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: number }) {
  if (!active || !payload?.length || label == null) return null;
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-xs shadow ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <div className="mb-1 font-semibold">{formatUK(fromUTC(label))}</div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div key={p.name} style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toFixed(p.name.includes('reps') ? 0 : 2) : p.value}
          </div>
        ))}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select className="input mb-3 text-base" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {exerciseName(o)}
        </option>
      ))}
    </select>
  );
}

export default function Progress() {
  const today = useToday();
  const daily = useDaily();
  const logs = useWorkouts();
  const complete = useMemo(() => logs.filter((l) => l.status === 'complete' || l.entries.length), [logs]);
  const rows = useMemo(() => weightChartData(daily, today), [daily, today]);
  const projection = projectMilestones(daily, today);
  const [lift, setLift] = useState(GYM_LIFTS[0]);
  const [move, setMove] = useState(BODYWEIGHT_MOVES[0]);
  const liftData = liftChartData(complete, lift);
  const repData = repChartData(complete, move);
  const tests = pullupTestHistory(logs);

  const ys = rows.flatMap((r) => [r.reading, r.target]).filter((v): v is number => v != null);
  const yMin = 2 * Math.floor((Math.min(...ys, PLAN.goalKg) - 1) / 2);
  const yMax = Math.ceil(Math.max(...ys) + 0.5);

  return (
    <Page title="Progress" subtitle="Daily readings, 7-day average and target path">
      <Card className="px-1 pb-2">
        <div className="mb-2 px-3">
          <h2 className="h2">Weight</h2>
          <p className="muted text-xs">Dots: daily readings · green: 7-day average · blue dashed: target path · shaded: festive fortnight</p>
        </div>
        <div className="h-80">
          <ResponsiveContainer>
            <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="x" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tickDate} {...axisProps} ticks={[PLAN.historyStart, PLAN.startDate, '2026-12-01', '2027-01-01', PLAN.endDate].map(toUTC)} />
              <YAxis domain={[yMin, yMax]} {...axisProps} ticks={Array.from({ length: Math.floor((yMax - yMin) / 2) + 1 }, (_, i) => yMin + i * 2)} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceArea x1={toUTC(PLAN.festive.start)} x2={toUTC(PLAN.festive.end)} fill={C.festive} strokeOpacity={0} />
              <ReferenceLine x={toUTC(PLAN.startDate)} stroke={C.avg} strokeDasharray="2 3" label={{ value: 'Wk 1', position: 'insideTopLeft', fontSize: 10, fill: C.avg }} />
              {PLAN.milestones.map((m) => (
                <ReferenceLine key={m.id} y={m.kg} stroke={C.milestone} strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: `${m.id.replace('st', ' st')} ${m.kg}`, position: 'insideBottomLeft', fontSize: 10, fill: C.milestone }} />
              ))}
              <Line name="Target" dataKey="target" stroke={C.target} strokeDasharray="5 4" dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line name="7-day avg" dataKey="avg" stroke={C.avg} dot={false} strokeWidth={2.5} isAnimationActive={false} />
              <Scatter name="Reading" dataKey="reading" fill={C.dot} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="h2 mb-2">Projected milestones</h2>
        <p className="muted mb-2 text-xs">From the trend of the last 14 days of readings{projection ? ` (${(projection.slopePerDay * 7).toFixed(2)} kg/week)` : ''}.</p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {PLAN.milestones.map((m, i) => {
            const p = projection?.milestones[i];
            return (
              <li key={m.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-semibold">{m.label}</div>
                  <div className="muted text-xs">
                    {m.kg} kg · planned around {formatUKShort(m.expected)}
                  </div>
                </div>
                <div className="text-right font-semibold tabular-nums">
                  {!projection ? <span className="muted text-sm">Not enough data</span> : p?.reached ? <span className="text-emerald-600">Reached ✓</span> : p?.date ? formatUK(p.date) : <span className="muted text-sm">Not trending down</span>}
                </div>
              </li>
            );
          })}
        </ul>
        {projection && <p className="muted mt-2 text-xs">Trend weight today: {projection.current.toFixed(2)} kg ({formatStLb(projection.current)})</p>}
      </Card>

      <Card className="px-1 pb-2">
        <div className="px-3">
          <h2 className="h2 mb-2">Strength</h2>
          <Select value={lift} onChange={setLift} options={GYM_LIFTS} />
        </div>
        {liftData.length === 0 ? (
          <p className="muted px-3 pb-3 text-sm">No sessions logged for this lift yet.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer>
              <ComposedChart data={liftData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="x" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tickDate} {...axisProps} />
                <YAxis {...axisProps} domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line name="Top set kg" dataKey="top" stroke={C.avg} strokeWidth={2.5} isAnimationActive={false} />
                <Line name="Est. 1RM (Epley)" dataKey="e1rm" stroke={C.target} strokeDasharray="5 4" strokeWidth={2} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="px-1 pb-2">
        <div className="px-3">
          <h2 className="h2 mb-2">Bodyweight reps</h2>
          <Select value={move} onChange={setMove} options={BODYWEIGHT_MOVES} />
        </div>
        {repData.length === 0 ? (
          <p className="muted px-3 pb-3 text-sm">No sessions logged for this exercise yet.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer>
              <ComposedChart data={repData} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="x" type="number" scale="time" domain={['dataMin - 86400000', 'dataMax + 86400000']} tickFormatter={tickDate} {...axisProps} />
                <YAxis yAxisId="r" {...axisProps} allowDecimals={false} />
                <YAxis yAxisId="p" orientation="right" {...axisProps} width={30} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="r" name="Total reps" dataKey="reps" fill={C.avg} barSize={14} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Line yAxisId="p" name="Backpack kg" dataKey="pack" stroke={C.milestone} strokeWidth={2} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="h2 mb-2">Pull-up tests</h2>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          <li className="flex justify-between py-2">
            <span className="muted">Previous best (before the plan)</span>
            <span className="font-semibold">{PLAN.previousPullupBest} reps</span>
          </li>
          {tests.map((t) => (
            <li key={t.date} className="flex justify-between py-2">
              <span>{formatUK(t.date)}</span>
              <span className="font-semibold">{t.reps} reps</span>
            </li>
          ))}
          {PLAN.pullupTestDays
            .filter((d) => !tests.some((t) => t.date === d))
            .map((d) => (
              <li key={d} className="muted flex justify-between py-2">
                <span>{formatUK(d)}</span>
                <span>{d < today ? 'Not logged' : 'Upcoming'}</span>
              </li>
            ))}
        </ul>
      </Card>
    </Page>
  );
}
