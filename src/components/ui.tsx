import { useEffect, useState, type ReactNode } from 'react';
import type { Status } from '../lib/weight';
import { STATUS_LABEL } from '../lib/weight';

export function Page({ title, subtitle, children, back, right }: { title: string; subtitle?: ReactNode; children: ReactNode; back?: string; right?: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 pb-28 pt-safe">
      <header className="mb-4 flex items-start gap-2 pt-2">
        {back && (
          <a href={back} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-2xl text-emerald-600 active:bg-slate-200 dark:text-emerald-400 dark:active:bg-slate-800" aria-label="Back">
            ‹
          </a>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <div className="muted mt-0.5 text-sm">{subtitle}</div>}
        </div>
        {right}
      </header>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

const STATUS_STYLE: Record<Status, string> = {
  'on-track': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  behind: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  ahead: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
};

export function StatusPill({ status }: { status: Status | null }) {
  if (!status) return <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500 dark:bg-slate-800">Not enough data</span>;
  return <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function Badge({ children, tone = 'emerald' }: { children: ReactNode; tone?: 'emerald' | 'amber' | 'sky' | 'slate' | 'rose' }) {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    sky: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    rose: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; sub?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-[52px] w-full items-center justify-between gap-3 text-left">
      <span>
        <span className="block font-semibold">{label}</span>
        {sub && <span className="muted block text-sm">{sub}</span>}
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${checked ? 'left-7' : 'left-1'}`} />
      </span>
    </button>
  );
}

/** Numeric input that keeps a string draft so decimals type naturally; emits numbers or null. */
export function NumInput({
  value,
  onChange,
  decimal = true,
  placeholder,
  className = '',
  ariaLabel,
  autoFocus,
  suffix,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  decimal?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  suffix?: string;
}) {
  const [draft, setDraft] = useState(value == null ? '' : String(value));
  useEffect(() => {
    const parsed = draft === '' ? null : Number(draft.replace(',', '.'));
    if (parsed !== value) setDraft(value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={`relative ${className}`}>
      <input
        className={`input text-center tabular-nums ${suffix ? 'pr-9' : ''}`}
        inputMode={decimal ? 'decimal' : 'numeric'}
        pattern={decimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
        enterKeyHint="done"
        aria-label={ariaLabel}
        placeholder={placeholder}
        autoFocus={autoFocus}
        value={draft}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const s = e.target.value.replace(',', '.');
          if (s !== '' && !(decimal ? /^\d*\.?\d*$/ : /^\d*$/).test(s)) return;
          setDraft(s);
          if (s === '' || s === '.') onChange(null);
          else onChange(Number(s));
        }}
      />
      {suffix && <span className="muted pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm">{suffix}</span>}
    </div>
  );
}

export function Stat({ label, value, sub, big }: { label: string; value: ReactNode; sub?: ReactNode; big?: boolean }) {
  return (
    <div>
      <div className="muted text-xs font-medium uppercase tracking-wide">{label}</div>
      <div className={`${big ? 'text-4xl' : 'text-2xl'} font-bold tabular-nums leading-tight`}>{value}</div>
      {sub && <div className="muted text-sm">{sub}</div>}
    </div>
  );
}

export function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between gap-3 ${className}`}>{children}</div>;
}

export function LinkRow({ href, title, sub, right }: { href: string; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <a href={href} className="flex min-h-[56px] items-center justify-between gap-3 py-2 active:opacity-70">
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        {sub && <span className="muted block text-sm">{sub}</span>}
      </span>
      <span className="flex items-center gap-2">
        {right}
        <span className="muted text-xl">›</span>
      </span>
    </a>
  );
}
