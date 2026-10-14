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
  leave: 'leaf', loave: 'loaf', chilly: 'chili', chily: 'chili',
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

// Food names that aren't in what you said you have (cupboard basics like oil, salt and spices are fine)
export function notInHave(ingredients, haveText) {
  const have = words(haveText);
  const extra = [];
  for (const i of ingredients) {
    const main = mainWords(i.food);
    if (!main.length || main.every((w) => STAPLES.has(w))) continue;
    if (!main.some((w) => have.has(w))) extra.push(i.food);
  }
  return extra;
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
  const ing = (raw.ingredients || []).map((i) => ({ food: i.food, g: i.grams || 0, kcal: fixKcal(i), p: i.p || 0, c: i.c || 0, f: i.f || 0 }));
  const tot = ing.reduce((t, i) => {
    t.kcal += i.kcal; t.p += i.p; t.c += i.c; t.f += i.f;
    return t;
  }, zero());
  if (!tot.kcal) return null;
  // one portion sized to the meal's target, as the planner does for its own meals
  const x = target?.kcal ? clamp(target.kcal / tot.kcal, 0.75, 1.35) : 1;
  const scale = Math.abs(x - 1) < 0.08 ? 1 : x;
  const lines = ing.map((i) => ({ food: i.food, g: roundTo(i.g * scale, i.g * scale < 30 ? 1 : 5) })).filter((l) => l.g > 0 || /salt|pepper|spice|herb/i.test(l.food));
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
