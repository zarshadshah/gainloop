// Weekly training load. Load = weight lifted × reps × sets, added up for three groups: legs, push and pull.
// It is worked out at the end of every week from what you logged. The next week's load is then planned
// to be within 5% of it, up when you're progressing and down when you're deloading, and shared out over
// your exercises as a weight, reps and sets for each. No DOM here.
import { exerciseById, isCardio } from './data/exercises.js';
import { currentWeight } from './calc.js';
import { addDays, mondayOf, round, sum } from './util.js';

export const MAX_CHANGE = 0.05; // a week's load never moves more than this from the week before

export const LOAD_GROUPS = [
  { id: 'legs', name: 'Legs', what: 'quads, hamstrings, glutes, calves and abs' },
  { id: 'push', name: 'Push', what: 'chest, shoulders and triceps' },
  { id: 'pull', name: 'Pull', what: 'back, biceps and forearms' },
];
const GROUP_OF = { quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs', abs: 'legs', chest: 'push', shoulders: 'push', triceps: 'push', back: 'pull', biceps: 'pull', forearms: 'pull' };
export const groupName = (id) => LOAD_GROUPS.find((g) => g.id === id)?.name || id;

// Bodyweight exercises count as a share of your body weight: a pull-up moves all of it, a push-up about two thirds
const FULL_BW = new Set(['pull-up', 'chin-up', 'dips']);
const bwShare = (ex) => (FULL_BW.has(ex.id) ? 1 : 0.65);

// Cardio and timed holds have no weight × reps, so they aren't part of the load
export const countsInLoad = (ex) => !!ex && !isCardio(ex) && (ex.load === 'kg' || ex.load === 'bw') && !!GROUP_OF[ex.m];
export const groupOf = (ex) => (countsInLoad(ex) ? GROUP_OF[ex.m] : null);

export const bodyKg = (state, d) => currentWeight(state.weights || [], d) || state.profile?.weightKg || 70;

// The weight that counts for one logged entry of an exercise (0 means it can't be counted)
function countedKg(ex, kg, body) {
  if (ex.load === 'bw') return body * bwShare(ex);
  return kg > 0 ? kg : 0;
}

export const entryLoad = (ex, h, body) => (countsInLoad(ex) && h?.reps?.length ? countedKg(ex, h.kg, body) * sum(h.reps) : 0);

export const weekStart = (d) => mondayOf(d);

// What you lifted in the week starting ws (Monday), or null if nothing was logged. n is how many
// exercises were logged in each group.
export function weekLoads(state, ws, program) {
  const end = addDays(ws, 6);
  const body = bodyKg(state, end);
  const out = { ws };
  let any = false;
  for (const g of LOAD_GROUPS) out[g.id] = { load: 0, n: 0, p: 0 };
  for (const [id, log] of Object.entries(state.exLog || {})) {
    const ex = exerciseById(id);
    const g = groupOf(ex);
    if (!g) continue;
    for (const h of log || []) {
      if (h.d < ws || h.d > end || !h.reps?.length) continue;
      const l = entryLoad(ex, h, body);
      if (!l) continue;
      out[g].load += l;
      out[g].n += 1;
      any = true;
    }
  }
  if (!any) return null;
  // how many loaded exercises the plan has in each group, to tell a full week from a part week
  for (const s of program?.sessions || []) {
    for (const sl of s.slots) {
      const g = groupOf(exerciseById(sl.ex));
      if (g) out[g].p += 1;
    }
  }
  for (const g of LOAD_GROUPS) {
    out[g.id].load = round(out[g.id].load, 1);
    if (!out[g.id].p) out[g.id].p = out[g.id].n;
  }
  return out;
}

// Close every finished week that hasn't been worked out yet. Returns true if anything was added.
export function closeWeeks(state, t) {
  if (!Array.isArray(state.loads)) state.loads = [];
  const cur = weekStart(t);
  let first = null;
  for (const log of Object.values(state.exLog || {})) for (const h of log || []) if (!first || h.d < first) first = h.d;
  if (!first) return false;
  const have = new Set(state.loads.map((r) => r.ws));
  let changed = false;
  let ws = weekStart(first);
  const earliest = addDays(cur, -26 * 7);
  if (ws < earliest) ws = earliest;
  for (; ws < cur; ws = addDays(ws, 7)) {
    if (have.has(ws)) continue;
    const rec = weekLoads(state, ws, state.program);
    if (!rec) continue;
    state.loads.push(rec);
    changed = true;
  }
  if (changed) state.loads.sort((a, b) => (a.ws < b.ws ? -1 : 1));
  return changed;
}

// Last week's load for a group. A week with only part of the plan logged is scaled up to a full week
// (at most double), and a week with less than half of it logged isn't used.
export function baselineFor(state, group, ws) {
  for (const r of [...(state.loads || [])].reverse()) {
    if (r.ws >= ws || !r[group]?.n) continue;
    const { load, n, p } = r[group];
    const scale = p > n ? p / n : 1;
    if (scale > 2) continue;
    return { load: load * scale, raw: load, ws: r.ws, scaled: scale > 1 };
  }
  return null;
}

// How much the load moves this week: up 2.5% most weeks, down 5% in a lighter week. Always within ±5%.
export function loadDelta(band, opts = {}) {
  let d = { fresh: MAX_CHANGE, normal: MAX_CHANGE / 2, tired: -MAX_CHANGE / 2, lighter: -MAX_CHANGE }[band] ?? MAX_CHANGE / 2;
  if (opts.lean && d > MAX_CHANGE / 2) d = MAX_CHANGE / 2; // a calorie deficit slows recovery
  if (opts.hold && d > 0) d = 0; // poor sleep or stress: no increase
  return Math.max(-MAX_CHANGE, Math.min(MAX_CHANGE, d));
}

// ---------- Planning the week ----------

const splitReps = (total, n) => Array.from({ length: n }, (_, k) => Math.floor(total / n) + (k < total % n ? 1 : 0));

// Every weight and total reps an exercise could be given this week: within 15% of what it did last time,
// so one exercise never takes the whole change
function candidates(c) {
  const out = [];
  const steps = c.fixed ? [0] : [-2, -1, 0, 1, 2];
  for (const dk of steps) {
    const kg = c.fixed ? c.w0 : round(c.w0 + dk * c.step, 2);
    if (kg <= 0) continue;
    for (let R = c.n * c.lo; R <= c.n * c.hi; R += 1) out.push({ dk, kg, R, load: kg * R });
  }
  const near = out.filter((x) => Math.abs(x.load / c.ref - 1) <= 0.15);
  return near.length ? near : out.sort((a, b) => Math.abs(a.load - c.ref) - Math.abs(b.load - c.ref)).slice(0, 5);
}

// Choose a weight and reps for each exercise of a group so the group's load lands near the target
// and always inside the 5% limits. Reps are changed first, weights only when reps can't do it.
function solve(cs, base, target, keepWeight) {
  const low = base * (1 - MAX_CHANGE);
  const high = base * (1 + MAX_CHANGE);
  const S = sum(cs.map((c) => c.ref));
  const lists = cs.map((c) => candidates(c));
  const pen = (c) => (c.dk === 0 ? 0 : 0.004 * Math.abs(c.dk) + (keepWeight && c.dk < 0 ? 0.02 : 0));
  // start: each exercise near its share of the target
  const pick = cs.map((c, i) => {
    const want = target * (c.ref / S);
    let best = null;
    let bestCost = Infinity;
    for (const cand of lists[i]) {
      const cost = Math.abs(cand.load - want) / Math.max(want, 1) + pen(cand) * 3;
      if (cost < bestCost - 1e-12) { best = cand; bestCost = cost; }
    }
    return best;
  });
  const score = (total, extra) => {
    const out = total < low ? low - total : total > high ? total - high : 0;
    return Math.abs(total - target) / base + 1000 * out / base + extra;
  };
  const cost = () => score(sum(pick.map((p) => p?.load || 0)), sum(pick.map((p) => (p ? pen(p) : 0))));
  // then adjust one exercise at a time while the whole group gets closer to the target
  for (let pass = 0; pass < 30; pass += 1) {
    let moved = false;
    for (let i = 0; i < cs.length; i += 1) {
      if (!pick[i]) continue;
      const keep = pick[i];
      let bestCand = keep;
      let bestCost = cost();
      for (const cand of lists[i]) {
        if (cand === keep) continue;
        pick[i] = cand;
        const c = cost();
        if (c < bestCost - 1e-9) { bestCand = cand; bestCost = c; }
      }
      pick[i] = bestCand;
      if (bestCand !== keep) moved = true;
    }
    if (!moved) break;
  }
  return pick;
}

// A week's plan for the three groups. sessions: this week's sessions (with swaps applied), in order.
// ctx: { settings (from week.js), rangeOf(ex) -> [lo, hi], t (today) }
// Returns { groups, rx } where rx maps `${sessionId}:${slotIndex}` to the weight, reps and load for that exercise.
export function planWeek(state, sessions, ctx) {
  const t = ctx.t;
  const ws = weekStart(t);
  const body = bodyKg(state, t);
  const w = ctx.settings;
  const delta = loadDelta(w.band, { lean: state.profile?.goal === 'lean', hold: w.hold });
  const rx = new Map();
  const groups = {};
  const items = { legs: [], push: [], pull: [] };

  for (const s of sessions) {
    s.slots.forEach((sl, idx) => {
      const ex = exerciseById(sl.ex);
      const g = groupOf(ex);
      if (!g || sl.cardio) return;
      const hist = (state.exLog?.[ex.id] || []).filter((h) => h.d < ws && h.reps?.length);
      const last = hist[hist.length - 1];
      if (!last) return;
      const kg0 = countedKg(ex, last.kg, body);
      if (!kg0) return;
      const [lo, hi] = ctx.rangeOf(ex);
      const r0 = sum(last.reps) / last.reps.length;
      const n = sl.sets;
      items[g].push({
        key: `${s.id}:${idx}`, ex, g, n, lo, hi, w0: kg0, fixed: ex.load === 'bw', step: ex.step || 2.5,
        last: { kg: last.kg, reps: last.reps, load: kg0 * sum(last.reps), d: last.d, recent: last.d >= addDays(ws, -7) },
        ref: kg0 * r0 * n, r0,
      });
    });
  }

  for (const gr of LOAD_GROUPS) {
    const cs = items[gr.id];
    const info = { id: gr.id, name: gr.name, delta, base: null, target: null, planned: null, pct: null, scaled: false, rebased: false, slots: cs.length, done: 0 };
    groups[gr.id] = info;
    const b = baselineFor(state, gr.id, ws);
    if (!b || !cs.length) continue;
    const S = sum(cs.map((c) => c.ref));
    let base = b.load;
    // if the plan has changed so much that last week's load no longer matches what you would repeat,
    // start from the last session of each exercise instead
    if (Math.abs(S / base - 1) > 0.1) { base = S; info.rebased = true; }
    info.scaled = b.scaled;
    info.baseWeek = b.ws;
    info.base = round(base, 0);
    info.target = round(base * (1 + delta), 0);
    const pick = solve(cs, base, base * (1 + delta), state.profile?.goal === 'lean');
    let total = 0;
    cs.forEach((c, i) => {
      const p = pick[i];
      if (!p) return;
      total += p.load;
      const reps = splitReps(p.R, c.n);
      rx.set(c.key, { ex: c.ex.id, kg: c.fixed ? null : p.kg, reps, total: p.R, load: round(p.load, 1), last: c.last, up: p.kg > c.w0 + 1e-9 && !c.fixed, down: p.kg < c.w0 - 1e-9 && !c.fixed, g: gr.id, lo: c.lo, hi: c.hi });
    });
    info.planned = round(total, 0);
    info.pct = base ? round((total / base - 1) * 100, 1) : 0;
  }
  return { groups, rx, delta, ws };
}

// The week so far, for the three groups
export function weekSoFar(state, t) {
  const rec = weekLoads(state, weekStart(t), null);
  return Object.fromEntries(LOAD_GROUPS.map((g) => [g.id, rec ? rec[g.id].load : 0]));
}

// Plain-words line for one exercise's numbers. fmtW formats a weight in the person's unit.
export function rxText(rx, fmtW) {
  const reps = rx.reps.join(', ');
  const last = rx.last;
  const lastR = sum(last.reps);
  const when = last.recent ? 'last week' : 'last time';
  const was = rx.kg === null ? '' : ` ${when[0].toUpperCase()}${when.slice(1)} ${fmtW(last.kg)}.`;
  if (rx.kg === null) {
    if (rx.total > lastR) return `Aim for ${reps} reps, ${rx.total - lastR === 1 ? '1 rep' : `${rx.total - lastR} reps`} more than ${when} in all.`;
    if (rx.total < lastR) return `Aim for ${reps} reps, ${lastR - rx.total === 1 ? '1 rep' : `${lastR - rx.total} reps`} fewer than ${when} in all.`;
    return `Repeat ${when}: ${reps} reps.`;
  }
  if (rx.up) return `Go up to ${fmtW(rx.kg)} and aim for ${reps} reps.${was}`;
  if (rx.down) return `Drop to ${fmtW(rx.kg)} and aim for ${reps} reps.${was}`;
  if (rx.total > lastR) return `Stay at ${fmtW(rx.kg)} and aim for ${reps} reps, ${rx.total - lastR === 1 ? '1 rep' : `${rx.total - lastR} reps`} more than ${when} in all.`;
  if (rx.total < lastR) return `Stay at ${fmtW(rx.kg)} and aim for ${reps} reps, ${lastR - rx.total === 1 ? '1 rep' : `${lastR - rx.total} reps`} fewer than ${when} in all.`;
  return `Repeat ${when}: ${fmtW(rx.kg)} for ${reps} reps.`;
}
