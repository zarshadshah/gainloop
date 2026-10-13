// "Cook with what you have": recipes you can already make, ones you're one or two items short of,
// and new meals put together from your own foods to fit the meal slot. Runs on the phone, no AI service.
import { INGREDIENTS, SHOP_GROUPS } from './data/foods.js';
import { healthBreaks, mealMacros, parseDislikes, ruleBreaks } from './meals.js';
import { roundTo } from './util.js';

// Always assumed to be in the cupboard
export const STAPLES = new Set([...Object.keys(INGREDIENTS).filter((id) => INGREDIENTS[id].pantry), 'olive-oil']);

// Ingredients you can tick, grouped like a shop
export function pickableIngredients(diet, rules) {
  const groups = SHOP_GROUPS.map((g) => ({ group: g, items: [] }));
  for (const [id, ing] of Object.entries(INGREDIENTS)) {
    if (STAPLES.has(id) || !ingredientAllowed(id, diet, rules)) continue;
    groups.find((g) => g.group === ing.shop)?.items.push({ id, name: ing.name });
  }
  for (const g of groups) g.items.sort((a, b) => a.name.localeCompare(b.name));
  return groups.filter((g) => g.items.length);
}

// Would this one ingredient break your food rules or health rules?
export function ingredientAllowed(id, diet, rules) {
  const probe = { id: `probe-${id}`, slot: 'snack', name: '', items: [[id, 100]] };
  if (ruleBreaks(probe, diet).length) return false;
  if (healthBreaks(probe, rules).hard.length) return false;
  const name = INGREDIENTS[id].name.toLowerCase();
  return !parseDislikes(diet.dislikes).some((w) => name.includes(w));
}

const needs = (meal) => (meal.items || []).map(([id]) => id).filter((id) => !STAPLES.has(id));

// Library and saved meals for a slot, by how many ingredients you'd still need
export function matchRecipes(allowed, have, slot) {
  const own = new Set(have);
  return allowed
    .filter((m) => m.slot === slot && m.items)
    .map((m) => {
      const missing = needs(m).filter((id) => !own.has(id));
      return { meal: m, missing, macros: mealMacros(m) };
    })
    .filter((x) => x.missing.length <= 2)
    .sort((a, b) => a.missing.length - b.missing.length || b.macros.p / b.macros.kcal - a.macros.p / a.macros.kcal);
}

// ---------- Building a meal from your foods ----------

const MAIN_PROTEIN = {
  chicken: { g: 150, name: 'Chicken', cook: 'Slice the chicken and pan-fry it in the oil for 6 to 8 minutes, until cooked through' },
  'chicken-thigh': { g: 170, name: 'Chicken thigh', cook: 'Slice the chicken thighs and pan-fry them in the oil for 8 to 10 minutes, until cooked through' },
  'beef-mince': { g: 140, name: 'Beef mince', cook: 'Brown the mince in a hot pan, breaking it up as it cooks' },
  lamb: { g: 140, name: 'Lamb', cook: 'Brown the lamb in the oil, then cover and cook gently for 20 minutes' },
  salmon: { g: 140, name: 'Salmon', cook: 'Bake the salmon at 200°C for 15 minutes' },
  tuna: { g: 112, name: 'Tuna', cook: 'Drain the tuna' },
  eggs: { g: 150, name: 'Egg', cook: 'Beat the eggs and scramble them gently in the oil' },
  tofu: { g: 200, name: 'Tofu', cook: 'Cube the tofu and fry it in the oil until golden' },
  paneer: { g: 100, name: 'Paneer', cook: 'Cube the paneer and fry it in the oil until golden' },
  lentils: { g: 80, name: 'Lentil', cook: 'Simmer the lentils in plenty of water for 15 minutes, then drain' },
  chickpeas: { g: 200, name: 'Chickpea', cook: 'Drain the chickpeas and warm them through in the oil' },
  'kidney-beans': { g: 200, name: 'Bean', cook: 'Drain the beans and warm them through in the oil' },
};

const CARB = {
  rice: { g: 75, name: 'rice', cook: 'Cook the rice', mins: 20 },
  pasta: { g: 80, name: 'pasta', cook: 'Cook the pasta', mins: 15 },
  potatoes: { g: 300, name: 'potato', cook: 'Boil or microwave the potatoes until tender', mins: 25 },
  'sweet-potato': { g: 300, name: 'sweet potato', cook: 'Roast the sweet potato in wedges at 200°C for 30 minutes', mins: 35 },
  wrap: { g: 124, name: 'wraps', cook: 'Warm the wraps', mins: 15 },
  bread: { g: 80, name: 'toast', cook: 'Toast the bread', mins: 10 },
};

const VEG = {
  broccoli: { g: 100, name: 'broccoli' },
  spinach: { g: 60, name: 'spinach' },
  peppers: { g: 100, name: 'peppers' },
  onion: { g: 60, name: 'onion' },
  'frozen-veg': { g: 150, name: 'mixed veg' },
  salad: { g: 50, name: 'salad', raw: true },
  'tomatoes-tin': { g: 200, name: 'tomatoes', sauce: true },
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const FRUIT = { banana: 'banana', berries: 'berries', apple: 'apple' };
const list2 = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0]);

function finish(slot, name, items, steps, mins) {
  const merged = new Map();
  for (const [id, g] of items) merged.set(id, (merged.get(id) || 0) + g);
  const it = [...merged].map(([id, g]) => [id, roundTo(g, 5)]).filter(([id]) => !STAPLES.has(id) || id === 'olive-oil');
  const key = `${slot}:${it.map(([id, g]) => `${id}${g}`).join('|')}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return { id: `g-${h.toString(36)}`, gen: true, slot, name, mins, items: it, pantry: ['garlic'], how: `${steps.filter(Boolean).join('. ')}.` };
}

// Eggs don't belong in a pasta bake or a sweet potato dinner
const PAIRS_BADLY = { eggs: ['pasta', 'sweet-potato'], tuna: ['sweet-potato'] };

function mainMeal(slot, have, rules, n) {
  const proteins = Object.keys(MAIN_PROTEIN).filter((id) => have.has(id));
  if (!proteins.length) return null;
  const vegs = Object.keys(VEG).filter((id) => have.has(id));
  const pid = proteins[n % proteins.length];
  const carbs = Object.keys(CARB).filter((id) => have.has(id) && id !== 'bread' && !(PAIRS_BADLY[pid] || []).includes(id));
  const cid = carbs.length ? carbs[Math.floor(n / proteins.length) % carbs.length] : null;
  const vlist = vegs.length ? [vegs[n % vegs.length], vegs[(n + 1) % vegs.length]].filter((v, i, a) => a.indexOf(v) === i) : [];
  const P = MAIN_PROTEIN[pid];
  const Cb = cid ? CARB[cid] : null;
  const carbScale = rules?.carbCap ? 0.7 : 1;
  const vegScale = rules?.carbCap || rules?.standardProtein ? 1.3 : 1;
  const proteinScale = rules?.standardProtein ? 0.6 : 1;
  const items = [[pid, P.g * proteinScale], ['olive-oil', 7]];
  if (Cb) items.push([cid, Cb.g * carbScale]);
  for (const v of vlist) items.push([v, VEG[v].g * vegScale]);
  const vNames = vlist.map((v) => VEG[v].name);
  const v1 = vNames[0];
  let name;
  if (!Cb) name = v1 ? `${P.name} and ${v1}` : P.name;
  else if (cid === 'rice') name = `${P.name}, rice${v1 ? ` and ${v1}` : ''}`;
  else if (cid === 'pasta') name = `${P.name}${v1 ? ` and ${v1}` : ''} pasta`;
  else if (cid === 'potatoes') name = pid === 'eggs' ? 'Egg and potato hash' : `${P.name} and potato traybake`;
  else if (cid === 'sweet-potato') name = `${P.name} with sweet potato${v1 ? ` and ${v1}` : ''}`;
  else name = `${P.name}${v1 ? ` and ${v1}` : ''} wraps`;
  if (pid === 'eggs' && cid === 'rice') name = `Egg fried rice${v1 ? ` with ${v1}` : ''}`;
  const cooked = vlist.filter((v) => !VEG[v].raw && !VEG[v].sauce).map((v) => VEG[v].name);
  const sauce = vlist.find((v) => VEG[v].sauce);
  const raw = vlist.filter((v) => VEG[v].raw).map((v) => VEG[v].name);
  const steps = [];
  if (cid === 'potatoes') {
    steps.push(`Chop the potatoes${cooked.length ? ` and ${list2(cooked)}` : ''}, toss with the ${P.name.toLowerCase()} and the oil, and roast at 200°C for 35 to 40 minutes until golden and cooked through`);
  } else {
    if (Cb) steps.push(Cb.cook);
    steps.push(P.cook);
    if (cooked.length) steps.push(`Add the ${list2(cooked)} with a little garlic and cook until tender`);
    if (sauce) steps.push('Stir in the chopped tomatoes and simmer for 10 minutes');
    if (cid === 'wrap') steps.push('Fill the wraps');
    else if (Cb) steps.push(`Serve with the ${Cb.name}`);
  }
  if (raw.length) steps.push(`Serve with the ${list2(raw)}`);
  const mins = Math.max(Cb ? Cb.mins : 15, pid === 'lamb' ? 35 : pid === 'lentils' ? 25 : 15);
  return finish(slot, name, items, steps, mins);
}

function breakfast(have, rules, n) {
  const opts = [];
  const fruit = ['berries', 'banana', 'apple'].filter((f) => have.has(f));
  const drink = ['milk', 'soya-milk'].find((d) => have.has(d));
  const powder = rules?.noShakes ? null : ['whey', 'pea-protein'].find((p) => have.has(p));
  if (have.has('oats') && drink) {
    const items = [['oats', rules?.carbCap ? 40 : 50], [drink, 250]];
    if (powder) items.push([powder, 30]);
    else if (have.has('greek-yog')) items.push(['greek-yog', 120]);
    if (fruit[0]) items.push([fruit[0], fruit[0] === 'berries' ? 100 : rules?.carbCap ? 60 : 100]);
    opts.push(finish('breakfast', `${powder ? 'Protein porridge' : 'Porridge'}${fruit[0] ? ` with ${FRUIT[fruit[0]]}` : ''}`, items,
      [`Cook the oats in the ${drink === 'milk' ? 'milk' : 'soya drink'} for 3 to 4 minutes`, powder ? 'Take off the heat and stir in the protein powder' : have.has('greek-yog') ? 'Top with the yogurt' : '', fruit[0] ? 'Add the fruit' : ''], 5));
  }
  if (have.has('eggs')) {
    const veg = ['spinach', 'peppers', 'onion'].filter((v) => have.has(v));
    const items = [['eggs', 150], ['olive-oil', 5], ...veg.slice(0, 2).map((v) => [v, 50])];
    if (have.has('bread')) items.push(['bread', 80]);
    const vn = veg.slice(0, 2).map((v) => VEG[v].name);
    const name = have.has('bread') ? `Scrambled eggs${vn.length ? ` with ${list2(vn)}` : ''} on toast` : vn.length ? `${cap(list2(vn.map((v) => (v === 'peppers' ? 'pepper' : v))))} omelette` : 'Omelette';
    opts.push(finish('breakfast', name, items,
      [vn.length ? `Soften the ${list2(vn)} in the oil` : '', have.has('bread') ? 'Add the beaten eggs, stir gently until just set and serve on toast' : 'Pour in the beaten eggs, cook until set and fold'], 10));
  }
  if (have.has('greek-yog')) {
    const items = [['greek-yog', 250]];
    if (fruit[0]) items.push([fruit[0], 100]);
    if (have.has('oats')) items.push(['oats', 30]);
    else if (have.has('almonds')) items.push(['almonds', 15]);
    opts.push(finish('breakfast', `Greek yogurt${fruit[0] ? ` with ${FRUIT[fruit[0]]}` : ' bowl'}`, items, ['Spoon the yogurt into a bowl', 'Add the toppings'], 3));
  }
  if (have.has('tofu') && have.has('potatoes')) {
    opts.push(finish('breakfast', 'Tofu scramble and potatoes', [['tofu', 200], ['potatoes', 200], ['olive-oil', 10], ...(have.has('spinach') ? [['spinach', 50]] : [])], ['Pan-fry diced potatoes until golden', 'Crumble in the tofu and cook until hot'], 20));
  }
  if (!opts.length && powder && (drink || fruit.length)) {
    opts.push(finish('breakfast', 'Protein shake and fruit', [[powder, 30], ...(drink ? [[drink, 250]] : []), ...(fruit[0] ? [[fruit[0], 100]] : [])], ['Shake the powder with the drink or water', 'Fruit on the side'], 2));
  }
  return opts.length ? opts[n % opts.length] : null;
}

function snack(have, rules, n) {
  const opts = [];
  const add = (cond, name, items, how) => { if (cond) opts.push(finish('snack', name, items, [how], 3)); };
  add(have.has('greek-yog'), `Greek yogurt${have.has('berries') ? ' and berries' : ''}`, [['greek-yog', 200], ...(have.has('berries') ? [['berries', 80]] : [])], 'Top the yogurt with the fruit');
  add(have.has('cottage') && have.has('rice-cakes'), 'Cottage cheese on rice cakes', [['cottage', 150], ['rice-cakes', 24]], 'Spread the cottage cheese on the rice cakes');
  add(have.has('tuna') && have.has('rice-cakes'), 'Tuna on rice cakes', [['tuna', 80], ['rice-cakes', 24]], 'Pile the tuna onto the rice cakes with black pepper');
  add(have.has('eggs'), 'Two boiled eggs', [['eggs', 100]], 'Boil for 8 minutes and cool in cold water');
  const drink = ['milk', 'soya-milk'].find((d) => have.has(d));
  const powder = rules?.noShakes ? null : ['whey', 'pea-protein'].find((p) => have.has(p));
  add(!!powder, `Protein shake${drink ? ` with ${drink === 'milk' ? 'milk' : 'soya drink'}` : ''}`, [[powder, 30], ...(drink ? [[drink, 250]] : [])], 'Shake the powder with the drink or cold water');
  add(have.has('apple') && have.has('almonds'), 'Apple and almonds', [['apple', 150], ['almonds', 25]], 'Slice the apple and eat with the almonds');
  add(have.has('hummus') && have.has('peppers'), 'Hummus and pepper sticks', [['hummus', 60], ['peppers', 100]], 'Slice the pepper into sticks and dip');
  add(have.has('pb') && have.has('bread'), 'Peanut butter toast', [['bread', 40], ['pb', 15]], 'Toast and spread');
  add(!!drink && have.has('banana') && !rules?.carbCap, `${drink === 'milk' ? 'Milk' : 'Soya drink'} and a banana`, [[drink, 300], ['banana', 100]], 'A big glass and a banana');
  add(have.has('chickpeas'), 'Crunchy roast chickpeas', [['chickpeas', 150], ['olive-oil', 5]], 'Pat dry, toss in the oil with paprika and roast at 200°C for 20 to 25 minutes');
  add(!!drink && have.has('berries'), `${drink === 'milk' ? 'Milk' : 'Soya drink'} and berries`, [[drink, 250], ['berries', 100]], 'A glass of the drink with a bowl of berries');
  add(have.has('pb') && have.has('banana') && !rules?.carbCap, 'Banana and peanut butter', [['banana', 100], ['pb', 15]], 'Slice the banana and spread with the peanut butter');
  if (!opts.length) return null;
  const ranked = opts.map((m) => ({ m, d: (mealMacros(m).p || 0) / (mealMacros(m).kcal || 1) })).sort((a, b) => b.d - a.d).map((x) => x.m);
  return ranked[n % ranked.length];
}

// A new meal for a slot from the foods you have. n picks a different combination.
export function buildMeal(slot, haveList, diet, rules, n = 0) {
  const have = new Set(haveList.filter((id) => INGREDIENTS[id] && ingredientAllowed(id, diet, rules)));
  for (const s of STAPLES) have.add(s);
  let meal = null;
  if (slot === 'breakfast') meal = breakfast(have, rules, n);
  else if (slot === 'snack') meal = snack(have, rules, n);
  else meal = mainMeal(slot, have, rules, n);
  if (!meal) return null;
  // final safety check against the rules
  if (ruleBreaks(meal, diet).length || healthBreaks(meal, rules).hard.length) return null;
  return meal;
}

// How many different meals buildMeal could make for a slot (for "another idea")
export function mealIdeas(slot, haveList, diet, rules, max = 6) {
  const seen = new Set();
  const out = [];
  for (let n = 0; n < max * 3 && out.length < max; n += 1) {
    const m = buildMeal(slot, haveList, diet, rules, n);
    if (m && !seen.has(m.id)) { seen.add(m.id); out.push(m); }
  }
  return out;
}
