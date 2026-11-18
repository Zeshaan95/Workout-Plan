import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { HubDB, seedIfEmpty } from '../db';
import { exportAll, importAll, resetAll } from './backup';
import { liftsCSV, weighInsCSV } from './csv';

describe('backup', () => {
  it('seeds once on first run', async () => {
    const db = new HubDB('seed-test');
    expect(await seedIfEmpty(db)).toBe(true);
    expect(await seedIfEmpty(db)).toBe(false);
    expect(await db.weighIns.count()).toBe(6);
    expect((await db.bodyComps.toArray())[0].bmrKcal).toBe(1773);
  });

  it('export then import restores everything exactly', async () => {
    const db = new HubDB('roundtrip');
    await seedIfEmpty(db);
    await db.weighIns.add({ date: '2026-11-10', time: '06:50', kg: 96.65 });
    await db.weeks.put({ week: 3, football: false });
    await db.workouts.add({ date: '2026-11-10', session: 'strengthC', status: 'complete', entries: [{ exerciseId: 'pullup', sets: [{ reps: 6, backpackKg: null, done: true }] }] });
    await db.checkIns.put({ date: '2026-11-15', waistCm: 104.5, notes: 'Good week — “quotes”, commas' });
    await db.habits.put({ date: '2026-11-10', kcal: 1900, protein: 172, creatine: true });
    await db.foodAudit.add({ date: '2026-11-10', meal: 'Ghee', kcal: 120, protein: 0 });

    const before = await exportAll(db);
    const json = JSON.parse(JSON.stringify(before));
    await resetAll(db);
    expect(await db.weighIns.count()).toBe(0);
    await importAll(db, json);
    const after = await exportAll(db);
    expect(after.tables).toEqual(before.tables);

    // Import into a fresh database on another "device"
    const other = new HubDB('other-device');
    await importAll(other, json);
    expect((await exportAll(other)).tables).toEqual(before.tables);
  });

  it('rejects files that are not backups', async () => {
    const db = new HubDB('reject');
    await expect(importAll(db, { foo: 1 })).rejects.toThrow(/not a Fat-Loss Hub backup/);
  });

  it('writes CSVs', () => {
    const csv = weighInsCSV([{ date: '2026-11-09', time: '07:00', kg: 97 }]);
    expect(csv).toBe('date,time,weight_kg,stone_lb,note\n2026-11-09,07:00,97.00,15 st 4 lb,\n');
    const lifts = liftsCSV([{ date: '2026-11-14', session: 'strengthA', status: 'complete', entries: [{ exerciseId: 'backSquat', sets: [{ weightKg: 80, reps: 6 }] }] }]);
    expect(lifts.split('\n')[1]).toBe('2026-11-14,Strength A (gym),complete,Back squat,1,80,6,,,,,');
  });
});

describe('food diary backup and habit sync', () => {
  it('round-trips foods, diary and saved meals, and still imports a v1 backup', async () => {
    const { syncHabitsFromDiary } = await import('../db');
    const db = new HubDB('food-roundtrip');
    await seedIfEmpty(db);
    const foodId = await db.foods.add({ name: 'Eggs', source: 'custom', servings: [{ label: '1 egg', kcal: 70, protein: 6, fat: 5, carbs: 0, fibre: 0 }] });
    const serving = { label: '1 egg', kcal: 70, protein: 6, fat: 5, carbs: 0, fibre: 0 };
    await db.diary.add({ date: '2026-11-18', meal: 'breakfast', foodId, name: 'Eggs', serving, qty: 3, kcal: 210, protein: 18, fat: 15, carbs: 0, fibre: 0 });
    await db.savedMeals.add({ name: 'Eggs on toast', items: [{ foodId, name: 'Eggs', serving, qty: 2, kcal: 140, protein: 12, fat: 10, carbs: 0, fibre: 0 }] });
    await syncHabitsFromDiary(db, '2026-11-18');
    expect(await db.habits.get('2026-11-18')).toMatchObject({ kcal: 210, protein: 18, fromDiary: true });

    const before = JSON.parse(JSON.stringify(await exportAll(db)));
    await resetAll(db);
    await importAll(db, before);
    expect((await exportAll(db)).tables).toEqual(before.tables);

    const v1 = { ...before, version: 1, tables: { ...before.tables } };
    delete v1.tables.foods;
    delete v1.tables.diary;
    delete v1.tables.savedMeals;
    await importAll(db, v1);
    expect(await db.diary.count()).toBe(0);
    expect(await db.weighIns.count()).toBe(6);

    await db.diary.clear();
    await syncHabitsFromDiary(db, '2026-11-18');
    expect((await db.habits.get('2026-11-18'))?.kcal).toBeNull();
  });
});
