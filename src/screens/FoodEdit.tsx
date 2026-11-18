import { useEffect, useState } from 'react';
import { Card, NumInput, Page } from '../components/ui';
import { db, syncHabitsFromDiary } from '../db';
import { useToday } from '../hooks';
import { PLAN } from '../plan';
import { draftToFood, makeEntry, type Food, type FoodDraft, type MealId, type Nutrients } from '../lib/food';

const EMPTY: FoodDraft = { name: '', brand: '', barcode: '', servingLabel: '1 serving', grams: null, kcal: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 };

export default function FoodEdit({ id, date: dateParam, meal: mealParam, barcode }: { id?: string | null; date?: string | null; meal?: string | null; barcode?: string | null }) {
  const today = useToday();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const meal = (PLAN.diary.meals.some((m) => m.id === mealParam) ? mealParam : 'snacks') as MealId;
  const [base, setBase] = useState<Food | undefined>();
  const [d, setD] = useState<FoodDraft>({ ...EMPTY, barcode: barcode ?? '' });

  useEffect(() => {
    if (!id) return;
    db.foods.get(Number(id)).then((f) => {
      if (!f) return;
      setBase(f);
      const s = f.servings[0];
      setD({ name: f.name, brand: f.brand ?? '', barcode: f.barcode ?? '', servingLabel: s.label.replace(/ \(\d+(\.\d+)? g\)$/, ''), grams: s.grams ?? null, kcal: s.kcal, protein: s.protein, fat: s.fat, carbs: s.carbs, fibre: s.fibre });
    });
  }, [id]);

  const valid = d.name.trim() && d.servingLabel.trim() && d.kcal >= 0;
  const back = `#/food/add?date=${date}&meal=${meal}`;

  const save = async (alsoAdd: boolean) => {
    if (!valid) return;
    const food = draftToFood(d, base);
    const foodId = base?.id != null ? (await db.foods.put({ ...food, id: base.id }), base.id) : await db.foods.add({ ...food, createdAt: new Date().toISOString() });
    if (alsoAdd) {
      await db.diary.add(makeEntry({ ...food, id: foodId }, food.servings[0], 1, date, meal));
      await syncHabitsFromDiary(db, date);
      window.location.hash = `/food?date=${date}`;
    } else {
      window.location.hash = back.slice(1);
    }
  };

  const num = (k: keyof Nutrients, label: string, unit: string, decimal = true) => (
    <label>
      <span className="label">{label}</span>
      <NumInput decimal={decimal} value={d[k] || (k === 'kcal' ? null : d[k] || null)} onChange={(v) => setD({ ...d, [k]: v ?? 0 })} suffix={unit} ariaLabel={label} />
    </label>
  );

  return (
    <Page title={base ? 'Edit food' : 'Create food'} subtitle="Copy the values from the label, per serving" back={back}>
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2">
            <span className="label">Name</span>
            <input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Chicken breast" />
          </label>
          <label>
            <span className="label">Brand (optional)</span>
            <input className="input" value={d.brand} onChange={(e) => setD({ ...d, brand: e.target.value })} />
          </label>
          <label>
            <span className="label">Barcode (optional)</span>
            <input className="input" inputMode="numeric" value={d.barcode} onChange={(e) => setD({ ...d, barcode: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label>
            <span className="label">Serving</span>
            <input className="input" value={d.servingLabel} onChange={(e) => setD({ ...d, servingLabel: e.target.value })} placeholder="1 slice" />
          </label>
          <label>
            <span className="label">Serving weight (optional)</span>
            <NumInput value={d.grams} onChange={(v) => setD({ ...d, grams: v })} suffix="g" ariaLabel="Serving weight in grams" />
          </label>
        </div>
      </Card>
      <Card>
        <h2 className="h2 mb-2">Per serving</h2>
        <div className="grid grid-cols-2 gap-3">
          {num('kcal', 'Calories', 'kcal', false)}
          {num('protein', 'Protein', 'g')}
          {num('carbs', 'Carbs', 'g')}
          {num('fat', 'Fat', 'g')}
          {num('fibre', 'Fibre', 'g')}
        </div>
        <p className="muted mt-2 text-xs">Add the serving weight and you can also log this food in grams.</p>
      </Card>
      <button className="btn-primary w-full" disabled={!valid} onClick={() => save(true)}>
        Save and add to {PLAN.diary.meals.find((m) => m.id === meal)!.label.toLowerCase()}
      </button>
      <button className="btn-secondary w-full" disabled={!valid} onClick={() => save(false)}>
        Save to my foods
      </button>
      {base?.id != null && (
        <button
          className="btn-secondary w-full text-rose-600"
          onClick={async () => {
            if (!confirm(`Delete "${base.name}" from your foods? Diary entries are kept.`)) return;
            await db.foods.delete(base.id!);
            window.location.hash = back.slice(1);
          }}
        >
          Delete food
        </button>
      )}
    </Page>
  );
}
