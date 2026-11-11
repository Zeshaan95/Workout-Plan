import { useRef, useState } from 'react';
import { Card, NumInput, Page, Row } from '../components/ui';
import { db, seedIfEmpty, type Settings as SettingsRow } from '../db';
import { useSettings } from '../hooks';
import { PLAN, type DailyTargets } from '../plan';
import { exportAll, importAll, resetAll } from '../lib/backup';
import { liftsCSV, weighInsCSV } from '../lib/csv';
import { todayISO } from '../lib/dates';
import { bmi } from '../lib/weight';

/** Save a file: share sheet on iPhone where supported, otherwise a normal download. */
async function saveFile(name: string, text: string, type: string) {
  const file = new File([text], name, { type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad/.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch {
      /* cancelled: fall through to download */
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const TARGET_FIELDS: [keyof DailyTargets, string, string, boolean][] = [
  ['kcal', 'Calories', 'kcal', false],
  ['kcalFloor', 'Calorie floor', 'kcal', false],
  ['proteinMin', 'Protein min', 'g', false],
  ['proteinMax', 'Protein max', 'g', false],
  ['fat', 'Fat', 'g', false],
  ['carbs', 'Carbs', 'g', false],
  ['fibre', 'Fibre', 'g', false],
  ['steps', 'Steps', '', false],
  ['waterMin', 'Water min', 'L', true],
  ['waterMax', 'Water max', 'L', true],
  ['sleepMin', 'Sleep min', 'h', true],
  ['sleepMax', 'Sleep max', 'h', true],
];

export default function Settings() {
  const s = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const update = (patch: Partial<SettingsRow>) => db.settings.update('app', patch);
  const setTarget = (k: keyof DailyTargets, v: number | null) => v != null && update({ targets: { ...s.targets, [k]: v } });

  const doExport = async () => {
    const data = await exportAll(db);
    await saveFile(`fat-loss-hub-backup-${todayISO()}.json`, JSON.stringify(data, null, 1), 'application/json');
    setMsg('Backup exported.');
  };

  const doImport = async (f: File) => {
    try {
      const data = JSON.parse(await f.text());
      if (!confirm('Replace ALL data in the app with this backup?')) return;
      await importAll(db, data);
      setMsg('Backup restored.');
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  const doReset = async () => {
    const typed = prompt('This deletes everything on this device. Export a backup first.\n\nType RESET to confirm.');
    if (typed !== 'RESET') return;
    await resetAll(db);
    await seedIfEmpty(db);
    window.location.hash = '/catchup?first=1';
  };

  return (
    <Page title="Settings" back="#/more">
      {msg && <Card className="bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-900">{msg}</Card>}

      <Card>
        <h2 className="h2 mb-2">You</h2>
        <label className="block">
          <span className="label">Height (worked out from the scale's BMI)</span>
          <NumInput value={s.heightCm} onChange={(v) => v && update({ heightCm: v })} suffix="cm" ariaLabel="Height" />
        </label>
        <p className="muted mt-1 text-sm">BMI at 97.0 kg: {bmi(PLAN.startKg, s.heightCm).toFixed(1)} · at 84.3 kg: {bmi(PLAN.goalKg, s.heightCm).toFixed(1)}</p>
        <label className="mt-3 block">
          <span className="label">Appearance</span>
          <select className="input text-base" value={s.theme} onChange={(e) => update({ theme: e.target.value as SettingsRow['theme'] })}>
            <option value="system">Match iPhone (light/dark)</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </Card>

      <Card>
        <Row className="mb-2">
          <h2 className="h2">Daily targets</h2>
          <button className="text-sm font-semibold text-emerald-600" onClick={() => confirm('Reset targets to the plan defaults?') && update({ targets: { ...PLAN.dailyTargets } })}>
            Reset to plan
          </button>
        </Row>
        <div className="grid grid-cols-2 gap-3">
          {TARGET_FIELDS.map(([k, label, unit, dec]) => (
            <label key={k}>
              <span className="label">{label}</span>
              <NumInput decimal={dec} value={s.targets[k] as number} onChange={(v) => setTarget(k, v)} suffix={unit} ariaLabel={label} />
            </label>
          ))}
        </div>
        <p className="muted mt-2 text-xs">The weight targets, sessions and rules live in src/plan.ts.</p>
      </Card>

      <Card>
        <h2 className="h2">Backup & move devices</h2>
        <p className="muted mb-3 text-sm">
          Data is stored only on this device. Persistent storage: {s.persistGranted ? 'granted ✓' : 'not granted (on iPhone, adding to the Home Screen helps)'}. Export a backup weekly.
        </p>
        <div className="grid gap-2">
          <button className="btn-primary" onClick={doExport}>Export everything (JSON)</button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>Import backup (JSON)</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={async () => saveFile(`weigh-ins-${todayISO()}.csv`, weighInsCSV(await db.weighIns.toArray()), 'text/csv')}>Weigh-ins CSV</button>
            <button className="btn-secondary" onClick={async () => saveFile(`lifts-${todayISO()}.csv`, liftsCSV(await db.workouts.toArray()), 'text/csv')}>Lifts CSV</button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="h2">Reset</h2>
        <p className="muted mb-3 text-sm">Deletes everything and reloads the plan's seed data.</p>
        <button className="btn-danger w-full" onClick={doReset}>Reset all data</button>
      </Card>

      <p className="muted text-center text-xs">No accounts, no servers, no analytics. Works offline.</p>
    </Page>
  );
}
