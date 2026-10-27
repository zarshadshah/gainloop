// Ties the maths together: setting up, refreshing the plan, and check-ins. Works on a state object, no DOM.
import * as C from './calc.js';
import { MEALS } from './data/foods.js';
import { exerciseById, muscleName, setCustomExercises } from './data/exercises.js';
import { healthRules, normHealth } from './health.js';
import { filterMeals, planWeek, rescaleDay } from './meals.js';
import { SITE_REASON, buildProgram } from './plan.js';
import { addDays, clamp, fmtInt, mondayOf, rng, round } from './util.js';
import { countsInLoad } from './load.js';
import { demoState } from './store.js';
import { dayTargets } from './track.js';
import { BANDS, MAX_SCORE, addWellness, lastSunday, weekSettings, weekSummary } from './wellness.js';

export const mealsById = (state) => new Map([...MEALS, ...(state.customMeals || [])].map((m) => [m.id, m]));

export const targetsOf = (state) => ({ kcal: state.nutrition.kcal, protein: state.nutrition.protein });

// One day's targets, with any back-on-track change for that day
export const targetsFor = (state, d) => {
  const t = dayTargets(state, d);
  return { kcal: t.kcal, protein: t.protein };
};
export const weekDate = (state, i) => addDays(state.mealWeek.start, i);

// Health conditions turned into planning rules
export const rulesOf = (state) => healthRules(state.profile?.health);

// Your food rules plus any that come from health (coeliac adds gluten)
export function dietOf(state) {
  const d = state.profile.diet;
  return rulesOf(state).gluten && !(d.avoid || []).includes('gluten') ? { ...d, avoid: [...(d.avoid || []), 'gluten'] } : d;
}

export const allowedMeals = (state) => filterMeals(dietOf(state), state.customMeals, rulesOf(state));

export function refreshProgram(state) {
  setCustomExercises(state.customExercises);
  state.program = buildProgram(state.profile, C.priorityMuscles(state), state.swaps, { mine: state.myExercises || [], avoid: rulesOf(state).avoid });
  return state.program;
}

export function refreshMeals(state, today, reshuffle = false) {
  const { allowed } = allowedMeals(state);
  const seed = reshuffle || !state.mealWeek ? Math.floor(Math.random() * 1e9) : state.mealWeek.seed;
  const start = mondayOf(today);
  state.mealWeek = planWeek(allowed, targetsOf(state), seed, start, { carbAware: !!rulesOf(state).carbCap, targetsFor: (i) => targetsFor(state, addDays(start, i)) });
  return state.mealWeek;
}

export function ensureCurrentWeek(state, today) {
  if (!state.profile || !state.nutrition) return false;
  if (!state.mealWeek || state.mealWeek.start !== mondayOf(today)) {
    refreshMeals(state, today, true);
    return true;
  }
  return false;
}

// Keep the same meals but resize portions to new targets
export function rescaleMeals(state) {
  if (!state.mealWeek) return;
  const byId = mealsById(state);
  state.mealWeek.days = state.mealWeek.days.map((d, i) => rescaleDay(d, targetsFor(state, weekDate(state, i)), byId));
}

function bodyBasis(state, today) {
  const kg = C.currentWeight(state.weights, today);
  const bf = C.bodyFatNow(state);
  const lbm = kg && bf ? kg * (1 - bf.pct / 100) : null;
  return { kg, bf, lbm };
}

export function freshNutrition(state, today) {
  const { kg, bf, lbm } = bodyBasis(state, today);
  return C.startingNutrition(state.profile, kg, C.ageNow(state.profile, today), bf?.pct ?? null, lbm, rulesOf(state));
}

// Same calories, macros redone (after health details change)
function remacro(state, today) {
  const { kg, bf, lbm } = bodyBasis(state, today);
  const p = state.profile;
  return { ...state.nutrition, ...C.macrosFor(state.nutrition.kcal, kg, p.goal, p.sex, bf?.pct ?? null, lbm, null, rulesOf(state)) };
}

const kcalText = (n) => `${fmtInt(n)} kcal`;

function nutritionWhy(n, profile) {
  const goalPart = profile.goal === 'build'
    ? `Building muscle adds ${n.adj} for a slow gain.`
    : profile.goal === 'lean'
      ? `Leaning out takes off ${Math.abs(n.adj)} for a slow loss.`
      : 'Recomp keeps you at maintenance.';
  return `Your starting maintenance estimate is about ${kcalText(n.maintenance)}, from your size, age, activity and ${profile.days} training days. ${goalPart} The first check-ins will correct this from your real weight trend.`;
}

export function priorityItems(before, after) {
  const items = [];
  const bySite = (list) => {
    const m = new Map();
    for (const p of list) if (p.source === 'tape') m.set(p.site, (m.get(p.site) || []).concat(p.muscle));
    return m;
  };
  const b = bySite(before);
  const a = bySite(after);
  for (const [site, muscles] of a) {
    if (!b.has(site)) {
      items.push({ area: 'training', text: `${C.siteName(site).replace(' (flexed)', '')} is now a priority: ${muscles.map((m) => muscleName(m).toLowerCase()).join(' and ')} get extra sets`, why: SITE_REASON[site] });
    }
  }
  for (const [site] of b) {
    if (!a.has(site)) items.push({ area: 'training', text: `${C.siteName(site).replace(' (flexed)', '')} is no longer a priority`, why: 'It has caught up with your other measurements, so it goes back to normal volume.' });
  }
  return items;
}

// After new measurements, frame or aim changes: rebuild the programme and log any priority change
export function afterBodyChange(state, today) {
  const before = state.program?.priorities || [];
  refreshProgram(state);
  const items = priorityItems(before, state.program.priorities);
  if (items.length) state.changes.push({ d: today, kind: 'measure', items });
  return items;
}

export function startState(state, today) {
  state.startedOn = today;
  state.nutrition = freshNutrition(state, today);
  refreshProgram(state);
  refreshMeals(state, today, true);
  const n = state.nutrition;
  const items = [
    { area: 'calories', text: `Calories set to ${kcalText(n.kcal)} a day with ${n.protein} g protein`, why: nutritionWhy(n, state.profile) },
    { area: 'training', text: `Training: ${state.program.split.toLowerCase()}, ${state.profile.days} days a week`, why: `${state.profile.days} sessions of about ${state.profile.minutes} minutes fit roughly ${state.program.capacity} hard sets a week, shared across every muscle.` },
  ];
  if (C.hasFrameTargets(state)) items.push({ area: 'targets', text: 'Targets worked out from your wrist, ankle and height', why: 'These are upper estimates for a natural lifter at about 8 to 10% body fat. Your aim starts at 90% of them.' });
  items.push(...priorityItems([], state.program.priorities));
  const mineIn = (state.program.mine || []).filter((x) => x.where.length);
  if (mineIn.length) {
    items.push({ area: 'training', text: `${mineIn.length === 1 ? 'One exercise' : `${mineIn.length} exercises`} you already do ${mineIn.length === 1 ? 'is' : 'are'} in your plan`, why: `${mineIn.map((x) => `${exerciseById(x.id).name} in ${x.where.join(' and ')}`).join('; ')}.` });
  }
  const r = rulesOf(state);
  if (r.items.length) items.push({ area: 'health', text: `Adjusted for ${r.items.map((i) => i.name.toLowerCase()).join(', ')}`, why: r.items.map((i) => `${i.name}: ${i.changes.join(', ').toLowerCase()}.`).join(' ') });
  state.changes.push({ d: today, kind: 'setup', items });
}

// When profile details change: rebuild training, and reset calories if the inputs to the estimate changed
export function afterProfileChange(state, before, today) {
  const p = state.profile;
  const items = [];
  const calorieInputs = ['goal', 'activity', 'days', 'sex', 'heightCm', 'experience'];
  const healthChanged = JSON.stringify(normHealth(before.health)) !== JSON.stringify(normHealth(p.health));
  if (calorieInputs.some((k) => before[k] !== p[k])) {
    state.nutrition = freshNutrition(state, today);
    items.push({ area: 'calories', text: `Calories reset to ${kcalText(state.nutrition.kcal)} with ${state.nutrition.protein} g protein`, why: nutritionWhy(state.nutrition, p) });
  } else if (healthChanged) {
    const old = state.nutrition;
    state.nutrition = remacro(state, today);
    if (old.protein !== state.nutrition.protein || old.carbs !== state.nutrition.carbs) {
      items.push({ area: 'calories', text: `Calories stay at ${kcalText(state.nutrition.kcal)}: ${state.nutrition.protein} g protein, ${state.nutrition.carbs} g carbs, ${state.nutrition.fat} g fat`, why: 'Your health details changed how calories are split between protein, carbs and fat.' });
    }
  }
  if (healthChanged) {
    const r = rulesOf(state);
    items.push({ area: 'health', text: r.items.length ? `Plan adjusted for ${r.items.map((i) => i.name.toLowerCase()).join(', ')}` : 'Health details cleared', why: r.items.length ? r.items.map((i) => `${i.name}: ${i.changes.join(', ').toLowerCase()}.`).join(' ') : 'Your plan is back to the standard settings.' });
  }
  const trainingInputs = ['days', 'minutes', 'equipment', 'pullupBar', 'experience'];
  const oldPri = state.program?.priorities || [];
  refreshProgram(state);
  if (trainingInputs.some((k) => before[k] !== p[k])) {
    items.push({ area: 'training', text: `Training rebuilt: ${state.program.split.toLowerCase()}, ${p.days} days a week`, why: 'Your days, session length, equipment or experience changed.' });
  }
  items.push(...priorityItems(oldPri, state.program.priorities));
  const dietChanged = JSON.stringify(before.diet) !== JSON.stringify(p.diet);
  if (dietChanged || healthChanged || items.some((i) => i.area === 'calories')) refreshMeals(state, today, true);
  if (dietChanged) items.push({ area: 'food', text: 'Meal plan rebuilt for your new food rules', why: 'Meals that break a rule are never used.' });
  if (items.length) state.changes.push({ d: today, kind: 'edit', items });
  return items;
}

const rateText = (kgPerWeek, fmt) => `${kgPerWeek >= 0 ? '+' : '−'}${fmt(Math.abs(kgPerWeek), 2)} a week`;

// Work out what a check-in would change, without changing anything yet
export function analyseCheckin(state, today, fmtKg = (n, dp = 1) => `${round(n, dp)} kg`) {
  const p = state.profile;
  const kg = C.currentWeight(state.weights, today);
  const rate = C.weightRate(state.weights, today);
  const n = state.nutrition;
  const decision = C.calorieDecision({ profile: p, kg, rate, kcal: n.kcal, floor: n.floor ?? C.calorieFloor(p, n.bmr || 0), waist: C.waistSignal(state.measures), early: !rate && C.rateTooEarly(state.weights, today) });
  const newKcal = n.kcal + decision.delta;
  const { bf, lbm } = bodyBasis(state, today);
  const macros = C.macrosFor(newKcal, kg, p.goal, p.sex, bf?.pct ?? null, lbm, n.protein, rulesOf(state));
  const items = [];

  const targetLine = decision.target === 0 ? 'Target: steady weight.' : `Target: ${rateText(decision.target, fmtKg)}.`;
  const tolLine = decision.status === 'hold' ? ` A gap under ${fmtKg(decision.tol, 2)} a week is too small to separate from water swings.` : '';
  const trendLine = rate ? `Your 7-day average went from ${fmtKg(rate.from)} to ${fmtKg(rate.to)} over ${Math.round(rate.days / 7)} weeks (${rateText(rate.kgPerWeek, fmtKg)}). ${targetLine}${tolLine}` : '';
  if (decision.delta !== 0) {
    items.push({ area: 'calories', text: `${decision.delta > 0 ? '+' : '−'}${Math.abs(decision.delta)} kcal a day, now ${kcalText(newKcal)}`, why: `${decision.reason} ${trendLine}`.trim() });
  } else {
    items.push({ area: 'calories', text: `Calories stay at ${kcalText(n.kcal)}`, why: `${decision.reason} ${trendLine}`.trim() });
  }
  if (decision.maintenanceFromTrend && rate && rate.days >= 14) {
    items.push({ area: 'note', text: `Your maintenance looks like about ${kcalText(decision.maintenanceFromTrend)}`, why: 'Worked out from your target calories and how your weight actually moved. It assumes you ate close to your target.' });
  }
  if (macros.protein !== n.protein) {
    items.push({ area: 'calories', text: `Protein ${macros.protein > n.protein ? 'up' : 'down'} to ${macros.protein} g`, why: 'Protein follows your body weight.' });
  }
  const before = state.program?.priorities || [];
  const after = C.priorityMuscles(state);
  items.push(...priorityItems(before, after));
  return { decision, newKcal, macros, items, rate, kg };
}

export function applyCheckin(state, today, analysis) {
  state.nutrition = {
    ...state.nutrition,
    kcal: analysis.newKcal,
    ...analysis.macros,
    basis: analysis.rate ? 'trend' : state.nutrition.basis,
    adjustedOn: today,
  };
  refreshProgram(state);
  rescaleMeals(state);
  state.checkins.push({ d: today });
  state.changes.push({ d: today, kind: 'checkin', items: analysis.items });
}

// Example data: eight weeks of a made-up lifter, run day by day through the same check-in rules
// the app uses, so every change in the history is one the app really would have made.
export function seedDemo(today, seed = DEMO.seed) {
  const s = demoState(today);
  const start = s.startedOn;
  const measures = [...s.measures].sort((a, b) => (a.d < b.d ? -1 : 1));
  const rand = rng(seed);
  const water = () => (rand() - 0.5) * 1.2; // day-to-day swing from water and food in the gut
  let kg = DEMO.startKg; // weight underneath the daily swings
  s.weights = [{ d: start, kg: round(kg + water(), 1) }];
  s.measures = measures.filter((m) => m.d <= start);
  startState(s, start);
  // The starting estimate is a little low for Sam, as it often is, so the first weeks gain too slowly
  const maintenance = s.nutrition.maintenance + DEMO.underestimate;
  for (let i = 1; i <= DEMO.days; i += 1) {
    const d = addDays(start, i);
    kg += (s.nutrition.kcal + (rand() - 0.5) * 300 - maintenance) / 7700;
    if (i === DEMO.days || rand() > 0.3) s.weights.push({ d, kg: round(kg + water(), 1) });
    const checkin = i % 14 === 0 && i < DEMO.days;
    for (const m of measures.filter((x) => x.d === d)) {
      s.measures.push(m);
      if (!checkin) afterBodyChange(s, d); // measured from the Body tab
    }
    if (checkin) applyCheckin(s, d, analyseCheckin(s, d)); // measured during the check-in
  }
  // Three weeks of lifting that match the plan (the same exercises and sets), so the weekly loads have a start
  const known = s.exLog;
  s.exLog = {};
  for (const sess of s.program.sessions) {
    for (const sl of sess.slots) {
      const ex = exerciseById(sl.ex);
      if (!countsInLoad(ex) || ex.load === 's' || s.exLog[ex.id]) continue;
      const lift = known[ex.id];
      const step = ex.step || 2.5;
      const lifted = ex.load === 'kg' ? (lift?.[lift.length - 1]?.kg || Math.max(step, Math.round((ex.k === 'c' ? 30 : 15) / step) * step)) : null;
      const [lo, hi] = ex.rr;
      s.exLog[ex.id] = [17, 10, 3].map((back, k) => ({
        d: addDays(today, -back),
        kg: lifted === null ? null : Math.max(step, lifted - (2 - k) * step),
        reps: Array.from({ length: sl.sets }, (_, j) => clamp(Math.round(lo + (hi - lo) * (0.35 + 0.2 * k) - (j > 0 ? j * 0.5 : 0)), lo, hi)),
      }));
    }
  }
  // exercises you know that are not in the plan stay available for swaps
  for (const [id, log] of Object.entries(known)) if (!s.exLog[id]) s.exLog[id] = log;

  // Six Sunday wellness checks: steady weeks, then a tired and sore one, so this week's sessions are lighter
  const answers = [[3, 4, 3, 3, 4], [4, 4, 3, 3, 4], [3, 3, 3, 3, 4], [4, 4, 3, 4, 4], [3, 4, 3, 3, 4], [2, 3, 2, 3, 4]];
  answers.forEach(([fatigue, sleep, soreness, stress, mood], i) => {
    const d = addDays(lastSunday(today), -7 * (answers.length - 1 - i));
    const e = addWellness(s, d, { fatigue, sleep, soreness, stress, mood });
    if (i === answers.length - 1) s.changes.push({ d, kind: 'wellness', items: wellnessChangeItems(s, e) });
  });
  refreshMeals(s, today, true);
  return s;
}

// What a weekly wellness check changed, for the list of plan changes
export function wellnessChangeItems(state, entry) {
  const w = weekSettings(entry, state.profile, rulesOf(state));
  return [{ area: 'training', text: `${BANDS[entry.band].name}: ${entry.total} of ${MAX_SCORE} in your wellness check`, why: `${entry.why.join(' ')} ${weekSummary(w, state.profile).join(' ')}` }];
}

export const DEMO = { seed: 5, startKg: 70, underestimate: 200, days: 56 };
