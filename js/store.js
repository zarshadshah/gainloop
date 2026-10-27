// State and saving. Everything lives in this browser's storage; backups are plain JSON.
import { addDays, isoDate, uid } from './util.js';
import { blankHealth, normHealth } from './health.js';

export const APP_VERSION = '1.5.0';
const KEY = 'gainloop.v1';

export const blankState = () => ({
  v: 1,
  profile: null,
  demo: false,
  startedOn: null,
  units: { len: 'cm', body: 'kg', lift: 'kg' },
  theme: 'auto',
  weights: [],
  measures: [],
  frame: null,
  bfOverride: null,
  aimPct: 90,
  pins: [],
  swaps: {},
  nutrition: null,
  program: null,
  exLog: {},
  loads: [],
  parq: null,
  baseline: null,
  sessionsDone: [],
  drafts: {},
  mealWeek: null,
  customMeals: [],
  myExercises: [],
  customExercises: [],
  pantry: { have: [], text: '', ai: null },
  foodLog: {},
  adjust: [],
  wellness: [],
  healthAck: '',
  changes: [],
  checkins: [],
  shopTicks: {},
  installDismissed: false,
});

let storageOK = true;

export function storageAvailable() {
  try {
    const k = '__gainloop_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function loadState() {
  storageOK = storageAvailable();
  if (!storageOK) return blankState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blankState();
    return migrate(JSON.parse(raw));
  } catch {
    return blankState();
  }
}

// Exercises that were replaced: saved lists point at the new ones
const RENAMED = { 'prone-y': 'superman', 'towel-wring': 'wrist-roller' };
const renameEx = (id) => RENAMED[id] || id;

export function migrate(s) {
  const base = blankState();
  const out = { ...base, ...s };
  out.units = { ...base.units, ...(s.units || {}) };
  for (const k of ['weights', 'measures', 'pins', 'sessionsDone', 'customMeals', 'changes', 'checkins', 'myExercises', 'customExercises', 'adjust', 'wellness', 'loads']) if (!Array.isArray(out[k])) out[k] = [];
  out.wellness = out.wellness.filter((e) => e && typeof e.d === 'string' && e.a && typeof e.a === 'object');
  for (const k of ['swaps', 'exLog', 'drafts', 'shopTicks', 'foodLog']) if (!out[k] || typeof out[k] !== 'object' || Array.isArray(out[k])) out[k] = {};
  if (!out.pantry || !Array.isArray(out.pantry.have)) out.pantry = { have: [] };
  out.pantry = { have: out.pantry.have, text: typeof out.pantry.text === 'string' ? out.pantry.text.slice(0, 600) : '', ai: out.pantry.ai && typeof out.pantry.ai === 'object' ? out.pantry.ai : null };
  out.myExercises = [...new Set(out.myExercises.map(renameEx))];
  out.swaps = Object.fromEntries(Object.entries(out.swaps).map(([k, v]) => [renameEx(k), renameEx(v)]));
  for (const k of ['parq', 'baseline']) if (!out[k] || typeof out[k] !== 'object' || Array.isArray(out[k])) out[k] = null;
  if (out.profile) out.profile = { ...out.profile, health: normHealth(out.profile.health) };
  return out;
}

let timer = null;
export function saveState(state, immediate = false) {
  if (!storageOK) return false;
  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      storageOK = false;
    }
  };
  clearTimeout(timer);
  if (immediate) write();
  else timer = setTimeout(write, 150);
  return true;
}

export const isStorageOK = () => storageOK;

export function clearSaved() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

export function exportText(state) {
  return JSON.stringify({ app: 'gainloop', version: APP_VERSION, exportedAt: new Date().toISOString(), state }, null, 1);
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(String(text).trim());
  } catch {
    throw new Error('That isn’t a Gainloop backup. Paste the whole text, starting with { and ending with }.');
  }
  const s = data?.state;
  if (data?.app !== 'gainloop' || !s || typeof s !== 'object') throw new Error('That file isn’t a Gainloop backup.');
  if (!s.profile) throw new Error('That backup has no profile in it, so there is nothing to restore.');
  return migrate(s);
}

// ---------- Example data ----------
// A believable 8-week history so every screen has something to show.

export function demoState(today = isoDate()) {
  const s = blankState();
  const start = addDays(today, -56);
  s.demo = true;
  s.startedOn = start;
  s.profile = {
    name: 'Sam',
    sex: 'male',
    age: 21,
    ageSetOn: start,
    heightCm: 178,
    experience: 'beginner',
    goal: 'build',
    days: 4,
    minutes: 60,
    equipment: 'gym',
    pullupBar: false,
    activity: 'medium',
    diet: { style: 'any', halal: true, avoid: ['nuts'], dislikes: 'mushrooms' },
    health: blankHealth(),
  };
  s.myExercises = ['bench', 'lat-pulldown', 'squat'];
  s.pantry = { have: ['chicken', 'eggs', 'rice', 'oats', 'milk', 'banana', 'broccoli', 'peppers', 'greek-yog', 'bread'] };
  s.frame = { wrist: 17.2, ankle: 22.5, d: start };

  s.measures = [
    { id: uid('m'), d: start, cm: { neck: 37.0, chest: 95.5, arm: 33.4, forearm: 28.2, waist: 79.0, thigh: 54.0, calf: 36.0 } },
    { id: uid('m'), d: addDays(start, 28), cm: { neck: 37.2, chest: 95.8, arm: 33.9, forearm: 28.5, waist: 79.5, thigh: 54.7, calf: 36.2 } },
    { id: uid('m'), d: addDays(today, -2), cm: { neck: 37.4, chest: 96.8, arm: 34.3, forearm: 28.8, waist: 80.0, thigh: 55.5, calf: 36.4 } },
  ];

  // A few logged lifts so the progression advice has history
  const lifts = {
    bench: [50, [10, 9, 8]], 'db-bench': [20, [12, 11, 10]], 'lat-pulldown': [45, [12, 12, 12]], 'cable-row': [45, [11, 10, 10]],
    squat: [60, [10, 10, 10]], rdl: [60, [10, 9, 9]], 'leg-press': [100, [12, 11, 10]], 'leg-curl': [35, [14, 13, 12]],
    'db-press': [16, [10, 9, 9]], 'lateral-raise': [8, [15, 14, 13]], 'ez-curl': [25, [12, 12, 12]], pushdown: [25, [15, 15, 15]],
    'incline-db': [18, [11, 10, 9]], 'pull-up': [0, [6, 5, 5]], 'standing-calf': [60, [12, 12, 11]], 'cable-crunch': [30, [15, 14, 14]],
  };
  for (const [id, [kg, reps]] of Object.entries(lifts)) {
    s.exLog[id] = [
      { d: addDays(today, -10), kg: Math.max(0, kg - 2.5), reps: reps.map((r) => Math.max(1, r - 1)) },
      { d: addDays(today, -3), kg, reps },
    ];
  }
  s.sessionsDone = [
    { d: addDays(today, -7), sid: 'A' }, { d: addDays(today, -6), sid: 'B' }, { d: addDays(today, -4), sid: 'C' },
    { d: addDays(today, -3), sid: 'D' }, { d: addDays(today, -1), sid: 'A' },
  ];
  s.customMeals = [{ id: 'c-demo', custom: true, name: 'Mum’s chicken biryani', slot: 'dinner', kcal: 720, p: 42, c: 85, f: 22, flags: ['meat', 'chicken', 'dairy'] }];
  return s;
}
