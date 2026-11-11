# Fat-Loss Hub — notes for future sessions

A personal, mobile-first, offline PWA for a 12-week fat-loss plan. You use it on an iPhone (sometimes a laptop). It has no backend, no accounts and no analytics. All data lives in IndexedDB.

## The plan (summary — `src/plan.ts` is the source of truth)

- **Dates:** week 1 begins Mon 9 Nov 2026 at 97.0 kg. The plan has 12 Monday–Sunday weeks and ends Sun 31 Jan 2027.
- **Goal:** 84.3 kg (2 st down).
- **Milestones:** 90.65 kg (1 st, around 18 Dec) and 87.5 kg (1.5 st, around 9 Jan).
- **History:** readings from 18 Oct 2026 (95.75 kg) are kept as history only.
- **Target path:** 7-day-average targets on each Sunday, linearly interpolated per day. Week 1 is 95.5, then about 1 kg a week to 84.3.
- **Week types:** football week is the default. The "Football this Thursday?" switch is per week and stored in the `weeks` table. A no-football week changes two things:
  - Thursday becomes a 50–60 min incline walk.
  - On Tuesday, Bulgarian split squats go to 1 rep short of failure instead of 2.
- **Football week schedule:**
  - Mon: jog
  - Tue: Strength C (garage, three supersets)
  - Wed: rest and cook-up
  - Thu: football
  - Fri: rest
  - Sat: Strength A (lower body)
  - Sun: Strength B (upper body), then the weekly review
- **Special days:**
  - Pull-up max tests on Sun 22 Nov and Sun 27 Dec, done first in Strength B.
  - Festive fortnight, 19 Dec – 1 Jan: weekday jog, Strength C and walk move to 10:00–11:30. Football's time is fixed.
- **Jog progression:** 20–25 min in weeks 1–2, then +5 min each fortnight, capped at 35–40 min.
- **Daily targets:**
  - 1,900 kcal (floor 1,750)
  - 160–180 g protein, about 60 g fat, about 170 g carbs, 30 g or more fibre
  - 12,000 steps, 2.5–3 L water, 7–8 h sleep
  - Creatine daily
- **Rules** (all in `src/lib`, each unit-tested):
  1. 7-day average: the earliest reading per day, at least 3 readings in the window (`weight.ts`).
  2. Weekly status: within ±0.5 kg of target is on track; above is behind; below is ahead (`weight.ts`).
  3. Adjustment advice from Sun 22 Nov. Rate = (avg 14 days ago, or 97.0) − (avg today), ÷ 2 (`rules.ts`).
  4. Week 4 check on Sun 6 Dec: more than 2 kg above target pushes the goal date back at the plan's pace (`rules.ts`).
  5. Gym lifts: all sets at the top of the range means +2.5 kg (`workouts.ts`).
  6. Bodyweight moves: +1 rep per set each new plan week. Backpack once split squats or pull-ups pass 12 reps; feet raised once push-ups pass 20. Max-minus-one = latest tested max − 1 (`workouts.ts`).
  7. Strength warning when a compound top set or pull-up total reps drops two sessions in a row (`workouts.ts`).
  8. Milestone projection: least squares over the last 14 days of daily readings, needing at least 4 readings (`weight.ts`).
- **Interpretations** (where the brief was open):
  - "Lifts going down" (rule 3): the latest session is lower than the previous one on any compound lift or on pull-ups.
  - Dips and push-ups: "tested max" is a manually recorded max on the exercise card.
  - Habit met: kcal within 1,750–1,900; protein 160 g or more; the other targets at or above their minimum.

## Code conventions

- **Stack:** React 18, TypeScript (strict), Vite 5, Tailwind 3, Recharts, Dexie 4 (`dexie-react-hooks`), `vite-plugin-pwa`, Vitest.
- **Config:** every plan number and rule threshold goes in `src/plan.ts`. Never hard-code plan values in screens or logic.
- **Logic:** pure, framework-free functions live in `src/lib/*.ts`, with `*.test.ts` alongside. Screens only compose them.
- **Dates:** ISO `YYYY-MM-DD` strings with UTC arithmetic (`src/lib/dates.ts`). Display in UK format ("31 Oct 2026") via `formatUK*`.
- **Units:** kg is primary, with st/lb alongside (`formatStLb`).
- **Data:** `src/db.ts` holds the tables (weighIns, bodyComps, weeks, workouts, checkIns, habits, foodAudit, settings). When adding a table, bump the Dexie version and add it to `TABLES` so backup covers it.
- **Routing:** hash-based (`src/router.ts`), so static hosting needs no rewrites. `?date=YYYY-MM-DD` on `#/today` previews any day.
- **Language and UI:** British English. Mobile-first at 390 × 844, with 48 px+ tap targets. Use `inputMode="decimal"` / `"numeric"` via `NumInput`.
- **Commands:** `npm test` (Vitest), `npm run build` (tsc + Vite + service worker), `npm run dev`.
- **Deploy:** `netlify.toml` and `vercel.json` publish `dist/`, with `sw.js`/`index.html` set to no-cache. See README for the deploy and iPhone install steps.
- **Icons:** to regenerate the PWA PNGs from `public/icon.svg`, run `node scripts/icons.cjs` (uses the pre-installed Playwright).
- **Logger pattern:** writes are serialised through a promise queue so a new log's `add` completes before later `put`s. A stale log from a previous date or session is never rendered.
