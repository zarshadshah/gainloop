// Training plan: weekly sets per muscle, a split that fits your days and time, exercises for your equipment,
// and double-progression advice. Rule-based so every number can be explained.
import { EFFORTS, EXERCISES, MUSCLES, customExercises, effortIndex, exerciseById, isCardio, muscleName } from './data/exercises.js';
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

// Every session has exactly 6 exercises, plus a separate 10 minute cardio finisher, and an exercise at most 5 sets
export const MAX_EXERCISES = 6;
export const MAX_SETS = 5;
// Bumped when the way plans are built changes, so saved plans are rebuilt once
export const PROGRAM_VERSION = 5;

// When sessions are full, places in the week go out in this order (your priorities always first).
// Glutes and abs come last because squats, lunges, deadlifts and presses already work them hard.
const KEEP = ['quads', 'chest', 'back', 'hamstrings', 'shoulders', 'triceps', 'biceps', 'calves', 'glutes', 'abs', 'forearms'];
const MAJOR = new Set(['quads', 'chest', 'back', 'hamstrings', 'shoulders']);
const BIG = new Set(['quads', 'chest', 'back']);
const ARMS = new Set(['triceps', 'biceps']);
// (muscle, which place it is for that muscle, is it a priority)
const TIERS = [
  (m, k, p) => p && k === 1,
  (m, k) => MAJOR.has(m) && k === 1,
  (m, k, p) => p && k === 2,
  (m, k) => BIG.has(m) && k === 2,
  (m, k) => ARMS.has(m) && k === 1,
  (m, k) => MAJOR.has(m) && k === 2,
  (m, k) => m === 'calves' && k === 1,
  (m, k) => k === 1,
  (m, k) => k === 2,
  () => true,
];

export const setsPerSession = (minutes) => clamp(Math.round((minutes - 8) / 2.6), 10, 32);
export const estimateMinutes = (sets) => Math.round(sets * 2.6 + 8);

// Every session ends with 10 minutes of cardio, on top of its 6 exercises: kept easy while building muscle so
// it helps your heart and recovery without eating into your gains. Cardio you already do goes in first.
export const CARDIO_MIN = 10;
export const CARDIO_FINISH = { build: { min: CARDIO_MIN, effort: 'easy' }, recomp: { min: CARDIO_MIN, effort: 'moderate' }, lean: { min: CARDIO_MIN, effort: 'moderate' } };
// What the finisher is when you haven't picked cardio of your own: easy to do wherever you train
const DEFAULT_CARDIO = { gym: ['incline-walk', 'bike', 'cross-trainer'], home: ['brisk-walk', 'jumping-jacks', 'mountain-climbers'], bw: ['brisk-walk', 'jumping-jacks', 'mountain-climbers'] };
const finishFor = (profile) => CARDIO_FINISH[profile.goal] || CARDIO_FINISH.build;
// Evenly spaced sessions for the j-th cardio: 0 and 2 of four sessions, then 1 and 3 for the next
function spread(n, j) {
  if (n <= 1) return [0];
  return [...new Set([j % n, (j + Math.ceil(n / 2)) % n])];
}

export function eligible(ex, profile) {
  if (!ex.eq.includes(profile.equipment)) return false;
  if (ex.bar && profile.equipment !== 'gym' && !profile.pullupBar) return false;
  return true;
}

// Exercises the planner may use for a muscle. ctx.mine: exercises you already do (always allowed, even ones
// the planner wouldn't pick by itself). ctx.avoid: exercises to leave out for a sore joint, if there's another option.
export function optionsFor(muscle, profile, ctx = {}) {
  const mine = new Set(ctx.mine || []);
  const avoid = ctx.avoid || new Set();
  const lib = EXERCISES.filter((e) => e.m === muscle && eligible(e, profile) && (e.auto !== false || mine.has(e.id)));
  const custom = customExercises().filter((e) => e.m === muscle && mine.has(e.id));
  const list = [...lib, ...custom];
  const safe = list.filter((e) => !avoid.has(e.id) || mine.has(e.id));
  return safe.length ? safe : list;
}

// Everything you could swap to for a muscle, including library extras the planner doesn't pick by itself
export function swapChoices(muscle, profile) {
  return [...EXERCISES.filter((e) => e.m === muscle && eligible(e, profile)), ...customExercises().filter((e) => e.m === muscle)];
}

// Weekly sets for each muscle before they are fitted into sessions
export function weeklySets(profile, priorities, mineMuscles = new Set()) {
  const base = BASE_SETS[profile.experience] || 12;
  const pri = new Set(priorities.map((p) => p.muscle));
  const weekly = {};
  for (const { id } of MUSCLES) weekly[id] = Math.round(base * MULT[id]);
  for (const m of pri) weekly[m] = m === 'forearms' ? 4 : weekly[m] + BOOST[profile.experience];
  // forearms normally get no direct sets, but if you already train them they keep a little
  if (mineMuscles.has('forearms') && !weekly.forearms) weekly.forearms = 3;

  const capacity = profile.days * setsPerSession(profile.minutes);
  let total = sum(Object.values(weekly));
  let squeezed = false;
  // forearms you already train keep a couple of sets even when time is short
  const floorOf = (m) => (m === 'forearms' && mineMuscles.has('forearms') ? 2 : FLOOR[m]);

  if (total > capacity) {
    squeezed = true;
    const reducible = MUSCLES.map((m) => m.id).filter((m) => !pri.has(m));
    const excess = total - capacity;
    const room = sum(reducible.map((m) => Math.max(0, weekly[m] - floorOf(m))));
    if (room >= excess) {
      for (const m of reducible) {
        const give = Math.max(0, weekly[m] - floorOf(m));
        weekly[m] = Math.round(weekly[m] - (give / room) * excess);
      }
    } else {
      for (const m of reducible) weekly[m] = floorOf(m);
      total = sum(Object.values(weekly));
      if (total > capacity) {
        const f = capacity / total;
        for (const m of Object.keys(weekly)) {
          if (weekly[m] === 0) continue;
          weekly[m] = Math.max(floorOf(m) > 0 ? 2 : 0, Math.round(weekly[m] * f));
        }
      }
    }
  }
  return { weekly, capacity, squeezed, base };
}

function pickExercises(muscle, count, occurrence, profile, swaps, usedInSession, ctx = {}) {
  const mine = new Set(ctx.mine || []);
  const placed = ctx.placed || new Set();
  const opts = optionsFor(muscle, profile, ctx);
  if (!opts.length) return [];
  // exercises you already do go to the front of each list, so they're picked first
  const mineFirst = (arr) => [...arr.filter((e) => mine.has(e.id)), ...arr.filter((e) => !mine.has(e.id))];
  let compounds = opts.filter((e) => e.k === 'c');
  let isolations = opts.filter((e) => e.k === 'i');
  // With weights available, rotate through loaded lifts; bodyweight moves stay available as swaps
  if (profile.equipment !== 'bw' && compounds.some((e) => e.load === 'kg')) compounds = compounds.filter((e) => e.load === 'kg' || mine.has(e.id));
  if (profile.experience === 'beginner' && compounds.some((e) => !PROGRESSIONS.has(e.id))) compounds = compounds.filter((e) => !PROGRESSIONS.has(e.id) || mine.has(e.id));
  compounds = mineFirst(compounds);
  isolations = mineFirst(isolations);

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
  // exercises you already do that aren't in the week yet come first, so each one gets in
  const fresh = (arr) => arr.find((e) => mine.has(e.id) && !placed.has(e.id) && !swaps?.[e.id] && !picks.includes(e) && !usedInSession.has(e.id));
  const pickFrom = (arr, i) => take(fresh(arr)) || take(rot(arr, i));

  if (muscle === 'back' && count >= 2) {
    // one vertical pull and one row when the equipment allows
    const vert = compounds.filter((e) => VERTICAL_PULLS.has(e.id));
    const horiz = compounds.filter((e) => !VERTICAL_PULLS.has(e.id));
    pickFrom(vert, occurrence) || pickFrom(horiz, occurrence + 1);
    pickFrom(horiz, occurrence) || take(rot(horiz, occurrence + 1)) || pickFrom(isolations, occurrence);
  } else if (PREFER_ISOLATION.has(muscle)) {
    // arms, calves, abs and forearms: two different isolation moves rather than another compound
    const pool1 = isolations.length ? isolations : compounds;
    pickFrom(pool1, occurrence);
    if (count >= 2) pickFrom(pool1, occurrence + 1) || take(rot(compounds.length ? compounds : pool1, occurrence));
  } else {
    const primary = compounds.length ? compounds : isolations;
    pickFrom(primary, occurrence);
    if (count >= 2) {
      const secondary = isolations.length ? isolations : compounds;
      pickFrom(secondary, occurrence) || take(rot(secondary, occurrence + 1)) || take(rot(primary, occurrence + 1));
    }
  }
  const pool = [...compounds, ...isolations];
  let i = occurrence;
  while (picks.length < count && i < occurrence + pool.length * 2) {
    pickFrom(pool, i);
    i += 1;
  }
  for (const p of picks) if (mine.has(p.id)) placed.add(p.id);
  return picks;
}

// Build the whole programme
export function buildProgram(profile, priorities, swaps = {}, ctx = {}) {
  const split = SPLITS[profile.days] || SPLITS[3];
  const mine = new Set(ctx.mine || []);
  const mineMuscles = new Set([...mine].map((id) => exerciseById(id)?.m).filter(Boolean));
  const { weekly, capacity, squeezed: globalSqueeze, base } = weeklySets(profile, priorities, mineMuscles);
  const cap = setsPerSession(profile.minutes);
  const pri = new Set(priorities.map((p) => p.muscle));
  const priOrder = priorities.map((p) => p.muscle);
  const avoidSet = ctx.avoid || new Set();
  const sessions = split.sessions.map(([id, name, type], idx) => ({ id, name, type, idx, muscles: TYPE_MUSCLES[type], alloc: {}, double: {}, load: 0 }));
  const placed = new Set();

  // 0. Cardio you already do goes in first, at most one finisher a session, so the lifting fits around it
  const fin = finishFor(profile);
  const cardioIn = sessions.map(() => null);
  const cardioFull = new Set();
  [...mine].map((id) => exerciseById(id)).filter((ex) => isCardio(ex) && (ex.custom || eligible(ex, profile))).forEach((own, j) => {
    // a cardio swapped for another one (rower for the bike, say) takes its place
    const to = swaps?.[own.id] ? exerciseById(swaps[own.id]) : null;
    const ex = to && isCardio(to) && (to.custom || eligible(to, profile)) ? to : own;
    const want = spread(sessions.length, j);
    const order = [...want, ...sessions.map((s) => s.idx).filter((i) => !want.includes(i))];
    let n = 0;
    for (const i of order) {
      if (n >= want.length) break;
      if (cardioIn[i]) continue;
      cardioIn[i] = { ex: ex.id, m: 'cardio', cardio: true, min: fin.min, effort: fin.effort, ...(ex === own ? { mine: true } : {}) };
      n += 1;
    }
    if (n) placed.add(own.id);
    else cardioFull.add(own.id);
  });

  // 0b. Every session without cardio of your own ends with a default 10 minute finisher
  for (const s of sessions) {
    if (cardioIn[s.idx]) continue;
    const all = DEFAULT_CARDIO[profile.equipment] || DEFAULT_CARDIO.gym;
    // not the ones your joints would rather avoid, while there is another
    const kind = all.filter((id) => !avoidSet.has(id));
    const list = kind.length ? kind : all;
    const ex = exerciseById(list[s.idx % list.length]);
    cardioIn[s.idx] = { ex: ex.id, m: 'cardio', cardio: true, min: fin.min, effort: fin.effort, auto: true };
  }

  // 1. Places in the week. A muscle takes one exercise of up to 5 sets in a session, and a session holds
  //    6 exercises. Places go out in order of importance, each to the session with the most room left.
  const room = sessions.map(() => MAX_EXERCISES);
  const importance = (m) => (pri.has(m) ? priOrder.indexOf(m) - 100 : KEEP.indexOf(m));
  const byImportance = MUSCLES.map((m) => m.id).filter((m) => weekly[m] > 0).sort((a, b) => importance(a) - importance(b));
  const want = {};
  const placesOf = {};
  for (const m of byImportance) {
    const elig = sessions.filter((s) => s.muscles.includes(m)).length;
    want[m] = Math.min(elig, Math.max(Math.ceil(weekly[m] / MAX_SETS), weekly[m] >= 4 ? 2 : 1), 3);
    placesOf[m] = [];
  }
  for (const tier of TIERS) {
    for (const m of byImportance) {
      const k = placesOf[m].length + 1;
      if (k > want[m] || !tier(m, k, pri.has(m))) continue;
      const cands = sessions.filter((s) => s.muscles.includes(m) && !placesOf[m].includes(s.idx) && room[s.idx] > 0);
      if (!cands.length) continue;
      cands.sort((a, b) => room[b.idx] - room[a.idx] || a.idx - b.idx);
      placesOf[m].push(cands[0].idx);
      room[cands[0].idx] -= 1;
    }
  }

  // 2. Each muscle's weekly sets shared across its places: at least 2 each, then spare sets to the lightest
  //    session, up to 5 an exercise. Beyond that, a second exercise for it where a session has room.
  const capped = {};
  for (const m of byImportance) {
    const where = placesOf[m].map((i) => sessions[i]);
    let left = weekly[m];
    for (const s of where) {
      const n = Math.min(2, left);
      s.alloc[m] = n;
      s.load += n;
      left -= n;
    }
    const top = (limit) => {
      while (left > 0) {
        const open = where.filter((s) => s.alloc[m] < limit(s));
        if (!open.length) return;
        open.sort((a, b) => a.load - b.load || a.idx - b.idx);
        open[0].alloc[m] += 1;
        open[0].load += 1;
        left -= 1;
      }
    };
    top(() => MAX_SETS);
    for (const s of [...where].sort((a, b) => room[b.idx] - room[a.idx] || a.load - b.load || a.idx - b.idx)) {
      if (left <= 0) break;
      if (room[s.idx] <= 0) continue;
      room[s.idx] -= 1;
      s.double[m] = true;
      const add = Math.min(left, MAX_SETS * 2 - s.alloc[m]);
      s.alloc[m] += add;
      s.load += add;
      left -= add;
    }
    if (left > 0) capped[m] = left;
  }

  // 3. Trim any session that runs over your time without taking a muscle below its floor.
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

  // 4. Where a session still has room, a muscle with plenty of sets there gets two different exercises:
  //    a pull-down and a row for back from 4 sets, a compound and an isolation move for the rest from 5
  for (const s of sessions) {
    const roomy = Object.keys(s.alloc).filter((m) => !s.double[m] && s.alloc[m] >= (m === 'back' ? 4 : MAX_SETS))
      .sort((a, b) => (b === 'back') - (a === 'back') || importance(a) - importance(b));
    for (const m of roomy) {
      if (room[s.idx] <= 0) break;
      room[s.idx] -= 1;
      s.double[m] = true;
    }
  }

  // 5. Pick exercises for each muscle in each session
  const occ = {};
  for (const s of sessions) {
    s.slots = [];
    for (const m of ORDER) {
      const sets = s.alloc[m];
      if (!sets) continue;
      occ[m] = (occ[m] ?? -1) + 1;
      const exs = pickExercises(m, s.double[m] ? 2 : 1, occ[m], profile, swaps, new Set(s.slots.map((x) => x.ex)), { ...ctx, placed });
      if (!exs.length) continue;
      const per = Math.floor(sets / exs.length);
      let rem = sets - per * exs.length;
      for (const ex of exs) {
        const n = per + (rem > 0 ? 1 : 0);
        if (rem > 0) rem -= 1;
        // when only one exercise fits your equipment, it still stops at 5 sets
        if (n > MAX_SETS) capped[m] = (capped[m] || 0) + n - MAX_SETS;
        s.slots.push({ ex: ex.id, m, sets: clamp(n, 2, MAX_SETS), priority: pri.has(m), ...(mine.has(ex.id) ? { mine: true } : {}) });
      }
    }
  }

  // 6. An exercise you already do that didn't fit its usual slot (a chin-up when biceps get curls, say)
  //    takes the place of one of the planner's own picks for the same muscle
  const swappedIn = new Set(Object.values(swaps || {}));
  for (const id of mine) {
    const ex = exerciseById(id);
    if (!ex || isCardio(ex) || placed.has(id) || swaps?.[id] || (!ex.custom && !eligible(ex, profile))) continue;
    let best = null;
    for (const s of sessions) {
      if (s.slots.some((x) => x.ex === id)) continue;
      for (const sl of s.slots) {
        if (sl.m !== ex.m || sl.mine || swappedIn.has(sl.ex)) continue;
        const repeats = sessions.filter((t) => t.slots.some((x) => x.ex === sl.ex)).length;
        const score = (exerciseById(sl.ex).k === ex.k ? 2 : 0) + (repeats > 1 ? 1 : 0);
        if (!best || score > best.score) best = { sl, score };
      }
    }
    if (best) {
      best.sl.ex = id;
      best.sl.mine = true;
      placed.add(id);
    }
  }

  // 6b. Every session has exactly 6 exercises. A session with fewer gets more, in this order: a muscle that
  //     is short of sets, then splitting a big exercise into two (same sets, more variety), then any other
  //     muscle of the session, then a second exercise for a muscle already there.
  const padded = {};
  const weekOf = (m) => sum(sessions.map((t) => sum(t.slots.filter((x) => x.m === m).map((x) => x.sets))));
  // loose: allow an exercise your joints would rather avoid, only when nothing else can fill the session
  const addTo = (s, m, sets, loose = false) => {
    occ[m] = (occ[m] ?? -1) + 1;
    const used = new Set(s.slots.map((x) => x.ex));
    const okEx = (e) => e && !used.has(e.id) && !isCardio(e) && (loose || !avoidSet.has(e.id) || mine.has(e.id));
    let [ex] = pickExercises(m, 1, occ[m], profile, swaps, used, { ...ctx, placed });
    // last resort: any exercise that fits your equipment, even a harder version or one the planner doesn't pick itself
    if (!okEx(ex)) ex = optionsFor(m, profile, ctx).find(okEx) || swapChoices(m, profile).find(okEx);
    if (!ex) return false;
    s.slots.push({ ex: ex.id, m, sets, priority: pri.has(m), ...(mine.has(ex.id) ? { mine: true } : {}) });
    padded[m] = (padded[m] || 0) + sets;
    return true;
  };
  for (const s of sessions) {
    const target = MAX_EXERCISES;
    const here = () => new Set(s.slots.map((x) => x.m));
    const short = (m) => MULT[m] > 0 && (capped[m] > 0 || weekOf(m) === 0);
    let loose = false;
    let guard = 40;
    while (s.slots.length < target && guard > 0) {
      guard -= 1;
      const missing = s.muscles.filter((m) => !here().has(m));
      const byNeed = (a, b) => importance(a) - importance(b);
      // a. a muscle that is short of sets
      const needy = missing.filter((m) => short(m) || pri.has(m)).sort(byNeed);
      if (needy.some((m) => addTo(s, m, 2, loose))) continue;
      // b. split the biggest exercise in two
      const big = [...s.slots].filter((x) => x.sets >= 4).sort((a, b) => b.sets - a.sets || importance(a.m) - importance(b.m));
      let didSplit = false;
      for (const sl of big) {
        const keepSets = Math.ceil(sl.sets / 2);
        const before = s.slots.length;
        if (addTo(s, sl.m, sl.sets - keepSets, loose)) {
          padded[sl.m] -= sl.sets - keepSets; // same sets as before, so no extra sets to count
          sl.sets = keepSets;
          didSplit = s.slots.length > before;
          break;
        }
      }
      if (didSplit) continue;
      // c. any other muscle of the session
      if ([...missing].sort(byNeed).some((m) => addTo(s, m, 2, loose))) continue;
      // d. a second exercise for a muscle already in the session
      const again = [...here()].sort((a, b) => importance(a) - importance(b));
      if (again.some((m) => addTo(s, m, 2, loose))) continue;
      // e. with very little equipment a session can run out of its own exercises: borrow from other muscles,
      //    the ones that train easily alongside (abs, calves, glutes) first
      const borrow = ['abs', 'calves', 'glutes', 'hamstrings', 'quads', 'shoulders', 'triceps', 'biceps', 'back', 'chest', 'forearms'].filter((m) => !s.muscles.includes(m));
      if (borrow.some((m) => addTo(s, m, 2, loose))) continue;
      // f. only now an exercise your joints would rather avoid, so the session still has all its exercises
      if (loose) break;
      loose = true;
    }
  }
  for (const m of Object.keys(padded)) {
    if (capped[m]) capped[m] = Math.max(0, capped[m] - Math.max(0, padded[m]));
    if (!capped[m]) delete capped[m];
  }

  // 7. The cardio finishers placed at the start go at the end of their sessions
  for (const s of sessions) if (cardioIn[s.idx]) s.slots.push(cardioIn[s.idx]);

  for (const s of sessions) {
    const rank = (sl) => {
      const ex = exerciseById(sl.ex);
      if (sl.cardio) return 5;
      if (sl.m === 'abs' && !sl.priority) return 4;
      if (ex.k === 'c') return sl.priority ? 0 : 1;
      return sl.priority ? 2 : 3;
    };
    s.slots.sort((a, b) => rank(a) - rank(b)
      || (a.priority && b.priority ? priOrder.indexOf(a.m) - priOrder.indexOf(b.m) : 0)
      || ORDER.indexOf(a.m) - ORDER.indexOf(b.m));
    s.sets = sum(s.slots.map((x) => x.sets || 0));
    s.minutes = estimateMinutes(s.sets) + sum(s.slots.map((x) => x.min || 0));
  }

  const done = {};
  for (const s of sessions) for (const sl of s.slots) if (!sl.cardio) done[sl.m] = (done[sl.m] || 0) + sl.sets;

  // Which of your own exercises made it in, and why any didn't
  const mineReport = [...mine].map((id) => {
    const ex = exerciseById(id);
    if (!ex) return null;
    const where = sessions.filter((s) => s.slots.some((sl) => sl.ex === id)).map((s) => s.name);
    let why = '';
    if (!where.length) {
      const barOnly = ex.bar && ex.eq.includes(profile.equipment) && profile.equipment !== 'gym' && !profile.pullupBar;
      if (!ex.custom && !eligible(ex, profile)) {
        why = isCardio(ex) ? 'It needs gym equipment, and you train at home. A brisk walk, running or skipping work anywhere.'
          : barOnly ? 'It needs a pull-up bar. If you have one, tick it in your training details.'
          : profile.equipment === 'gym' ? 'It’s a version for training at home, so your plan uses gym exercises for that muscle.'
            : 'It needs equipment you said you don’t have.';
      } else if (swaps?.[id]) why = 'You swapped it for something else.';
      else if (cardioFull.has(id)) why = 'Each session already ends with one 10 minute cardio finisher. Do it on a rest day if you like.';
      else if (!done[ex.m] && capped[ex.m]) why = `Every session has exactly ${MAX_EXERCISES} exercises, so with ${profile.days} training days ${muscleName(ex.m).toLowerCase()} ${SINGULAR.has(ex.m) ? 'gets' : 'get'} no direct sets.`;
      else if (!done[ex.m]) why = `${muscleName(ex.m)} ${SINGULAR.has(ex.m) ? 'gets' : 'get'} no direct sets in this plan.`;
      else why = `Your other ${MUSCLE_WORD[ex.m] || ex.m} exercises filled the slots this week.`;
    }
    return { id, where, why };
  }).filter(Boolean);

  return {
    v: PROGRAM_VERSION,
    split: split.name,
    days: profile.days,
    minutes: profile.minutes,
    equipment: profile.equipment,
    base,
    capacity,
    perSession: cap,
    squeezed: globalSqueeze || trimmed,
    weekly: done,
    // sets a muscle would have had, but that didn't fit in 6 exercises a session
    capped,
    mine: mineReport,
    priorities: priorities.map((p) => ({ ...p })),
    sessions: sessions.map(({ id, name, type, slots, sets, minutes }) => ({ id, name, type, slots, sets, minutes })),
  };
}

const EXPERIENCE_WORD = { beginner: 'Newer', intermediate: 'Intermediate', advanced: 'Experienced' };
const SINGULAR = new Set(['chest', 'back']);
// 'shoulder exercises', not 'shoulders exercises'
const MUSCLE_WORD = { shoulders: 'shoulder', quads: 'quad', hamstrings: 'hamstring', glutes: 'glute', calves: 'calf', abs: 'ab', forearms: 'forearm' };

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
  const lost = program.capped?.[muscle] || 0;
  if (lost) {
    const also = { glutes: ' Squats, lunges and Romanian deadlifts still work them hard.', abs: ' Squats, deadlifts and presses still work them as you brace.' }[muscle] || '';
    parts.push(n
      ? `Every session has exactly ${MAX_EXERCISES} exercises plus the cardio finisher, and an exercise has at most ${MAX_SETS} sets, so with ${program.days} training days ${name} ${verb('gets', 'get')} ${n} sets a week instead of ${n + lost}.${also} Another training day would give more room.`
      : `Every session has exactly ${MAX_EXERCISES} exercises plus the cardio finisher, so with ${program.days} training days there’s no place for ${name}.${also} Another training day, or making ${name} a priority, would give ${verb('it', 'them')} one.`);
    return parts.join(' ');
  }
  if (p && n < intended) parts.push(`Your sessions fit about ${program.perSession} sets each, so with everything else that works out at ${n} a week. More time per session or an extra day would give more room.`);
  if (program.squeezed && !p && n < baseFor) {
    parts.push(n >= FLOOR[muscle]
      ? `Your sessions fit about ${program.perSession} sets each, so this was trimmed to ${n}. It never goes below ${FLOOR[muscle]}.`
      : 'Your sessions are short for the number of days, so every muscle gets fewer sets. More time per session or an extra day would give more room.');
  }
  return parts.join(' ');
}

export const restText = (ex) => (isCardio(ex) ? 'at a steady pace' : ex.heavy ? '2 to 3 min rest' : ex.k === 'c' ? '2 min rest' : '60 to 90 s rest');

export const repText = (ex, rr = ex.rr) => (ex.load === 'min' ? `${rr[0]} to ${rr[1]} min` : ex.load === 's' ? `${rr[0]} to ${rr[1]} s` : `${rr[0]} to ${rr[1]} reps`);

// Cardio: same time and effort until it feels comfortable, then a few more minutes or a little harder
export function cardioAdvice(ex, history, plannedMin, effort = 'easy') {
  const last = history && history.length ? history[history.length - 1] : null;
  const e = EFFORTS[effortIndex(effort)];
  const talk = `${e.name} pace: ${e.talk.toLowerCase()}.`;
  if (!last?.min) return { min: plannedMin, text: `${plannedMin} minutes. ${talk}` };
  if (last.min >= plannedMin && last.felt === 'easy') {
    const more = Math.min(plannedMin + 5, ex.rr?.[1] || plannedMin + 5);
    return { min: more, text: more > plannedMin ? `That felt easy last time, so try ${more} minutes. ${talk}` : `That felt easy last time, so go a little harder. ${talk}` };
  }
  return { min: Math.max(plannedMin, last.min), text: `${Math.max(plannedMin, last.min)} minutes. ${talk}` };
}

// Double progression: stay at a weight until you hit the top of the range on every set, then go up.
// week (from your weekly wellness check): load 'progress' as normal, 'hold' keeps last time's weight.
// Once a full week of training has been recorded, the weekly load plan (load.js) sets the numbers instead.
export function advice(ex, history, fmtW, rr = ex.rr, stop = '1 or 2', week = null) {
  const last = history && history.length ? history[history.length - 1] : null;
  const [lo, hi] = rr;
  const mode = week?.load || 'progress';
  if (!last || !last.reps?.length) {
    if (ex.load === 'kg' && week?.start) return { kg: week.start, text: '' };
    if (ex.load === 'kg') return { kg: null, text: `First time: pick a weight you could lift about ${hi + 2} times, and stop each set ${stop} reps before you'd fail.` };
    if (ex.load === 's') return { kg: null, text: `First time: hold for as long as you can with good form, up to ${hi} seconds.` };
    return { kg: null, text: `First time: do as many good reps as you can, stopping ${stop} short of failure.` };
  }
  const allTop = last.reps.every((r) => r >= hi);
  const anyLow = last.reps.some((r) => r < lo);

  if (ex.load === 'kg') {
    const w = last.kg ?? 0;
    if (mode === 'hold') {
      if (!w) return { kg: null, text: `Stay at bodyweight this week and stop each set ${stop} reps before you'd fail.` };
      return { kg: w, text: allTop ? `You hit ${hi} on every set last time, but stay at ${fmtW(w)} this week while you recover, and go up next week.` : `Stay at ${fmtW(w)} this week and stop each set ${stop} reps before you'd fail. No need to beat last time.` };
    }
    if (allTop) {
      if (!w) return { kg: null, text: `You hit ${hi} on every set with bodyweight. Add some load: dumbbells or a loaded backpack.` };
      return { kg: w + (ex.step || 2.5), text: `You hit ${hi} on every set last time, so go up to ${fmtW(w + (ex.step || 2.5))}, or the nearest weight up.` };
    }
    if (anyLow) return { kg: w || null, text: `Stay at ${w ? fmtW(w) : 'bodyweight'} and aim for at least ${lo} on every set. If you miss again next time, drop about 10%.` };
    return { kg: w || null, text: `Stay at ${w ? fmtW(w) : 'bodyweight'} and beat last time by a rep on at least one set.` };
  }
  if (ex.load === 's') {
    if (mode === 'hold') return { kg: null, text: 'Hold for about as long as last time. No need to beat it this week.' };
    if (allTop) return { kg: null, text: `You held ${hi} s on every set. Add 10 seconds or hold something heavier.` };
    return { kg: null, text: 'Aim to hold a few seconds longer than last time.' };
  }
  if (mode === 'hold') return { kg: null, text: `Aim for about what you did last time, stopping ${stop} reps short of failure. No need to beat it this week.` };
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
