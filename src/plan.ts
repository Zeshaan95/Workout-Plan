/**
 * THE PLAN — single source of truth.
 *
 * Every number, rule threshold, session and both week types live here. Change
 * the plan by editing this file only; the logic in src/lib reads from it.
 */
import type { ISODate } from './lib/dates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionId =
  | 'jog'
  | 'strengthC'
  | 'restCook'
  | 'football'
  | 'restSteps'
  | 'strengthA'
  | 'strengthB'
  | 'walk';

export type ExerciseKind = 'weighted' | 'bodyweight' | 'test';

export interface ExerciseDef {
  id: string;
  name: string;
  kind: ExerciseKind;
  /** Labelled "(compound)" in the plan. Drives rest, effort and the strength warning. */
  compound?: boolean;
  sets: number;
  /** Rep range. For max-minus-one moves these are unused (aim comes from the tested max). */
  repMin?: number;
  repMax?: number;
  perSide?: boolean;
  maxMinusOne?: boolean;
  /** Default rest in seconds for the rest timer. */
  restSec: number;
  /** Range shown to the user, e.g. "2–3 min". */
  restLabel: string;
  /** Short coaching cue shown on the exercise card. */
  cue?: string;
  /** Rule 6: suggest a loaded backpack once reps pass this. */
  backpackAfter?: number;
  /** Rule 6: suggest feet-raised once reps pass this. */
  feetRaisedAfter?: number;
  /** Only on pull-up test days (Strength B). */
  testDayOnly?: boolean;
}

export interface StrengthSession {
  id: 'strengthA' | 'strengthB' | 'strengthC';
  name: string;
  short: string;
  location: string;
  warmUp: string[];
  rules: string[];
  format: 'straight' | 'supersets';
  /** Straight sessions: exercise ids in order. Superset sessions: pairs. */
  exercises?: string[];
  supersets?: [string, string][];
  supersetRestSec?: number;
  progression?: string[];
}

export interface DayPlanDef {
  session: SessionId;
  title: string;
  length: string;
  when: string;
  notes?: string[];
}

export type WeekType = 'football' | 'noFootball';

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

const units = {
  kgPerStone: 6.35029,
  lbPerKg: 2.20462,
};

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

const COMPOUND_REST = { restSec: 150, restLabel: '2–3 min' };
const ACCESSORY_REST = { restSec: 75, restLabel: '60–90 s' };

export const EXERCISES: Record<string, ExerciseDef> = {
  // Strength A — lower body (gym)
  backSquat: { id: 'backSquat', name: 'Back squat', kind: 'weighted', compound: true, sets: 3, repMin: 5, repMax: 8, ...COMPOUND_REST, cue: 'Stop 1–2 reps short of failure' },
  rdl: { id: 'rdl', name: 'Romanian deadlift', kind: 'weighted', compound: true, sets: 3, repMin: 6, repMax: 8, ...COMPOUND_REST, cue: 'Stop 1–2 reps short of failure' },
  dbSplitSquat: { id: 'dbSplitSquat', name: 'Dumbbell split squats', kind: 'weighted', sets: 3, repMin: 10, repMax: 10, perSide: true, ...ACCESSORY_REST, cue: 'Each leg · 1 rep short of failure' },
  legCurl: { id: 'legCurl', name: 'Leg curl (lying or seated)', kind: 'weighted', sets: 3, repMin: 10, repMax: 15, ...ACCESSORY_REST, cue: '1 rep short of failure' },
  hangingLegRaiseA: { id: 'hangingLegRaise', name: 'Hanging leg raises', kind: 'bodyweight', sets: 3, repMin: 10, repMax: 12, ...ACCESSORY_REST, cue: 'Bodyweight · 1 rep short of failure' },

  // Strength B — upper body (gym)
  pullupTest: { id: 'pullupTest', name: 'Pull-up max test', kind: 'test', sets: 1, testDayOnly: true, restSec: 180, restLabel: 'Rest well before working sets', cue: 'Test day: do this first, strict reps only' },
  pullup: { id: 'pullup', name: 'Pull-ups', kind: 'bodyweight', sets: 4, maxMinusOne: true, ...ACCESSORY_REST, backpackAfter: 12, cue: 'Max minus one (latest tested max − 1) per set' },
  dbBench: { id: 'dbBench', name: 'Dumbbell bench press', kind: 'weighted', compound: true, sets: 3, repMin: 8, repMax: 10, ...COMPOUND_REST, cue: 'Stop 1–2 reps short of failure' },
  ohp: { id: 'ohp', name: 'Overhead press (barbell or dumbbell)', kind: 'weighted', compound: true, sets: 3, repMin: 6, repMax: 10, ...COMPOUND_REST, cue: 'Stop 1–2 reps short of failure' },
  cableRow: { id: 'cableRow', name: 'Seated cable row', kind: 'weighted', sets: 3, repMin: 10, repMax: 12, ...ACCESSORY_REST, cue: '1 rep short of failure' },
  dip: { id: 'dip', name: 'Dips', kind: 'bodyweight', sets: 3, maxMinusOne: true, ...ACCESSORY_REST, cue: 'Max minus one per set' },

  // Strength C — calisthenics (garage)
  pullupC: { id: 'pullup', name: 'Pull-ups', kind: 'bodyweight', sets: 4, maxMinusOne: true, restSec: 75, restLabel: '60–90 s', backpackAfter: 12, cue: 'Max minus one per set' },
  pushup: { id: 'pushup', name: 'Push-ups', kind: 'bodyweight', sets: 4, maxMinusOne: true, restSec: 75, restLabel: '60–90 s', feetRaisedAfter: 20, cue: 'Max minus one · feet on a step once past 20 reps' },
  bulgarianSplitSquat: { id: 'bulgarianSplitSquat', name: 'Bulgarian split squats', kind: 'bodyweight', sets: 3, repMin: 10, repMax: 12, perSide: true, restSec: 75, restLabel: '60–90 s', backpackAfter: 12, cue: 'Rear foot on chair/step · each leg' },
  pikePushup: { id: 'pikePushup', name: 'Pike push-ups', kind: 'bodyweight', sets: 3, repMin: 8, repMax: 12, restSec: 75, restLabel: '60–90 s' },
  hangingLegRaiseC: { id: 'hangingLegRaise', name: 'Hanging leg raises', kind: 'bodyweight', sets: 3, repMin: 10, repMax: 12, restSec: 75, restLabel: '60–90 s' },
  slGluteBridge: { id: 'slGluteBridge', name: 'Single-leg glute bridges', kind: 'bodyweight', sets: 3, repMin: 12, repMax: 12, perSide: true, restSec: 75, restLabel: '60–90 s', cue: 'Each leg' },
};

/** Bulgarian split squat effort depends on the week type. */
export const BSS_REPS_SHORT: Record<WeekType, number> = { football: 2, noFootball: 1 };

// ---------------------------------------------------------------------------
// Strength sessions
// ---------------------------------------------------------------------------

const GYM_RULES = [
  'Warm-up (8 min): 5 min bike or rower, then 2 lighter warm-up sets of the first lift',
  'Compound lifts: stop 1–2 reps short of failure · accessories: 1 rep short',
  'Rest 2–3 min on compound lifts, 60–90 s on accessories',
];

export const STRENGTH_SESSIONS: Record<'strengthA' | 'strengthB' | 'strengthC', StrengthSession> = {
  strengthA: {
    id: 'strengthA',
    name: 'Strength A: lower body',
    short: 'Strength A',
    location: 'Gym',
    warmUp: ['5 min bike or rower', '2 lighter warm-up sets of back squat'],
    rules: GYM_RULES,
    format: 'straight',
    exercises: ['backSquat', 'rdl', 'dbSplitSquat', 'legCurl', 'hangingLegRaiseA'],
  },
  strengthB: {
    id: 'strengthB',
    name: 'Strength B: upper body',
    short: 'Strength B',
    location: 'Gym',
    warmUp: ['5 min bike or rower', '2 lighter warm-up sets of the first lift'],
    rules: GYM_RULES,
    format: 'straight',
    exercises: ['pullupTest', 'pullup', 'dbBench', 'ohp', 'cableRow', 'dip'],
  },
  strengthC: {
    id: 'strengthC',
    name: 'Strength C: calisthenics full body',
    short: 'Strength C',
    location: 'Garage',
    warmUp: [
      '3 min skipping or jogging on the spot',
      '2 × 8 scapular pull-ups',
      '2 × 20 s dead hangs',
      '20 bodyweight squats',
    ],
    rules: [
      'Three supersets: one set of the first exercise, rest 60–90 s, one set of the second, rest, repeat',
    ],
    format: 'supersets',
    supersets: [
      ['pullupC', 'pushup'],
      ['bulgarianSplitSquat', 'pikePushup'],
      ['hangingLegRaiseC', 'slGluteBridge'],
    ],
    supersetRestSec: 75,
    progression: [
      'Add a rep per set each week while form stays strict',
      'Past 12 reps on split squats or pull-ups, add a loaded backpack (start at 2.5–5 kg)',
    ],
  },
};

// ---------------------------------------------------------------------------
// Weekly schedule — two week types
// ---------------------------------------------------------------------------

const FOOTBALL_WEEK: DayPlanDef[] = [
  { session: 'jog', title: 'Easy jog (treadmill or lit route)', length: '20–40 min', when: 'After school or evening' },
  { session: 'strengthC', title: 'Strength C: calisthenics full body (garage)', length: '45 min', when: 'As soon as you get home' },
  { session: 'restCook', title: 'Rest: steps and cook-up', length: '—', when: '—' },
  { session: 'football', title: 'Football', length: '60 min', when: 'Evening' },
  { session: 'restSteps', title: 'Rest: steps only', length: '—', when: '—' },
  { session: 'strengthA', title: 'Strength A: lower body (gym)', length: '55–60 min', when: 'Morning, 08:00–10:00' },
  { session: 'strengthB', title: 'Strength B: upper body (gym), then weekly review and cook-up', length: '55–60 min', when: 'Morning, 08:00–10:00' },
];

const NO_FOOTBALL_WEEK: DayPlanDef[] = FOOTBALL_WEEK.map((d, i) => {
  if (i === 1) {
    return { ...d, notes: ['No-football week: take Bulgarian split squats to 1 rep short of failure (not 2)'] };
  }
  if (i === 3) {
    return {
      session: 'walk',
      title: 'Incline treadmill walk (or long brisk outdoor walk)',
      length: '50–60 min',
      when: 'Evening',
      notes: [
        "Once Monday's jog is a comfortable 30 min, this can be a second easy jog instead",
        'Never more than 2 runs a week',
      ],
    };
  }
  return d;
});

export const WEEK_TYPES: Record<WeekType, DayPlanDef[]> = {
  football: FOOTBALL_WEEK,
  noFootball: NO_FOOTBALL_WEEK,
};

/** Sessions that count as "hard" / trackable for the habit "session done". */
export const REST_SESSIONS: SessionId[] = ['restCook', 'restSteps'];

export const SESSION_LABELS: Record<SessionId, string> = {
  jog: 'Easy jog',
  strengthC: 'Strength C (garage)',
  restCook: 'Rest: steps and cook-up',
  football: 'Football',
  restSteps: 'Rest: steps only',
  strengthA: 'Strength A (gym)',
  strengthB: 'Strength B (gym)',
  walk: 'Incline walk',
};

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export interface TargetPoint {
  week: number;
  date: ISODate;
  kg: number;
  note?: string;
}

export const PLAN = {
  units,

  startDate: '2026-11-09' as ISODate,
  endDate: '2027-01-31' as ISODate,
  totalWeeks: 12,
  startKg: 97.0,
  goalKg: 84.3,
  historyStart: '2026-10-18' as ISODate,

  milestones: [
    { id: '1st', label: '1 stone down', kg: 90.65, expected: '2026-12-18' as ISODate },
    { id: '1.5st', label: '1.5 stone down', kg: 87.5, expected: '2027-01-09' as ISODate },
    { id: '2st', label: '2 stone down', kg: 84.3, expected: '2027-01-31' as ISODate },
  ],

  /** 7-day-average target path. Week 0 is the start point (Mon 9 Nov). Interpolate linearly. */
  targetPath: [
    { week: 0, date: '2026-11-09', kg: 97.0, note: 'Week 1 start' },
    { week: 1, date: '2026-11-15', kg: 95.5, note: 'About 1.5 kg off in week 1, partly water' },
    { week: 2, date: '2026-11-22', kg: 94.5 },
    { week: 3, date: '2026-11-29', kg: 93.5 },
    { week: 4, date: '2026-12-06', kg: 92.4, note: 'Behind-schedule check (rule 4)' },
    { week: 5, date: '2026-12-13', kg: 91.4 },
    { week: 6, date: '2026-12-20', kg: 90.4, note: '1 stone down around 18 Dec' },
    { week: 7, date: '2026-12-27', kg: 89.4, note: 'Festive fortnight' },
    { week: 8, date: '2027-01-03', kg: 88.4, note: 'About 88.7 kg on 1 Jan' },
    { week: 9, date: '2027-01-10', kg: 87.4, note: '1.5 stone down around 9 Jan' },
    { week: 10, date: '2027-01-17', kg: 86.3 },
    { week: 11, date: '2027-01-24', kg: 85.3 },
    { week: 12, date: '2027-01-31', kg: 84.3, note: '2 stone down' },
  ] as TargetPoint[],

  festive: {
    start: '2026-12-19' as ISODate,
    end: '2027-01-01' as ISODate,
    weekdayTime: '10:00–11:30',
    /** Weekday sessions whose time moves during the festive fortnight. */
    movableSessions: ['jog', 'strengthC', 'walk'] as SessionId[],
    note: 'Festive fortnight: weekday sessions move to 10:00–11:30. If football stops for the holidays, switch this week to no football.',
  },

  pullupTestDays: ['2026-11-22', '2026-12-27'] as ISODate[],
  previousPullupBest: 7,

  jog: {
    startMin: 20,
    startMax: 25,
    stepMin: 5,
    everyWeeks: 2,
    capMin: 35,
    capMax: 40,
    maxRunsPerWeek: 2,
    startNote: 'Conversational pace, or alternate 4 min jogging with 1 min walking',
  },

  waist: {
    baselineDate: '2026-11-09' as ISODate,
    firstSunday: '2026-11-22' as ISODate,
    everyDays: 14,
  },

  dailyTargets: {
    kcal: 1900,
    kcalFloor: 1750,
    proteinMin: 160,
    proteinMax: 180,
    fat: 60,
    carbs: 170,
    fibre: 30,
    steps: 12000,
    waterMin: 2.5,
    waterMax: 3,
    sleepMin: 7,
    sleepMax: 8,
    creatine: true,
  },
  dailyTargetNotes: {
    kcal: 'Never below 1,750; same on no-football weeks',
    protein: 'About 40 g × 4 meals',
    carbs: 'Mostly around training',
    steps: 'From 9 Nov 2026',
    creatine: 'Daily, with no stopping or starting mid-plan',
  },

  rules: {
    /** Rule 1 */
    avgWindowDays: 7,
    avgMinReadings: 3,
    /** Rule 2 */
    statusToleranceKg: 0.5,
    /** Rule 3 */
    adjustmentFrom: '2026-11-22' as ISODate,
    onPaceMin: 0.9,
    onPaceMax: 1.4,
    slowMin: 0.5,
    tooFastOver: 1.5,
    extraSteps: 2000,
    kcalCut: 150,
    kcalAddCarbs: 150,
    /** Rule 4 */
    week4CheckDate: '2026-12-06' as ISODate,
    week4ThresholdKg: 2,
    /** Rule 5 */
    gymIncrementKg: 2.5,
    /** Rule 8 */
    projectionWindowDays: 14,
    projectionMinReadings: 4,
  },

  foodAudit: {
    days: 3,
    oilGhee: { label: 'Oil or ghee (1 tbsp)', kcal: 120, protein: 0 },
  },

  defaultHeightCm: 174,

  seed: {
    bodyComp: {
      date: '2026-10-18' as ISODate,
      weightKg: 95.75,
      bmi: 31.6,
      bodyFatPct: 31.8,
      subcutaneousFatPct: 27.6,
      visceralFat: 14,
      muscleMassKg: 62.05,
      skeletalMusclePct: 43.9,
      boneMassKg: 3.25,
      fatFreeMassKg: 65.3,
      bmrKcal: 1773,
      bodyWaterPct: 49.2,
      proteinPct: 15.6,
      metabolicAge: 36,
    },
    weighIns: [
      { date: '2026-10-18', kg: 95.75 },
      { date: '2026-10-27', kg: 96.95 },
      { date: '2026-10-28', kg: 96.95 },
      { date: '2026-10-29', kg: 96.5 },
      { date: '2026-10-31', kg: 96.35 },
      { date: '2026-11-09', kg: 97.0, note: 'Week 1 start' },
    ] as { date: ISODate; kg: number; note?: string }[],
  },
};

export type DailyTargets = typeof PLAN.dailyTargets;

/** Gym compound lifts tracked by the strength warning (rule 7) and strength charts. */
export const GYM_LIFTS = ['backSquat', 'rdl', 'dbSplitSquat', 'legCurl', 'dbBench', 'ohp', 'cableRow'];
export const COMPOUND_LIFTS = Object.values(EXERCISES)
  .filter((e) => e.compound)
  .map((e) => e.id);
export const BODYWEIGHT_MOVES = ['pullup', 'pushup', 'dip', 'bulgarianSplitSquat', 'pikePushup', 'hangingLegRaise', 'slGluteBridge'];

/** Exercise display info by logged id (A/C variants share an id, e.g. hanging leg raises). */
export function exerciseName(id: string): string {
  const def = Object.values(EXERCISES).find((e) => e.id === id);
  return def?.name ?? id;
}
