import { useRef, useState } from 'react';
import { db, syncHabitsFromDiary } from '../db';
import { PLAN } from '../plan';
import type { MealId } from '../lib/food';
import { totals } from '../lib/food';
import { photoToJpegBase64 } from '../lib/image';
import { analyseFoodPhoto, itemNutrients, makeClient, PhotoAnalysisError, photoItemsToEntries, type PhotoItem } from '../lib/photoFood';
import { NutrientLine, Sheet } from './ServingSheet';
import { NumInput } from './ui';

type Row = PhotoItem & { include: boolean };

/** Take or choose a photo, let Claude estimate it, review and edit, then add to the diary. */
export default function PhotoLog({ apiKey, date, meal: initialMeal, onClose, onAdded }: { apiKey: string; date: string; meal: MealId; onClose: () => void; onAdded: (n: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [notes, setNotes] = useState('');
  const [meal, setMeal] = useState<MealId>(initialMeal);

  if (!apiKey) {
    return (
      <Sheet onClose={onClose}>
        <h2 className="h2 mb-2">Log food from a photo</h2>
        <p className="text-sm">Photo logging uses Claude to estimate what's on your plate. It needs your own Anthropic API key, which is kept only on this phone.</p>
        <ol className="muted mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>Go to platform.claude.com, sign in and add a little credit (each photo costs around 1–2p).</li>
          <li>Create an API key and copy it.</li>
          <li>Paste it in More → Settings → Photo logging.</li>
        </ol>
        <a href="#/settings" className="btn-primary mt-4 w-full">Open Settings</a>
      </Sheet>
    );
  }

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    setRows(null);
    try {
      const { data, previewUrl } = await photoToJpegBase64(f, PLAN.diary.photo.maxImagePx, PLAN.diary.photo.jpegQuality);
      setImage(data);
      setPreview(previewUrl);
    } catch {
      setError("Couldn't read that photo. Try another.");
    }
  };

  const analyse = async () => {
    if (!image) return;
    if (!navigator.onLine) return setError('No connection. Photo analysis needs signal.');
    setBusy(true);
    setError('');
    try {
      const res = await analyseFoodPhoto(await makeClient(apiKey), image, 'image/jpeg', note);
      setRows(res.items.map((i) => ({ ...i, include: true })));
      setNotes(res.notes);
    } catch (e) {
      setError(e instanceof PhotoAnalysisError ? e.message : 'Analysis failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const chosen = (rows ?? []).filter((r) => r.include);
  const sum = totals(chosen.map(itemNutrients));

  const add = async () => {
    if (!chosen.length) return;
    await db.diary.bulkAdd(photoItemsToEntries(chosen, date, meal));
    await syncHabitsFromDiary(db, date);
    onAdded(chosen.length);
  };

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs!.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <Sheet onClose={onClose}>
      <h2 className="h2 mb-2">Log food from a photo</h2>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

      {preview ? (
        <button className="relative block w-full overflow-hidden rounded-2xl" onClick={() => fileRef.current?.click()} aria-label="Retake photo">
          <img src={preview} alt="Your meal" className="max-h-56 w-full object-cover" />
          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">Retake</span>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-primary" onClick={() => { fileRef.current?.setAttribute('capture', 'environment'); fileRef.current?.click(); }}>📷 Take photo</button>
          <button className="btn-secondary" onClick={() => { fileRef.current?.removeAttribute('capture'); fileRef.current?.click(); }}>Choose photo</button>
        </div>
      )}

      {image && !rows && (
        <>
          <label className="mt-3 block">
            <span className="label">Anything Claude can't see? (optional)</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 200 g chicken, cooked in 1 tbsp olive oil" />
          </label>
          <button className="btn-primary mt-3 w-full" disabled={busy} onClick={analyse}>
            {busy ? 'Analysing… (about 10–20 s)' : 'Analyse photo'}
          </button>
        </>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {rows && (
        <div className="mt-3">
          <p className="mb-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            These are AI estimates from a photo. Check the portions and edit anything that looks off before adding.
          </p>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={i} className={`rounded-2xl p-3 ring-1 ring-slate-200 dark:ring-slate-700 ${r.include ? '' : 'opacity-50'}`}>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={r.include} onChange={(e) => setRow(i, { include: e.target.checked })} aria-label={`Include ${r.name}`} />
                  <input className="input min-h-[40px] flex-1 text-base font-semibold" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} aria-label="Food name" />
                </div>
                <div className="muted mt-1 text-xs">
                  {r.portion} · {r.confidence} confidence
                </div>
                <div className="mt-2 grid grid-cols-5 gap-1">
                  {(
                    [
                      ['kcal', 'kcal'],
                      ['protein_g', 'P'],
                      ['carbs_g', 'C'],
                      ['fat_g', 'F'],
                      ['fibre_g', 'Fib'],
                    ] as [keyof PhotoItem, string][]
                  ).map(([k, l]) => (
                    <label key={k} className="text-center">
                      <NumInput className="[&_input]:min-h-[40px] [&_input]:px-1 [&_input]:text-sm" decimal={k !== 'kcal'} value={Math.round((r[k] as number) * 10) / 10} onChange={(v) => setRow(i, { [k]: v ?? 0 } as Partial<Row>)} ariaLabel={`${r.name} ${l}`} />
                      <span className="muted text-[10px]">{l}</span>
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {notes && <p className="muted mt-2 text-xs">Claude's note: {notes}</p>}
          <div className="mt-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <NutrientLine n={sum} big />
          </div>
          <div className="mt-3 flex gap-2">
            <select className="input w-36 text-base" value={meal} onChange={(e) => setMeal(e.target.value as MealId)} aria-label="Meal">
              {PLAN.diary.meals.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <button className="btn-primary flex-1" disabled={!chosen.length} onClick={add}>
              Add {chosen.length} item{chosen.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}
      <p className="muted mt-3 text-center text-[11px]">The photo is sent to Anthropic for analysis and isn't saved in the app.</p>
    </Sheet>
  );
}
