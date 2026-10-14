// Food log and getting back on track. No DOM here.
//
// Your meal plan counts as eaten unless you log otherwise: a meal you skipped, something else you ate instead,
// or something extra. Each log entry keeps what was planned and what you ate, so a day's difference from plan
// stays the same even if the plan is changed later.
//
// When the difference adds up to more than normal day-to-day noise, Gainloop offers to spread it over the
// next few days: protein stays the same, the change comes from carbs and fat, it never goes more than 15% from
// your usual calories or below your floor, and cardio can cover up to half of a big day.
import { cardioKcal, exerciseById, isCardio } from './data/exercises.js';
import { addDays, clamp, round, roundTo, uid } from './util.js';

export const MACRO_KEYS = ['kcal', 'p', 'c', 'f'];
export const zero = () => ({ kcal: 0, p: 0, c: 0, f: 0 });
const add = (t, m, sign = 1) => {
  for (const k of MACRO_KEYS) t[k] += sign * (Number(m?.[k]) || 0);
  return t;
};
export const roundMacros = (m) => ({ kcal: Math.round(m.kcal), p: Math.round(m.p), c: Math.round(m.c), f: Math.round(m.f) });

// How a day's food usually splits between meals, for when that day's plan isn't known any more
export const SLOT_SHARE = { breakfast: 0.25, lunch: 0.3, dinner: 0.3, snack: 0.15 };

export const GAP_MIN = 200; // kcal: smaller differences are within normal day-to-day swings
export const LOOKBACK = 7; // days of the log that count toward getting back on track
export const WINDOWS = [3, 7, 14];
const STEP_MAX = 0.15; // never more than 15% from your usual calories in a day
const STEP_EASY = 0.1; // the suggested option stays within 10%
const KEEP_LOG_DAYS = 60;

// ---------- The log ----------

export const logFor = (state, d) => state.foodLog?.[d] || null;

export function addLogItem(state, d, item) {
  state.foodLog ||= {};
  const day = (state.foodLog[d] ||= { items: [] });
  const it = { id: uid('f'), ...item };
  day.items.push(it);
  return it;
}

export function removeLogItem(state, d, id) {
  const day = state.foodLog?.[d];
  if (!day) return;
  day.items = day.items.filter((x) => x.id !== id);
  if (!day.items.length) delete state.foodLog[d];
}

// What you ate minus what was planned, for a list of log items
export function diffOf(items) {
  const t = zero();
  for (const it of items || []) {
    add(t, it.ate);
    add(t, it.planned, -1);
  }
  return t;
}

export const dayDiff = (state, d) => diffOf(logFor(state, d)?.items);

// Planned meals logged as skipped or swapped, by their place in the day's plan
export const loggedMeal = (state, d, index) => (logFor(state, d)?.items || []).find((x) => x.mealIdx === index && (x.kind === 'skip' || x.kind === 'instead')) || null;

export function pruneLog(state, today) {
  const cut = addDays(today, -KEEP_LOG_DAYS);
  for (const d of Object.keys(state.foodLog || {})) if (d < cut) delete state.foodLog[d];
  state.adjust = (state.adjust || []).filter((a) => addDays(a.start, a.days) >= cut);
}

// ---------- Getting back on track ----------

// Log items from the last week that no back-on-track plan has dealt with yet
export function pendingGap(state, today) {
  const days = [];
  for (let i = LOOKBACK - 1; i >= 0; i -= 1) {
    const d = addDays(today, -i);
    const items = (logFor(state, d)?.items || []).filter((x) => !x.handled);
    if (!items.length) continue;
    const diff = diffOf(items);
    if (Math.abs(diff.kcal) < 1 && Math.abs(diff.p) < 1) continue;
    days.push({ d, diff, items });
  }
  if (!days.length) return null;
  const diff = days.reduce((t, x) => add(t, x.diff), zero());
  return { days, diff, dir: diff.kcal >= 0 ? 'over' : 'under', small: Math.abs(diff.kcal) < GAP_MIN };
}

function limits(state) {
  const n = state.nutrition;
  const floor = n.floor || 0;
  return {
    cut: Math.max(0, Math.min(Math.round(n.kcal * STEP_MAX), n.kcal - floor)),
    add: Math.round(n.kcal * STEP_MAX),
  };
}

// The usual cardio for a back-on-track plan: easy on the joints, and something your equipment allows
export function defaultCardio(state, rules) {
  const sore = rules?.avoid || new Set();
  const eq = state.profile.equipment;
  const order = eq === 'gym' ? ['incline-walk', 'bike', 'cross-trainer', 'rower', 'brisk-walk'] : ['brisk-walk', 'run', 'skipping'];
  for (const id of [...(state.myExercises || []).filter((x) => isCardio(exerciseById(x))), ...order]) {
    const ex = exerciseById(id);
    if (ex && isCardio(ex) && (ex.custom || ex.eq.includes(eq)) && !sore.has(id)) return ex;
  }
  return exerciseById('brisk-walk');
}

// Up to 3 sessions a week, covering at most half of what you ate over plan
export function cardioOffer(state, gap, days, kg, rules, exId = null) {
  if (!gap || gap.dir !== 'over' || !kg) return null;
  const ex = (exId && isCardio(exerciseById(exId)) && exerciseById(exId)) || defaultCardio(state, rules);
  const effort = rules?.cardioMax === 'moderate' ? 'easy' : 'moderate';
  const min = ex.load === 'min' && ex.rr ? clamp(30, ex.rr[0], ex.rr[1]) : 30;
  const each = cardioKcal(ex, min, kg, effort);
  if (!each) return null;
  const most = Math.max(1, Math.round((days * 3) / 7));
  const sessions = clamp(Math.floor((gap.diff.kcal * 0.5) / each), 1, most);
  return { ex: ex.id, min, effort, each, sessions, total: each * sessions };
}

// The choices: spread over 3 days, a week or two weeks
export function catchUpOptions(state, gap, cardio = null) {
  if (!gap || gap.small) return { options: [], recommended: 0 };
  const base = state.nutrition.kcal;
  const lim = limits(state);
  const total = -gap.diff.kcal + (cardio ? cardio.total : 0); // food change needed over the window
  const options = WINDOWS.map((days) => {
    let perDay = roundTo(total / days, 10);
    const limit = perDay < 0 ? lim.cut : lim.add;
    const capped = Math.abs(perDay) > limit;
    if (capped) perDay = Math.sign(perDay) * roundTo(limit, 10);
    return { days, perDay, pct: Math.abs(perDay) / base, capped, covers: capped ? Math.abs(perDay * days) : Math.abs(total) };
  });
  // the shortest window that stays gentle; eating back an under-eat is fine over 3 days
  const gentle = options.find((o) => !o.capped && o.pct <= STEP_EASY);
  const fits = options.find((o) => !o.capped);
  const recommended = (gentle || fits || options[options.length - 1]).days;
  return { options, recommended, total };
}

// Split a daily calorie change between carbs and fat. Protein never changes.
export function macroShift(state, perDay, rules) {
  const n = state.nutrition;
  const share = rules?.carbCap ? 0.45 : 0.6;
  let carbs = roundTo((perDay * share) / 4, 5);
  // keep at least half your usual carbs and three quarters of your usual fat
  carbs = Math.max(carbs, -Math.floor(n.carbs * 0.5));
  let fat = round((perDay - carbs * 4) / 9, 0);
  if (n.fat + fat < n.fat * 0.75) {
    fat = -Math.floor(n.fat * 0.25);
    carbs = Math.max(-Math.floor(n.carbs * 0.5), roundTo((perDay - fat * 9) / 4, 5));
  }
  return { carbs, fat };
}

export function applyCatchUp(state, today, { days, cardio = null, rules = null }) {
  const gap = pendingGap(state, today);
  if (!gap || gap.small) return null;
  const { options } = catchUpOptions(state, gap, cardio);
  const opt = options.find((o) => o.days === days) || options[1];
  const start = addDays(today, 1);
  const shift = macroShift(state, opt.perDay, rules);
  const adj = {
    id: uid('a'),
    made: today,
    start,
    days: opt.days,
    kcal: opt.perDay,
    carbs: shift.carbs,
    fat: shift.fat,
    dir: gap.dir,
    gap: roundMacros(gap.diff),
    from: gap.days.map((x) => x.d),
    covers: opt.covers,
    cardio: [],
  };
  if (cardio && gap.dir === 'over') {
    for (let k = 0; k < cardio.sessions; k += 1) {
      const offset = Math.floor((k * opt.days) / cardio.sessions) + (cardio.sessions < opt.days ? 1 : 0);
      adj.cardio.push({ id: uid('k'), d: addDays(start, Math.min(opt.days - 1, offset)), ex: cardio.ex, min: cardio.min, effort: cardio.effort, kcal: cardio.each, done: false });
    }
  }
  state.adjust = [...(state.adjust || []), adj];
  for (const x of gap.days) for (const it of x.items) it.handled = adj.id;
  return adj;
}

// "Leave it": mark the gap as dealt with, without changing the plan
export function leaveGap(state, today) {
  const gap = pendingGap(state, today);
  if (!gap) return;
  for (const x of gap.days) for (const it of x.items) it.handled = 'leave';
}

// Stopping a plan leaves what's still to even out as it is (your check-ins pick it up)
export function stopAdjustment(state, id) {
  state.adjust = (state.adjust || []).filter((a) => a.id !== id);
  for (const day of Object.values(state.foodLog || {})) for (const it of day.items || []) if (it.handled === id) it.handled = 'leave';
}

const inWindow = (a, d) => d >= a.start && d < addDays(a.start, a.days);
export const activeAdjustments = (state, d) => (state.adjust || []).filter((a) => inWindow(a, d));

// Targets for one day: your usual ones plus any back-on-track change, within the same safety limits
export function dayTargets(state, d) {
  const n = state.nutrition;
  const active = activeAdjustments(state, d);
  let kcal = 0;
  let carbs = 0;
  let fat = 0;
  for (const a of active) {
    kcal += a.kcal;
    carbs += a.carbs;
    fat += a.fat;
  }
  const lim = limits(state);
  const k = clamp(kcal, -lim.cut, lim.add);
  if (kcal && k !== kcal) {
    const f = k / kcal;
    carbs *= f;
    fat *= f;
  }
  return {
    kcal: n.kcal + Math.round(k),
    protein: n.protein,
    carbs: Math.max(0, roundTo(n.carbs + carbs, 5)),
    fat: Math.max(0, Math.round(n.fat + fat)),
    delta: Math.round(k),
    active,
  };
}

// Extra cardio from back-on-track plans that isn't done yet, soonest first
export function cardioToDo(state, today) {
  const out = [];
  for (const a of state.adjust || []) {
    const end = addDays(a.start, a.days);
    for (const s of a.cardio || []) if (!s.done && today < end) out.push({ ...s, adj: a.id, late: s.d < today });
  }
  return out.sort((x, y) => (x.d < y.d ? -1 : 1));
}

export function markCardio(state, adjId, sessionId, done = true, today = null) {
  const a = (state.adjust || []).find((x) => x.id === adjId);
  const s = a?.cardio.find((x) => x.id === sessionId);
  if (!s) return null;
  s.done = done;
  s.doneOn = done ? today : null;
  return s;
}

// Day of a plan: 'day 2 of 7'
export function adjustmentProgress(a, today) {
  const day = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${a.start}T00:00:00Z`)) / 86400000) + 1;
  return { day: clamp(day, 0, a.days + 1), of: a.days, started: day >= 1, over: day > a.days };
}
