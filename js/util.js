// Small helpers shared by every module. No DOM access here, so the maths can be tested in Node.

export const round = (n, dp = 0) => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const roundTo = (n, step) => Math.round(n / step) * step;

export const sum = (arr) => arr.reduce((a, b) => a + b, 0);

export const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// Escape text before it goes into innerHTML.
export const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ---- Dates: stored as local 'YYYY-MM-DD' strings ----

const pad = (n) => String(n).padStart(2, '0');

export const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISO = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const daysBetween = (a, b) => {
  // whole days from a to b (b - a), ignoring clock changes
  const [ya, ma, da] = String(a).split('-').map(Number);
  const [yb, mb, db] = String(b).split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
};

export const addDays = (s, n) => {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};

// Monday-based weekday index, 0 = Monday
export const weekdayIndex = (s) => (parseISO(s).getDay() + 6) % 7;

export const mondayOf = (s) => addDays(s, -weekdayIndex(s));

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const dayShort = (i) => DAY_SHORT[i];
export const dayLong = (i) => DAY_LONG[i];

export const fmtDate = (s, style = 'short') => {
  const d = parseISO(s);
  const wd = weekdayIndex(s);
  if (style === 'long') return `${DAY_LONG[wd]} ${d.getDate()} ${MONTH_LONG[d.getMonth()]}`;
  if (style === 'day') return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  if (style === 'full') return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  return `${DAY_SHORT[wd]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
};

export const relDays = (from, to) => {
  const n = daysBetween(from, to);
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n === -1) return 'tomorrow';
  if (n > 1 && n < 14) return `${n} days ago`;
  if (n >= 14 && n < 60) return `${Math.round(n / 7)} weeks ago`;
  if (n >= 60) return `${Math.round(n / 30)} months ago`;
  return `in ${-n} days`;
};

// ---- Seeded random numbers, so a meal week stays the same until you reshuffle ----

export const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const shuffled = (arr, rand) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Lower-case the first letter of a name for use mid-sentence, keeping words like Greek or EZ intact
// 'Barbell row' becomes 'barbell row' mid-sentence, but names of places and people keep their capital
const PROPER = /^(Romanian|Bulgarian|Nordic|Smith|Arnold|Zottman|Pallof|Copenhagen|Russian|Turkish|Greek|Mum’s|Mum's)\b/;
export const lcFirst = (s) => (s && s.length > 1 && s[1] === s[1].toLowerCase() && !PROPER.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const fmtInt = (n) => Math.round(n).toLocaleString('en-GB');

// 'a', 'a and b', 'a, b and c'
export const andList = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0] || '');
