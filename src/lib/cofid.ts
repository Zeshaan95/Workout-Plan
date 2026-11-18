/**
 * UK CoFID (McCance and Widdowson) generic foods, bundled for offline search.
 */
import type { Food } from './food';

/** [code, name, group, kcal, protein, fat, carbs, fibre] per 100 g (per 100 ml for drinks, group Q). */
export type CofidRow = [string, string, string, number, number, number, number, number];

export const COFID_ATTRIBUTION =
  "UK foods from McCance and Widdowson's Composition of Foods Integrated Dataset 2021. Contains public sector information licensed under the Open Government Licence v3.0.";

let cache: Promise<CofidRow[]> | null = null;

/** Lazy-loads the dataset (a separate chunk, precached by the service worker). */
export function loadCofid(): Promise<CofidRow[]> {
  cache ??= import('../data/cofid.json').then((m) => (m.default as unknown as { foods: CofidRow[] }).foods);
  return cache;
}

export function cofidToFood(r: CofidRow): Food {
  const [code, name, group, kcal, protein, fat, carbs, fibre] = r;
  const unit = group.startsWith('Q') ? 'ml' : 'g';
  const per100g = { kcal, protein, fat, carbs, fibre };
  return { name, source: 'cofid', cofidCode: code, unit, per100g, servings: [{ label: `100 ${unit}`, grams: 100, ...per100g }] };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
/** Very light stemming so "eggs" finds "Egg" and "potatoes" finds "Potato". */
const stem = (w: string) => w.replace(/(es|s)$/, '');

/**
 * Every query word must appear; rank names that start with the first word, then shorter names.
 * With `loose`, names missing up to half the words are allowed, ranked by how many words matched
 * (CoFID's wording differs from everyday names, e.g. raw chicken breast is "Chicken, light meat, raw").
 */
export function searchCofid(rows: CofidRow[], q: string, limit = 30, loose = false): CofidRow[] {
  const words = norm(q).split(' ').filter(Boolean).map(stem);
  if (!words.length) return [];
  const scored: { r: CofidRow; score: number }[] = [];
  const maxMissing = loose ? Math.floor(words.length / 2) : 0;
  for (const r of rows) {
    const name = norm(r[1]);
    const missing = words.filter((w) => !name.includes(w)).length;
    if (missing > maxMissing || missing === words.length) continue;
    let score = name.length + missing * 1000;
    if (name.startsWith(words[0])) score -= 100;
    if (/\braw\b/.test(name) && !words.includes('raw')) score += 5;
    if (/weighed with/.test(name)) score += 40;
    scored.push({ r, score });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((x) => x.r);
}
