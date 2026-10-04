// Body maths: body fat, lean mass, frame targets, priorities, calories and check-in adjustments.
// Every function is pure so it can be tested and explained.
import { addDays, clamp, daysBetween, median, round, roundTo, sum } from './util.js';

// ---------- Measurement sites ----------

export const SITES = [
  { id: 'neck', name: 'Neck', how: 'Just below the Adam’s apple, tape level all the way round.' },
  { id: 'chest', name: 'Chest', how: 'Relaxed, arms by your sides, tape under the armpits and level across the nipples.' },
  { id: 'arm', name: 'Arm (flexed)', how: 'Flex hard and measure around the peak of the biceps. Same arm every time.' },
  { id: 'forearm', name: 'Forearm', how: 'Arm straight out in front, fist clenched, at the widest point.' },
  { id: 'waist', name: 'Waist', how: { male: 'At your belly button, relaxed, just after breathing out.', female: 'At the narrowest point, relaxed, just after breathing out.' } },
  { id: 'hips', name: 'Hips', how: 'Feet together, around the widest part of your bum.' },
  { id: 'thigh', name: 'Thigh', how: 'Standing relaxed, halfway between hip and knee.' },
  { id: 'calf', name: 'Calf', how: 'Standing relaxed, at the widest point.' },
];

export const FRAME_SITES = [
  { id: 'wrist', name: 'Wrist', how: 'Between your hand and the bony bump of the wrist, where it’s narrowest. You only need to do this once.' },
  { id: 'ankle', name: 'Ankle', how: 'The narrowest point just above the ankle bones. You only need to do this once.' },
];

export const siteName = (id) => (SITES.find((s) => s.id === id) || FRAME_SITES.find((s) => s.id === id) || { name: id }).name;

export const siteHow = (id, sex) => {
  const s = SITES.find((x) => x.id === id) || FRAME_SITES.find((x) => x.id === id);
  if (!s) return '';
  return typeof s.how === 'string' ? s.how : s.how[sex === 'female' ? 'female' : 'male'];
};

// Which sites are asked for. Hips are needed for the female body-fat formula.
export const sitesFor = (sex) => SITES.filter((s) => s.id !== 'hips' || sex === 'female');

// A reading that moves more than this since last time is flagged for a re-measure (cm)
export const JUMP_LIMIT = { neck: 1.5, chest: 3, arm: 1.5, forearm: 1.5, waist: 3, hips: 3, thigh: 3, calf: 1.5, wrist: 0.8, ankle: 0.8 };

// Tape sites that map to muscles in the training plan
export const SITE_MUSCLES = {
  chest: ['chest', 'back'],
  arm: ['triceps', 'biceps'],
  forearm: ['forearms'],
  thigh: ['quads', 'hamstrings'],
  calf: ['calves'],
};
export const TARGET_SITES = ['chest', 'arm', 'forearm', 'neck', 'thigh', 'calf'];
export const PRIORITY_SITES = Object.keys(SITE_MUSCLES);

// ---------- Small data helpers ----------

export const byDate = (a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0);

export function latestSite(measures, site, beforeOrOn = null, excludeId = null) {
  const list = [...measures].sort(byDate).reverse();
  for (const m of list) {
    if (excludeId && m.id === excludeId) continue;
    if (beforeOrOn && m.d > beforeOrOn) continue;
    const v = m.cm?.[site];
    if (Number.isFinite(v)) return { v, d: m.d, id: m.id };
  }
  return null;
}

// The reading before the most recent one, at least minGapDays earlier
export function earlierSite(measures, site, latestDate, minGapDays) {
  const list = [...measures].sort(byDate).reverse();
  for (const m of list) {
    const v = m.cm?.[site];
    if (!Number.isFinite(v)) continue;
    if (daysBetween(m.d, latestDate) >= minGapDays) return { v, d: m.d };
  }
  return null;
}

export function readingWarning(site, newCm, prev) {
  if (!prev || !Number.isFinite(newCm)) return null;
  const diff = newCm - prev.v;
  const limit = JUMP_LIMIT[site] ?? 3;
  return Math.abs(diff) > limit ? { diff, prevDate: prev.d, prevValue: prev.v } : null;
}

// ---------- Age ----------

export function ageNow(profile, today) {
  if (!profile) return null;
  if (!profile.ageSetOn) return profile.age;
  return profile.age + Math.floor(daysBetween(profile.ageSetOn, today) / 365.25);
}

export const isUnder18 = (profile, today) => (ageNow(profile, today) ?? 99) < 18;

// ---------- Weight ----------

export function trendAt(weights, date, windowDays = 7) {
  const from = addDays(date, -(windowDays - 1));
  const pts = weights.filter((w) => w.d >= from && w.d <= date);
  if (!pts.length) return null;
  return { kg: sum(pts.map((p) => p.kg)) / pts.length, n: pts.length };
}

export function latestWeight(weights) {
  if (!weights.length) return null;
  return [...weights].sort(byDate)[weights.length - 1];
}

// 7-day average if there are recent weigh-ins, otherwise the last one
export function currentWeight(weights, today) {
  const t = trendAt(weights, today);
  if (t) return t.kg;
  const last = latestWeight(weights);
  return last ? last.kg : null;
}

// Rate of change of the 7-day average, over up to 4 weeks. Needs about 2 weeks of weigh-ins.
export function weightRate(weights, today) {
  const sorted = [...weights].filter((w) => w.d <= today).sort(byDate);
  if (sorted.length < 4) return null;
  const end = trendAt(sorted, today);
  if (!end) return null;
  const first = sorted[0].d;
  const span = daysBetween(first, today);
  if (span < 20) return null;
  let start = span >= 34 ? addDays(today, -28) : addDays(first, 6);
  let a = trendAt(sorted, start);
  if (!a) {
    const next = sorted.find((w) => w.d >= start);
    if (!next) return null;
    start = next.d;
    a = trendAt(sorted, start);
  }
  const days = daysBetween(start, today);
  if (days < 7 || !a) return null;
  return { kgPerWeek: (end.kg - a.kg) / (days / 7), days, from: a.kg, to: end.kg, recentCount: end.n };
}

// When there is no rate yet: is it just too early (enough weigh-ins, under ~3 weeks of them)?
export function rateTooEarly(weights, today) {
  const sorted = [...weights].filter((w) => w.d <= today).sort(byDate);
  return sorted.length >= 4 && !!trendAt(sorted, today) && daysBetween(sorted[0].d, today) < 20;
}

// ---------- Body fat, lean mass, FFMI ----------

// US Navy tape method (Hodgdon and Beckett), metric form, all in cm
export function navyBodyFat(sex, heightCm, neck, waist, hips) {
  if (!heightCm || !neck || !waist) return null;
  let bf;
  if (sex === 'female') {
    if (!hips) return null;
    const x = waist + hips - neck;
    if (x <= 0) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(x) + 0.221 * Math.log10(heightCm)) - 450;
  } else {
    const x = waist - neck;
    if (x <= 0) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(x) + 0.15456 * Math.log10(heightCm)) - 450;
  }
  return Number.isFinite(bf) ? clamp(bf, 3, 60) : null;
}

export function bodyFatNow(state) {
  const { profile, measures = [], bfOverride } = state;
  if (!profile) return null;
  let tape = null;
  const neck = latestSite(measures, 'neck');
  const waist = latestSite(measures, 'waist');
  const hips = latestSite(measures, 'hips');
  if (neck && waist && (profile.sex !== 'female' || hips)) {
    const pct = navyBodyFat(profile.sex, profile.heightCm, neck.v, waist.v, hips?.v);
    const d = [neck.d, waist.d, hips?.d].filter(Boolean).sort().pop();
    if (pct !== null) tape = { pct, d, source: 'tape' };
  }
  const manual = bfOverride ? { pct: bfOverride.pct, d: bfOverride.d, source: 'manual' } : null;
  if (manual && (!tape || manual.d >= tape.d)) return manual;
  return tape;
}

export function ffmi(lbmKg, heightCm) {
  const m = heightCm / 100;
  const raw = lbmKg / (m * m);
  return { raw, norm: raw + 6.1 * (1.8 - m) };
}

// ---------- Frame-based ceilings (Casey Butt) ----------
// Max lean body mass, metric form: H^1.5 x (sqrt(W)/322.4 + sqrt(A)/241.9) x (BF/224 + 1), kg from cm.
export function maxLeanMass(heightCm, wristCm, ankleCm, bfPct) {
  return heightCm ** 1.5 * (Math.sqrt(wristCm) / 322.4 + Math.sqrt(ankleCm) / 241.9) * (bfPct / 224 + 1);
}

// Body-part ceilings at about 8 to 10% body fat. The published formulas use inches.
export function frameCeilings(heightCm, wristCm, ankleCm) {
  const H = heightCm / 2.54;
  const W = wristCm / 2.54;
  const A = ankleCm / 2.54;
  const inch = {
    chest: 1.6817 * W + 1.3759 * A + 0.3314 * H,
    arm: 1.2033 * W + 0.1236 * H,
    forearm: 0.9626 * W + 0.0989 * H,
    neck: 1.1424 * W + 0.1236 * H,
    thigh: 1.3868 * A + 0.1805 * H,
    calf: 0.9298 * A + 0.121 * H,
  };
  return Object.fromEntries(Object.entries(inch).map(([k, v]) => [k, v * 2.54]));
}

export const hasFrameTargets = (state) =>
  !!(state.profile && state.profile.sex === 'male' && state.frame?.wrist && state.frame?.ankle);

export function siteProgress(state) {
  if (!hasFrameTargets(state)) return null;
  const c = frameCeilings(state.profile.heightCm, state.frame.wrist, state.frame.ankle);
  const aim = (state.aimPct || 90) / 100;
  return TARGET_SITES.map((site) => {
    const cur = latestSite(state.measures || [], site);
    const target = c[site] * aim;
    return { site, ceiling: c[site], target, current: cur ? cur.v : null, d: cur ? cur.d : null, pct: cur ? cur.v / target : null };
  });
}

// Sites clearly behind the rest: at least 3 points under the median, worst two
export function laggingSites(progress) {
  if (!progress) return [];
  const rows = progress.filter((r) => PRIORITY_SITES.includes(r.site) && r.pct !== null);
  if (rows.length < 3) return [];
  const med = median(rows.map((r) => r.pct));
  return rows.filter((r) => r.pct <= med - 0.03).sort((a, b) => a.pct - b.pct).slice(0, 2);
}

export const MAX_PINS = 2;

// Muscles that get extra sets: from the tape (lagging sites) and from your own picks
export function priorityMuscles(state) {
  const out = [];
  for (const r of laggingSites(siteProgress(state))) {
    for (const m of SITE_MUSCLES[r.site]) {
      if (!out.find((o) => o.muscle === m)) out.push({ muscle: m, source: 'tape', site: r.site, pct: r.pct });
    }
  }
  // at most 2 lagging sites (4 muscles) plus your own picks (MAX_PINS)
  for (const m of (state.pins || []).slice(0, MAX_PINS)) {
    if (!out.find((o) => o.muscle === m)) out.push({ muscle: m, source: 'pin' });
  }
  return out;
}

export function leanSummary(state, today) {
  const kg = currentWeight(state.weights || [], today);
  const bf = bodyFatNow(state);
  if (!kg || !bf || !state.profile) return null;
  const lbm = kg * (1 - bf.pct / 100);
  const out = { kg, bf, lbm, ffmi: ffmi(lbm, state.profile.heightCm) };
  if (hasFrameTargets(state)) {
    out.max = maxLeanMass(state.profile.heightCm, state.frame.wrist, state.frame.ankle, bf.pct);
    out.aim = out.max * ((state.aimPct || 90) / 100);
    out.pctOfMax = lbm / out.max;
    out.pctOfAim = lbm / out.aim;
  }
  return out;
}

// ---------- Calories ----------

export function bmr(sex, kg, cm, age) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'female' ? -161 : 5);
}

export const ACTIVITY = {
  low: { name: 'Mostly sitting', base: 1.2 },
  medium: { name: 'Some walking or standing', base: 1.3 },
  high: { name: 'On my feet most of the day', base: 1.45 },
};

export const activityFactor = (activity, days) => (ACTIVITY[activity]?.base ?? 1.3) + 0.035 * days;

export const GOALS = {
  build: { name: 'Build muscle', desc: 'Gain slowly so most of it is muscle.' },
  recomp: { name: 'Recomp', desc: 'Stay about the same weight, swap fat for muscle.' },
  lean: { name: 'Lean out', desc: 'Lose fat slowly while keeping your muscle.' },
};

export const EXPERIENCE = {
  beginner: { name: 'New to lifting', desc: 'Less than a year of regular training.' },
  intermediate: { name: 'Some experience', desc: '1 to 3 years of regular training.' },
  advanced: { name: 'Experienced', desc: 'More than 3 years of regular training.' },
};

// Lean-bulk pace as % of body weight per month
export const MONTHLY_GAIN_PCT = { beginner: 1.25, intermediate: 0.75, advanced: 0.4 };
export const SURPLUS = { beginner: 300, intermediate: 200, advanced: 150 };

export function targetRate(profile, kg) {
  if (profile.goal === 'build') return (kg * MONTHLY_GAIN_PCT[profile.experience] / 100) * 12 / 52;
  if (profile.goal === 'lean') return -kg * 0.005;
  return 0;
}

export const calorieFloor = (profile, bmrValue) =>
  Math.round(Math.max(bmrValue, profile.sex === 'female' ? 1400 : 1600) / 10) * 10;

// prevProtein: keep the current protein target unless the new one is 4 g or more away,
// so normal day-to-day weight swings don't nudge it up and down at every check-in
export function macrosFor(kcal, kg, goal, sex, bf, lbm, prevProtein = null) {
  let protein = (goal === 'lean' ? 2.0 : 1.8) * kg;
  const highFat = bf !== null && bf !== undefined && (sex === 'female' ? bf > 32 : bf > 25);
  if (highFat && lbm) protein = 2.2 * lbm;
  protein = prevProtein && Math.abs(protein - prevProtein) < 4 ? prevProtein : roundTo(protein, 5);
  let fat = roundTo(Math.max(0.7 * kg, (kcal * 0.25) / 9), 5);
  let carbs = (kcal - protein * 4 - fat * 9) / 4;
  if (carbs < 60) {
    fat = Math.max(roundTo(0.6 * kg, 5), fat - roundTo(((60 - carbs) * 4) / 9, 5));
    carbs = (kcal - protein * 4 - fat * 9) / 4;
  }
  return { protein, fat, carbs: Math.max(0, roundTo(carbs, 5)) };
}

export function startingNutrition(profile, kg, age, bfPct = null, lbm = null) {
  const b = bmr(profile.sex, kg, profile.heightCm, age);
  const maintenance = roundTo(b * activityFactor(profile.activity, profile.days), 10);
  let adj = 0;
  if (profile.goal === 'build') adj = SURPLUS[profile.experience];
  if (profile.goal === 'lean') adj = -Math.min(500, roundTo(maintenance * 0.2, 10));
  const floor = calorieFloor(profile, b);
  const kcal = Math.max(floor, roundTo(maintenance + adj, 10));
  return {
    kcal,
    ...macrosFor(kcal, kg, profile.goal, profile.sex, bfPct, lbm),
    maintenance,
    bmr: Math.round(b),
    adj: kcal - maintenance,
    floor,
    basis: 'estimate',
  };
}

// The calorie part of a check-in. Returns a change and the reason for it.
export function calorieDecision({ profile, kg, rate, kcal, floor, waist, early = false }) {
  const target = targetRate(profile, kg);
  const tol = Math.max(0.1, Math.abs(target) * 0.35);
  const out = { target, tol, rate, delta: 0, status: 'hold', reason: '', maintenanceFromTrend: null };

  if (!rate) {
    out.status = 'insufficient';
    out.reason = early
      ? 'It takes about 3 weeks of weigh-ins to see your real trend through day-to-day water changes, so calories stay put for now. The next check-in can adjust them.'
      : 'Not enough recent weigh-ins to judge your trend. Weigh in 3 or more times a week and it will adjust at the next check-in.';
    return out;
  }
  out.maintenanceFromTrend = roundTo(kcal - (rate.kgPerWeek * 7700) / 7, 10);
  const diff = rate.kgPerWeek - target;

  if (Math.abs(diff) > tol) {
    let delta = roundTo((-diff * 7700 / 7) * 0.5, 25);
    delta = clamp(delta, -250, 250);
    if (delta === 0) delta = diff > 0 ? -25 : 25;
    out.delta = delta;
    out.status = delta > 0 ? 'up' : 'down';
    out.reason = diff > 0
      ? (target < 0 ? 'You’re losing slower than planned.' : target === 0 ? 'Your weight is creeping up.' : 'You’re gaining faster than planned, so some of it is likely fat.')
      : (target > 0 ? 'You’re gaining slower than planned.' : target === 0 ? 'Your weight is drifting down.' : 'You’re losing faster than planned, which risks muscle.');
  } else if (waist && (profile.goal === 'build' || profile.goal === 'recomp') && waist.change >= 1.5 && waist.muscleChange < 0.5) {
    out.delta = -100;
    out.status = 'down';
    out.reason = 'Your weight is on pace, but your waist is up while your arms and chest have barely moved, so the extra food is probably going to fat.';
  } else {
    out.reason = 'Your weight trend is close to the target pace, so calories stay the same.';
  }

  if (out.delta < 0 && kcal + out.delta < floor) {
    out.delta = Math.min(0, floor - kcal);
    out.reason += ' Calories are at the lowest this app will set.';
    if (out.delta === 0) out.status = 'floor';
  }
  return out;
}

// Waist versus muscle change over roughly the last 4 weeks (cm)
export function waistSignal(measures) {
  const w = latestSite(measures, 'waist');
  if (!w) return null;
  const w0 = earlierSite(measures, 'waist', w.d, 21);
  if (!w0) return null;
  const parts = ['arm', 'chest'].map((s) => {
    const a = latestSite(measures, s);
    const b = a ? earlierSite(measures, s, a.d, 21) : null;
    return a && b ? a.v - b.v : 0;
  });
  return { change: w.v - w0.v, muscleChange: parts[0] + parts[1] / 2, from: w0.d, to: w.d };
}

export function checkinStatus(state, today) {
  const last = state.checkins?.length ? state.checkins[state.checkins.length - 1].d : state.startedOn;
  const days = last ? daysBetween(last, today) : 0;
  const lastMeasure = [...(state.measures || [])].sort(byDate).pop();
  const sinceMeasure = lastMeasure ? daysBetween(lastMeasure.d, today) : null;
  return { last, days, due: days >= 14, dueIn: Math.max(0, 14 - days), sinceMeasure, measureDue: sinceMeasure === null || sinceMeasure >= 28 };
}

export const bmi = (kg, cm) => kg / ((cm / 100) ** 2);

// Lean out is not offered to under-18s, or when weight is already low for your height
export function leanAllowed(profile, kg, today) {
  if (isUnder18(profile, today)) return { ok: false, why: 'While you’re still growing the app won’t set a calorie deficit. Build muscle or recomp instead.' };
  if (kg && profile.heightCm && bmi(kg, profile.heightCm) < 20) return { ok: false, why: 'Your weight is already on the low side for your height, so the app won’t set a deficit.' };
  return { ok: true, why: '' };
}

export const fmtPct = (x, dp = 0) => `${round(x * 100, dp)}%`;
