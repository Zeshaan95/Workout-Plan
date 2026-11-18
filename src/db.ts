import Dexie, { type Table } from 'dexie';
import { PLAN, type DailyTargets } from './plan';
import type { ISODate } from './lib/dates';
import type { DiaryEntry, Food, SavedMeal } from './lib/food';
import type { HabitDay } from './lib/habits';
import type { WeighIn } from './lib/weight';
import type { WorkoutLog } from './lib/workouts';

export interface BodyComp {
  id?: number;
  date: ISODate;
  weightKg?: number | null;
  bmi?: number | null;
  bodyFatPct?: number | null;
  subcutaneousFatPct?: number | null;
  visceralFat?: number | null;
  muscleMassKg?: number | null;
  skeletalMusclePct?: number | null;
  boneMassKg?: number | null;
  fatFreeMassKg?: number | null;
  bmrKcal?: number | null;
  bodyWaterPct?: number | null;
  proteinPct?: number | null;
  metabolicAge?: number | null;
}

export interface WeekSetting {
  week: number;
  football: boolean;
}

export interface CheckIn {
  date: ISODate;
  avg7?: number | null;
  target?: number | null;
  status?: string | null;
  waistCm?: number | null;
  notes?: string;
  advice?: string | null;
  /** Advice actions applied to targets (so they are never applied twice). */
  appliedActions?: string[];
  savedAt?: string;
}

export interface FoodItem {
  id?: number;
  date: ISODate;
  meal: string;
  kcal: number;
  protein: number;
}

export interface Settings {
  id: 'app';
  heightCm: number;
  targets: DailyTargets;
  theme: 'system' | 'light' | 'dark';
  onboarded: boolean;
  auditStart?: ISODate | null;
  persistGranted?: boolean;
  /** Look up foods online (Open Food Facts). Only search words and barcodes are sent. */
  onlineFoodSearch?: boolean;
}

export class HubDB extends Dexie {
  weighIns!: Table<WeighIn, number>;
  bodyComps!: Table<BodyComp, number>;
  weeks!: Table<WeekSetting, number>;
  workouts!: Table<WorkoutLog, number>;
  checkIns!: Table<CheckIn, string>;
  habits!: Table<HabitDay, string>;
  foodAudit!: Table<FoodItem, number>;
  settings!: Table<Settings, string>;
  foods!: Table<Food, number>;
  diary!: Table<DiaryEntry, number>;
  savedMeals!: Table<SavedMeal, number>;

  constructor(name = 'fat-loss-hub') {
    super(name);
    this.version(1).stores({
      weighIns: '++id, date',
      bodyComps: '++id, date',
      weeks: 'week',
      workouts: '++id, date, session',
      checkIns: 'date',
      habits: 'date',
      foodAudit: '++id, date',
      settings: 'id',
    });
    // v2: food diary
    this.version(2).stores({
      foods: '++id, name, barcode',
      diary: '++id, date, foodId',
      savedMeals: '++id, name',
    });
  }
}

export const TABLES = ['weighIns', 'bodyComps', 'weeks', 'workouts', 'checkIns', 'habits', 'foodAudit', 'settings', 'foods', 'diary', 'savedMeals'] as const;
export type TableName = (typeof TABLES)[number];

export function defaultSettings(): Settings {
  return {
    id: 'app',
    heightCm: PLAN.defaultHeightCm,
    targets: { ...PLAN.dailyTargets },
    theme: 'system',
    onboarded: false,
    auditStart: null,
    onlineFoodSearch: true,
  };
}

/** Load seed data on first run (no settings row yet). Idempotent. */
export async function seedIfEmpty(db: HubDB): Promise<boolean> {
  return db.transaction('rw', db.settings, db.weighIns, db.bodyComps, async () => {
    if (await db.settings.get('app')) return false;
    await db.settings.put(defaultSettings());
    if ((await db.weighIns.count()) === 0) {
      await db.weighIns.bulkAdd(PLAN.seed.weighIns.map((w) => ({ date: w.date, time: '07:00', kg: w.kg, note: w.note })));
    }
    if ((await db.bodyComps.count()) === 0) {
      await db.bodyComps.add({ ...PLAN.seed.bodyComp });
    }
    return true;
  });
}

export const db = new HubDB();

/** Diary totals feed the calorie and protein habits for that day. */
export async function syncHabitsFromDiary(db: HubDB, date: ISODate): Promise<void> {
  const entries = await db.diary.where('date').equals(date).toArray();
  const h = await db.habits.get(date);
  if (!entries.length) {
    if (h?.fromDiary) await db.habits.put({ ...h, kcal: null, protein: null, fromDiary: false });
    return;
  }
  const kcal = entries.reduce((a, e) => a + e.kcal, 0);
  const protein = Math.round(entries.reduce((a, e) => a + e.protein, 0));
  await db.habits.put({ ...(h ?? { date }), date, kcal, protein, fromDiary: true });
}
