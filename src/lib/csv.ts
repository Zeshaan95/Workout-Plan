import { EXERCISES, SESSION_LABELS, exerciseName } from '../plan';
import { formatStLb } from './units';
import type { WeighIn } from './weight';
import type { WorkoutLog } from './workouts';

function esc(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: unknown[][]): string {
  return rows.map((r) => r.map(esc).join(',')).join('\n') + '\n';
}

export function weighInsCSV(w: WeighIn[]): string {
  const rows = [...w].sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  return toCSV([
    ['date', 'time', 'weight_kg', 'stone_lb', 'note'],
    ...rows.map((r) => [r.date, r.time, r.kg.toFixed(2), formatStLb(r.kg), r.note ?? '']),
  ]);
}

export function liftsCSV(logs: WorkoutLog[]): string {
  const out: unknown[][] = [['date', 'session', 'status', 'exercise', 'set', 'weight_kg', 'reps', 'backpack_kg', 'feet_raised', 'tested_max', 'duration_min', 'distance_km']];
  for (const l of [...logs].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (!l.entries.length) {
      out.push([l.date, SESSION_LABELS[l.session], l.status, '', '', '', '', '', '', '', l.durationMin ?? '', l.distanceKm ?? '']);
      continue;
    }
    for (const e of l.entries) {
      e.sets.forEach((s, i) => {
        if (s.reps == null && s.weightKg == null) return;
        out.push([
          l.date,
          SESSION_LABELS[l.session],
          l.status,
          exerciseName(e.exerciseId) || EXERCISES[e.exerciseId]?.name,
          i + 1,
          s.weightKg ?? '',
          s.reps ?? '',
          s.backpackKg ?? '',
          e.feetRaised ? 'yes' : '',
          e.testMax ?? '',
          l.durationMin ?? '',
          l.distanceKm ?? '',
        ]);
      });
    }
  }
  return toCSV(out);
}
