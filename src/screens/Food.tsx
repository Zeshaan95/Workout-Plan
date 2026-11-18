import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import ServingSheet, { Sheet } from '../components/ServingSheet';
import { Card, Page } from '../components/ui';
import { db, syncHabitsFromDiary } from '../db';
import { useSettings, useToday } from '../hooks';
import { PLAN } from '../plan';
import { addDays, formatUK, weekdayName } from '../lib/dates';
import { dayProgress, totals, withQty, type DiaryEntry, type Food, type MealId } from '../lib/food';

function Bar({ label, value, target, max, unit }: { label: string; value: number; target: number; max?: number; unit: string }) {
  const pct = Math.min(100, (value / (max ?? target)) * 100);
  const hit = value >= target && (max == null || value <= max);
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">
          <b>{Math.round(value)}</b>
          <span className="muted">
            {' '}
            / {max != null ? `${target}–${max}` : target} {unit}
          </span>
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-2 rounded-full ${hit ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Rebuild a Food from a diary entry so its serving can be edited. */
function entryFood(e: DiaryEntry, food?: Food): Food {
  return food ?? { name: e.name, brand: e.brand, source: 'custom', servings: [e.serving] };
}

export default function FoodDiary({ date: dateParam }: { date?: string | null }) {
  const today = useToday();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const t = useSettings().targets;
  const entries = useLiveQuery(() => db.diary.where('date').equals(date).toArray(), [date]) ?? [];
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [menu, setMenu] = useState<MealId | null>(null);
  const p = dayProgress(entries, t);

  const changed = () => syncHabitsFromDiary(db, date);

  const copyFrom = async (meal: MealId, fromDate: string) => {
    const src = await db.diary.where('date').equals(fromDate).filter((e) => e.meal === meal).toArray();
    if (!src.length) return alert(`Nothing logged for that meal on ${formatUK(fromDate)}.`);
    await db.diary.bulkAdd(src.map(({ id: _id, ...e }) => (void _id, { ...e, date, createdAt: new Date().toISOString() })));
    await changed();
    setMenu(null);
  };

  const saveMeal = async (meal: MealId) => {
    const items = entries.filter((e) => e.meal === meal);
    if (!items.length) return;
    const label = PLAN.diary.meals.find((m) => m.id === meal)!.label;
    const name = prompt('Name this meal', `${label} (${formatUK(date)})`);
    if (!name) return;
    await db.savedMeals.add({ name, items: items.map(({ id: _i, date: _d, meal: _m, createdAt: _c, ...rest }) => (void _i, void _d, void _m, void _c, rest)) });
    setMenu(null);
  };

  return (
    <Page title="Food diary" subtitle={`${weekdayName(date)} ${formatUK(date)}`}>
      <div className="flex gap-2">
        <a className="btn-secondary flex-1" href={`#/food?date=${addDays(date, -1)}`}>‹ Prev</a>
        {date !== today && <a className="btn-secondary flex-1" href="#/food">Today</a>}
        <a className="btn-secondary flex-1" href={`#/food?date=${addDays(date, 1)}`}>Next ›</a>
      </div>

      <Card>
        <div className="flex items-end justify-between">
          <div>
            <div className="muted text-xs font-medium uppercase tracking-wide">Calories remaining</div>
            <div className={`text-4xl font-bold tabular-nums ${p.overTarget ? 'text-rose-600' : ''}`}>{p.kcalRemaining.toLocaleString('en-GB')}</div>
          </div>
          <div className="muted text-right text-sm tabular-nums">
            {t.kcal.toLocaleString('en-GB')} target
            <br />− {p.eaten.kcal.toLocaleString('en-GB')} food
          </div>
        </div>
        <div className="mt-3 space-y-2.5">
          <Bar label="Protein" value={p.eaten.protein} target={t.proteinMin} max={t.proteinMax} unit="g" />
          <Bar label="Carbs" value={p.eaten.carbs} target={t.carbs} unit="g" />
          <Bar label="Fat" value={p.eaten.fat} target={t.fat} unit="g" />
          <Bar label="Fibre" value={p.eaten.fibre} target={t.fibre} unit="g" />
        </div>
        {entries.length > 0 && p.belowFloor && date < today && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">Under the {t.kcalFloor.toLocaleString('en-GB')} kcal floor: don't go lower than that.</p>
        )}
        <p className="muted mt-2 text-xs">Same target on every day, training or not. Totals fill in your calorie and protein habits.</p>
      </Card>

      {PLAN.diary.meals.map((m) => {
        const items = entries.filter((e) => e.meal === m.id);
        const sub = totals(items);
        return (
          <Card key={m.id} className="p-0">
            <div className="flex items-center justify-between px-4 pt-3">
              <div>
                <h2 className="h2">{m.label}</h2>
                <div className="muted text-xs tabular-nums">
                  {sub.kcal} kcal · {Math.round(sub.protein)} g protein{m.id !== 'snacks' ? ` (aim ~${PLAN.diary.proteinPerMeal} g)` : ''}
                </div>
              </div>
              <button className="h-11 w-11 rounded-full text-xl active:bg-slate-100 dark:active:bg-slate-800" aria-label={`${m.label} options`} onClick={() => setMenu(m.id as MealId)}>
                ⋯
              </button>
            </div>
            <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((e) => (
                <li key={e.id}>
                  <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800/50" onClick={() => setEditing(e)}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{e.name}</span>
                      <span className="muted block truncate text-xs">
                        {e.brand ? `${e.brand} · ` : ''}
                        {e.serving.label === 'entry' ? '' : `${e.qty !== 1 ? `${e.qty} × ` : ''}${e.serving.label} · `}
                        {e.protein} g protein
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{e.kcal}</span>
                  </button>
                </li>
              ))}
            </ul>
            <a href={`#/food/add?date=${date}&meal=${m.id}`} className="block px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
              + Add food
            </a>
          </Card>
        );
      })}

      <Card>
        <div className="flex justify-between text-sm">
          <span className="font-semibold">Day total</span>
          <span className="tabular-nums">
            {p.eaten.kcal} kcal · P {Math.round(p.eaten.protein)} · C {Math.round(p.eaten.carbs)} · F {Math.round(p.eaten.fat)} · Fibre {Math.round(p.eaten.fibre)}
          </span>
        </div>
      </Card>

      {editing && (
        <ServingSheet
          food={entryFood(editing, foods.find((f) => f.id === editing.foodId))}
          initialServing={editing.serving}
          initialQty={editing.qty}
          initialMeal={editing.meal}
          confirmLabel="Save"
          onClose={() => setEditing(null)}
          onConfirm={async (serving, qty, meal) => {
            await db.diary.put({ ...withQty({ ...editing, serving }, qty), meal });
            await changed();
            setEditing(null);
          }}
          onDelete={async () => {
            await db.diary.delete(editing.id!);
            await changed();
            setEditing(null);
          }}
        />
      )}

      {menu && (
        <Sheet onClose={() => setMenu(null)}>
          <h2 className="h2 mb-3">{PLAN.diary.meals.find((m) => m.id === menu)!.label}</h2>
          <div className="grid gap-2">
            <button className="btn-secondary" onClick={() => copyFrom(menu, addDays(date, -1))}>Copy from yesterday</button>
            <button className="btn-secondary" onClick={() => saveMeal(menu)} disabled={!entries.some((e) => e.meal === menu)}>Save as a meal</button>
            <button
              className="btn-secondary text-rose-600"
              disabled={!entries.some((e) => e.meal === menu)}
              onClick={async () => {
                if (!confirm('Remove everything from this meal?')) return;
                await db.diary.bulkDelete(entries.filter((e) => e.meal === menu).map((e) => e.id!));
                await changed();
                setMenu(null);
              }}
            >
              Clear this meal
            </button>
          </div>
        </Sheet>
      )}
    </Page>
  );
}
