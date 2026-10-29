// Starting strength. You test seven lifts, each with a weight you can lift a number of times (1 to 10).
// A one rep max (1RM) is worked out from it with the formula
//     1RM = weight / (1.0278 - 0.0278 × reps), rounded to the nearest 2.5 kg
// The seven 1RMs set your starting weight for each of those lifts, and, through how strong each exercise
// usually is compared with them, a starting weight for every other exercise. No DOM here.
import { EXERCISES, exerciseById, isCardio } from './data/exercises.js';
import { clamp, round, roundTo } from './util.js';

export const MAX_TEST_REPS = 10; // the formula is only reliable up to about 10 reps

// The 1RM from a set of reps. Null if the numbers can't be right.
export function oneRepMax(weight, reps) {
  if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(reps) || reps < 1 || reps > MAX_TEST_REPS) return null;
  return roundTo(weight / (1.0278 - 0.0278 * reps), 2.5);
}

// The weight you could lift for a number of reps, from a 1RM (the same formula the other way round)
export const weightForReps = (oneRM, reps) => oneRM * (1.0278 - 0.0278 * reps);

// ---------- The seven lifts ----------
// Each exercise belongs to a role (a movement) and has a share f: its 1RM as a fraction of the role's strength,
// measured as the barbell or machine version at a gym. Dumbbell shares are for one dumbbell.
const MODEL = {
  // chest and triceps follow the bench press
  bench: ['bench', 1], 'db-bench': ['bench', 0.37], 'incline-db': ['bench', 0.33], 'machine-press': ['bench', 0.85], 'cable-fly': ['bench', 0.2], 'db-fly': ['bench', 0.16],
  'incline-bench': ['bench', 0.85], 'decline-bench': ['bench', 1.0], 'cable-press-low': ['bench', 0.3], 'cable-press-high': ['bench', 0.3], 'cable-fly-low': ['bench', 0.2], 'pec-deck': ['bench', 0.5], 'cg-bench': ['bench', 0.85],
  pushdown: ['bench', 0.4], 'rope-ext': ['bench', 0.35], 'oh-cable-ext': ['bench', 0.3], 'skull-crusher': ['bench', 0.35], 'db-oh-ext': ['bench', 0.22], 'db-kickback': ['bench', 0.08],
  // shoulders follow the overhead press
  ohp: ['press', 1], 'db-press': ['press', 0.38], 'lateral-raise': ['press', 0.16], 'cable-lateral': ['press', 0.14], 'rear-delt-fly': ['press', 0.14], 'face-pull': ['press', 0.45], 'front-raise': ['press', 0.16], 'external-rotation': ['press', 0.05], 'internal-rotation': ['press', 0.05], 'bottle-lateral': ['press', 0.08],
  // back: pull-downs follow the lat pulldown, rows the seated row; biceps follow the row
  'lat-pulldown': ['pulldown', 1], 'straight-arm': ['pulldown', 0.55], 'db-pullover': ['pulldown', 0.35], 'one-arm-row': ['pulldown', 0.55],
  'cable-row': ['row', 1], 'vbar-row': ['row', 1], 'tbar-row': ['row', 1.0], 'cg-pulldown': ['pulldown', 1], 'bb-shrug': ['row', 0.9], 'bb-curl': ['row', 0.55], 'cs-row': ['row', 0.42], 'bb-row': ['row', 1.1], 'backpack-row': ['row', 0.3], shrug: ['row', 0.5],
  'ez-curl': ['row', 0.55], 'db-curl': ['row', 0.22], 'incline-curl': ['row', 0.18], 'cable-curl': ['row', 0.4], 'hammer-curl': ['row', 0.25], 'preacher-curl': ['row', 0.5], 'backpack-curl': ['row', 0.1],
  'wrist-curl': ['row', 0.25], 'reverse-curl': ['row', 0.3],
  // legs follow the squat; hamstrings the deadlift; calves the calf raise
  squat: ['squat', 1], 'low-bar-squat': ['squat', 1.05], 'front-squat': ['squat', 0.8], 'trap-bar-dl': ['squat', 1.3], 'db-squat': ['squat', 0.25], 'sumo-squat': ['squat', 0.3], 'sl-leg-ext': ['squat', 0.25], 'side-lunge': ['squat', 0.2], 'walking-lunge': ['squat', 0.22], 'forward-lean-lunge': ['squat', 0.22], 'leg-press': ['squat', 2.2], 'hack-squat': ['squat', 1.2], 'goblet-squat': ['squat', 0.3], 'split-squat': ['squat', 0.28], 'leg-ext': ['squat', 0.45], 'step-up': ['squat', 0.22], 'reverse-lunge': ['squat', 0.22],
  'hip-thrust': ['squat', 1.1], 'db-hip-thrust': ['squat', 0.45], 'cable-kickback': ['squat', 0.15], 'hip-abduction': ['squat', 0.45], 'kb-swing': ['squat', 0.25], 'cable-crunch': ['squat', 0.45],
  deadlift: ['deadlift', 1], 'stiff-leg-dl': ['deadlift', 0.65], 'sumo-dl': ['deadlift', 1], rdl: ['deadlift', 0.75], 'db-rdl': ['deadlift', 0.33], 'leg-curl': ['deadlift', 0.35], 'sl-rdl': ['deadlift', 0.15],
  'standing-calf': ['calf', 1], 'seated-calf': ['calf', 0.45], 'step-calf': ['calf', 0.3],
};

// The seven test lifts, by where you train. Bodyweight-only plans have no weights to test.
export const TEST_LIFTS = {
  gym: [
    { id: 'bench', role: 'bench', name: 'Bench press' },
    { id: 'deadlift', role: 'deadlift', name: 'Deadlift' },
    { id: 'squat', role: 'squat', name: 'Squat' },
    { id: 'lat-pulldown', role: 'pulldown', name: 'Lat pulldown' },
    { id: 'cable-row', role: 'row', name: 'Seated row' },
    { id: 'ohp', role: 'press', name: 'Shoulder press' },
    { id: 'standing-calf', role: 'calf', name: 'Calf raise' },
  ],
  // the dumbbell version of each, for training at home (weights are for one dumbbell)
  home: [
    { id: 'db-bench', role: 'bench', name: 'Dumbbell bench press', each: true },
    { id: 'db-rdl', role: 'deadlift', name: 'Dumbbell Romanian deadlift', each: true },
    { id: 'goblet-squat', role: 'squat', name: 'Goblet squat' },
    { id: 'one-arm-row', role: 'pulldown', name: 'One-arm dumbbell row', each: true },
    { id: 'cs-row', role: 'row', name: 'Chest-supported dumbbell row', each: true },
    { id: 'db-press', role: 'press', name: 'Dumbbell shoulder press', each: true },
    { id: 'step-calf', role: 'calf', name: 'Dumbbell calf raise', each: true },
  ],
};
export const testLifts = (equipment) => TEST_LIFTS[equipment] || [];

// Safety notes shown with the test
export const TEST_TIPS = {
  deadlift: 'Keep your back flat and stop if your form slips.',
  squat: 'Use a rack with safety bars, or a machine, and a spotter if you can.',
  bench: 'Use a spotter or safety bars, and never test alone with a loaded bar.',
  ohp: 'Brace your stomach and glutes and stop if your lower back arches.',
};

// ---------- Estimates for lifts you haven't tested ----------
// Typical 1RM as a multiple of body weight for someone new to lifting (a man), by role
const STANDARD = { bench: 0.6, deadlift: 1.0, squat: 0.8, pulldown: 0.6, row: 0.6, press: 0.4, calf: 0.8 };
const EXPERIENCE = { beginner: 1, intermediate: 1.35, advanced: 1.8 };
// Women are typically about 60% as strong in the upper body and 75% in the lower body, for the same body weight
const UPPER = new Set(['bench', 'pulldown', 'row', 'press']);
const ROLE_OF_MUSCLE = { chest: 'bench', triceps: 'bench', shoulders: 'press', back: 'row', biceps: 'row', forearms: 'row', quads: 'squat', glutes: 'squat', abs: 'squat', hamstrings: 'deadlift', calves: 'calf' };

// The strength of each role in barbell terms, from your tested lifts and, for any you skipped, from your
// body weight and experience scaled by how strong your tested lifts show you are.
// tested: { 'bench': { weight, reps } | null, ... } by exercise id. Returns { roles, oneRM (of the tested lifts), est (roles estimated) }.
export function strengthFrom(tested, profile, kg) {
  const lifts = testLifts(profile.equipment);
  const std = (role) => kg * STANDARD[role] * (EXPERIENCE[profile.experience] || 1) * (profile.sex === 'female' ? (UPPER.has(role) ? 0.6 : 0.75) : 1);
  const roles = {};
  const oneRM = {};
  const ratios = [];
  for (const l of lifts) {
    const t = tested?.[l.id];
    const rm = t ? oneRepMax(t.weight, t.reps) : null;
    if (!rm) continue;
    oneRM[l.id] = rm;
    roles[l.role] = rm / MODEL[l.id][1];
    ratios.push(roles[l.role] / std(l.role));
  }
  // how strong you are against the typical lifter, shrunk toward 1 because a few lifts say little about the rest
  const sorted = [...ratios].sort((a, b) => a - b);
  const mid = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 1;
  const scale = clamp(1 + 0.7 * (mid - 1), 0.5, 2.5);
  const est = [];
  for (const role of Object.keys(STANDARD)) {
    if (roles[role]) continue;
    // an estimate is kept a little low, so the first week is never too heavy
    roles[role] = std(role) * scale * 0.9;
    est.push(role);
  }
  return { roles, oneRM, est, scale: round(scale, 2) };
}

// 1RM of any exercise from the role strengths. Exercises not in the table follow their muscle's role.
export function exerciseOneRM(ex, roles) {
  if (!ex || ex.load !== 'kg' || isCardio(ex)) return null;
  const m = MODEL[ex.id];
  if (m) return roles[m[0]] * m[1];
  const role = ROLE_OF_MUSCLE[ex.m];
  return role ? roles[role] * 0.4 : null;
}

// The weight to start with: one you could lift about 2 more times than the top of the rep range,
// rounded down to the exercise's usual step
export function startWeight(ex, roles) {
  const rm = exerciseOneRM(ex, roles);
  if (!rm) return null;
  const reps = Math.min(15, ex.rr[1] + 2);
  const step = ex.step || 2.5;
  const kg = Math.floor(weightForReps(rm, reps) / step + 1e-9) * step;
  return Math.max(step, round(kg, 2));
}

// Everything saved after the test: the seven lifts as tested, their 1RMs and the role strengths.
// tested: { id: { weight, reps } | null }. kg: body weight in kg.
export function makeBaseline(tested, profile, kg, d) {
  const { roles, oneRM, est, scale } = strengthFrom(tested, profile, kg);
  const lifts = {};
  for (const l of testLifts(profile.equipment)) {
    const t = tested?.[l.id];
    lifts[l.id] = {
      role: l.role,
      tested: !!oneRM[l.id],
      ...(oneRM[l.id] ? { weight: t.weight, reps: t.reps } : {}),
      oneRM: oneRM[l.id] ?? roundTo(roles[l.role] * MODEL[l.id][1], 2.5),
    };
  }
  return { d, equipment: profile.equipment, lifts, roles: Object.fromEntries(Object.entries(roles).map(([k, v]) => [k, round(v, 1)])), est, scale };
}

// The starting weight for an exercise from a saved baseline, or null (no baseline, or a lift without a weight)
export function startFor(baseline, exId) {
  if (!baseline?.roles) return null;
  const ex = exerciseById(exId);
  return startWeight(ex, baseline.roles);
}

// A table of the seven lifts for the summary screen
export function summary(baseline) {
  return testLifts(baseline.equipment).map((l) => {
    const ex = exerciseById(l.id);
    return { ...l, ...baseline.lifts[l.id], start: startFor(baseline, l.id), rr: ex.rr };
  });
}

export const hasEstimates = (baseline) => Object.values(baseline?.lifts || {}).some((l) => !l.tested);
export const allExerciseIds = () => EXERCISES.filter((e) => e.load === 'kg').map((e) => e.id);
