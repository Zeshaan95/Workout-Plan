/**
 * Food diary logic: servings, totals, remaining, Open Food Facts parsing, recent/frequent foods.
 */
import { PLAN, type DailyTargets } from '../plan';
import type { ISODate } from './dates';

export type MealId = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface Nutrients {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fibre: number;
}

export interface Serving extends Nutrients {
  /** e.g. "100 g", "1 serving (30 g)", "1 slice". */
  label: string;
  /** Weight of one serving in grams, if known. */
  grams?: number | null;
}

export interface Food {
  id?: number;
  name: string;
  brand?: string;
  barcode?: string;
  source: 'custom' | 'off' | 'quick';
  /** Nutrients per 100 g, when known (lets you log any number of grams). */
  per100g?: Nutrients | null;
  servings: Serving[];
  createdAt?: string;
}

export interface DiaryEntry extends Nutrients {
  id?: number;
  date: ISODate;
  meal: MealId;
  foodId?: number | null;
  name: string;
  brand?: string;
  /** Serving used, with its per-serving nutrients, so the quantity can be edited later. */
  serving: Serving;
  qty: number;
  createdAt?: string;
}

export interface SavedMeal {
  id?: number;
  name: string;
  items: Omit<DiaryEntry, 'id' | 'date' | 'meal' | 'createdAt'>[];
}

export const ZERO: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 };
export const NUTRIENT_KEYS: (keyof Nutrients)[] = ['kcal', 'protein', 'fat', 'carbs', 'fibre'];

const r1 = (n: number) => Math.round(n * 10) / 10;

export function scale(n: Nutrients, factor: number): Nutrients {
  return {
    kcal: Math.round(n.kcal * factor),
    protein: r1(n.protein * factor),
    fat: r1(n.fat * factor),
    carbs: r1(n.carbs * factor),
    fibre: r1(n.fibre * factor),
  };
}

export function add(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: r1(a.protein + b.protein),
    fat: r1(a.fat + b.fat),
    carbs: r1(a.carbs + b.carbs),
    fibre: r1(a.fibre + b.fibre),
  };
}

export function totals(entries: Nutrients[]): Nutrients {
  return entries.reduce<Nutrients>((t, e) => add(t, e), { ...ZERO });
}

/** A serving for an arbitrary number of grams, from per-100 g values. */
export function gramsServing(per100g: Nutrients, grams: number): Serving {
  return { label: `${grams} g`, grams, ...scale(per100g, grams / 100) };
}

/** Make a diary entry from a food, a serving and a quantity (number of servings). */
export function makeEntry(food: Food, serving: Serving, qty: number, date: ISODate, meal: MealId): DiaryEntry {
  return {
    date,
    meal,
    foodId: food.id ?? null,
    name: food.name,
    brand: food.brand,
    serving,
    qty,
    ...scale(serving, qty),
    createdAt: new Date().toISOString(),
  };
}

export function withQty(e: DiaryEntry, qty: number): DiaryEntry {
  return { ...e, qty, ...scale(e.serving, qty) };
}

export function quickAddFood(label: string, n: Nutrients): Food {
  return { name: label || 'Quick add', source: 'quick', servings: [{ label: 'entry', ...n }] };
}

export interface DayProgress {
  eaten: Nutrients;
  kcalRemaining: number;
  /** Below the 1,750 floor (only meaningful at the end of the day). */
  belowFloor: boolean;
  overTarget: boolean;
  proteinRange: [number, number];
}

export function dayProgress(entries: Nutrients[], t: DailyTargets): DayProgress {
  const eaten = totals(entries);
  return {
    eaten,
    kcalRemaining: t.kcal - eaten.kcal,
    belowFloor: eaten.kcal < t.kcalFloor,
    overTarget: eaten.kcal > t.kcal,
    proteinRange: [t.proteinMin, t.proteinMax],
  };
}

/** Share of calories from protein, carbs and fat (4/4/9 kcal per gram). */
export function macroSplit(n: Nutrients): { protein: number; carbs: number; fat: number } | null {
  const p = n.protein * 4;
  const c = n.carbs * 4;
  const f = n.fat * 9;
  const sum = p + c + f;
  if (sum <= 0) return null;
  return { protein: Math.round((p / sum) * 100), carbs: Math.round((c / sum) * 100), fat: Math.round((f / sum) * 100) };
}

// ---------------------------------------------------------------------------
// Recent and frequent foods
// ---------------------------------------------------------------------------

export function foodKey(e: Pick<DiaryEntry, 'foodId' | 'name' | 'brand'>): string {
  return e.foodId != null ? `id:${e.foodId}` : `n:${e.name}|${e.brand ?? ''}`;
}

/** Most recently logged distinct foods, newest first. */
export function recentFoods(entries: DiaryEntry[], limit = 20): DiaryEntry[] {
  const sorted = [...entries].sort((a, b) => ((b.createdAt ?? b.date) > (a.createdAt ?? a.date) ? 1 : -1));
  const seen = new Set<string>();
  const out: DiaryEntry[] = [];
  for (const e of sorted) {
    const k = foodKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/** Most often logged distinct foods. */
export function frequentFoods(entries: DiaryEntry[], limit = 20): { entry: DiaryEntry; count: number }[] {
  const map = new Map<string, { entry: DiaryEntry; count: number }>();
  for (const e of recentFoods(entries, Infinity)) map.set(foodKey(e), { entry: e, count: 0 });
  for (const e of entries) map.get(foodKey(e))!.count++;
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function matchesQuery(name: string, brand: string | undefined, q: string): boolean {
  const hay = `${name} ${brand ?? ''}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

// ---------------------------------------------------------------------------
// Open Food Facts
// ---------------------------------------------------------------------------

type OFFNutriments = Record<string, number | string | undefined>;
export interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: OFFNutriments;
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function nutrientsFrom(n: OFFNutriments, suffix: '_100g' | '_serving'): Nutrients | null {
  let kcal = num(n[`energy-kcal${suffix}`]);
  if (kcal == null) {
    const kj = num(n[`energy-kj${suffix}`]) ?? num(n[`energy${suffix}`]);
    if (kj != null) kcal = kj / 4.184;
  }
  if (kcal == null) return null;
  return {
    kcal: Math.round(kcal),
    protein: r1(num(n[`proteins${suffix}`]) ?? 0),
    fat: r1(num(n[`fat${suffix}`]) ?? 0),
    carbs: r1(num(n[`carbohydrates${suffix}`]) ?? 0),
    fibre: r1(num(n[`fiber${suffix}`]) ?? 0),
  };
}

/** Convert an Open Food Facts product to a Food. Returns null if it has no usable calories. */
export function parseOFFProduct(p: OFFProduct): Food | null {
  const name = (p.product_name || p.product_name_en || '').trim();
  if (!name || !p.nutriments) return null;
  const per100g = nutrientsFrom(p.nutriments, '_100g');
  const servingG = num(p.serving_quantity);
  let perServing = nutrientsFrom(p.nutriments, '_serving');
  if (!perServing && per100g && servingG) perServing = scale(per100g, servingG / 100);
  if (!per100g && !perServing) return null;

  const servings: Serving[] = [];
  if (perServing) {
    const label = p.serving_size ? `1 serving (${p.serving_size.trim()})` : servingG ? `1 serving (${servingG} g)` : '1 serving';
    servings.push({ label, grams: servingG, ...perServing });
  }
  if (per100g) servings.push({ label: '100 g', grams: 100, ...per100g });

  return {
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    barcode: p.code || undefined,
    source: 'off',
    per100g,
    servings,
  };
}

export function offSearchUrl(q: string): string {
  const s = PLAN.diary.onlineSource;
  const params = new URLSearchParams({
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(s.pageSize),
    fields: s.fields,
  });
  return `${s.searchUrl}?${params}`;
}

export function offProductUrl(barcode: string): string {
  const s = PLAN.diary.onlineSource;
  return `${s.productUrl}${encodeURIComponent(barcode)}.json?fields=${s.fields}`;
}

export async function searchOFF(q: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<Food[]> {
  const res = await fetcher(offSearchUrl(q), { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = (await res.json()) as { products?: OFFProduct[] };
  return (data.products ?? []).map(parseOFFProduct).filter((f): f is Food => f != null);
}

export async function lookupBarcode(barcode: string, fetcher: typeof fetch = fetch): Promise<Food | null> {
  const res = await fetcher(offProductUrl(barcode));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
  const data = (await res.json()) as { status?: number; product?: OFFProduct };
  if (data.status === 0 || !data.product) return null;
  const f = parseOFFProduct({ ...data.product, code: data.product.code ?? barcode });
  return f;
}

// ---------------------------------------------------------------------------
// Create / edit a food from a form
// ---------------------------------------------------------------------------

export interface FoodDraft extends Nutrients {
  name: string;
  brand: string;
  barcode: string;
  servingLabel: string;
  grams: number | null;
}

/** Per-serving values from the label, plus per-100 g when the serving weight is known. */
export function draftToFood(d: FoodDraft, base?: Food): Food {
  const label = d.grams && d.servingLabel.trim() !== `${d.grams} g` ? `${d.servingLabel.trim()} (${d.grams} g)` : d.servingLabel.trim();
  const serving: Serving = { label, grams: d.grams, kcal: d.kcal, protein: d.protein, fat: d.fat, carbs: d.carbs, fibre: d.fibre };
  const per100g = d.grams ? scale(serving, 100 / d.grams) : base?.per100g ?? null;
  const servings = [serving];
  if (per100g && d.grams !== 100) servings.push({ label: '100 g', grams: 100, ...per100g });
  return {
    ...(base ?? {}),
    name: d.name.trim(),
    brand: d.brand.trim() || undefined,
    barcode: d.barcode.trim() || undefined,
    source: base?.source === 'off' ? 'off' : 'custom',
    per100g,
    servings,
  };
}
