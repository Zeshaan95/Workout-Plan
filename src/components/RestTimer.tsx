import { useEffect, useRef, useState } from 'react';

export interface TimerState {
  endAt: number;
  total: number;
  label: string;
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    /* audio unavailable */
  }
  navigator.vibrate?.([200, 100, 200]);
}

/** Rest timer bar. Uses an end timestamp so it stays right if the phone locks. */
export default function RestTimer({ timer, onChange }: { timer: TimerState | null; onChange: (t: TimerState | null) => void }) {
  const [now, setNow] = useState(Date.now());
  const beeped = useRef<number | null>(null);

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer]);

  const left = timer ? Math.ceil((timer.endAt - now) / 1000) : 0;
  useEffect(() => {
    if (timer && left <= 0 && beeped.current !== timer.endAt) {
      beeped.current = timer.endAt;
      beep();
    }
  }, [left, timer]);

  if (!timer) return null;
  const done = left <= 0;
  const abs = Math.abs(left);
  const mmss = `${done && left < 0 ? '+' : ''}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
  const pct = Math.min(100, Math.max(0, ((timer.total - left) / timer.total) * 100));

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+max(env(safe-area-inset-bottom),0.5rem))] z-40 px-3 pb-2">
      <div className={`mx-auto max-w-xl overflow-hidden rounded-2xl shadow-lg ring-1 ${done ? 'bg-emerald-600 text-white ring-emerald-700' : 'bg-slate-900 text-white ring-slate-800 dark:bg-slate-800'}`}>
        <div className="h-1 bg-white/20">
          <div className="h-1 bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-2 p-2">
          <div className="min-w-0 flex-1 pl-2">
            <div className="truncate text-xs opacity-75">{done ? 'Rest done: next set' : `Rest · ${timer.label}`}</div>
            <div className="text-3xl font-bold tabular-nums leading-none">{mmss}</div>
          </div>
          <button className="h-12 w-12 rounded-xl bg-white/15 text-sm font-semibold active:bg-white/25" onClick={() => onChange({ ...timer, endAt: timer.endAt - 15000 })}>
            −15
          </button>
          <button className="h-12 w-12 rounded-xl bg-white/15 text-sm font-semibold active:bg-white/25" onClick={() => onChange({ ...timer, endAt: Math.max(timer.endAt, Date.now()) + 15000, total: timer.total + 15 })}>
            +15
          </button>
          <button className="h-12 w-12 rounded-xl bg-white/15 text-lg active:bg-white/25" aria-label="Stop timer" onClick={() => onChange(null)}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
