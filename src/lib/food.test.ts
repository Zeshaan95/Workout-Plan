import { describe, expect, it, vi } from 'vitest';
import { PLAN } from '../plan';
import {
  dayProgress,
  frequentFoods,
  gramsServing,
  lookupBarcode,
  macroSplit,
  makeEntry,
  matchesQuery,
  parseOFFProduct,
  recentFoods,
  searchOFF,
  totals,
  withQty,
  type DiaryEntry,
  type Food,
} from './food';

const oats: Food = {
  id: 1,
  name: 'Porridge oats',
  brand: 'Brand',
  source: 'custom',
  per100g: { kcal: 375, protein: 11, fat: 8, carbs: 60, fibre: 9 },
  servings: [{ label: '40 g', grams: 40, kcal: 150, protein: 4.4, fat: 3.2, carbs: 24, fibre: 3.6 }],
};

describe('servings and entries', () => {
  it('scales a serving by quantity', () => {
    const e = makeEntry(oats, oats.servings[0], 1.5, '2026-11-18', 'breakfast');
    expect(e).toMatchObject({ kcal: 225, protein: 6.6, fat: 4.8, carbs: 36, fibre: 5.4, qty: 1.5, foodId: 1 });
  });
  it('re-scales when the quantity is edited', () => {
    const e = withQty(makeEntry(oats, oats.servings[0], 1, '2026-11-18', 'breakfast'), 2);
    expect(e.kcal).toBe(300);
    expect(e.protein).toBe(8.8);
  });
  it('builds a gram serving from per-100 g values', () => {
    expect(gramsServing(oats.per100g!, 55)).toEqual({ label: '55 g', grams: 55, kcal: 206, protein: 6.1, fat: 4.4, carbs: 33, fibre: 5 });
  });
  it('totals a day and works out calories remaining against the plan', () => {
    const t = PLAN.dailyTargets;
    const day = [
      { kcal: 600, protein: 45, fat: 20, carbs: 50, fibre: 8 },
      { kcal: 700, protein: 50, fat: 15, carbs: 70, fibre: 10 },
    ];
    expect(totals(day)).toEqual({ kcal: 1300, protein: 95, fat: 35, carbs: 120, fibre: 18 });
    const p = dayProgress(day, t);
    expect(p.kcalRemaining).toBe(600);
    expect(p.belowFloor).toBe(true);
    expect(p.overTarget).toBe(false);
    expect(dayProgress([{ kcal: 1950, protein: 0, fat: 0, carbs: 0, fibre: 0 }], t).overTarget).toBe(true);
  });
  it('macro split uses 4/4/9 kcal per gram', () => {
    expect(macroSplit({ kcal: 0, protein: 100, carbs: 100, fat: 0, fibre: 0 })).toEqual({ protein: 50, carbs: 50, fat: 0 });
    expect(macroSplit({ kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 })).toBeNull();
  });
});

describe('recent and frequent', () => {
  const e = (name: string, createdAt: string, foodId?: number): DiaryEntry => ({
    date: createdAt.slice(0, 10), meal: 'lunch', name, foodId, createdAt, qty: 1,
    serving: { label: '1', kcal: 1, protein: 0, fat: 0, carbs: 0, fibre: 0 }, kcal: 1, protein: 0, fat: 0, carbs: 0, fibre: 0,
  });
  const entries = [e('Eggs', '2026-11-16T07:00', 2), e('Chicken', '2026-11-16T12:00', 3), e('Eggs', '2026-11-17T07:00', 2), e('Eggs', '2026-11-18T07:00', 2), e('Apple', '2026-11-17T15:00')];
  it('recent foods are distinct and newest first', () => {
    expect(recentFoods(entries).map((x) => x.name)).toEqual(['Eggs', 'Apple', 'Chicken']);
  });
  it('frequent foods are ordered by count', () => {
    expect(frequentFoods(entries).map((x) => [x.entry.name, x.count])).toEqual([['Eggs', 3], ['Apple', 1], ['Chicken', 1]]);
  });
  it('matches every search word against name and brand', () => {
    expect(matchesQuery('Greek yoghurt 0%', 'Fage', 'fage yog')).toBe(true);
    expect(matchesQuery('Greek yoghurt', 'Fage', 'skyr')).toBe(false);
  });
});

describe('Open Food Facts', () => {
  const product = {
    code: '5000159484695',
    product_name: 'Muesli bar',
    brands: 'Acme, Acme UK',
    serving_size: '30 g',
    serving_quantity: 30,
    nutriments: { 'energy-kcal_100g': 400, proteins_100g: 10, fat_100g: 15, carbohydrates_100g: 55, fiber_100g: 6 },
  };
  it('parses per-100 g and derives the serving', () => {
    const f = parseOFFProduct(product)!;
    expect(f).toMatchObject({ name: 'Muesli bar', brand: 'Acme', barcode: '5000159484695', source: 'off' });
    expect(f.servings[0]).toMatchObject({ label: '1 serving (30 g)', grams: 30, kcal: 120, protein: 3, fat: 4.5, carbs: 16.5, fibre: 1.8 });
    expect(f.servings[1]).toMatchObject({ label: '100 g', kcal: 400 });
  });
  it('falls back to kJ when kcal is missing', () => {
    const f = parseOFFProduct({ product_name: 'Bread', nutriments: { 'energy-kj_100g': 1046 } })!;
    expect(f.servings[0].kcal).toBe(250);
  });
  it('rejects products without a name or calories', () => {
    expect(parseOFFProduct({ product_name: '', nutriments: {} })).toBeNull();
    expect(parseOFFProduct({ product_name: 'Water', nutriments: { proteins_100g: 0 } })).toBeNull();
  });
  it('searches and looks up barcodes through fetch', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes('search.pl')) return new Response(JSON.stringify({ products: [product, { product_name: '' }] }));
      if (url.includes('000000')) return new Response(JSON.stringify({ status: 0 }));
      return new Response(JSON.stringify({ status: 1, product }));
    }) as unknown as typeof fetch;
    const found = await searchOFF('muesli', fetcher);
    expect(found).toHaveLength(1);
    expect((fetcher as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]).toContain('search_terms=muesli');
    expect((await lookupBarcode('5000159484695', fetcher))?.name).toBe('Muesli bar');
    expect(await lookupBarcode('000000', fetcher)).toBeNull();
  });
});

describe('create food from a label', () => {
  it('keeps per-serving values and derives per-100 g from the serving weight', async () => {
    const { draftToFood } = await import('./food');
    const f = draftToFood({ name: ' Wholemeal bread ', brand: '', barcode: '0123', servingLabel: '1 slice', grams: 40, kcal: 96, protein: 4, fat: 1, carbs: 16, fibre: 2.8 });
    expect(f).toMatchObject({ name: 'Wholemeal bread', brand: undefined, barcode: '0123', source: 'custom' });
    expect(f.servings[0]).toMatchObject({ label: '1 slice (40 g)', kcal: 96 });
    expect(f.per100g).toEqual({ kcal: 240, protein: 10, fat: 2.5, carbs: 40, fibre: 7 });
    expect(f.servings[1].label).toBe('100 g');
    const noWeight = draftToFood({ name: 'Curry', brand: '', barcode: '', servingLabel: '1 portion', grams: null, kcal: 650, protein: 40, fat: 25, carbs: 60, fibre: 6 });
    expect(noWeight.servings).toHaveLength(1);
    expect(noWeight.per100g).toBeNull();
  });
});
