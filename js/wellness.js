// Weekly wellness check: five questions on fatigue, sleep, soreness, stress and mood, scored 1 to 5
// (5 is best), best answered on Sunday morning. The total, compared with your own normal, decides whether
// the coming week's training load goes up or down (never by more than 5%, see load.js), how close to
// failure you work, and whether a sore muscle swaps an exercise. Every session keeps its 6 exercises. No DOM here.
//
// Based on the athlete wellness questionnaire of McLean and colleagues (2010). Deload changes follow the
// Delphi consensus of Bell and colleagues (2023): less load, further from failure, familiar lifts kept.
import { exerciseById, isCardio } from './data/exercises.js';
import { eligible, estimateMinutes } from './plan.js';
import { MAX_CHANGE, loadDelta } from './load.js';
import { addDays, clamp, daysBetween, round, uid, weekdayIndex } from './util.js';

// Options run from 1 (worst) to 5 (best), in the wording of the original sheet
export const QUESTIONS = [
  { id: 'fatigue', name: 'Fatigue', options: ['Always tired', 'More tired than normal', 'Normal', 'Fresh', 'Very fresh'] },
  { id: 'sleep', name: 'Sleep quality', options: ['Insomnia', 'Restless sleep', 'Difficulty falling asleep', 'Good', 'Very restful'] },
  { id: 'soreness', name: 'General muscle soreness', options: ['Very sore', 'Increase in soreness or tightness', 'Normal', 'Feeling good', 'Feeling great'] },
  { id: 'stress', name: 'Stress levels', options: ['Highly stressed', 'Feeling stressed', 'Normal', 'Relaxed', 'Very relaxed'] },
  { id: 'mood', name: 'Mood', options: ['Highly annoyed, irritable or down', 'Snappy with teammates, family or co-workers', 'Less interested in others or activities than usual', 'A generally good mood', 'Very positive mood'] },
];
export const MAX_SCORE = QUESTIONS.length * 5;

export const BANDS = {
  fresh: { id: 'fresh', name: 'Fresh week', short: 'Fresh' },
  normal: { id: 'normal', name: 'Normal week', short: 'Normal' },
  tired: { id: 'tired', name: 'Tired week', short: 'Tired' },
  lighter: { id: 'lighter', name: 'Lighter week', short: 'Lighter' },
};
const RANK = { lighter: 0, tired: 1, normal: 2, fresh: 3 };

// Everyone answers a little differently, so after 3 check-ins your score is compared with your own normal:
// the average of up to 6 earlier ones from the last 10 weeks. Until then, all 3s (15) is normal.
export const DEFAULT_NORMAL = 15;
const NORMAL_MIN = 13; // a habit of low scores still counts as tired, not as normal
const NORMAL_MAX = 19;
const BASELINE_WEEKS = 6;
const BASELINE_DAYS = 70;
export const ACTIVE_DAYS = 8; // a check-in sets your training for 8 days, so a late one still counts

export const totalOf = (a) => QUESTIONS.reduce((t, q) => t + (Number(a?.[q.id]) || 0), 0);
export const isComplete = (a) => QUESTIONS.every((q) => Number.isInteger(a?.[q.id]) && a[q.id] >= 1 && a[q.id] <= 5);

const byDate = (x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0);
export const history = (state) => [...(state.wellness || [])].sort(byDate);

// The check-in in force on day d: the latest one from the 8 days up to and including it
export function activeEntry(state, d) {
  const list = history(state).filter((e) => e.d <= d && daysBetween(e.d, d) < ACTIVE_DAYS);
  return list[list.length - 1] || null;
}

export const lastSunday = (d) => addDays(d, -((weekdayIndex(d) + 1) % 7));

// Due every Sunday (unless done in the last few days), or as soon as the last one is a week old
export function wellnessDue(state, t) {
  const list = history(state).filter((e) => e.d <= t);
  const last = list[list.length - 1];
  if (!last) return { due: true, first: true, last: null };
  const age = daysBetween(last.d, t);
  if (age >= 7 || (weekdayIndex(t) === 6 && age >= 3)) return { due: true, first: false, last, age };
  // next due: the coming Sunday (if it's at least 3 days after the last one), or a week after the last one
  let sunday = addDays(t, weekdayIndex(t) === 6 ? 7 : 6 - weekdayIndex(t));
  if (daysBetween(last.d, sunday) < 3) sunday = addDays(sunday, 7);
  const next = [addDays(last.d, 7), sunday].sort()[0];
  return { due: false, first: false, last, age, nextIn: daysBetween(t, next) };
}

export function normalFor(state, d) {
  const prev = history(state).filter((e) => e.d < d && daysBetween(e.d, d) <= BASELINE_DAYS).slice(-BASELINE_WEEKS);
  if (prev.length < 3) return { value: DEFAULT_NORMAL, from: 0 };
  const avg = prev.reduce((t, e) => t + e.total, 0) / prev.length;
  return { value: clamp(round(avg, 1), NORMAL_MIN, NORMAL_MAX), from: prev.length };
}

// Score a set of answers for day d: the week it gives, and why
export function assess(state, a, d) {
  const total = totalOf(a);
  const normal = normalFor(state, d);
  const gap = round(total - normal.value, 1);
  const why = [];
  let band = gap >= 3 ? 'fresh' : gap >= -1 ? 'normal' : gap >= -4 ? 'tired' : 'lighter';
  const vs = normal.from ? `your normal of ${normal.value}` : `a normal score of ${DEFAULT_NORMAL}`;
  why.push(`${total} of ${MAX_SCORE}, ${gap > 0 ? `${gap} above` : gap < 0 ? `${-gap} below` : 'the same as'} ${vs}.`);
  const ones = QUESTIONS.filter((q) => a[q.id] === 1);
  const lows = QUESTIONS.filter((q) => a[q.id] <= 2);
  if (total <= 9 && band !== 'lighter') {
    band = 'lighter';
    why.push('A score this low means a lighter week, whatever your normal.');
  }
  if (ones.length && RANK[band] > RANK.tired) {
    band = 'tired';
    why.push(`${ones.map((q) => q.name).join(' and ')} scored 1, so this is a tired week at most.`);
  }
  if (band === 'fresh' && lows.length) {
    band = 'normal';
    why.push(`${lows.map((q) => q.name).join(' and ')} scored 2, so it stays a normal week rather than a hard one.`);
  }
  // a second tired week in a row becomes a lighter week, so fatigue doesn't keep building
  const prev = history(state).filter((e) => e.d < d && daysBetween(e.d, d) <= 10).pop();
  if (band === 'tired' && prev?.band === 'tired') {
    band = 'lighter';
    why.push('It’s your second tired week in a row, so this one is lighter to let you recover.');
  }
  return { total, normal: normal.value, baseline: normal.from, gap, band, why };
}

// Save this week's answers (answering again the same day replaces them)
export function addWellness(state, d, a) {
  const res = assess({ ...state, wellness: (state.wellness || []).filter((e) => e.d !== d) }, a, d);
  const old = (state.wellness || []).find((e) => e.d === d);
  const entry = { id: old?.id || uid('w'), d, a: { ...a }, total: res.total, normal: res.normal, gap: res.gap, band: res.band, why: res.why, keep: old?.keep || [] };
  state.wellness = [...(state.wellness || []).filter((e) => e.d !== d), entry].sort(byDate);
  return entry;
}

// ---------- What the week changes ----------

const stopText = ([lo, hi]) => (lo === hi ? `${lo}` : `${lo} or ${hi}`);
// health rules give 'how many reps short of failure' as text: '2 to 3', '3'
const healthRir = (s) => {
  const n = String(s || '').match(/\d+/g)?.map(Number) || [];
  return n.length ? [n[0], n[n.length - 1]] : [0, 0];
};

// profile: goal and experience; rules: your health rules
export function weekSettings(entry, profile, rules) {
  const band = entry?.band || 'normal';
  const a = entry?.a || {};
  const lean = profile?.goal === 'lean';
  const s = {
    band,
    // how far from failure to stop each set
    rir: { fresh: [1, 1], normal: [1, 2], tired: [2, 3], lighter: [3, 4] }[band],
    sore: a.soreness <= 2,
    poorSleep: a.sleep <= 2,
    stressed: a.stress <= 2,
    hold: false,
    lean,
    cardioEasy: band === 'tired' || band === 'lighter',
  };
  if (band === 'fresh' && profile?.experience === 'beginner') s.rir = [1, 2];
  // sleep and stress both slow recovery: no increase in load and a little further from failure
  if ((s.poorSleep || s.stressed) && loadDelta(band, { lean }) > 0) {
    s.hold = true;
    s.rir = [Math.max(s.rir[0], 2), Math.max(s.rir[1], 3)];
  }
  s.delta = loadDelta(band, { lean, hold: s.hold });
  s.mode = s.delta > 0 ? 'progress' : s.delta < 0 ? 'deload' : 'hold';
  // never closer to failure than your health rules allow
  const h = healthRir(rules?.stopShort);
  s.rir = [Math.max(s.rir[0], h[0]), Math.max(s.rir[1], h[1])];
  s.stop = stopText(s.rir);
  return s;
}

const pctText = (d) => `${round(Math.abs(d) * 100, 1)}%`;

// The week's changes in plain words, for the results screen and the Train tab
export function weekSummary(settings, profile) {
  const w = settings;
  const out = [];
  const limit = `${pctText(MAX_CHANGE)}`;
  if (w.mode === 'progress') out.push(`Your load goes up by about ${pctText(w.delta)} on last week’s, for legs, push and pull. It never moves more than ${limit} either way.`);
  if (w.mode === 'hold') {
    const because = w.poorSleep && w.stressed ? ' Poor sleep and stress both slow recovery.' : w.poorSleep ? ' Poor sleep slows recovery.' : w.stressed ? ' Stress slows recovery.' : '';
    out.push(`Your load stays the same as last week’s, for legs, push and pull.${because}`);
  }
  if (w.mode === 'deload') out.push(`Your load comes down by about ${pctText(w.delta)} from last week’s, for legs, push and pull. It never moves more than ${limit} either way.`);
  out.push('Every session keeps its 6 exercises and the same number of sets. The reps change first, and the weights only when the reps can’t.');
  out.push(`Stop each set ${w.stop} reps before you’d fail.`);
  if (w.mode === 'deload' && w.lean) out.push('Leaning out, the weights stay where they can and the reps come down: heavy weights help you keep your muscle.');
  if (w.sore) out.push('Your muscles are sore, so exercises that load a muscle at full stretch, like Romanian deadlifts, swap for one you already know and do a lot, if there is one.');
  if (w.cardioEasy) out.push('Cardio at an easy pace.');
  if (profile?.goal === 'lean' && w.band === 'lighter') out.push('Your calories don’t change: a lighter week is about recovery, not eating less.');
  return out;
}

// Exercises that load a muscle at full stretch cause the most soreness. When you're sore, each can swap for
// a gentler one for the same muscle, but only one you already know: a new exercise brings its own soreness.
export const STRETCH = {
  rdl: ['leg-curl'],
  'db-rdl': ['leg-curl'],
  'sl-rdl': ['leg-curl'],
  deadlift: ['leg-curl'],
  'split-squat': ['leg-press', 'goblet-squat', 'step-up', 'leg-ext'],
  'reverse-lunge': ['goblet-squat', 'step-up', 'leg-press'],
  'db-fly': ['machine-press', 'db-bench'],
  'cable-fly': ['machine-press', 'db-bench'],
  'pec-deck': ['machine-press', 'db-bench'],
  'incline-curl': ['db-curl', 'cable-curl', 'hammer-curl'],
  'db-pullover': ['straight-arm', 'cable-row', 'cs-row'],
  'oh-cable-ext': ['pushdown', 'skull-crusher'],
  'db-oh-ext': ['pushdown'],
};

// Exercises you have logged in the last 12 weeks. A swapped-in exercise needs a history, so its weight
// and reps can be worked out from what you did.
export function familiarSet(state, t) {
  const set = new Set();
  for (const [id, log] of Object.entries(state.exLog || {})) if ((log || []).some((h) => h.reps?.length && daysBetween(h.d, t) <= 84)) set.add(id);
  return set;
}

// This week's version of one session. ctx: { profile, rules, familiar (Set), keep (ids you chose to keep) }
// The session keeps all its exercises and sets: the load plan (load.js) changes the reps and weights. The
// one change here is for sore muscles: a stretch-heavy exercise swaps for a gentler one you already know.
export function adjustSession(session, w, ctx = {}) {
  const keep = new Set(ctx.keep || []);
  const avoid = ctx.rules?.avoid || new Set();
  const used = new Set(session.slots.map((sl) => sl.ex));
  const slots = session.slots.map((sl, i) => {
    const out = { ...sl, i, planned: sl };
    if (sl.cardio || isCardio(exerciseById(sl.ex))) return { ...out, effort: w.cardioEasy ? 'easy' : sl.effort };
    if (w.sore && STRETCH[sl.ex] && !keep.has(sl.ex)) {
      const alt = STRETCH[sl.ex].map((id) => exerciseById(id)).find((e) => e && e.m === sl.m && !used.has(e.id) && !avoid.has(e.id)
        && ctx.familiar?.has(e.id) && (!ctx.profile || e.custom || eligible(e, ctx.profile)));
      if (alt) {
        used.add(alt.id);
        return { ...out, ex: alt.id, base: sl.ex, swapWhy: 'sore' };
      }
    }
    return out;
  });
  const sets = slots.reduce((t, x) => t + (x.sets || 0), 0);
  const minutes = estimateMinutes(sets) + slots.reduce((t, x) => t + (x.min || 0), 0);
  return { ...session, slots, sets, minutes };
}

// The whole week at once, in session order
export function adjustWeek(program, w, ctx = {}) {
  const out = new Map();
  for (const s of program?.sessions || []) out.set(s.id, adjustSession(s, w, ctx));
  return out;
}

// Two weeks in a row of very low sleep, stress or mood scores: worth a word with someone
export function wellbeingNote(state, entry) {
  if (!entry) return '';
  const prev = history(state).filter((e) => e.d < entry.d && daysBetween(e.d, entry.d) <= 10).pop();
  if (!prev) return '';
  const low = (e, id) => e.a?.[id] <= 2;
  const both = ['sleep', 'stress', 'mood'].filter((id) => low(entry, id) && low(prev, id));
  if (!both.length && !(entry.band === 'lighter' && prev.band === 'lighter')) return '';
  return 'You’ve scored low for two weeks running. Training can wait: if this carries on, it can help to talk to someone you trust or your GP.';
}
