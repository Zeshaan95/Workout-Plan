import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Card, NumInput, Page } from '../components/ui';
import { db } from '../db';
import { useSettings, useToday } from '../hooks';
import { PLAN } from '../plan';
import { addDays, formatUK, shortWeekday } from '../lib/dates';

export default function FoodAudit() {
  const today = useToday();
  const settings = useSettings();
  const start = settings.auditStart ?? null;
  const days = start ? Array.from({ length: PLAN.foodAudit.days }, (_, i) => addDays(start, i)) : [];
  const [day, setDay] = useState<string | null>(null);
  const active = day && days.includes(day) ? day : days.find((d) => d === today) ?? days[0];
  const items = useLiveQuery(() => (active ? db.foodAudit.where('date').equals(active).toArray() : []), [active]) ?? [];
  const all = useLiveQuery(() => (start ? db.foodAudit.where('date').between(days[0], days[days.length - 1], true, true).toArray() : []), [start]) ?? [];
  const [meal, setMeal] = useState('');
  const [kcal, setKcal] = useState<number | null>(null);
  const [protein, setProtein] = useState<number | null>(null);
  const t = settings.targets;
  const kcalTotal = items.reduce((a, i) => a + i.kcal, 0);
  const proteinTotal = items.reduce((a, i) => a + i.protein, 0);

  const add = async (m: string, k: number, p: number) => {
    if (!active) return;
    await db.foodAudit.add({ date: active, meal: m, kcal: k, protein: p });
  };

  return (
    <Page title="Food audit" subtitle="Weigh and log everything for 3 days to find hidden calories" back="#/more">
      {!start ? (
        <Card>
          <p>Start a 3-day audit when the Sunday review says loss has stalled, or any time you want to check your numbers.</p>
          <button className="btn-primary mt-3 w-full" onClick={() => db.settings.update('app', { auditStart: today })}>
            Start audit today
          </button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {days.map((d, i) => {
              const total = all.filter((x) => x.date === d).reduce((a, x) => a + x.kcal, 0);
              return (
                <button key={d} onClick={() => setDay(d)} className={`rounded-xl p-2 text-center ${d === active ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  <div className="text-sm font-semibold">Day {i + 1}</div>
                  <div className="text-xs opacity-80">{shortWeekday(d)} {formatUK(d).slice(0, -5)}</div>
                  <div className="text-xs font-semibold tabular-nums">{total} kcal</div>
                </button>
              );
            })}
          </div>
          <Card>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="muted text-xs uppercase">Calories</div>
                <div className={`text-3xl font-bold tabular-nums ${kcalTotal > t.kcal ? 'text-rose-600' : ''}`}>{kcalTotal}</div>
                <div className="muted text-sm">of {t.kcal.toLocaleString('en-GB')} kcal ({kcalTotal - t.kcal > 0 ? '+' : ''}{kcalTotal - t.kcal})</div>
              </div>
              <div>
                <div className="muted text-xs uppercase">Protein</div>
                <div className={`text-3xl font-bold tabular-nums ${proteinTotal >= t.proteinMin ? 'text-emerald-600' : ''}`}>{proteinTotal}</div>
                <div className="muted text-sm">of {t.proteinMin}–{t.proteinMax} g</div>
              </div>
            </div>
          </Card>
          <Card>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!meal || kcal == null) return;
                add(meal, kcal, protein ?? 0);
                setMeal('');
                setKcal(null);
                setProtein(null);
              }}
              className="space-y-3"
            >
              <input className="input" placeholder="Meal or item" value={meal} onChange={(e) => setMeal(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <NumInput decimal={false} value={kcal} onChange={setKcal} suffix="kcal" ariaLabel="kcal" />
                <NumInput value={protein} onChange={setProtein} suffix="g protein" ariaLabel="Protein g" />
              </div>
              <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={!meal || kcal == null}>Add</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => add(PLAN.foodAudit.oilGhee.label, PLAN.foodAudit.oilGhee.kcal, PLAN.foodAudit.oilGhee.protein)}>
                  + 1 tbsp oil/ghee ({PLAN.foodAudit.oilGhee.kcal})
                </button>
              </div>
            </form>
          </Card>
          <Card className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.length === 0 && <li className="muted px-4 py-3 text-sm">Nothing logged for this day yet.</li>}
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="flex-1">{i.meal}</span>
                  <span className="tabular-nums">{i.kcal} kcal</span>
                  <span className="muted w-12 text-right tabular-nums">{i.protein} g</span>
                  <button className="h-10 w-10 text-rose-600" aria-label="Delete" onClick={() => i.id != null && db.foodAudit.delete(i.id)}>✕</button>
                </li>
              ))}
            </ul>
          </Card>
          <button className="btn-secondary w-full" onClick={() => confirm('End this audit? Entries are kept.') && db.settings.update('app', { auditStart: null })}>
            End audit
          </button>
        </>
      )}
    </Page>
  );
}
