// Finding exercises by the names people actually use: "bench press", "RDL", "tricep pushdown", "pull ups".
import { MUSCLES, allExercises } from './data/exercises.js';
import { GUIDES } from './data/guides.js';

const SYN = {
  db: 'dumbbell', dbs: 'dumbbell', bb: 'barbell', kb: 'kettlebell', triceps: 'tricep', biceps: 'bicep', delts: 'delt',
  pushup: 'push up', pushups: 'push up', pullup: 'pull up', pullups: 'pull up', chinup: 'chin up', chinups: 'chin up',
  situp: 'sit up', situps: 'sit up', pressup: 'push up', pressups: 'push up', abs: 'ab', quad: 'quads', ham: 'hamstring', hams: 'hamstring', glute: 'glutes',
  pecs: 'pec', calves: 'calf',
};

const singular = (w) => (w.length > 2 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

export function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .flatMap((w) => (SYN[w] || w).split(' '))
    .map(singular);
}

// Words that name a muscle, as tokens() writes them
const musclesByWord = new Map([
  ...MUSCLES.flatMap((m) => tokens(m.name).concat(tokens(m.id)).map((w) => [w, m.id])),
  ['pec', 'chest'], ['delt', 'shoulders'], ['calf', 'calves'], ['ab', 'abs'], ['cardio', 'cardio'], ['conditioning', 'cardio'],
]);

function scoreName(q, name) {
  const n = tokens(name);
  if (!n.length) return 0;
  const qs = q.join(' ');
  const ns = n.join(' ');
  if (qs === ns) return 100;
  if (ns.startsWith(qs)) return 85;
  const hit = q.filter((w) => n.some((x) => x.startsWith(w) || (w.length > 4 && x.startsWith(w.slice(0, -1)))));
  if (hit.length === q.length) return 60 + Math.min(q.length, 5) * 2 - Math.max(0, n.length - q.length);
  if (!hit.length) return 0;
  return Math.round((hit.length / q.length) * 40);
}

// The exercise's own name counts a little more than its nicknames
const bestName = (q, names) => names.reduce((best, n, i) => Math.max(best, scoreName(q, n) - (i ? 1 : 0)), 0);

export function searchExercises(query, { limit = 8 } = {}) {
  const q = tokens(query);
  if (!q.length) return [];
  // "chest" lists chest exercises; "shoulder press" prefers shoulder exercises with "press" in the name
  const muscle = musclesByWord.get(q.join(' ')) || (q.length <= 3 ? q.map((w) => musclesByWord.get(w)).find(Boolean) : null);
  const rest = muscle ? q.filter((w) => musclesByWord.get(w) !== muscle) : q;
  const scored = [];
  for (const ex of allExercises()) {
    const names = [ex.name, ...(GUIDES[ex.id]?.aka || [])];
    let best = bestName(q, names);
    if (muscle && ex.m === muscle) {
      if (!rest.length) best = Math.max(best, 90);
      else {
        const r = bestName(rest, names);
        if (r >= 60) best = Math.max(best, 80);
        else if (r >= 30) best = Math.max(best, 65);
      }
    }
    if (best >= 20) scored.push({ ex, score: best + (ex.auto === false ? 0 : 1) });
  }
  scored.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name));
  // close matches only; partial ones are shown when nothing is close
  const strong = scored.filter((x) => x.score >= 30);
  return (strong.length ? strong : scored).slice(0, limit).map((x) => x.ex);
}

// True when the query is this exercise's name or one of its nicknames
export function namesMatch(query, ex) {
  const q = tokens(query).join(' ');
  return !!q && [ex.name, ...(GUIDES[ex.id]?.aka || [])].some((n) => tokens(n).join(' ') === q);
}
