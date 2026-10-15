// Weekly wellness check: five questions on fatigue, sleep, soreness, stress and mood, scored 1 to 5
// (5 is best), best answered on Sunday morning. The total, compared with your own normal, sets how hard
// the coming week's sessions are: sets, how close to failure, weights and which exercises. No DOM here.
//
// Based on the athlete wellness questionnaire of McLean and colleagues (2010). Deload changes follow the
// Delphi consensus of Bell and colleagues (2023): fewer sets, further from failure, familiar main lifts
// kept and accessory work dropped.
import { exerciseById, isCardio } from './data/exercises.js';
import { MAX_EXERCISES, MAX_SETS, eligible, estimateMinutes } from './plan.js';
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
    sets: { fresh: 1, normal: 0, tired: -1, lighter: 'lighter' }[band],
    extra: band === 'fresh' && !lean, // one more set on your main or priority lifts
    maxEx: { fresh: MAX_EXERCISES, normal: MAX_EXERCISES, tired: MAX_EXERCISES - 1, lighter: MAX_EXERCISES - 2 }[band],
    rir: { fresh: [1, 1], normal: [1, 2], tired: [2, 3], lighter: [3, 4] }[band],
    load: { fresh: 'progress', normal: 'progress', tired: 'hold', lighter: 'lighter' }[band],
    // leaning out: keep the weights heavy to hold on to muscle, and take the rest from sets and reps
    pct: band === 'lighter' && !lean ? 0.1 : 0,
    sore: a.soreness <= 2,
    poorSleep: a.sleep <= 2,
    stressed: a.stress <= 2,
    cardioEasy: band === 'tired' || band === 'lighter',
  };
  if (band === 'fresh' && profile?.experience === 'beginner') s.rir = [1, 2];
  // sleep and stress both slow recovery: no weight increases and a little further from failure
  if ((s.poorSleep || s.stressed) && s.load === 'progress') {
    s.load = 'hold';
    s.extra = false;
    s.rir = [Math.max(s.rir[0], 2), Math.max(s.rir[1], 3)];
  }
  // never closer to failure than your health rules allow
  const h = healthRir(rules?.stopShort);
  s.rir = [Math.max(s.rir[0], h[0]), Math.max(s.rir[1], h[1])];
  s.stop = stopText(s.rir);
  return s;
}

// The week's changes in plain words, for the results screen and the Train tab
export function weekSummary(settings, profile) {
  const w = settings;
  const out = [];
  if (w.band === 'fresh') out.push(w.extra ? 'One extra set on two exercises in each session: your priority lifts first, or else the first lifts of the session.' : 'Sets stay as planned: leaning out, recovery is limited, so extra sets aren’t added.');
  if (w.band === 'tired') out.push('One set fewer on each exercise.');
  if (w.band === 'lighter') out.push('About 40% fewer sets, two or three on each exercise.');
  if (w.maxEx < MAX_EXERCISES) out.push(w.band === 'lighter' ? `At most ${w.maxEx} exercises a session: your main lifts and easy cardio stay, and accessory work like arm, calf and ab exercises is left out.` : `At most ${w.maxEx} exercises a session: your main lifts stay and the last accessory exercise is left out.`);
  out.push(`Stop each set ${w.stop} reps before you’d fail.`);
  if (w.load === 'progress') out.push('Go up in weight wherever you hit the top of the rep range on every set last time.');
  if (w.load === 'hold') {
    const because = w.band === 'tired' ? '' : w.poorSleep && w.stressed ? ' Poor sleep and stress both slow recovery.' : w.poorSleep ? ' Poor sleep slows recovery.' : ' Stress slows recovery.';
    out.push(`Same weights as last time, no increases this week.${because}`);
  }
  if (w.load === 'lighter') out.push(w.pct ? `Weights about ${Math.round(w.pct * 100)}% lighter than last time.` : 'Same weights as last time, with fewer reps: leaning out, heavy weights help you keep your muscle.');
  if (w.sore) out.push('Your muscles are sore, so exercises that load a muscle at full stretch, like Romanian deadlifts, get one set fewer, or swap for one you already know.');
  if (w.cardioEasy) out.push('Cardio at an easy pace.');
  if (profile?.goal === 'lean' && w.band === 'lighter') out.push('Your calories don’t change: a lighter week is about recovery, not eating less.');
  return out;
}

// Exercises that load a muscle at full stretch cause the most soreness. When you're sore, each can swap for
// a gentler one for the same muscle, but only one you already know: a new exercise brings its own soreness.
export const STRETCH = {
  rdl: ['leg-curl', 'slider-curl'],
  'db-rdl': ['leg-curl', 'slider-curl'],
  'sl-rdl': ['slider-curl', 'leg-curl'],
  deadlift: ['leg-curl', 'slider-curl'],
  nordic: ['slider-curl', 'leg-curl'],
  'split-squat': ['leg-press', 'goblet-squat', 'step-up', 'leg-ext'],
  'reverse-lunge': ['goblet-squat', 'step-up', 'leg-press'],
  'db-fly': ['machine-press', 'db-bench', 'push-up'],
  'cable-fly': ['machine-press', 'db-bench'],
  'pec-deck': ['machine-press', 'db-bench'],
  dips: ['machine-press', 'db-bench', 'push-up'],
  'deficit-push-up': ['push-up', 'feet-up-push-up'],
  'incline-curl': ['db-curl', 'cable-curl', 'hammer-curl', 'backpack-curl'],
  'db-pullover': ['straight-arm', 'cable-row', 'cs-row'],
  'oh-cable-ext': ['pushdown', 'skull-crusher'],
  'db-oh-ext': ['pushdown', 'diamond-push-up', 'bench-dip'],
};

// Exercises you know: in your plan, on your list, or logged in the last 12 weeks
export function familiarSet(state, t) {
  const set = new Set([...(state.myExercises || []), ...(state.program?.sessions || []).flatMap((s) => s.slots.map((sl) => sl.ex))]);
  for (const [id, log] of Object.entries(state.exLog || {})) if ((log || []).some((h) => daysBetween(h.d, t) <= 84)) set.add(id);
  return set;
}

// Order exercises are left out in when a session has to be shorter: abs first, then other isolation
// accessories (from the end of the session), then priority isolation work, and only then the last compound
// lifts. Easy cardio stays, as it helps recovery. The first lifts and your priority compounds always stay.
function dropRank(sl) {
  const ex = exerciseById(sl.ex);
  if (sl.cardio) return 7;
  if (sl.m === 'abs' && !sl.priority) return 0;
  if (ex?.k === 'i') return sl.priority ? 3 : 1;
  return sl.priority ? 9 : 8;
}

// This week's version of one session. ctx: { profile, rules, familiar (Set), keep (ids you chose to keep) }
export function adjustSession(session, w, ctx = {}) {
  const keep = new Set(ctx.keep || []);
  const avoid = ctx.rules?.avoid || new Set();
  const used = new Set(session.slots.map((sl) => sl.ex));
  // 1. the shorter session: leave out exercises until it fits
  let slots = session.slots.map((sl, i) => ({ ...sl, i }));
  const dropped = [];
  // between two equal choices, leave out the one whose muscle is still trained elsewhere this week
  const covered = (x) => (slots.some((y) => y !== x && y.m === x.m) || (ctx.elsewhere ? ctx.elsewhere(x.m) > 0 : false) ? 1 : 0);
  while (slots.length > w.maxEx) {
    const cands = [...slots].sort((a, b) => dropRank(a) - dropRank(b) || covered(b) - covered(a) || b.i - a.i);
    const out = cands[0];
    if (dropRank(out) >= 9) break; // never a priority compound lift
    dropped.push(out);
    slots = slots.filter((x) => x !== out);
  }
  // the extra set on a fresh week goes to two lifts a session: priority lifts first, then the first lifts
  const lifts = slots.filter((x) => !x.cardio && (x.sets || 0) < MAX_SETS);
  const extraFor = new Set([...lifts.filter((x) => x.priority), ...lifts.filter((x) => !x.priority)].slice(0, 2).map((x) => x.i));
  slots = slots.map((sl) => {
    const ex = exerciseById(sl.ex);
    if (sl.cardio || isCardio(ex)) return { ...sl, effort: w.cardioEasy ? 'easy' : sl.effort, planned: sl };
    let sets = sl.sets;
    if (w.sets === 'lighter') sets = Math.max(2, Math.round(sl.sets * 0.6));
    else if (w.sets < 0) sets = Math.max(2, sl.sets + w.sets);
    else if (w.extra && extraFor.has(sl.i)) sets = Math.min(MAX_SETS, sl.sets + 1);
    const out = { ...sl, sets, planned: sl };
    // 2. sore: a stretch-heavy exercise swaps for a gentler one you know, or loses a set
    if (w.sore && STRETCH[sl.ex] && !keep.has(sl.ex)) {
      const alt = STRETCH[sl.ex].map((id) => exerciseById(id)).find((e) => e && e.m === sl.m && !used.has(e.id) && !avoid.has(e.id)
        && ctx.familiar?.has(e.id) && (!ctx.profile || e.custom || eligible(e, ctx.profile)));
      if (alt) {
        used.add(alt.id);
        return { ...out, ex: alt.id, base: sl.ex, swapWhy: 'sore' };
      }
      out.sets = Math.max(2, out.sets - 1);
      out.soreCut = true;
    }
    return out;
  });
  const sets = slots.reduce((t, x) => t + (x.sets || 0), 0);
  const minutes = estimateMinutes(sets) + slots.reduce((t, x) => t + (x.min || 0), 0);
  return { ...session, slots, dropped, sets, minutes };
}

// The whole week at once, in session order, so a muscle left out of one session keeps its place in another
export function adjustWeek(program, w, ctx = {}) {
  const out = new Map();
  const kept = new Map();
  const sessions = program?.sessions || [];
  sessions.forEach((s, idx) => {
    const later = sessions.slice(idx + 1);
    const elsewhere = (m) => (kept.get(m) || 0) + later.filter((t) => t.slots.some((x) => x.m === m && !x.cardio)).length;
    const a = adjustSession(s, w, { ...ctx, elsewhere });
    for (const m of new Set(a.slots.filter((x) => !x.cardio).map((x) => x.m))) kept.set(m, (kept.get(m) || 0) + 1);
    out.set(s.id, a);
  });
  return out;
}

// Reps aimed for in a lighter week: the bottom half of the range
export function weekRange(rr, w) {
  if (w?.band !== 'lighter' || !rr) return rr;
  const [lo, hi] = rr;
  return [lo, Math.max(lo, Math.round((lo + hi) / 2))];
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
