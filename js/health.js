// Health conditions: what changes in the plan, and the safety notes shown with it.
// General guidance only. Everything here stays on the device.
import { lcFirst } from './util.js';

export const DIABETES = [
  ['none', 'No'],
  ['t1', 'Type 1'],
  ['t2', 'Type 2'],
  ['pre', 'Prediabetes'],
  ['other', 'Another type, or not sure'],
];

export const CONDITIONS = [
  { id: 'bp', name: 'High blood pressure' },
  { id: 'heart', name: 'Heart condition' },
  { id: 'kidney', name: 'Kidney disease' },
  { id: 'coeliac', name: 'Coeliac disease' },
  { id: 'cholesterol', name: 'High cholesterol' },
  { id: 'asthma', name: 'Asthma' },
];

export const PAIN = [
  { id: 'back', name: 'Lower back', word: 'lower back', short: 'lower back pain' },
  { id: 'knee', name: 'Knees', word: 'knees', short: 'knee pain' },
  { id: 'shoulder', name: 'Shoulders', word: 'shoulders', short: 'shoulder pain' },
];

// Exercises that tend to load a sore area. They're left out when there is another option for that muscle.
export const STRESS = {
  knee: ['squat', 'low-bar-squat', 'front-squat', 'db-squat', 'sumo-squat', 'trap-bar-dl', 'side-lunge', 'walking-lunge', 'forward-lean-lunge', 'single-leg-squat', 'pistol-squat', 'sissy-squat', 'sl-leg-ext', 'jump-squat', 'hack-squat', 'split-squat', 'reverse-lunge', 'box-pistol', 'leg-ext', 'nordic', 'run', 'treadmill-run', 'skipping', 'jumping-jacks', 'burpees', 'stair-climber'],
  back: ['deadlift', 'sumo-dl', 'stiff-leg-dl', 'trap-bar-dl', 'tbar-row', 'low-bar-squat', 'front-squat', 'rdl', 'db-rdl', 'bb-row', 'backpack-row', 'squat', 'kb-swing', 'ohp', 'standing-calf', 'superman', 'rower', 'burpees'],
  shoulder: ['dips', 'decline-bench', 'cable-press-high', 'cable-press-low', 'kneeling-push-up', 'incline-push-up', 'front-raise', 'bench', 'incline-bench', 'cg-bench', 'ohp', 'db-press', 'pike-push-up', 'feet-up-pike', 'bench-dip', 'db-pullover', 'deficit-push-up', 'burpees', 'mountain-climbers'],
};

export const blankHealth = () => ({ diabetes: 'none', conditions: [], pain: [], other: '' });

export function normHealth(h) {
  const base = blankHealth();
  if (!h || typeof h !== 'object') return base;
  return {
    diabetes: DIABETES.some(([k]) => k === h.diabetes) ? h.diabetes : 'none',
    conditions: (h.conditions || []).filter((c) => CONDITIONS.some((x) => x.id === c)),
    pain: (h.pain || []).filter((c) => PAIN.some((x) => x.id === c)),
    other: String(h.other || '').slice(0, 200),
  };
}

export const hasHealth = (h) => !!h && (h.diabetes !== 'none' || h.conditions.length > 0 || h.pain.length > 0 || !!h.other);

const DIA_NAME = { t1: 'Type 1 diabetes', t2: 'Type 2 diabetes', pre: 'Prediabetes', other: 'Diabetes' };

// Everything the planners need to know, plus notes grouped by where they show
export function healthRules(raw) {
  const h = normHealth(raw);
  const has = (c) => h.conditions.includes(c);
  const r = {
    h,
    diabetes: h.diabetes !== 'none' ? h.diabetes : null,
    carbCap: null,
    carbCounts: false,
    noSugar: false,
    standardProtein: false,
    noShakes: false,
    lowSalt: false,
    lowSatFat: false,
    gluten: false,
    avoid: new Set(),
    pain: h.pain,
    repFloor: 0,
    stopShort: null,
    cardioMax: 'hard',
    checkFirst: [],
    train: [],
    food: [],
    items: [],
  };

  if (r.diabetes) {
    r.carbCap = 0.45;
    r.carbCounts = true;
    r.noSugar = true;
    const insulin = h.diabetes === 't1' || h.diabetes === 'other';
    r.food.push('Each meal shows its carbs so you can count them. Meals with added sugar are left out, carbs are kept to about 45% of your calories, and the planner leans toward meals with fewer carbs.');
    if (h.diabetes === 'pre') {
      r.train.push('Training and steady, slow weight change both help keep your blood glucose in range.');
    } else {
      r.train.push('Check your blood glucose before you train and keep fast-acting glucose, like glucose tablets, with you.');
      r.train.push(insulin
        ? 'Don’t train if your glucose is low, or very high with ketones. Lifting can lower it for up to a day afterwards, including overnight, so ask your diabetes team how to adjust insulin and food around training.'
        : 'If you take insulin or a sulfonylurea such as gliclazide, lows can happen during or after training, so keep up those checks.');
    }
    if (insulin) r.checkFirst.push('Talk to your diabetes team before starting a new training plan.');
    r.items.push({ id: 'diabetes', name: DIA_NAME[h.diabetes], areas: ['food', 'train'], changes: ['Carbs shown on every meal', 'No meals with added sugar', 'Carbs capped at about 45% of calories', 'Glucose checks before training'] });
  }
  if (has('bp')) {
    r.repFloor = Math.max(r.repFloor, 8);
    r.stopShort = '2 to 3';
    r.lowSalt = true;
    r.train.push('Breathe out as you push or pull and never hold your breath. Finish each set with 2 to 3 good reps still in the tank.');
    r.food.push('Meals with very salty cheese are swapped out where there are other options. Go easy on added salt and stock cubes.');
    r.checkFirst.push('If your blood pressure isn’t under control, get the all-clear from your GP before lifting.');
    r.items.push({ id: 'bp', name: 'High blood pressure', areas: ['train', 'food'], changes: ['At least 8 reps a set', 'Finish each set with 2 to 3 reps still in the tank', 'Breathing reminders', 'Saltier meals swapped out'] });
  }
  if (has('heart')) {
    r.repFloor = Math.max(r.repFloor, 10);
    r.stopShort = '3';
    r.cardioMax = 'moderate';
    r.train.push('Keep every set comfortable: at least 10 reps, finishing each set with about 3 good reps still in the tank. Keep cardio at an easy to moderate pace, where you can still talk. Stop and get help if you have chest pain, unusual breathlessness, dizziness or a racing heartbeat.');
    r.checkFirst.push('Check with your GP or heart team before you start, and show them what this plan includes.');
    r.items.push({ id: 'heart', name: 'Heart condition', areas: ['train'], changes: ['At least 10 reps a set', 'Finish each set with about 3 reps still in the tank', 'Warning signs to stop'] });
  }
  if (has('kidney')) {
    r.standardProtein = true;
    r.noShakes = true;
    r.food.push('Protein is set to a standard 0.8 g per kg instead of the higher muscle-building amount, and protein shakes are left out. If your kidney team gives you a different target, or you’re on dialysis, follow their advice instead.');
    r.checkFirst.push('Ask your kidney team about protein and exercise before starting.');
    r.items.push({ id: 'kidney', name: 'Kidney disease', areas: ['food'], changes: ['Standard protein target', 'No protein shakes'] });
  }
  if (r.carbCap && r.standardProtein) {
    r.food.push('With diabetes and kidney disease together, more of your calories come from fat. Choose mostly unsaturated fats, like olive or rapeseed oil, and ask a dietitian for targets that fit you.');
  }
  if (has('coeliac')) {
    r.gluten = true;
    r.food.push('Gluten is left out of every meal, including standard oats. If you add your own meals, use oats labelled gluten-free.');
    r.items.push({ id: 'coeliac', name: 'Coeliac disease', areas: ['food'], changes: ['No gluten in any meal'] });
  }
  if (has('cholesterol')) {
    r.lowSatFat = true;
    r.food.push('Meals built on fatty cheese, paneer or lamb are swapped out where there are other options.');
    r.items.push({ id: 'cholesterol', name: 'High cholesterol', areas: ['food'], changes: ['Fewer meals high in saturated fat'] });
  }
  if (has('asthma')) {
    r.train.push('Warm up gradually for 5 to 10 minutes and keep your reliever inhaler with you.');
    r.items.push({ id: 'asthma', name: 'Asthma', areas: ['train'], changes: ['Warm-up and inhaler reminder'] });
  }
  for (const p of h.pain) {
    for (const id of STRESS[p] || []) r.avoid.add(id);
  }
  if (h.pain.length) {
    const words = PAIN.filter((p) => h.pain.includes(p.id)).map((p) => p.word);
    const list = words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0];
    r.train.push(`Exercises that tend to load your ${list} are left out where there’s another option. If anything hurts, stop and swap it, and see a physio if the pain lasts.`);
    r.items.push({ id: 'pain', name: `Pain in your ${list}`, areas: ['train'], changes: ['Harder exercises for that area left out'] });
  }
  if (h.other) {
    r.checkFirst.push(`You mentioned “${h.other}”. Gainloop can’t adjust for that automatically, so check your plan with your GP.`);
    r.items.push({ id: 'other', name: h.other, areas: [], changes: ['No automatic changes'] });
  }
  return r;
}

// Rep range with health limits applied (higher reps, lighter loads)
export function repRange(ex, rules) {
  const [lo, hi] = ex.rr;
  if (!rules?.repFloor || ex.load === 's' || lo >= rules.repFloor) return [lo, hi];
  const nlo = rules.repFloor;
  return [nlo, Math.max(hi, nlo + 4)];
}

// One line for the profile screen: 'Type 2 diabetes, high blood pressure and knee pain'
export function healthSummary(raw) {
  const h = normHealth(raw);
  const r = healthRules(h);
  const parts = [
    ...r.items.filter((i) => i.id !== 'pain' && i.id !== 'other').map((i) => i.name),
    ...PAIN.filter((p) => h.pain.includes(p.id)).map((p) => p.short),
    ...(h.other ? [h.other] : []),
  ].map((x, i) => (i ? lcFirst(x) : x.charAt(0).toUpperCase() + x.slice(1)));
  if (!parts.length) return 'Nothing added';
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}
