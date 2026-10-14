// Talking to Gainloop's AI helper (functions/api/ai.js, on Cloudflare Workers AI), and checking what it sends
// back before anything reaches the screen: totals are added up again here, meals are checked against your food
// rules, and anything made with food you didn't list is kept apart. Only what each task needs is sent.
import { AVOID_OPTIONS } from './data/foods.js';
import { parseDislikes } from './meals.js';
import { SLOT_SHARE, roundMacros, zero } from './track.js';
import { clamp, roundTo } from './util.js';

export const AI_PATH = 'api/ai';

export class AIError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind;
  }
}

export async function callAI(payload, { timeout = 75000 } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AIError('You’re offline. The AI needs a connection.', 'offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(AI_PATH, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal });
  } catch (err) {
    throw new AIError(err?.name === 'AbortError' ? 'The AI took too long to answer. Try again.' : 'Couldn’t reach the AI. Check your connection and try again.', 'network');
  } finally {
    clearTimeout(timer);
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.status === 404 || (!body && !res.ok)) throw new AIError('The AI helper works on gainloop.pages.dev. Open Gainloop there to use it.', 'missing');
  if (!res.ok) throw new AIError(body?.error || 'The AI couldn’t answer just now. Try again in a minute.', res.status === 429 ? 'limit' : 'error');
  return body || {};
}

// ---------- What gets sent ----------

// Food rules and health rules as plain instructions. Health conditions themselves aren't sent, only what
// they change about food.
export function aiRules(diet, r) {
  const avoid = (diet.avoid || []).map((a) => AVOID_OPTIONS.find((o) => o.id === a)?.name.toLowerCase() || a);
  return {
    style: diet.style || 'any',
    halal: !!diet.halal,
    avoid,
    dislikes: diet.dislikes || '',
    glutenFree: (diet.avoid || []).includes('gluten') || !!r?.gluten,
    carbCapPct: r?.carbCap ? Math.round(r.carbCap * 100) : null,
    noAddedSugar: !!r?.noSugar,
    lowSalt: !!r?.lowSalt,
    lowSatFat: !!r?.lowSatFat,
    noShakes: !!r?.noShakes,
    moderateProtein: !!r?.standardProtein,
  };
}

// A day's targets split into meals the usual way
export function slotTargets(day) {
  const out = {};
  for (const [slot, share] of Object.entries(SLOT_SHARE)) {
    out[slot] = { kcal: roundTo(day.kcal * share, 10), p: Math.round(day.protein * share), c: Math.round(day.carbs * share), f: Math.round(day.fat * share) };
  }
  return out;
}

// ---------- Reading food names ----------

const SAME = {
  yoghurt: 'yogurt', chilli: 'chili', chile: 'chili', chapatti: 'chapati', roti: 'chapati', aubergine: 'eggplant', courgette: 'zucchini',
  cilantro: 'coriander', prawn: 'shrimp', rocket: 'arugula', porridge: 'oat', oatmeal: 'oat', spud: 'potato', garbanzo: 'chickpea',
  capsicum: 'pepper', scallion: 'onion', shallot: 'onion', houmous: 'hummus', hummous: 'hummus', soya: 'soy', mincemeat: 'mince', veggie: 'vegetable', veg: 'vegetable',
  leave: 'leaf', loave: 'loaf', chilly: 'chili', chily: 'chili', bulgar: 'bulgur', bulghur: 'bulgur',
};
// Words that also stand for a wider name: 'cheddar' is a cheese, 'salmon' is a fish
const ALSO = {
  cheddar: 'cheese', mozzarella: 'cheese', feta: 'cheese', paneer: 'cheese', halloumi: 'cheese', parmesan: 'cheese',
  salmon: 'fish', tuna: 'fish', cod: 'fish', haddock: 'fish', mackerel: 'fish', sardine: 'fish', trout: 'fish', pollock: 'fish', basa: 'fish', tilapia: 'fish',
  steak: 'beef', mince: 'beef', spaghetti: 'pasta', penne: 'pasta', fusilli: 'pasta', macaroni: 'pasta', tagliatelle: 'pasta', linguine: 'pasta',
  basmati: 'rice', wrap: 'tortilla', tortilla: 'wrap', naan: 'bread', pitta: 'bread', pita: 'bread', toast: 'bread', bagel: 'bread', chapati: 'bread',
};
const DESCRIBE = new Set(['raw', 'dry', 'dried', 'uncooked', 'cooked', 'fresh', 'frozen', 'chopped', 'sliced', 'diced', 'grated', 'tinned', 'canned', 'tin', 'can', 'drained',
  'whole', 'plain', 'low', 'fat', 'free', 'reduced', 'semi', 'skimmed', 'skim', 'lean', 'boneless', 'skinless', 'fillet', 'large', 'small', 'medium', 'mixed', 'red', 'green',
  'yellow', 'white', 'brown', 'wholemeal', 'wholewheat', 'wholegrain', 'organic', 'in', 'of', 'and', 'with', 'the', 'a', 'or', 'for', 'about', 'approx', 'unsweetened',
  'natural', 'light', 'extra', 'virgin', 'mild', 'mature', 'hot', 'cold', 'cut', 'piece', 'portion', 'serving', 'smoked', 'roasted', 'boiled', 'steamed', 'fried', 'style',
  'pack', 'bag', 'handful', 'slice', 'cup', 'tbsp', 'tsp', 'g', 'ml', 'x', 'half', 'peeled', 'trimmed', 'minced', 'baby', 'sweet', 'sauce']);
const STAPLES = new Set(['water', 'oil', 'salt', 'peppercorn', 'herb', 'spice', 'garlic', 'lemon', 'juice', 'vinegar', 'stock', 'paprika', 'cumin', 'turmeric',
  'chili', 'flake', 'powder', 'coriander', 'garam', 'masala', 'curry', 'oregano', 'basil', 'thyme', 'rosemary', 'parsley', 'cinnamon', 'seasoning', 'bay', 'leaf',
  'nutmeg', 'cayenne', 'mint', 'dill', 'sage', 'ground']);

const singular = (w) => (w.length > 3 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 3 && /(ch|sh|x|ss|o)es$/.test(w) ? w.slice(0, -2) : w.length > 2 && w.endsWith('s') && !/(ss|us)$/.test(w) ? w.slice(0, -1) : w);

function prep(text) {
  return String(text || '').toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\b(black|white|ground|cracked)\s+pepper(corns?)?\b/g, ' peppercorn ')
    .replace(/\b(olive|rapeseed|sunflower|vegetable|cooking|coconut|sesame)\s+oil\b/g, ' oil ')
    .replace(/\bcooking\s+spray\b|\boil\s+spray\b/g, ' oil ')
    .replace(/\b(vegetable|chicken|beef)\s+stock(\s+cubes?|\s+pots?)?\b/g, ' stock ')
    .replace(/\bstock\s+cubes?\b/g, ' stock ')
    .replace(/\b(soya|soy|oat|almond|coconut|rice|cashew)\s+(milk|drink|yogh?urt)\b/g, ' $1 plantmilk ')
    .replace(/\b(peanut|almond|cashew)\s+butter\b/g, ' $1 nutbutter ')
    .replace(/\bgluten[\s-]free\b/g, ' glutenfree ');
}

export function words(text) {
  const out = new Set();
  for (const raw of prep(text).split(/[^a-z0-9]+/)) {
    if (!raw || /^\d+$/.test(raw)) continue;
    const w = SAME[singular(raw)] || SAME[raw] || singular(raw);
    out.add(w);
    if (ALSO[w]) out.add(ALSO[w]);
  }
  return out;
}

const mainWords = (text) => [...words(text)].filter((w) => !DESCRIBE.has(w) && w.length > 1);

// Oil, salt, spices and the like: in every cupboard, so they're never "extra" and don't go on the shopping list
export function isBasic(food) {
  const main = mainWords(food);
  return !main.length || main.every((w) => STAPLES.has(w));
}

// Food names that aren't in what you said you have (cupboard basics like oil, salt and spices are fine)
export function notInHave(ingredients, haveText) {
  const have = words(haveText);
  const extra = [];
  for (const i of ingredients) {
    if (isBasic(i.food)) continue;
    if (!mainWords(i.food).some((w) => have.has(w))) extra.push(i.food);
  }
  return extra;
}

// ---------- Checking the AI's amounts ----------

// Typical values per 100 g as bought, for the foods where a mix-up changes a meal the most. `cooked` is the
// value per 100 g once cooked, for foods you weigh dry. A food is only checked when every word of its name
// belongs to it, so mixes like 'egg fried rice' or 'tuna in oil' are left as the AI gave them.
const TYPICAL = [
  { need: ['rice'], ok: ['basmati', 'jasmine', 'long', 'grain', 'pilau', 'arborio', 'risotto', 'wild', 'easy', 'cook'], not: ['plantmilk', 'cake', 'pudding', 'cracker', 'noodle', 'paper'], kcal: 355, p: 8, c: 78, f: 1, cooked: 140 },
  { need: ['pasta'], ok: ['spaghetti', 'penne', 'fusilli', 'macaroni', 'tagliatelle', 'linguine', 'farfalle', 'rigatoni', 'orzo', 'conchiglie', 'durum', 'wheat', 'egg'], kcal: 350, p: 12.5, c: 70, f: 1.5, cooked: 155 },
  { need: ['noodle'], ok: ['egg', 'rice', 'udon', 'soba', 'ramen', 'wheat', 'vermicelli', 'instant'], kcal: 360, p: 11, c: 74, f: 2, cooked: 140 },
  { need: ['oat'], ok: ['rolled', 'jumbo', 'scottish', 'instant', 'glutenfree'], not: ['plantmilk', 'bar', 'cake', 'biscuit'], kcal: 374, p: 11, c: 60, f: 8, cooked: 70 },
  { need: ['couscous'], ok: ['giant', 'pearl'], kcal: 360, p: 13, c: 72, f: 1.5, cooked: 120 },
  { need: ['quinoa'], ok: ['tricolour', 'tri', 'colour'], kcal: 368, p: 14, c: 64, f: 6, cooked: 120 },
  { need: ['lentil'], ok: ['puy', 'split'], kcal: 330, p: 24, c: 50, f: 1.5, cooked: 115 },
  { need: ['bulgur'], ok: ['wheat', 'cracked'], kcal: 350, p: 12, c: 70, f: 1.5, cooked: 85 },
  { need: ['oil'], ok: ['avocado', 'groundnut', 'peanut', 'walnut'], kcal: 899, p: 0, c: 0, f: 100 },
  { need: ['butter'], ok: ['unsalted', 'salted', 'spreadable'], kcal: 740, p: 0.6, c: 0.6, f: 82 },
  { need: ['egg'], ok: ['hen', 'range'], not: ['white', 'yolk'], kcal: 140, p: 12.6, c: 0.4, f: 9.5 },
  { need: ['chicken', 'thigh'], ok: [], kcal: 140, p: 19, c: 0, f: 7 },
  { need: ['chicken'], ok: ['breast', 'mini', 'chunk', 'strip'], kcal: 110, p: 24, c: 0, f: 1.5 },
];
const COOKED = ['cooked', 'boiled', 'steamed', 'tinned', 'canned', 'drained'];

function typicalFor(food) {
  const all = words(food);
  const main = mainWords(food);
  if (!main.length) return null;
  return TYPICAL.find((t) => t.need.every((w) => all.has(w)) && !(t.not || []).some((w) => all.has(w)) && main.every((w) => t.need.includes(w) || t.ok.includes(w))) || null;
}

// Puts right an amount whose calories don't fit the food. The usual slip is rice or pasta given as a dry
// weight but counted as cooked, which would have you cook nearly three times too much.
export function checkLine(i) {
  const t = i.g > 0 && i.kcal > 0 ? typicalFor(i.food) : null;
  if (!t) return i;
  const per = (i.kcal / i.g) * 100;
  const cookedName = COOKED.some((w) => words(i.food).has(w));
  // weighed dry but counted cooked: keep the calories (they're what makes the meal fit) and give the dry weight
  if (t.cooked && !cookedName && per < t.kcal * 0.6 && per >= t.cooked * 0.6) return { ...i, g: Math.round((i.kcal / t.kcal) * 100), fixed: 'dry' };
  const k = cookedName && t.cooked ? t.cooked / t.kcal : 1;
  if (per >= t.kcal * k * 0.55 && per <= t.kcal * k * 1.8) return i;
  // far from typical: keep the amount and use typical values for it
  const x = (i.g / 100) * k;
  return { ...i, kcal: Math.round(t.kcal * x), p: Math.round(t.p * x * 10) / 10, c: Math.round(t.c * x * 10) / 10, f: Math.round(t.f * x * 10) / 10, fixed: 'typical' };
}

// ---------- Food rules, checked on the meal itself ----------

const W = {
  pork: ['pork', 'bacon', 'ham', 'gammon', 'lard', 'pancetta', 'prosciutto', 'chorizo', 'salami', 'pepperoni', 'gelatine', 'gelatin'],
  chicken: ['chicken', 'turkey', 'duck'],
  beef: ['beef', 'steak', 'mince', 'burger', 'veal'],
  lamb: ['lamb', 'mutton', 'goat'],
  meat: ['meat', 'sausage', 'meatball', 'kebab', 'venison', 'liver', 'keema', 'kofta'],
  fish: ['fish', 'salmon', 'tuna', 'cod', 'haddock', 'mackerel', 'sardine', 'anchovy', 'trout', 'shrimp', 'crab', 'lobster', 'mussel', 'squid', 'tilapia', 'pollock', 'basa', 'seafood', 'fishcake', 'scampi'],
  dairy: ['milk', 'cheese', 'butter', 'ghee', 'cream', 'yogurt', 'whey', 'kefir', 'quark', 'skyr', 'custard', 'casein', 'raita', 'paneer'],
  egg: ['egg', 'mayonnaise', 'mayo', 'omelette', 'frittata'],
  gluten: ['wheat', 'bread', 'pasta', 'flour', 'couscous', 'barley', 'rye', 'semolina', 'bulgur', 'seitan', 'noodle', 'wrap', 'tortilla', 'naan', 'chapati', 'bagel', 'cracker', 'biscuit', 'cake', 'pastry', 'pizza', 'oat', 'cereal', 'breadcrumb', 'beer', 'muesli', 'granola', 'spelt'],
  nuts: ['nut', 'peanut', 'almond', 'cashew', 'walnut', 'hazelnut', 'pecan', 'pistachio', 'macadamia', 'praline', 'marzipan', 'nutella', 'nutbutter'],
  soy: ['soy', 'tofu', 'tempeh', 'edamame', 'miso'],
  sesame: ['sesame', 'tahini', 'hummus'],
  honey: ['honey'],
  alcohol: ['wine', 'beer', 'rum', 'vodka', 'brandy', 'sherry', 'cider', 'mirin', 'sake', 'whisky', 'whiskey', 'liqueur', 'gin', 'lager', 'ale'],
  sugar: ['sugar', 'syrup', 'honey', 'jam', 'chocolate', 'sweet', 'cola', 'coke', 'lemonade', 'nutella', 'treacle', 'custard', 'cake', 'biscuit'],
  shake: ['whey', 'casein', 'shake'],
};
const PHRASE = { shake: [/protein (powder|shake)/, /pea protein/] };

// The same flags the meal planner uses ('meat', 'beef', 'dairy', 'nuts'...), worked out from food names
export function flagsFor(names) {
  const flags = new Set();
  for (const name of names) {
    const ws = words(name);
    const text = prep(name);
    for (const [flag, list] of Object.entries(W)) {
      if (flag === 'gluten' && ws.has('glutenfree')) continue;
      if (flag === 'dairy' && (ws.has('plantmilk') || ws.has('nutbutter'))) continue;
      if (list.some((w) => ws.has(w)) || (PHRASE[flag] || []).some((re) => re.test(text))) flags.add(flag);
    }
  }
  for (const m of ['pork', 'chicken', 'beef', 'lamb']) if (flags.has(m)) flags.add('meat');
  if (flags.has('pork')) flags.add('meat');
  return flags;
}

// Why a meal from the AI can't be used with your rules (empty means it can)
export function aiBreaks(names, diet, r) {
  const flags = flagsFor(names);
  const reasons = [];
  if ((diet.style === 'vegetarian' || diet.style === 'vegan') && (flags.has('meat') || flags.has('fish'))) reasons.push('not vegetarian');
  if (diet.style === 'vegan' && ['dairy', 'egg', 'honey'].some((f) => flags.has(f))) reasons.push('not vegan');
  if (diet.halal && (flags.has('pork') || flags.has('alcohol'))) reasons.push('not halal');
  const avoid = new Set([...(diet.avoid || []), ...(r?.gluten ? ['gluten'] : [])]);
  for (const a of avoid) if (flags.has(a)) reasons.push(`contains ${(AVOID_OPTIONS.find((o) => o.id === a)?.name || a).toLowerCase()}`);
  if (r?.noSugar && flags.has('sugar')) reasons.push('has added sugar');
  if (r?.noShakes && flags.has('shake')) reasons.push('protein shake');
  const text = names.map((n) => String(n).toLowerCase()).join(' | ');
  for (const w of parseDislikes(diet.dislikes)) if (text.includes(w) || text.includes(singular(w))) reasons.push(`contains “${w}”`);
  return { reasons: [...new Set(reasons)], flags };
}

// ---------- Turning an AI meal into a Gainloop meal ----------

// Calories that don't add up to the protein, carbs and fat are worked out again from them
function fixKcal(i) {
  const fromMacros = i.p * 4 + i.c * 4 + i.f * 9;
  if (!fromMacros) return i.kcal;
  return Math.abs(i.kcal - fromMacros) > Math.max(25, fromMacros * 0.2) ? Math.round(fromMacros) : i.kcal;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// target: the calories and protein for this meal. ctx: { diet, rules, have (text) }
export function aiMeal(raw, slot, target, ctx) {
  const ing = (raw.ingredients || []).map((i) => checkLine({ food: i.food, g: i.grams || 0, kcal: fixKcal(i), p: i.p || 0, c: i.c || 0, f: i.f || 0 }));
  const tot = ing.reduce((t, i) => {
    t.kcal += i.kcal; t.p += i.p; t.c += i.c; t.f += i.f;
    return t;
  }, zero());
  if (!tot.kcal) return null;
  // one portion sized to the meal's target, as the planner does for its own meals
  const x = target?.kcal ? clamp(target.kcal / tot.kcal, 0.65, 1.4) : 1;
  const scale = Math.abs(x - 1) < 0.08 ? 1 : x;
  const lines = ing
    .filter((i) => i.g > 0 || /salt|pepper|spice|herb/i.test(i.food))
    .map((i) => ({ food: i.food, g: roundTo(i.g * scale, i.g * scale < 30 ? 1 : 5), ...(isBasic(i.food) ? { basic: true } : {}) }));
  const m = roundMacros({ kcal: tot.kcal * scale, p: tot.p * scale, c: tot.c * scale, f: tot.f * scale });
  const names = [raw.name, ...ing.map((i) => i.food)];
  const check = aiBreaks(names, ctx.diet, ctx.rules);
  const extras = [...new Set([...(raw.notInList || []), ...notInHave(ing, ctx.have)])];
  return {
    id: `ai-${hash(`${slot}|${raw.name}|${lines.map((l) => `${l.food}${l.g}`).join('|')}`)}`,
    ai: true,
    custom: true,
    slot,
    name: raw.name.charAt(0).toUpperCase() + raw.name.slice(1),
    mins: raw.minutes || null,
    ...m,
    flags: [...check.flags],
    lines,
    how: (raw.steps || []).join(' '),
    steps: raw.steps || [],
    extras,
    breaks: check.reasons,
  };
}

// How an AI meal's ingredient reads: '150 g chicken thigh fillets', or '2 eggs'
export { aiLineText as lineText } from './meals.js';

// Adding up what the AI estimated for something you ate
export function estimateTotal(items) {
  const t = zero();
  for (const i of items || []) {
    t.kcal += fixKcal(i); t.p += i.p || 0; t.c += i.c || 0; t.f += i.f || 0;
  }
  return roundMacros(t);
}
