import { useState, type ReactNode } from 'react';
import { PLAN } from '../plan';
import { gramsServing, scale, type Food, type MealId, type Serving } from '../lib/food';
import { NumInput } from './ui';

export function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="pb-safe mx-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-4 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        {children}
      </div>
    </div>
  );
}

export function NutrientLine({ n, big }: { n: { kcal: number; protein: number; fat: number; carbs: number; fibre: number }; big?: boolean }) {
  return (
    <div className={`grid grid-cols-5 gap-1 text-center ${big ? '' : 'text-sm'}`}>
      {[
        ['kcal', n.kcal, ''],
        ['Protein', n.protein, 'g'],
        ['Carbs', n.carbs, 'g'],
        ['Fat', n.fat, 'g'],
        ['Fibre', n.fibre, 'g'],
      ].map(([l, v, u]) => (
        <div key={l as string}>
          <div className={`${big ? 'text-xl' : 'text-base'} font-bold tabular-nums`}>
            {v}
            <span className="text-xs font-normal">{u}</span>
          </div>
          <div className="muted text-[11px]">{l}</div>
        </div>
      ))}
    </div>
  );
}

/** Choose a serving, a quantity and a meal for a food. */
export default function ServingSheet({
  food,
  initialServing,
  initialQty = 1,
  initialMeal,
  confirmLabel = 'Add',
  onConfirm,
  onClose,
  onDelete,
}: {
  food: Food;
  initialServing?: Serving;
  initialQty?: number;
  initialMeal: MealId;
  confirmLabel?: string;
  onConfirm: (serving: Serving, qty: number, meal: MealId) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const servings = food.servings;
  const startIdx = initialServing ? Math.max(0, servings.findIndex((s) => s.label === initialServing.label)) : 0;
  const isCustomGrams = !!initialServing && !servings.some((s) => s.label === initialServing.label) && initialServing.grams != null;
  const [idx, setIdx] = useState<number | 'grams'>(isCustomGrams ? 'grams' : startIdx);
  const [qty, setQty] = useState<number | null>(isCustomGrams ? 1 : initialQty);
  const [grams, setGrams] = useState<number | null>(isCustomGrams ? initialServing!.grams! : 100);
  const [meal, setMeal] = useState<MealId>(initialMeal);

  const serving: Serving | null =
    idx === 'grams' ? (food.per100g && grams ? gramsServing(food.per100g, grams) : null) : (servings[idx] ?? initialServing ?? null);
  const q = idx === 'grams' ? 1 : qty ?? 0;
  const preview = serving ? scale(serving, q) : null;

  return (
    <Sheet onClose={onClose}>
      <div className="mb-3">
        <div className="text-lg font-bold leading-tight">{food.name}</div>
        {food.brand && <div className="muted text-sm">{food.brand}</div>}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {servings.map((s, i) => (
          <button key={s.label} onClick={() => setIdx(i)} className={`rounded-full px-3 py-2 text-sm font-semibold ${idx === i ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {s.label}
          </button>
        ))}
        {food.per100g && (
          <button onClick={() => setIdx('grams')} className={`rounded-full px-3 py-2 text-sm font-semibold ${idx === 'grams' ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800'}`}>
            Grams
          </button>
        )}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        {idx === 'grams' ? (
          <label>
            <span className="label">Amount</span>
            <NumInput value={grams} onChange={setGrams} suffix="g" ariaLabel="Grams" autoFocus />
          </label>
        ) : (
          <label>
            <span className="label">Servings</span>
            <NumInput value={qty} onChange={setQty} suffix="×" ariaLabel="Number of servings" />
          </label>
        )}
        <label>
          <span className="label">Meal</span>
          <select className="input text-base" value={meal} onChange={(e) => setMeal(e.target.value as MealId)}>
            {PLAN.diary.meals.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {idx !== 'grams' && (
        <div className="mb-3 flex gap-2">
          {[0.5, 1, 1.5, 2].map((v) => (
            <button key={v} onClick={() => setQty(v)} className={`flex-1 rounded-xl py-2 text-sm font-semibold ${qty === v ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}>
              {v}×
            </button>
          ))}
        </div>
      )}
      {preview && (
        <div className="mb-4 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <NutrientLine n={preview} big />
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={!serving || q <= 0} onClick={() => serving && onConfirm(serving, q, meal)}>
          {confirmLabel}
        </button>
        {onDelete && (
          <button className="btn-secondary text-rose-600" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </Sheet>
  );
}
