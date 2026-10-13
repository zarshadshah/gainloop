// Meal planning: diet rules are hard filters, portions scale to your calories, and protein is checked.
import { INGREDIENTS, MEALS, AVOID_OPTIONS } from './data/foods.js';
import { clamp, lcFirst, rng, round, roundTo } from './util.js';

export const FLAG_WORDS = {
  fish: ['fish'],
  dairy: ['dairy'],
  egg: ['egg', 'eggs'],
  nuts: ['nut', 'nuts', 'peanut', 'peanuts'],
  gluten: ['gluten', 'wheat'],
  soy: ['soy', 'soya'],
  sesame: ['sesame'],
};

const isCustom = (meal) => !!meal.custom;

export function mealFlags(meal) {
  const flags = new Set();
  if (isCustom(meal)) {
    for (const f of meal.flags || []) flags.add(f);
    return flags;
  }
  for (const [id] of meal.items) addIngredientFlags(flags, INGREDIENTS[id]);
  for (const id of meal.pantry || []) addIngredientFlags(flags, INGREDIENTS[id]);
  return flags;
}

function addIngredientFlags(flags, ing) {
  if (!ing) return;
  if (ing.meat) { flags.add('meat'); flags.add(ing.meat); }
  for (const f of ['fish', 'dairy', 'egg', 'gluten', 'nuts', 'soy', 'sesame', 'honey', 'pork', 'alcohol', 'sugar', 'shake']) if (ing[f]) flags.add(f);
}

export function mealMacros(meal) {
  if (isCustom(meal)) return { kcal: meal.kcal, p: meal.p, c: meal.c, f: meal.f };
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const [id, g] of meal.items) {
    const ing = INGREDIENTS[id];
    for (const k of Object.keys(t)) t[k] += (ing[k] * g) / 100;
  }
  return t;
}

const singular = (w) => (w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.endsWith('oes') ? w.slice(0, -2) : w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

export const parseDislikes = (text) =>
  String(text || '')
    .split(/[,;\n]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 1);

// Returns the reasons a meal breaks your rules. Empty means it's allowed.
export function ruleBreaks(meal, diet) {
  const flags = mealFlags(meal);
  const reasons = [];
  if (diet.style === 'vegetarian' && (flags.has('meat') || flags.has('fish'))) reasons.push('not vegetarian');
  if (diet.style === 'vegan' && ['meat', 'fish', 'dairy', 'egg', 'honey'].some((f) => flags.has(f))) reasons.push('not vegan');
  if (diet.halal && (flags.has('pork') || flags.has('alcohol'))) reasons.push('not halal');
  for (const a of diet.avoid || []) {
    if (flags.has(a)) reasons.push(`contains ${(AVOID_OPTIONS.find((o) => o.id === a)?.name || a).toLowerCase()}`);
  }
  const names = isCustom(meal)
    ? [meal.name.toLowerCase()]
    : [meal.name.toLowerCase(), ...meal.items.map(([id]) => INGREDIENTS[id].name.toLowerCase()), ...(meal.pantry || []).map((id) => INGREDIENTS[id].name.toLowerCase())];
  for (const word of parseDislikes(diet.dislikes)) {
    const s = singular(word);
    const flagHit = Object.entries(FLAG_WORDS).find(([, words]) => words.includes(word));
    const meatHit = ['meat', 'chicken', 'beef', 'lamb', 'pork'].includes(s) && flags.has(s);
    const textHit = names.some((n) => n.includes(word) || n.includes(s));
    if (textHit || meatHit || (flagHit && flags.has(flagHit[0]))) reasons.push(`contains “${word}”`);
  }
  return [...new Set(reasons)];
}

// Grams of ingredients carrying a flag (for the 'cut back' health rules)
function flagGrams(meal, flag) {
  if (isCustom(meal)) return 0;
  return meal.items.reduce((n, [id, g]) => n + (INGREDIENTS[id]?.[flag] ? g : 0), 0);
}

// Health rules: hard ones always apply; 'cut back' ones (salt, saturated fat) only while each meal slot keeps 3 options
export function healthBreaks(meal, rules) {
  if (!rules) return { hard: [], soft: [] };
  const flags = mealFlags(meal);
  const hard = [];
  const soft = [];
  if (rules.noSugar && flags.has('sugar')) hard.push('has added sugar');
  if (rules.noShakes && flags.has('shake')) hard.push('protein shake');
  if (rules.lowSalt && flagGrams(meal, 'salty') >= 30) soft.push('salty cheese');
  if (rules.lowSatFat && flagGrams(meal, 'satfat') >= 40) soft.push('high in saturated fat');
  return { hard, soft };
}

export function filterMeals(diet, customMeals = [], rules = null) {
  const allowed = [];
  const hidden = [];
  const softOut = [];
  for (const meal of [...MEALS, ...customMeals]) {
    const reasons = ruleBreaks(meal, diet);
    const hb = healthBreaks(meal, rules);
    if (reasons.length || hb.hard.length) hidden.push({ meal, reasons: [...reasons, ...hb.hard] });
    else if (hb.soft.length) softOut.push({ meal, reasons: hb.soft });
    else allowed.push(meal);
  }
  // put 'cut back' meals back if a slot would otherwise run short
  for (const x of softOut) {
    const left = allowed.filter((m) => m.slot === x.meal.slot).length;
    if (left < 3) allowed.push(x.meal);
    else hidden.push(x);
  }
  return { allowed, hidden };
}

export const carbShare = (meal) => {
  const m = mealMacros(meal);
  return m.kcal ? (m.c * 4) / m.kcal : 0;
};

export const needsHalalNote = (meal, diet) => diet.halal && mealFlags(meal).has('meat');

// ---- Planning a week ----

const SLOT_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

function pick(list, rand, counts, avoid) {
  const fresh = list.filter((m) => !avoid.has(m.id));
  const pool = fresh.length ? fresh : list;
  const minUse = Math.min(...pool.map((m) => counts.get(m.id) || 0));
  const least = pool.filter((m) => (counts.get(m.id) || 0) === minUse);
  return least[Math.floor(rand() * least.length)];
}

export function dayTotals(day, byId) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const e of day.meals) {
    const meal = byId.get(e.id);
    if (!meal) continue;
    const m = mealMacros(meal);
    for (const k of Object.keys(t)) t[k] += m[k] * day.x;
  }
  return t;
}

export function rescaleDay(day, targets, byId) {
  const base = dayTotals({ ...day, x: 1 }, byId);
  if (!base.kcal) return { ...day, x: 1 };
  const x = round(clamp(targets.kcal / base.kcal, 0.6, 1.8) / 0.05) * 0.05;
  return { ...day, x: round(x, 2) };
}

const proteinDensity = (meal) => {
  const m = mealMacros(meal);
  return m.kcal ? m.p / m.kcal : 0;
};

function planDay(bySlot, targets, rand, counts, prevIds, byId, opts = {}) {
  const meals = [];
  const today = new Set();
  for (const slot of ['breakfast', 'lunch', 'dinner']) {
    let list = bySlot[slot] || [];
    if (!list.length) continue;
    // carb-aware (diabetes): lean toward meals where carbs are no more than half the calories
    if (opts.carbAware) {
      const lower = list.filter((m) => carbShare(m) <= 0.5);
      if (lower.length >= 2) list = lower;
    }
    const m = pick(list, rand, counts, new Set([...prevIds, ...today]));
    meals.push({ slot, id: m.id });
    today.add(m.id);
  }
  const snacks = bySlot.snack || [];
  let day = { meals, x: 1 };
  let t = dayTotals(day, byId);
  while (snacks.length && meals.filter((m) => m.slot === 'snack').length < 3 && t.kcal < targets.kcal * 0.85) {
    const ratio = t.p / Math.max(t.kcal, 1);
    const want = targets.protein / targets.kcal;
    let pool = snacks;
    const half = Math.max(2, Math.ceil(snacks.length / 2));
    if (ratio < want) pool = [...snacks].sort((a, b) => proteinDensity(b) - proteinDensity(a)).slice(0, half);
    else if (ratio > want * 1.4) pool = [...snacks].sort((a, b) => proteinDensity(a) - proteinDensity(b)).slice(0, half);
    const s = pick(pool, rand, counts, today);
    meals.push({ slot: 'snack', id: s.id });
    today.add(s.id);
    day = { meals, x: 1 };
    t = dayTotals(day, byId);
  }
  day = rescaleDay({ meals, x: 1 }, targets, byId);

  // protein check: swap the weakest snack for a higher-protein one, up to three times
  for (let tries = 0; tries < 3; tries += 1) {
    t = dayTotals(day, byId);
    if (t.p >= targets.protein * 0.92) break;
    const snackIdx = day.meals
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.slot === 'snack')
      .sort((a, b) => proteinDensity(byId.get(a.e.id)) - proteinDensity(byId.get(b.e.id)))[0];
    const better = [...snacks]
      .filter((s) => !day.meals.some((e) => e.id === s.id))
      .sort((a, b) => proteinDensity(b) - proteinDensity(a))[0];
    if (!better) break;
    if (snackIdx && proteinDensity(better) > proteinDensity(byId.get(snackIdx.e.id))) {
      day.meals[snackIdx.i] = { slot: 'snack', id: better.id };
    } else if (day.meals.filter((e) => e.slot === 'snack').length < 3) {
      day.meals.push({ slot: 'snack', id: better.id });
    } else break;
    day = rescaleDay(day, targets, byId);
  }
  for (const e of day.meals) counts.set(e.id, (counts.get(e.id) || 0) + 1);
  day.meals.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  return day;
}

export function planWeek(allowed, targets, seed, start, opts = {}) {
  const rand = rng(seed);
  const byId = new Map(allowed.map((m) => [m.id, m]));
  const bySlot = {};
  for (const m of allowed) (bySlot[m.slot] ||= []).push(m);
  const counts = new Map();
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const prev = days[i - 1] ? new Set(days[i - 1].meals.filter((e) => e.slot !== 'snack').map((e) => e.id)) : new Set();
    days.push(planDay(bySlot, targets, rand, counts, prev, byId, opts));
  }
  return { seed, start, days };
}

export function swapOptions(day, slotIndex, allowed, targets) {
  const current = day.meals[slotIndex];
  return allowed
    .filter((m) => m.slot === current.slot && m.id !== current.id)
    .map((m) => ({ meal: m, macros: mealMacros(m) }))
    .sort((a, b) => b.macros.p / b.macros.kcal - a.macros.p / a.macros.kcal);
}

export function applySwap(day, slotIndex, newId, targets, byId) {
  const meals = day.meals.map((e, i) => (i === slotIndex ? { ...e, id: newId } : e));
  return rescaleDay({ ...day, meals }, targets, byId);
}

// ---- Showing amounts ----

const FRACTIONS = { 0.5: '½', 0.25: '¼', 0.75: '¾' };

export function amountText(ingId, grams) {
  const ing = INGREDIENTS[ingId];
  if (ing.pantry) return ing.name;
  const u = ing.unit;
  if (u?.count) {
    const step = u.one === 'banana' || u.one === 'scoop' ? 0.5 : 1;
    const n = Math.max(step, roundTo(grams / u.g, step));
    const whole = Math.floor(n);
    const frac = round(n - whole, 2);
    const num = frac ? `${whole || ''}${FRACTIONS[frac] || ''}` : String(whole);
    return `${num}\u00a0${n > 1 ? u.many : u.one}${u.of ? ` of ${u.of}` : ''}`;
  }
  // a no-break space keeps '120 g' together on one line
  const g = roundTo(grams, grams < 30 ? 1 : 5);
  return `${g}\u00a0${ing.ml ? 'ml' : 'g'} ${lcFirst(ing.name)}`;
}

export function mealLines(meal, x) {
  if (isCustom(meal)) return [];
  return [
    ...meal.items.map(([id, g]) => amountText(id, g * x)),
  ];
}

export const pantryLine = (meal) => (meal.pantry || []).map((id) => lcFirst(INGREDIENTS[id].name));

// ---- Shopping list for a week ----

export function shoppingList(week, byId) {
  const totals = new Map();
  const pantry = new Set();
  const custom = new Map();
  for (const day of week.days) {
    for (const e of day.meals) {
      const meal = byId.get(e.id);
      if (!meal) continue;
      if (isCustom(meal)) {
        custom.set(meal.name, (custom.get(meal.name) || 0) + day.x);
        continue;
      }
      for (const [id, g] of meal.items) totals.set(id, (totals.get(id) || 0) + g * day.x);
      for (const id of meal.pantry || []) pantry.add(id);
    }
  }
  const groups = new Map();
  for (const [id, g] of totals) {
    const ing = INGREDIENTS[id];
    let text;
    if (ing.unit) {
      const n = Math.max(1, Math.ceil(g / ing.unit.g - 0.15));
      text = ing.unit.list ? `${n} ${n > 1 ? ing.unit.many : ing.unit.one}` : String(n);
    } else if (g >= 1000) {
      text = `${round(Math.ceil(g / 100) / 10, 1)} ${ing.ml ? 'litres' : 'kg'}`;
    } else {
      text = `${Math.ceil(g / 50) * 50} ${ing.ml ? 'ml' : 'g'}`;
    }
    if (!groups.has(ing.shop)) groups.set(ing.shop, []);
    groups.get(ing.shop).push({ id, name: ing.name, amount: text });
  }
  for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return {
    groups,
    pantry: [...pantry].map((id) => INGREDIENTS[id].name).sort(),
    custom: [...custom].map(([name, portions]) => ({ name, portions: round(portions, 1) })),
  };
}
