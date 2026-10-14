// Gainloop's AI helper, running as a Cloudflare Pages Function on Workers AI (free: 10,000 neurons a day).
// POST /api/ai with { task, ... }:
//   meals:    meal ideas from the foods someone types, sized to their plan and food rules
//   estimate: calories and macros for something they ate that wasn't in the plan
//   coach:    a short, kind note on getting back on track after a day off plan
// The app sends only what each task needs: food lists, calorie and macro targets, and food rules.
// No names, measurements or diagnoses. Nothing is stored here.

const MODELS = {
  main: '@cf/openai/gpt-oss-120b',
  backup: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
};
const MAX_BODY = 8000;
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const clean = (s, max = 200) => String(s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};

// ---------- Prompts ----------

function rulesText(r = {}) {
  const lines = [];
  if (r.style === 'vegan') lines.push('Vegan: no meat, fish, dairy, eggs or honey.');
  else if (r.style === 'vegetarian') lines.push('Vegetarian: no meat or fish (dairy and eggs are fine).');
  if (r.halal) lines.push('Halal: no pork or pork products, no alcohol (including wine or beer in cooking), no gelatine. Any meat must be halal.');
  const avoid = (Array.isArray(r.avoid) ? r.avoid : []).map((a) => clean(a, 30)).filter(Boolean).slice(0, 12);
  if (avoid.length) lines.push(`Allergies or foods to avoid completely: ${avoid.join(', ')}.`);
  const dislikes = clean(r.dislikes, 120);
  if (dislikes) lines.push(`Dislikes, never use: ${dislikes}.`);
  if (r.glutenFree) lines.push('Strictly gluten-free (coeliac): no wheat, barley, rye, standard oats, regular soy sauce or stock that contains gluten.');
  if (r.carbCapPct) lines.push(`Diabetes-friendly: carbs no more than about ${num(r.carbCapPct, 20, 60)}% of each meal's calories, no added sugar, honey or syrups, prefer wholegrain and high-fibre carbs.`);
  else if (r.noAddedSugar) lines.push('No added sugar, honey or syrups.');
  if (r.lowSalt) lines.push('Low salt: no added salt, go easy on stock cubes, salty cheese and processed meat.');
  if (r.lowSatFat) lines.push('Low saturated fat: lean meat, little cheese, butter or cream.');
  if (r.noShakes) lines.push('No protein powders or shakes.');
  if (r.moderateProtein) lines.push('Moderate protein only (kidney health): do not exceed the protein target.');
  return lines.length ? lines.join('\n') : 'No special food rules.';
}

function targetText(t) {
  if (!t) return '';
  const parts = [`about ${Math.round(t.kcal)} kcal`, `at least ${Math.round(t.p)} g protein`];
  if (t.c) parts.push(`about ${Math.round(t.c)} g carbs`);
  if (t.f) parts.push(`about ${Math.round(t.f)} g fat`);
  return parts.join(', ');
}

const MEAL_SHAPE = `{"meals":[{"name":"short meal name","slot":"breakfast|lunch|dinner|snack","minutes":20,
"ingredients":[{"food":"chicken thigh fillets, raw","grams":170,"kcal":238,"protein":32,"carbs":0,"fat":12}],
"steps":["short step","short step"],"notInList":[]}]}`;

function mealsPrompt(d) {
  const slot = SLOTS.includes(d.slot) ? d.slot : 'any';
  const count = num(d.count, 1, 4) || 3;
  const targets = d.targets && typeof d.targets === 'object' ? d.targets : {};
  const wanted = slot === 'any'
    ? SLOTS.filter((s) => targets[s]).map((s) => `- ${s}: ${targetText(targets[s])}`).join('\n')
    : `- ${slot}: ${targetText(targets[slot])}`;
  const system = `You are the meal planner inside Gainloop, a UK fitness app for building muscle. You suggest realistic, tasty home-cooked meals.
Hard rules:
1. Use ONLY the foods the person lists, plus these basics that everyone has: water, cooking oil, salt, black pepper, dried herbs, spices, garlic, lemon juice, vinegar, a vegetable stock cube. Never add any other ingredient. If a good meal needs something else, skip that meal. If you break this rule anyway, name the extra food in "notInList".
2. Follow every food rule below exactly.
3. Size each meal to its target by choosing gram amounts. Hit the protein target where the foods allow.
4. Weigh ingredients as bought: raw meat and fish, dry rice and pasta, raw potatoes. Give kcal, protein, carbs and fat for the amount used, from typical UK food labels.
5. Steps: 2 to 5 short steps in UK English, metric units, oven in °C.
Answer with JSON only, no other text, in exactly this shape:
${MEAL_SHAPE}`;
  const user = `Foods I have: ${clean(d.foods, 600)}
Give me ${count} different meal idea${count > 1 ? 's' : ''}${slot === 'any' ? ' across these meals' : ` for ${slot}`}:
${wanted}
Food rules:
${rulesText(d.rules)}`;
  return { system, user, maxTokens: 3000 };
}

function estimatePrompt(d) {
  const system = `You estimate the nutrition of food someone ate, for a UK fitness app.
Split it into items. When an amount isn't given, assume a typical UK portion and say what you assumed. Use typical UK food labels and restaurant or takeaway values.
Answer with JSON only, no other text, in exactly this shape:
{"items":[{"food":"pepperoni pizza","amount":"2 slices, about 220 g","kcal":580,"protein":24,"carbs":64,"fat":24}],"confidence":"low|medium|high"}`;
  return { system, user: `What I ate: ${clean(d.text, 400)}`, maxTokens: 1500 };
}

function coachPrompt(d) {
  const goal = { build: 'building muscle', lean: 'losing fat while keeping muscle', recomp: 'recomposition at a steady weight' }[d.goal] || 'building muscle';
  const gap = d.gap || {};
  const plan = d.plan || {};
  const days = (Array.isArray(gap.days) ? gap.days : []).slice(0, 7).map((x) => `- ${clean(x.label, 30)}: ${Math.round(num(x.kcal, -9000, 9000) || 0)} kcal vs plan${x.foods ? ` (${clean(x.foods, 160)})` : ''}`).join('\n');
  const cardio = (Array.isArray(plan.cardio) ? plan.cardio : []).slice(0, 4).map((c) => `${num(c.count, 1, 7)} x ${num(c.min, 5, 90)} min ${clean(c.name, 40)}`).join(', ');
  const system = `You are a calm, encouraging coach inside Gainloop, a UK fitness app. Someone's eating went off their plan and the app has already worked out a safe plan to get back on track. Explain it and give practical tips.
Rules: no guilt or shame, and never call food good or bad. Never suggest skipping meals, fasting, purging, or extra exercise beyond the plan. Don't change any of the numbers. If being off plan happens often, suggest a more flexible plan rather than stricter rules. UK English.
Answer with JSON only, no other text, in exactly this shape:
{"message":"2 to 3 sentences, under 70 words","tips":["under 20 words","under 20 words","under 20 words"]}`;
  const user = `Goal: ${goal}.
Off plan:
${days || '- one day'}
Total: ${Math.round(num(gap.kcal, -20000, 20000) || 0)} kcal vs plan.
The app's plan: ${num(plan.days, 1, 21)} days at ${Math.round(num(plan.kcal, 800, 6000) || 0)} kcal a day (${Math.round(num(plan.perDay, -2000, 2000) || 0)} kcal a day versus normal), protein stays at ${Math.round(num(plan.protein, 0, 400) || 0)} g.${cardio ? ` Extra cardio: ${cardio}.` : ''}
Food rules: ${rulesText(d.rules).replace(/\n/g, ' ')}`;
  return { system, user, maxTokens: 1200 };
}

// ---------- Talking to the model ----------

// Workers AI models answer in a few shapes; find the text in any of them
export function textOf(res) {
  if (!res) return '';
  if (typeof res === 'string') return res;
  if (typeof res.response === 'string') return res.response;
  if (res.response && typeof res.response === 'object') return JSON.stringify(res.response);
  if (typeof res.output_text === 'string') return res.output_text;
  const choice = res.choices?.[0];
  if (typeof choice?.message?.content === 'string') return choice.message.content;
  if (typeof choice?.text === 'string') return choice.text;
  if (Array.isArray(res.output)) {
    const parts = [];
    for (const o of res.output) {
      if (o?.type && o.type !== 'message') continue;
      for (const c of o?.content || []) if (typeof c?.text === 'string') parts.push(c.text);
    }
    if (parts.length) return parts.join('');
  }
  if (res.result) return textOf(res.result);
  return '';
}

// Pull the JSON object out of a reply, even if it came wrapped in a code block or with words around it
export function parseJSON(text) {
  const s = String(text || '').replace(/```(?:json)?/gi, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    return null;
  }
}

async function ask(env, { system, user, maxTokens }, schema, report = null) {
  const attempts = [
    { model: MODELS.main, input: { instructions: system, input: user, reasoning: { effort: 'low' } } },
    { model: MODELS.main, input: { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens, temperature: 0.4 } },
    { model: MODELS.backup, input: { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: Math.min(maxTokens, 2000), temperature: 0.4, ...(schema ? { response_format: { type: 'json_schema', json_schema: schema } } : {}) } },
  ];
  let lastError = 'no answer';
  for (const a of attempts) {
    const t0 = Date.now();
    try {
      const res = await env.AI.run(a.model, a.input);
      const text = textOf(res);
      const data = parseJSON(text);
      report?.push({ model: a.model, shape: a.input.messages ? 'messages' : 'responses', ms: Date.now() - t0, ok: !!data, keys: res && typeof res === 'object' ? Object.keys(res).slice(0, 8) : typeof res, sample: clean(text, 300) });
      if (data) return { data, model: a.model };
      lastError = 'unreadable answer';
    } catch (err) {
      lastError = clean(err?.message || err, 160);
      report?.push({ model: a.model, shape: a.input.messages ? 'messages' : 'responses', ms: Date.now() - t0, ok: false, error: lastError });
      // the daily free allowance is used up: every model will say the same
      if (/limit|quota|capacity|neuron|429/i.test(lastError)) break;
    }
  }
  const e = new Error(lastError);
  e.limit = /limit|quota|capacity|neuron|429/i.test(lastError);
  throw e;
}

// ---------- Checking what came back ----------

function tidyMeal(m) {
  const ingredients = (Array.isArray(m?.ingredients) ? m.ingredients : []).slice(0, 12).map((i) => ({
    food: clean(i?.food, 60),
    grams: num(i?.grams, 0, 1500) ?? 0,
    kcal: num(i?.kcal, 0, 2500) ?? 0,
    p: num(i?.protein ?? i?.p, 0, 300) ?? 0,
    c: num(i?.carbs ?? i?.c, 0, 400) ?? 0,
    f: num(i?.fat ?? i?.f, 0, 250) ?? 0,
  })).filter((i) => i.food);
  const steps = (Array.isArray(m?.steps) ? m.steps : []).slice(0, 6).map((s) => clean(s, 220)).filter(Boolean);
  const name = clean(m?.name, 60);
  if (!name || !ingredients.length || !steps.length) return null;
  return {
    name,
    slot: SLOTS.includes(m?.slot) ? m.slot : null,
    minutes: num(m?.minutes, 2, 180) ?? null,
    ingredients,
    steps,
    notInList: (Array.isArray(m?.notInList) ? m.notInList : []).slice(0, 6).map((x) => clean(x, 40)).filter(Boolean),
  };
}

function tidyItems(data) {
  const items = (Array.isArray(data?.items) ? data.items : []).slice(0, 12).map((i) => ({
    food: clean(i?.food, 60),
    amount: clean(i?.amount, 60),
    kcal: num(i?.kcal, 0, 5000) ?? 0,
    p: num(i?.protein ?? i?.p, 0, 400) ?? 0,
    c: num(i?.carbs ?? i?.c, 0, 600) ?? 0,
    f: num(i?.fat ?? i?.f, 0, 400) ?? 0,
  })).filter((i) => i.food);
  return { items, confidence: ['low', 'medium', 'high'].includes(data?.confidence) ? data.confidence : 'medium' };
}

const SCHEMAS = {
  meals: {
    type: 'object',
    properties: {
      meals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' }, slot: { type: 'string' }, minutes: { type: 'number' },
            ingredients: { type: 'array', items: { type: 'object', properties: { food: { type: 'string' }, grams: { type: 'number' }, kcal: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' } }, required: ['food', 'grams', 'kcal', 'protein', 'carbs', 'fat'] } },
            steps: { type: 'array', items: { type: 'string' } },
            notInList: { type: 'array', items: { type: 'string' } },
          },
          required: ['name', 'slot', 'ingredients', 'steps'],
        },
      },
    },
    required: ['meals'],
  },
  estimate: {
    type: 'object',
    properties: { items: { type: 'array', items: { type: 'object', properties: { food: { type: 'string' }, amount: { type: 'string' }, kcal: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' } }, required: ['food', 'kcal', 'protein', 'carbs', 'fat'] } }, confidence: { type: 'string' } },
    required: ['items'],
  },
  coach: {
    type: 'object',
    properties: { message: { type: 'string' }, tips: { type: 'array', items: { type: 'string' } } },
    required: ['message', 'tips'],
  },
};

export async function runTask(env, d) {
  const task = d?.task;
  if (task === 'meals') {
    if (!clean(d.foods)) return { status: 400, body: { error: 'Tell me what food you have first.' } };
    const { data, model } = await ask(env, mealsPrompt(d), SCHEMAS.meals);
    const meals = (Array.isArray(data.meals) ? data.meals : []).map(tidyMeal).filter(Boolean).slice(0, 4);
    return { status: 200, body: { meals, model } };
  }
  if (task === 'estimate') {
    if (!clean(d.text)) return { status: 400, body: { error: 'Say what you ate first.' } };
    const { data, model } = await ask(env, estimatePrompt(d), SCHEMAS.estimate);
    return { status: 200, body: { ...tidyItems(data), model } };
  }
  if (task === 'coach') {
    const { data, model } = await ask(env, coachPrompt(d), SCHEMAS.coach);
    const tips = (Array.isArray(data.tips) ? data.tips : []).slice(0, 3).map((t) => clean(t, 160)).filter(Boolean);
    return { status: 200, body: { message: clean(data.message, 600), tips, model } };
  }
  return { status: 400, body: { error: 'Unknown task.' } };
}

// ---------- The endpoint ----------

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ error: 'The AI isn’t set up on this site yet.' }, 503);
  // Requests from other websites are turned away (the app itself always comes from this one)
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Not allowed.' }, 403);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'That’s too long. Keep it shorter.' }, 413);
  let d;
  try {
    d = JSON.parse(raw);
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  try {
    const { status, body } = await runTask(env, d);
    return json(body, status);
  } catch (err) {
    if (err.limit) return json({ error: 'The free AI has used up today’s allowance. It resets overnight, at midnight UTC.', limit: true }, 429);
    return json({ error: 'The AI couldn’t answer just now. Try again in a minute.' }, 502);
  }
}

// A quick health check. ?check=gl-quick runs one small real request and reports each attempt (for setting up).
export async function onRequestGet({ env, request }) {
  const base = { ok: true, ai: !!env.AI, model: MODELS.main };
  const check = new URL(request.url).searchParams.get('check');
  if (!env.AI || !['gl-quick', 'gl-meal'].includes(check)) return json(base);
  const started = Date.now();
  const report = [];
  try {
    const p = check === 'gl-meal'
      ? mealsPrompt({ foods: 'chicken thighs, basmati rice, peppers, onions, Greek yogurt', slot: 'dinner', count: 1, targets: { dinner: { kcal: 700, p: 45, c: 75, f: 20 } }, rules: { halal: true } })
      : estimatePrompt({ text: 'a banana and a glass of semi-skimmed milk' });
    const { data, model } = await ask(env, p, check === 'gl-meal' ? SCHEMAS.meals : SCHEMAS.estimate, report);
    return json({ ...base, ms: Date.now() - started, used: model, report, data });
  } catch (err) {
    return json({ ...base, ms: Date.now() - started, report, error: clean(err?.message || err, 200) });
  }
}
