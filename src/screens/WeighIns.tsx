import { useMemo, useState } from 'react';
import { Card, NumInput, Page } from '../components/ui';
import { db } from '../db';
import { useWeighIns } from '../hooks';
import { formatUK, nowTime, shortWeekday, todayISO } from '../lib/dates';
import { formatStLb } from '../lib/units';
import { dailyReadings, sevenDayAverage, type WeighIn } from '../lib/weight';

function Editor({ initial, onDone }: { initial: WeighIn; onDone: () => void }) {
  const [w, setW] = useState(initial);
  const valid = w.kg > 30 && w.kg < 300 && /^\d{4}-\d{2}-\d{2}$/.test(w.date);
  const save = async () => {
    if (!valid) return;
    const row = { ...w, kg: Math.round(w.kg * 100) / 100 };
    if (row.id != null) await db.weighIns.put(row);
    else await db.weighIns.add(row);
    onDone();
  };
  return (
    <Card>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Date</span>
          <input type="date" className="input" value={w.date} onChange={(e) => setW({ ...w, date: e.target.value })} />
        </label>
        <label>
          <span className="label">Time</span>
          <input type="time" className="input" value={w.time} onChange={(e) => setW({ ...w, time: e.target.value })} />
        </label>
        <label className="col-span-2">
          <span className="label">Weight (kg, 2 dp)</span>
          <NumInput value={w.kg || null} onChange={(v) => setW({ ...w, kg: v ?? 0 })} suffix="kg" ariaLabel="Weight" />
          <span className="muted mt-1 block text-sm">{w.kg > 0 ? formatStLb(w.kg) : ' '}</span>
        </label>
        <label className="col-span-2">
          <span className="label">Note (optional)</span>
          <input className="input" value={w.note ?? ''} onChange={(e) => setW({ ...w, note: e.target.value })} />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary flex-1" onClick={save} disabled={!valid}>
          {w.id != null ? 'Save changes' : 'Add weigh-in'}
        </button>
        <button className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </Card>
  );
}

export default function WeighIns() {
  const all = useWeighIns() ?? [];
  const [editing, setEditing] = useState<WeighIn | null>(null);
  const daily = useMemo(() => dailyReadings(all), [all]);
  const sorted = useMemo(() => [...all].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1)), [all]);
  const counted = useMemo(() => {
    const ids = new Set<number>();
    const firstByDay = new Map<string, WeighIn>();
    for (const w of all) {
      const c = firstByDay.get(w.date);
      if (!c || w.time < c.time) firstByDay.set(w.date, w);
    }
    firstByDay.forEach((w) => w.id != null && ids.add(w.id));
    return ids;
  }, [all]);

  return (
    <Page title="Weigh-ins" subtitle={`${all.length} readings · earliest reading each day counts`}>
      {editing ? (
        <Editor initial={editing} onDone={() => setEditing(null)} />
      ) : (
        <button className="btn-primary w-full" onClick={() => setEditing({ date: todayISO(), time: nowTime(), kg: 0 })}>
          + Add weigh-in
        </button>
      )}
      <Card className="p-0">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {sorted.map((w) => {
            const avg = sevenDayAverage(daily, w.date);
            const isCounted = w.id != null && counted.has(w.id);
            return (
              <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(w)}>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-xl font-bold tabular-nums ${isCounted ? '' : 'opacity-50'}`}>{w.kg.toFixed(2)}</span>
                    <span className="muted text-sm">{formatStLb(w.kg)}</span>
                  </div>
                  <div className="muted text-sm">
                    {shortWeekday(w.date)} {formatUK(w.date)} · {w.time}
                    {w.note ? ` · ${w.note}` : ''}
                    {!isCounted ? ' · not counted (later reading)' : ''}
                  </div>
                </button>
                <div className="text-right text-sm">
                  <div className="muted text-xs">7-day avg</div>
                  <div className="font-semibold tabular-nums">{avg != null && isCounted ? avg.toFixed(2) : '—'}</div>
                </div>
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-full text-rose-600 active:bg-rose-50 dark:active:bg-rose-950"
                  aria-label="Delete"
                  onClick={() => {
                    if (w.id != null && confirm(`Delete ${w.kg.toFixed(2)} kg on ${formatUK(w.date)}?`)) db.weighIns.delete(w.id);
                  }}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </Page>
  );
}
