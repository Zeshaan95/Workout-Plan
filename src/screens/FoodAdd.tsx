import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import ServingSheet, { NutrientLine, Sheet } from '../components/ServingSheet';
import { Card, NumInput, Page } from '../components/ui';
import { db, syncHabitsFromDiary } from '../db';
import { useSettings, useToday } from '../hooks';
import { PLAN } from '../plan';
import {
  frequentFoods,
  lookupBarcode,
  makeEntry,
  matchesQuery,
  quickAddFood,
  recentFoods,
  searchOFF,
  totals,
  ZERO,
  type DiaryEntry,
  type Food,
  recipeToFood,
  type MealId,
  type Nutrients,
  type RecipeItem,
  type Serving,
} from '../lib/food';

import { COFID_ATTRIBUTION, cofidToFood, loadCofid, searchCofid, type CofidRow } from '../lib/cofid';

const BarcodeScanner = lazy(() => import('../components/BarcodeScanner'));

type Tab = 'recent' | 'frequent' | 'mine' | 'meals';

/** Save an online food locally (once) so it works offline next time. */
async function ensureFood(food: Food): Promise<Food> {
  if (food.id != null) return food;
  let existing: Food | undefined;
  if (food.barcode) existing = await db.foods.where('barcode').equals(food.barcode).first();
  if (!existing) existing = (await db.foods.where('name').equals(food.name).toArray()).find((f) => (f.brand ?? '') === (food.brand ?? ''));
  if (existing) return existing;
  const id = await db.foods.add({ ...food, createdAt: new Date().toISOString() });
  return { ...food, id };
}

function FoodRow({ title, sub, kcal, onClick }: { title: string; sub?: string; kcal?: number; onClick: () => void }) {
  return (
    <li>
      <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800/50" onClick={onClick}>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block font-medium leading-snug">{title}</span>
          {sub && <span className="muted block truncate text-xs">{sub}</span>}
        </span>
        {kcal != null && <span className="font-semibold tabular-nums">{kcal}</span>}
        <span className="text-xl text-emerald-600">+</span>
      </button>
    </li>
  );
}

export default function FoodAdd({ date: dateParam, meal: mealParam, recipe: recipeParam }: { date?: string | null; meal?: string | null; recipe?: string | null }) {
  const today = useToday();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const meal = (PLAN.diary.meals.some((m) => m.id === mealParam) ? mealParam : 'snacks') as MealId;
  const mealLabel = PLAN.diary.meals.find((m) => m.id === meal)!.label;
  const settings = useSettings();
  const online = settings.onlineFoodSearch !== false;

  const allEntries = useLiveQuery(() => db.diary.toArray(), []) ?? [];
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  const meals = useLiveQuery(() => db.savedMeals.toArray(), []) ?? [];
  const [tab, setTab] = useState<Tab>('recent');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [picked, setPicked] = useState<{ food: Food; serving?: Serving; qty?: number } | null>(null);
  const [quick, setQuick] = useState(false);
  const [scan, setScan] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const [cofid, setCofid] = useState<CofidRow[]>([]);
  useEffect(() => {
    loadCofid().then(setCofid);
  }, []);

  // Recipe mode: chosen foods become ingredients of this recipe instead of diary entries.
  const recipeId = recipeParam ? Number(recipeParam) : null;
  const recipeFood = foods.find((f) => f.id === recipeId);
  const recipeBack = `/food/recipe?id=${recipeId}&date=${date}&meal=${meal}`;

  const recent = useMemo(() => recentFoods(allEntries.filter((e) => e.foodId != null || e.serving.label !== 'entry'), 30), [allEntries]);
  const frequent = useMemo(() => frequentFoods(allEntries.filter((e) => e.serving.label !== 'entry'), 30), [allEntries]);
  const myFoods = useMemo(() => [...foods].filter((f) => f.source !== 'quick').sort((a, b) => a.name.localeCompare(b.name)), [foods]);
  const localMatches = q.trim() ? myFoods.filter((f) => f.id !== recipeId && matchesQuery(f.name, f.brand, q)) : [];
  const cofidExact = useMemo(() => (q.trim().length >= 2 ? searchCofid(cofid, q) : []), [cofid, q]);
  const cofidMatches = useMemo(() => (cofidExact.length || q.trim().length < 2 ? cofidExact : searchCofid(cofid, q, 30, true)), [cofid, q, cofidExact]);

  // Online search, debounced.
  useEffect(() => {
    setResults([]);
    setSearchError('');
    const term = q.trim();
    if (!online || term.length < 3) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      if (!navigator.onLine) {
        setSearchError('Offline: showing your saved foods only.');
        return;
      }
      setSearching(true);
      try {
        setResults(await searchOFF(term, fetch, ctl.signal));
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setSearchError('Online search failed. Check your signal and try again.');
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, online]);

  const addToRecipe = async (items: RecipeItem[]) => {
    const r = await db.foods.get(recipeId!);
    if (!r?.recipe) return;
    const recipe = { ...r.recipe, items: [...r.recipe.items, ...items] };
    await db.foods.put(recipeToFood(r.name, recipe, r));
    window.location.hash = recipeBack;
  };

  const addEntry = async (food: Food, serving: Serving, qty: number, m: MealId) => {
    const saved = food.source === 'quick' ? food : await ensureFood(food);
    if (recipeId != null) return addToRecipe([{ foodId: saved.id ?? null, name: saved.name, brand: saved.brand, serving, qty }]);
    await db.diary.add(makeEntry(saved, serving, qty, date, m));
    await syncHabitsFromDiary(db, date);
    setPicked(null);
    setAdded(`Added ${saved.name}`);
    setTimeout(() => setAdded(null), 1800);
  };

  const pickEntry = (e: DiaryEntry) => {
    const food = foods.find((f) => f.id === e.foodId) ?? { name: e.name, brand: e.brand, source: 'custom' as const, servings: [e.serving] };
    setPicked({ food, serving: e.serving, qty: e.qty });
  };

  const addMeal = async (items: DiaryEntry[] | Omit<DiaryEntry, 'id' | 'date' | 'meal' | 'createdAt'>[]) => {
    if (recipeId != null) return addToRecipe(items.map((i) => ({ foodId: i.foodId, name: i.name, brand: i.brand, serving: i.serving, qty: i.qty })));
    const now = new Date().toISOString();
    await db.diary.bulkAdd(items.map((i) => ({ ...i, id: undefined, date, meal, createdAt: now })) as DiaryEntry[]);
    await syncHabitsFromDiary(db, date);
    setAdded(`Added ${items.length} item${items.length > 1 ? 's' : ''}`);
    setTimeout(() => setAdded(null), 1800);
  };

  const onBarcode = async (code: string) => {
    setScan(false);
    setScanMsg(`Looking up ${code}…`);
    const local = await db.foods.where('barcode').equals(code).first();
    if (local) {
      setScanMsg('');
      setPicked({ food: local });
      return;
    }
    if (!online || !navigator.onLine) {
      setScanMsg(`${code} isn't in your saved foods${online ? ' and you are offline' : ''}. Create it below.`);
      window.location.hash = `/food/new?date=${date}&meal=${meal}&barcode=${code}`;
      return;
    }
    try {
      const f = await lookupBarcode(code);
      if (f) {
        setScanMsg('');
        setPicked({ food: f });
      } else {
        window.location.hash = `/food/new?date=${date}&meal=${meal}&barcode=${code}`;
      }
    } catch {
      setScanMsg('Lookup failed. Check your signal, or create the food yourself.');
    }
  };

  return (
    <Page
      title={recipeId != null ? 'Add ingredient' : `Add to ${mealLabel}`}
      subtitle={recipeId != null ? recipeFood?.name : date === today ? 'Today' : date}
      back={recipeId != null ? `#${recipeBack}` : `#/food?date=${date}`}
    >
      <input className="input" type="search" placeholder={online ? 'Search foods, UK foods and Open Food Facts' : 'Search your foods and UK foods'} value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />

      <div className="grid grid-cols-2 gap-2">
        <button className="btn-secondary px-2 text-sm" onClick={() => setScan(true)}>▦ Scan barcode</button>
        <button className="btn-secondary px-2 text-sm" onClick={() => setQuick(true)}>Quick add</button>
        {recipeId == null && (
          <>
            <a className="btn-secondary px-2 text-sm" href={`#/food/new?date=${date}&meal=${meal}`}>Create food</a>
            <a className="btn-secondary px-2 text-sm" href={`#/food/recipe?date=${date}&meal=${meal}`}>New recipe</a>
          </>
        )}
      </div>
      {scanMsg && <p className="text-sm text-amber-700 dark:text-amber-400">{scanMsg}</p>}
      {added && <div className="fixed inset-x-0 top-4 z-50 mx-auto w-max rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">{added} ✓</div>}

      {q.trim() ? (
        <>
          <Card className="p-0">
            <div className="muted px-4 pt-3 text-xs font-semibold uppercase">Your foods</div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {localMatches.length === 0 && <li className="muted px-4 py-3 text-sm">No saved foods match.</li>}
              {localMatches.map((f) => (
                <FoodRow key={f.id} title={f.name} sub={`${f.brand ? `${f.brand} · ` : ''}${f.servings[0]?.label}`} kcal={f.servings[0]?.kcal} onClick={() => setPicked({ food: f })} />
              ))}
            </ul>
          </Card>
          <Card className="p-0">
            <div className="muted px-4 pt-3 text-xs font-semibold uppercase">UK foods (CoFID) · works offline</div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {q.trim().length < 2 && <li className="muted px-4 py-3 text-sm">Type at least 2 letters.</li>}
              {q.trim().length >= 2 && cofidMatches.length === 0 && <li className="muted px-4 py-3 text-sm">No UK foods match. Try fewer words, e.g. "chicken breast".</li>}
              {cofidExact.length === 0 && cofidMatches.length > 0 && <li className="muted px-4 py-2 text-xs">No exact match. Closest UK foods:</li>}
              {cofidMatches.map((r) => {
                const f = cofidToFood(r);
                return <FoodRow key={r[0]} title={r[1]} sub={`Per ${f.servings[0].label} · ${r[4]} g protein`} kcal={r[3]} onClick={() => setPicked({ food: f })} />;
              })}
            </ul>
          </Card>
          {online && (
            <Card className="p-0">
              <div className="muted px-4 pt-3 text-xs font-semibold uppercase">{PLAN.diary.onlineSource.name} · branded and packaged</div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {q.trim().length < 3 && <li className="muted px-4 py-3 text-sm">Type at least 3 letters.</li>}
                {searching && <li className="muted px-4 py-3 text-sm">Searching…</li>}
                {searchError && <li className="px-4 py-3 text-sm text-amber-700 dark:text-amber-400">{searchError}</li>}
                {!searching && !searchError && q.trim().length >= 3 && results.length === 0 && <li className="muted px-4 py-3 text-sm">No results.</li>}
                {results.map((f, i) => (
                  <FoodRow key={`${f.barcode}-${i}`} title={f.name} sub={`${f.brand ? `${f.brand} · ` : ''}${f.servings[0]?.label}`} kcal={f.servings[0]?.kcal} onClick={() => setPicked({ food: f })} />
                ))}
              </ul>
            </Card>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {(
              [
                ['recent', 'Recent'],
                ['frequent', 'Frequent'],
                ['mine', 'My foods'],
                ['meals', 'Meals'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} className={`rounded-lg py-2 text-sm font-semibold ${tab === id ? 'bg-white shadow dark:bg-slate-900' : 'muted'}`}>
                {label}
              </button>
            ))}
          </div>
          <Card className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {tab === 'recent' &&
                (recent.length ? recent.map((e) => <FoodRow key={e.id} title={e.name} sub={`${e.qty !== 1 ? `${e.qty} × ` : ''}${e.serving.label}`} kcal={e.kcal} onClick={() => pickEntry(e)} />) : <li className="muted px-4 py-3 text-sm">Foods you log will appear here.</li>)}
              {tab === 'frequent' &&
                (frequent.length ? frequent.map(({ entry: e, count }) => <FoodRow key={e.id} title={e.name} sub={`Logged ${count}× · ${e.serving.label}`} kcal={e.kcal} onClick={() => pickEntry(e)} />) : <li className="muted px-4 py-3 text-sm">Nothing logged yet.</li>)}
              {tab === 'mine' &&
                (myFoods.length ? (
                  myFoods.map((f) => (
                    <li key={f.id} className="flex items-center">
                      <ul className="min-w-0 flex-1">
                        <FoodRow
                          title={f.name}
                          sub={`${f.source === 'recipe' ? 'Recipe · ' : ''}${f.brand ? `${f.brand} · ` : ''}${f.servings[0]?.label}${f.source === 'off' ? ' · Open Food Facts' : f.source === 'cofid' ? ' · UK foods' : ''}`}
                          kcal={f.servings[0]?.kcal}
                          onClick={() => setPicked({ food: f })}
                        />
                      </ul>
                      <a className="muted px-3 py-3 text-sm" href={f.source === 'recipe' ? `#/food/recipe?id=${f.id}&date=${date}&meal=${meal}` : `#/food/new?id=${f.id}&date=${date}&meal=${meal}`}>
                        Edit
                      </a>
                    </li>
                  ))
                ) : (
                  <li className="muted px-4 py-3 text-sm">Foods and recipes you create or use are saved here for offline use.</li>
                ))}
              {tab === 'meals' &&
                (meals.length ? (
                  meals.map((m) => {
                    const sum = totals(m.items);
                    return (
                      <li key={m.id} className="flex items-center">
                        <ul className="min-w-0 flex-1">
                          <FoodRow title={m.name} sub={`${m.items.length} items · ${Math.round(sum.protein)} g protein`} kcal={sum.kcal} onClick={() => addMeal(m.items)} />
                        </ul>
                        <button className="h-11 w-11 text-rose-600" aria-label="Delete meal" onClick={() => confirm(`Delete saved meal "${m.name}"?`) && db.savedMeals.delete(m.id!)}>
                          ✕
                        </button>
                      </li>
                    );
                  })
                ) : (
                  <li className="muted px-4 py-3 text-sm">Save a meal from the ⋯ menu on the diary to add it in one tap.</li>
                ))}
            </ul>
          </Card>
        </>
      )}

      <a href={recipeId != null ? `#${recipeBack}` : `#/food?date=${date}`} className="btn-primary w-full">Done</a>
      <p className="muted text-center text-[11px]">{COFID_ATTRIBUTION}</p>

      {picked && (
        <ServingSheet
          food={picked.food}
          initialServing={picked.serving}
          initialQty={picked.qty}
          initialMeal={meal}
          hideMeal={recipeId != null}
          confirmLabel={recipeId != null ? 'Add to recipe' : 'Add'}
          onClose={() => setPicked(null)}
          onConfirm={(s, qty, m) => addEntry(picked.food, s, qty, m)}
        />
      )}
      {quick && <QuickAdd onClose={() => setQuick(false)} onAdd={(label, n) => (setQuick(false), addEntry(quickAddFood(label, n), { label: 'entry', ...n }, 1, meal))} />}
      {scan && (
        <Sheet onClose={() => setScan(false)}>
          <Suspense fallback={<p className="muted">Starting camera…</p>}>
            <BarcodeScanner onDetected={onBarcode} onCancel={() => setScan(false)} />
          </Suspense>
        </Sheet>
      )}
    </Page>
  );
}

function QuickAdd({ onClose, onAdd }: { onClose: () => void; onAdd: (label: string, n: Nutrients) => void }) {
  const [label, setLabel] = useState('');
  const [n, setN] = useState<Nutrients>({ ...ZERO });
  const [kcal, setKcal] = useState<number | null>(null);
  const field = (k: keyof Nutrients, l: string) => (
    <label>
      <span className="label">{l}</span>
      <NumInput value={n[k] || null} onChange={(v) => setN({ ...n, [k]: v ?? 0 })} suffix="g" ariaLabel={l} />
    </label>
  );
  return (
    <Sheet onClose={onClose}>
      <h2 className="h2 mb-3">Quick add</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2">
          <span className="label">Label (optional)</span>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Canteen lunch" />
        </label>
        <label className="col-span-2">
          <span className="label">Calories</span>
          <NumInput decimal={false} value={kcal} onChange={setKcal} suffix="kcal" ariaLabel="Calories" autoFocus />
        </label>
        {field('protein', 'Protein')}
        {field('carbs', 'Carbs')}
        {field('fat', 'Fat')}
        {field('fibre', 'Fibre')}
      </div>
      <div className="my-3">
        <NutrientLine n={{ ...n, kcal: kcal ?? 0 }} />
      </div>
      <button className="btn-primary w-full" disabled={!kcal} onClick={() => onAdd(label || 'Quick add', { ...n, kcal: kcal ?? 0 })}>
        Add
      </button>
    </Sheet>
  );
}
