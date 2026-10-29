// The week's training load. Every fourth week is a lighter one (load down about 5%) so you stay on top of
// your training; the other weeks go up about 2.5%. Sets stay the same: the reps change first, and the weights
// only when the reps can't (see load.js). Each set ends with a few good reps still in the tank. No DOM here.
//
// Planned lighter weeks follow the Delphi consensus of Bell and colleagues (2023): less load, further from
// the limit, familiar lifts kept. Nothing here asks how you feel, and nothing is scored.
import { isCardio, exerciseById } from './data/exercises.js';
import { MAX_CHANGE, loadDelta, weekStart } from './load.js';
import { daysBetween, round } from './util.js';

export const CYCLE_WEEKS = 4; // every 4th week of training is a lighter one

// Which week of training this is, counting from the first week you logged a set (1 when you haven't yet)
export function weekNumber(state, t) {
  let first = null;
  for (const log of Object.values(state.exLog || {})) for (const h of log || []) if (h.reps?.length && (!first || h.d < first)) first = h.d;
  if (!first || first > t) return 1;
  return Math.floor(daysBetween(weekStart(first), weekStart(t)) / 7) + 1;
}

// health rules give 'how many reps to leave' as text: '2 to 3', '3'
const healthRir = (s) => {
  const n = String(s || '').match(/\d+/g)?.map(Number) || [];
  return n.length ? [n[0], n[n.length - 1]] : [0, 0];
};
const leaveText = ([lo, hi]) => (lo === hi ? `${lo}` : `${lo} or ${hi}`);

// profile: goal and experience; rules: your health rules
export function weekSettings(state, t, profile, rules) {
  const n = weekNumber(state, t);
  const deload = n % CYCLE_WEEKS === 0;
  const lean = profile?.goal === 'lean';
  const band = deload ? 'lighter' : 'normal'; // the names load.js uses for -5% and +2.5%
  const delta = loadDelta(band, { lean });
  let rir = deload ? [3, 4] : [2, 3];
  const h = healthRir(rules?.stopShort);
  rir = [Math.max(rir[0], h[0]), Math.max(rir[1], h[1])];
  return {
    band, week: n, deload, lean, hold: false, delta,
    mode: delta > 0 ? 'progress' : delta < 0 ? 'deload' : 'hold',
    rir, stop: leaveText(rir),
    cardioEasy: deload,
  };
}

const pctText = (d) => `${round(Math.abs(d) * 100, 1)}%`;

// The week's changes in plain words, for the Train tab
export function weekSummary(w, profile) {
  const out = [];
  if (w.mode === 'progress') out.push(`Your load goes up by about ${pctText(w.delta)} on last week’s, for legs, push and pull. It never moves more than ${pctText(MAX_CHANGE)} either way.`);
  if (w.mode === 'deload') out.push(`This is a lighter week: your load comes down by about ${pctText(w.delta)} from last week’s, for legs, push and pull. Every ${CYCLE_WEEKS}th week is a lighter one, so you stay fresh for the weeks that follow.`);
  out.push('Every session keeps its 6 exercises and the same number of sets. The reps change first, and the weights only when the reps can’t.');
  out.push(`Finish each set with ${w.stop} good reps still in the tank. You should feel you’ve worked, not that you’re spent.`);
  if (w.deload && w.lean) out.push('Leaning out, the weights stay where they can and the reps come down: heavy weights help you keep your muscle.');
  if (w.cardioEasy) out.push('Cardio at an easy pace.');
  return out;
}

// This week's version of each session: the same exercises and sets, with cardio easy in a lighter week
export function adjustWeek(program, w) {
  const out = new Map();
  for (const s of program?.sessions || []) {
    const slots = s.slots.map((sl, i) => {
      const o = { ...sl, i, planned: sl };
      return (sl.cardio || isCardio(exerciseById(sl.ex))) && w.cardioEasy ? { ...o, effort: 'easy' } : o;
    });
    out.set(s.id, { ...s, slots });
  }
  return out;
}
