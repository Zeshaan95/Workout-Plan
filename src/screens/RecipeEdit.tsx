import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import ServingSheet, { NutrientLine } from '../components/ServingSheet';
import { Card, NumInput, Page } from '../components/ui';
import { db, syncHabitsFromDiary } from '../db';
import { useToday } from '../hooks';
import { PLAN } from '../plan';
import { makeEntry, recipeItemNutrients, recipeServings, recipeToFood, recipeTotals, type Food, type MealId, type Recipe } from '../lib/food';

/** Build a batch recipe (e.g. the Wednesday/Sunday cook-up), then log it by portion or by grams. */
export default function RecipeEdit({ id, date: dateParam, meal: mealParam }: { id?: string | null; date?: string | null; meal?: string | null }) {
  const today = useToday();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const meal = (PLAN.diary.meals.some((m) => m.id === mealParam) ? mealParam : 'dinner') as MealId;
  const mealLabel = PLAN.diary.meals.find((m) => m.id === meal)!.label.toLowerCase();
  const recipeId = id ? Number(id) : null;
  const food = useLiveQuery(() => (recipeId != null ? db.foods.get(recipeId) : undefined), [recipeId]);
  const allFoods = useLiveQuery(() => db.foods.toArray(), []) ?? [];

  const [name, setName] = useState('');
  const [portions, setPortions] = useState<number | null>(4);
  const [cooked, setCooked] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [logging, setLogging] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    if (!food?.recipe) return;
    setName(food.name);
    setPortions(food.recipe.portions);
    setCooked(food.recipe.cookedWeightG ?? null);
    // Only when the recipe loads or changes identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food?.id]);

  const recipe: Recipe = { portions: portions && portions > 0 ? portions : 1, cookedWeightG: cooked, items: food?.recipe?.items ?? [] };
  const total = recipeTotals(recipe);
  const { servings } = recipeServings(recipe);

  const save = async (r: Recipe = recipe): Promise<number> => {
    const f = recipeToFood(name, r, food);
    if (recipeId != null) {
      await db.foods.put({ ...f, id: recipeId });
      return recipeId;
    }
    const newId = await db.foods.add({ ...f, createdAt: new Date().toISOString() });
    window.location.hash = `/food/recipe?id=${newId}&date=${date}&meal=${meal}`;
    return newId;
  };

  const addIngredient = async () => {
    const rid = await save();
    window.location.hash = `/food/add?recipe=${rid}&date=${date}&meal=${meal}`;
  };

  const updateItems = (items: Recipe['items']) => save({ ...recipe, items });

  return (
    <Page title={recipeId != null ? 'Recipe' : 'New recipe'} subtitle="Batch cook once, log a portion all week" back={`#/food/add?date=${date}&meal=${meal}`}>
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2">
            <span className="label">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => recipeId != null && save()} placeholder="e.g. Chicken chilli cook-up" />
          </label>
          <label>
            <span className="label">Portions it makes</span>
            <NumInput decimal={false} value={portions} onChange={setPortions} ariaLabel="Portions" />
          </label>
          <label>
            <span className="label">Cooked weight (optional)</span>
            <NumInput value={cooked} onChange={setCooked} suffix="g" ariaLabel="Total cooked weight in grams" />
          </label>
        </div>
        <p className="muted mt-2 text-xs">Weigh the whole pot after cooking (minus the pot) to log by grams as well as by portion.</p>
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 className="h2">Ingredients</h2>
          <span className="muted text-sm tabular-nums">{total.kcal} kcal total</span>
        </div>
        <ul className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
          {recipe.items.length === 0 && <li className="muted px-4 py-3 text-sm">Add everything that goes in the pot, including oil.</li>}
          {recipe.items.map((it, i) => {
            const n = recipeItemNutrients(it);
            return (
              <li key={i}>
                <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800/50" onClick={() => setEditing(i)}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{it.name}</span>
                    <span className="muted block truncate text-xs">
                      {it.qty !== 1 ? `${it.qty} × ` : ''}
                      {it.serving.label} · {n.protein} g protein
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{n.kcal}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="p-3">
          <button className="btn-secondary w-full" disabled={!name.trim()} onClick={addIngredient}>
            + Add ingredient
          </button>
          {!name.trim() && <p className="muted mt-1 text-center text-xs">Name the recipe first.</p>}
        </div>
      </Card>

      {recipe.items.length > 0 && (
        <Card>
          <h2 className="h2 mb-2">{servings[0].label}</h2>
          <NutrientLine n={servings[0]} big />
          {servings[1] && <p className="muted mt-2 text-sm">Per 100 g: {servings[1].kcal} kcal · {servings[1].protein} g protein</p>}
        </Card>
      )}

      {recipe.items.length > 0 && (
        <button className="btn-primary w-full" onClick={() => setLogging(true)}>
          Log to {mealLabel}
        </button>
      )}
      {recipeId != null && (
        <button
          className="btn-secondary w-full"
          onClick={async () => {
            await save();
            setFlash('Recipe saved');
            setTimeout(() => setFlash(''), 1500);
          }}
        >
          {flash || 'Save recipe'}
        </button>
      )}
      {recipeId == null && (
        <button className="btn-primary w-full" disabled={!name.trim()} onClick={() => save()}>
          Create recipe
        </button>
      )}
      {recipeId != null && (
        <button
          className="btn-secondary w-full text-rose-600"
          onClick={async () => {
            if (!confirm(`Delete the recipe "${name}"? Diary entries are kept.`)) return;
            await db.foods.delete(recipeId);
            window.location.hash = `/food/add?date=${date}&meal=${meal}`;
          }}
        >
          Delete recipe
        </button>
      )}

      {editing != null && recipe.items[editing] && (
        <ServingSheet
          food={allFoods.find((f) => f.id === recipe.items[editing].foodId) ?? ({ name: recipe.items[editing].name, brand: recipe.items[editing].brand, source: 'custom', servings: [recipe.items[editing].serving] } as Food)}
          initialServing={recipe.items[editing].serving}
          initialQty={recipe.items[editing].qty}
          initialMeal={meal}
          hideMeal
          confirmLabel="Save"
          onClose={() => setEditing(null)}
          onConfirm={async (serving, qty) => {
            await updateItems(recipe.items.map((x, k) => (k === editing ? { ...x, serving, qty } : x)));
            setEditing(null);
          }}
          onDelete={async () => {
            await updateItems(recipe.items.filter((_, k) => k !== editing));
            setEditing(null);
          }}
        />
      )}

      {logging && food && (
        <ServingSheet
          food={recipeToFood(name, recipe, food)}
          initialMeal={meal}
          onClose={() => setLogging(false)}
          onConfirm={async (serving, qty, m) => {
            await save();
            await db.diary.add(makeEntry({ ...recipeToFood(name, recipe, food), id: recipeId! }, serving, qty, date, m));
            await syncHabitsFromDiary(db, date);
            window.location.hash = `/food?date=${date}`;
          }}
        />
      )}
    </Page>
  );
}
