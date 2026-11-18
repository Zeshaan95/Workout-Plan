import { describe, expect, it } from 'vitest';
import data from '../data/cofid.json';
import { cofidToFood, searchCofid, type CofidRow } from './cofid';
import { recipeServings, recipeToFood, recipeTotals, type Recipe } from './food';

const rows = (data as unknown as { foods: CofidRow[] }).foods;

describe('CoFID dataset', () => {
  it('has the UK composition tables with sensible values', () => {
    expect(rows.length).toBeGreaterThan(2800);
    const breast = rows.find((r) => r[1] === 'Chicken, breast, grilled without skin, meat only')!;
    expect(breast.slice(3)).toEqual([148, 32, 2.2, 0, 0]);
  });
  it('search matches every word, handles plurals and ranks plain names first', () => {
    const res = searchCofid(rows, 'chicken breast grilled');
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => /chicken/i.test(r[1]) && /breast/i.test(r[1]) && /grilled/i.test(r[1]))).toBe(true);
    expect(searchCofid(rows, 'bananas')[0][1]).toMatch(/^Banana/);
    expect(searchCofid(rows, 'eggs').length).toBeGreaterThan(0);
    expect(searchCofid(rows, '')).toEqual([]);
  });
  it('loose search finds near matches when the wording differs', () => {
    expect(searchCofid(rows, 'chicken breast raw')).toEqual([]);
    const loose = searchCofid(rows, 'chicken breast raw', 30, true).map((r) => r[1]);
    expect(loose).toContain('Chicken, light meat, raw');
    // Names starting with the first word rank first.
    expect(loose.slice(0, 10).every((n) => /^chicken/i.test(n))).toBe(true);
  });
  it('converts to a per-100 g food (per 100 ml for drinks)', () => {
    const f = cofidToFood(['11-858', 'Rice, white, basmati, boiled in unsalted water', 'AC', 117, 2.8, 0.7, 26.5, 0.6]);
    expect(f).toMatchObject({ source: 'cofid', cofidCode: '11-858', unit: 'g', per100g: { kcal: 117, protein: 2.8 } });
    expect(f.servings[0].label).toBe('100 g');
    expect(cofidToFood(['17-506', 'Beer, bitter', 'QA', 30, 0.3, 0, 2.2, 0]).servings[0].label).toBe('100 ml');
  });
});

describe('recipes', () => {
  const recipe: Recipe = {
    portions: 4,
    cookedWeightG: 1600,
    items: [
      { name: 'Chicken breast', serving: { label: '100 g', grams: 100, kcal: 106, protein: 24, fat: 1, carbs: 0, fibre: 0 }, qty: 8 },
      { name: 'Rice', serving: { label: '100 g', grams: 100, kcal: 355, protein: 6.7, fat: 1, carbs: 85.1, fibre: 1.1 }, qty: 3 },
      { name: 'Olive oil', serving: { label: '1 tbsp', kcal: 120, protein: 0, fat: 13.6, carbs: 0, fibre: 0 }, qty: 1 },
    ],
  };
  it('totals the ingredients', () => {
    expect(recipeTotals(recipe)).toEqual({ kcal: 2033, protein: 212.1, fat: 24.6, carbs: 255.3, fibre: 3.3 });
  });
  it('divides into portions and per 100 g of cooked weight', () => {
    const { servings, per100g } = recipeServings(recipe);
    expect(servings[0]).toMatchObject({ label: '1 portion (400 g)', grams: 400, kcal: 508, protein: 53 });
    expect(per100g).toMatchObject({ kcal: 127, protein: 13.3 });
    expect(recipeServings({ ...recipe, cookedWeightG: null }).servings).toHaveLength(1);
  });
  it('becomes a loggable food', () => {
    const f = recipeToFood('Chicken & rice', recipe);
    expect(f).toMatchObject({ name: 'Chicken & rice', source: 'recipe' });
    expect(f.servings[0].kcal).toBe(508);
  });
});
