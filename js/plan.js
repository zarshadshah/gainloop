// Training plan: weekly sets per muscle, a split that fits your days and time, exercises for your equipment,
// and double-progression advice. Rule-based so every number can be explained.
import { EXERCISES, MUSCLES, exerciseById, muscleName } from './data/exercises.js';
import { clamp, lcFirst, sum } from './util.js';

export const BASE_SETS = { beginner: 10, intermediate: 12, advanced: 14 };
// Share of the base each muscle gets. Glutes and forearms also get plenty of indirect work.
export const MULT = { chest: 1, back: 1.1, shoulders: 0.8, biceps: 0.6, triceps: 0.6, quads: 1, hamstrings: 0.8, glutes: 0.5, calves: 0.6, abs: 0.5, forearms: 0 };
// Every muscle keeps at least this many sets a week when the plan is trimmed to fit your time
export const FLOOR = { chest: 6, back: 6, shoulders: 4, biceps: 3, triceps: 3, quads: 6, hamstrings: 4, glutes: 2, calves: 3, abs: 2, forearms: 0 };
export const BOOST = { beginner: 2, intermediate: 3, advanced: 4 };

const TYPE_MUSCLES = {
  full: ['quads', 'chest', 'back', 'hamstrings', 'shoulders', 'glutes', 'triceps', 'biceps', 'calves', 'abs', 'forearms'],
  upper: ['chest', 'back', 'shoulders', 'triceps', 'biceps', 'forearms'],
  lower: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps', 'forearms'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'],
};

export const SPLITS = {
  2: { name: 'Full body', sessions: [['A', 'Full body A', 'full'], ['B', 'Full body B', 'full']] },
  3: { name: 'Full body', sessions: [['A', 'Full body A', 'full'], ['B', 'Full body B', 'full'], ['C', 'Full body C', 'full']] },
  4: { name: 'Upper and lower', sessions: [['A', 'Upper A', 'upper'], ['B', 'Lower A', 'lower'], ['C', 'Upper B', 'upper'], ['D', 'Lower B', 'lower']] },
  5: { name: 'Upper, lower, push, pull, legs', sessions: [['A', 'Upper', 'upper'], ['B', 'Lower', 'lower'], ['C', 'Push', 'push'], ['D', 'Pull', 'pull'], ['E', 'Legs', 'legs']] },
  6: { name: 'Push, pull, legs', sessions: [['A', 'Push A', 'push'], ['B', 'Pull A', 'pull'], ['C', 'Legs A', 'legs'], ['D', 'Push B', 'push'], ['E', 'Pull B', 'pull'], ['F', 'Legs B', 'legs']] },
};

// Order exercises run in: big compound lifts first, small isolation work last
const ORDER = ['quads', 'chest', 'back', 'hamstrings', 'shoulders', 'glutes', 'triceps', 'biceps', 'calves', 'forearms', 'abs'];
const PREFER_ISOLATION = new Set(['biceps', 'triceps', 'calves', 'abs', 'forearms']);
const VERTICAL_PULLS = new Set(['lat-pulldown', 'pull-up']);
// Harder bodyweight versions: reached through progression, not handed to beginners on day one
const PROGRESSIONS = new Set(EXERCISES.filter((e) => e.next).map((e) => e.next));

export const setsPerSession = (minutes) => clamp(Math.round((minutes - 8) / 2.6), 10, 32);
export const estimateMinutes = (sets) => Math.round(sets * 2.6 + 8);

export function eligible(ex, profile) {
  if (!ex.eq.includes(profile.equipment)) return false;
  if (ex.bar && profile.equipment !== 'gym' && !profile.pullupBar) return false;
  return true;
}

export const optionsFor = (muscle, profile) => EXERCISES.filter((e) => e.m === muscle && eligible(e, profile));

// Weekly sets for each muscle before they are fitted into sessions
export function weeklySets(profile, priorities) {
  const base = BASE_SETS[profile.experience] || 12;
  const pri = new Set(priorities.map((p) => p.muscle));
  const weekly = {};
  for (const { id } of MUSCLES) weekly[id] = Math.round(base * MULT[id]);
  for (const m of pri) weekly[m] = m === 'forearms' ? 4 : weekly[m] + BOOST[profile.experience];

  const capacity = profile.days * setsPerSession(profile.minutes);
  let total = sum(Object.values(weekly));
  let squeezed = false;

  if (total > capacity) {
    squeezed = true;
    const reducible = MUSCLES.map((m) => m.id).filter((m) => !pri.has(m));
    const excess = total - capacity;
    const room = sum(reducible.map((m) => Math.max(0, weekly[m] - FLOOR[m])));
    if (room >= excess) {
      for (const m of reducible) {
        const give = Math.max(0, weekly[m] - FLOOR[m]);
        weekly[m] = Math.round(weekly[m] - (give / room) * excess);
      }
    } else {
      for (const m of reducible) weekly[m] = FLOOR[m];
      total = sum(Object.values(weekly));
      if (total > capacity) {
        const f = capacity / total;
        for (const m of Object.keys(weekly)) {
          if (weekly[m] === 0) continue;
          weekly[m] = Math.max(FLOOR[m] > 0 ? 2 : 0, Math.round(weekly[m] * f));
        }
      }
    }
  }
  return { weekly, capacity, squeezed, base };
}

function pickExercises(muscle, count, occurrence, profile, swaps, usedInSession) {
  const opts = optionsFor(muscle, profile);
  if (!opts.length) return [];
  let compounds = opts.filter((e) => e.k === 'c');
  const isolations = opts.filter((e) => e.k === 'i');
  // With weights available, rotate through loaded lifts; bodyweight moves stay available as swaps
  if (profile.equipment !== 'bw' && compounds.some((e) => e.load === 'kg')) compounds = compounds.filter((e) => e.load === 'kg');
  if (profile.experience === 'beginner' && compounds.some((e) => !PROGRESSIONS.has(e.id))) compounds = compounds.filter((e) => !PROGRESSIONS.has(e.id));

  const rot = (arr, i) => (arr.length ? arr[((i % arr.length) + arr.length) % arr.length] : null);
  const picks = [];
  const take = (ex) => {
    if (!ex) return false;
    let chosen = ex;
    const swapped = swaps?.[ex.id] ? exerciseById(swaps[ex.id]) : null;
    if (swapped && swapped.m === muscle && eligible(swapped, profile)) chosen = swapped;
    if (picks.includes(chosen) || usedInSession.has(chosen.id)) return false;
    picks.push(chosen);
    return true;
  };

  if (muscle === 'back' && count >= 2) {
    // one vertical pull and one row when the equipment allows
    const vert = compounds.filter((e) => VERTICAL_PULLS.has(e.id));
    const horiz = compounds.filter((e) => !VERTICAL_PULLS.has(e.id));
    take(rot(vert, occurrence)) || take(rot(horiz, occurrence + 1));
    take(rot(horiz, occurrence)) || take(rot(horiz, occurrence + 1)) || take(rot(isolations, occurrence));
  } else if (PREFER_ISOLATION.has(muscle)) {
    // arms, calves, abs and forearms: two different isolation moves rather than another compound
    const pool1 = isolations.length ? isolations : compounds;
    take(rot(pool1, occurrence));
    if (count >= 2) take(rot(pool1, occurrence + 1)) || take(rot(compounds.length ? compounds : pool1, occurrence));
  } else {
    const primary = compounds.length ? compounds : isolations;
    take(rot(primary, occurrence));
    if (count >= 2) {
      const secondary = isolations.length ? isolations : compounds;
      take(rot(secondary, occurrence)) || take(rot(secondary, occurrence + 1)) || take(rot(primary, occurrence + 1));
    }
  }
  const pool = [...compounds, ...isolations];
  let i = occurrence;
  while (picks.length < count && i < occurrence + pool.length * 2) {
    take(rot(pool, i));
    i += 1;
  }
  return picks;
}

// Build the whole programme
export function buildProgram(profile, priorities, swaps = {}) {
  const split = SPLITS[profile.days] || SPLITS[3];
  const { weekly, capacity, squeezed: globalSqueeze, base } = weeklySets(profile, priorities);
  const cap = setsPerSession(profile.minutes);
  const pri = new Set(priorities.map((p) => p.muscle));
  const priOrder = priorities.map((p) => p.muscle);
  const sessions = split.sessions.map(([id, name, type], idx) => ({ id, name, type, idx, muscles: TYPE_MUSCLES[type], alloc: {}, load: 0 }));

  // 1. Share each muscle's sets across the sessions that train it, topping up the lightest session first
  const order = MUSCLES.map((m) => m.id).filter((m) => weekly[m] > 0).sort((a, b) => weekly[b] - weekly[a] || ORDER.indexOf(a) - ORDER.indexOf(b));
  for (const m of order) {
    const elig = sessions.filter((s) => s.muscles.includes(m));
    if (!elig.length) continue;
    const T = weekly[m];
    const k = Math.max(1, Math.min(elig.length, Math.floor(T / 2)));
    const chosen = [...elig].sort((a, b) => a.load - b.load || a.idx - b.idx).slice(0, k);
    for (const s of chosen) { s.alloc[m] = 2; s.load += 2; }
    let left = T - 2 * k;
    while (left > 0) {
      chosen.sort((a, b) => a.load - b.load || a.idx - b.idx);
      chosen[0].alloc[m] += 1;
      chosen[0].load += 1;
      left -= 1;
    }
  }

  // 2. Trim any session that runs over your time without taking a muscle below its floor.
  //    Priorities give sets back only as a last resort, and always keep more than the rest.
  const weekTotal = (m) => sum(sessions.map((s) => s.alloc[m] || 0));
  let trimmed = false;
  for (const s of sessions) {
    let guard = 200;
    while (s.load > cap + 1 && guard > 0) {
      guard -= 1;
      let cands = Object.keys(s.alloc).filter((m) => !pri.has(m) && s.alloc[m] > 2 && weekTotal(m) - 1 >= Math.max(FLOOR[m], 2));
      if (!cands.length) cands = Object.keys(s.alloc).filter((m) => pri.has(m) && s.alloc[m] > 2);
      if (!cands.length) break;
      cands.sort((a, b) => s.alloc[b] - s.alloc[a] || ORDER.indexOf(b) - ORDER.indexOf(a));
      s.alloc[cands[0]] -= 1;
      s.load -= 1;
      trimmed = true;
    }
  }

  // 3. Pick exercises for each muscle in each session
  const occ = {};
  for (const s of sessions) {
    s.slots = [];
    for (const m of ORDER) {
      const sets = s.alloc[m];
      if (!sets) continue;
      occ[m] = (occ[m] ?? -1) + 1;
      // back gets a pull-down and a row once it has 4 sets; otherwise up to 4 sets per exercise
      const nEx = m === 'back' && sets >= 4 ? Math.max(2, Math.ceil(sets / 4)) : sets <= 4 ? 1 : Math.ceil(sets / 4);
      const exs = pickExercises(m, nEx, occ[m], profile, swaps, new Set(s.slots.map((x) => x.ex)));
      if (!exs.length) continue;
      const per = Math.floor(sets / exs.length);
      let rem = sets - per * exs.length;
      for (const ex of exs) {
        const n = per + (rem > 0 ? 1 : 0);
        if (rem > 0) rem -= 1;
        // when only one exercise fits your equipment, cap it at 5 sets
        s.slots.push({ ex: ex.id, m, sets: clamp(n, 2, 5), priority: pri.has(m) });
      }
    }
    const rank = (sl) => {
      const ex = exerciseById(sl.ex);
      if (sl.m === 'abs' && !sl.priority) return 4;
      if (ex.k === 'c') return sl.priority ? 0 : 1;
      return sl.priority ? 2 : 3;
    };
    s.slots.sort((a, b) => rank(a) - rank(b)
      || (a.priority && b.priority ? priOrder.indexOf(a.m) - priOrder.indexOf(b.m) : 0)
      || ORDER.indexOf(a.m) - ORDER.indexOf(b.m));
    s.sets = sum(s.slots.map((x) => x.sets));
    s.minutes = estimateMinutes(s.sets);
  }

  const done = {};
  for (const s of sessions) for (const sl of s.slots) done[sl.m] = (done[sl.m] || 0) + sl.sets;

  return {
    split: split.name,
    days: profile.days,
    minutes: profile.minutes,
    equipment: profile.equipment,
    base,
    capacity,
    perSession: cap,
    squeezed: globalSqueeze || trimmed,
    weekly: done,
    priorities: priorities.map((p) => ({ ...p })),
    sessions: sessions.map(({ id, name, type, slots, sets, minutes }) => ({ id, name, type, slots, sets, minutes })),
  };
}

const EXPERIENCE_WORD = { beginner: 'Newer', intermediate: 'Intermediate', advanced: 'Experienced' };
const SINGULAR = new Set(['chest', 'back']);

export const SITE_REASON = {
  chest: 'Your chest measurement is one of the furthest behind its target. Chest and back muscles both add to it.',
  arm: 'Your arm measurement is one of the furthest behind its target. Triceps make up most of the upper arm and biceps the rest.',
  forearm: 'Your forearm measurement is one of the furthest behind its target.',
  thigh: 'Your thigh measurement is one of the furthest behind its target. Quads and hamstrings make up most of it.',
  calf: 'Your calf measurement is one of the furthest behind its target.',
};

export function whySets(program, muscle, profile) {
  const n = program.weekly[muscle] || 0;
  const p = program.priorities.find((x) => x.muscle === muscle);
  const name = muscleName(muscle).toLowerCase();
  const verb = (one, many) => (SINGULAR.has(muscle) ? one : many);
  const baseFor = Math.round(program.base * MULT[muscle]);
  if (muscle === 'forearms' && !p) return 'Forearms get plenty of work from rows, curls and holding weights, so they have no direct sets unless you make them a priority.';
  const parts = [`${EXPERIENCE_WORD[profile.experience]} lifters start at about ${baseFor} sets a week for ${name}.`];
  if (p?.source === 'tape') parts.push(`${SITE_REASON[p.site]} So ${name} ${verb('gets', 'get')} ${BOOST[profile.experience]} extra sets a week and ${verb('moves', 'move')} up the order in each session.`);
  if (p?.source === 'pin') parts.push(`You picked ${name} as a priority, so ${verb('it gets', 'they get')} ${muscle === 'forearms' ? '4 direct sets' : `${BOOST[profile.experience]} extra sets`} a week and ${verb('moves', 'move')} up the order in each session.`);
  const intended = muscle === 'forearms' ? 4 : baseFor + BOOST[profile.experience];
  if (p && n < intended) parts.push(`Your sessions fit about ${program.perSession} sets each, so with everything else that works out at ${n} a week. More time per session or an extra day would give more room.`);
  if (program.squeezed && !p && n < baseFor) {
    parts.push(n >= FLOOR[muscle]
      ? `Your sessions fit about ${program.perSession} sets each, so this was trimmed to ${n}. It never goes below ${FLOOR[muscle]}.`
      : 'Your sessions are short for the number of days, so every muscle gets fewer sets. More time per session or an extra day would give more room.');
  }
  return parts.join(' ');
}

export const restText = (ex) => (ex.heavy ? '2 to 3 min rest' : ex.k === 'c' ? '2 min rest' : '60 to 90 s rest');

export const repText = (ex) => (ex.load === 's' ? `${ex.rr[0]} to ${ex.rr[1]} s` : `${ex.rr[0]} to ${ex.rr[1]} reps`);

// Double progression: stay at a weight until you hit the top of the range on every set, then go up
export function advice(ex, history, fmtW) {
  const last = history && history.length ? history[history.length - 1] : null;
  const [lo, hi] = ex.rr;
  if (!last || !last.reps?.length) {
    if (ex.load === 'kg') return { kg: null, text: `First time: pick a weight you could lift about ${hi + 2} times, and stop each set 1 or 2 reps before you'd fail.` };
    if (ex.load === 's') return { kg: null, text: `First time: hold for as long as you can with good form, up to ${hi} seconds.` };
    return { kg: null, text: 'First time: do as many good reps as you can, stopping 1 or 2 short of failure.' };
  }
  const allTop = last.reps.every((r) => r >= hi);
  const anyLow = last.reps.some((r) => r < lo);

  if (ex.load === 'kg') {
    const w = last.kg ?? 0;
    if (allTop) {
      if (!w) return { kg: null, text: `You hit ${hi} on every set with bodyweight. Add some load: dumbbells or a loaded backpack.` };
      return { kg: w + ex.step, text: `You hit ${hi} on every set last time, so go up to ${fmtW(w + ex.step)}, or the nearest weight up.` };
    }
    if (anyLow) return { kg: w || null, text: `Stay at ${w ? fmtW(w) : 'bodyweight'} and aim for at least ${lo} on every set. If you miss again next time, drop about 10%.` };
    return { kg: w || null, text: `Stay at ${w ? fmtW(w) : 'bodyweight'} and beat last time by a rep on at least one set.` };
  }
  if (ex.load === 's') {
    if (allTop) return { kg: null, text: `You held ${hi} s on every set. Add 10 seconds or hold something heavier.` };
    return { kg: null, text: 'Aim to hold a few seconds longer than last time.' };
  }
  if (allTop) {
    const next = ex.next ? exerciseById(ex.next) : null;
    if (next) return { kg: null, text: `You hit ${hi} on every set. Try the harder version, ${lcFirst(next.name)}. Swap it in from the exercise menu.`, nextEx: next.id };
    return { kg: null, text: `You hit ${hi} on every set. Make it harder: lower for 3 seconds or add a pause at the bottom.` };
  }
  return { kg: null, text: 'Beat last time by a rep on at least one set.' };
}

export function nextSessionId(program, sessionsDone) {
  if (!program?.sessions?.length) return null;
  const ids = program.sessions.map((s) => s.id);
  const last = [...(sessionsDone || [])].reverse().find((s) => ids.includes(s.sid));
  if (!last) return ids[0];
  return ids[(ids.indexOf(last.sid) + 1) % ids.length];
}
