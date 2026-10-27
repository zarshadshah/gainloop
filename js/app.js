// Gainloop: screens, actions and routing. The maths lives in calc.js, plan.js, meals.js and engine.js.
import { addDays, andList, dayLong, dayShort, daysBetween, esc, fmtDate, fmtInt, isoDate, lcFirst, plural, relDays, round, uid, weekdayIndex } from './util.js';
import { downloadText } from './download.js';
import { bodyInputValue, fmtBody, fmtBodyDelta, fmtHeight, fmtLen, fmtLenDelta, fmtLenNum, fmtLift, heightParts, kgToLb, lbToKg, lenFromCm, lenToCm, lenUnitLabel, liftInputValue, liftToKg, parseNum, stoneParts, CM_PER_IN } from './units.js';
import * as C from './calc.js';
import { CARDIO, EFFORTS, MUSCLES, allExercises, cardioExercises, cardioKcal, customExercises, effortIndex, exerciseById, isCardio, muscleName, setCustomExercises } from './data/exercises.js';
import { AVOID_OPTIONS, INGREDIENTS, SLOTS } from './data/foods.js';
import { GUIDES } from './data/guides.js';
import { PICTURE_CREDIT, PICTURE_CREDIT_URL, frameSrcs, pictureFor, thumbSrc } from './data/pictures.js';
import { CONDITIONS, DIABETES, PAIN, STRESS, blankHealth, hasHealth, healthSummary, normHealth, repRange } from './health.js';
import { namesMatch, searchExercises } from './search.js';
import { matchRecipes, mealIdeas, pickableIngredients } from './pantry.js';
import { CARDIO_FINISH, MAX_EXERCISES, MAX_SETS, PROGRAM_VERSION, advice, cardioAdvice, nextSessionId, repText, restText, swapChoices, whySets } from './plan.js';
import { applySwap, dayTotals, mealLines, mealMacros, needsHalalNote, pantryLine, rescaleDay, shoppingList, swapOptions } from './meals.js';
import { afterBodyChange, afterProfileChange, allowedMeals, analyseCheckin, applyCheckin, dietOf, ensureCurrentWeek, mealsById, refreshMeals, refreshProgram, rescaleMeals, rulesOf, seedDemo, startState, targetsFor, weekDate, wellnessChangeItems } from './engine.js';
import { LOOKBACK, SLOT_SHARE, addLogItem, adjustmentProgress, applyCatchUp, cardioOffer, cardioToDo, catchUpOptions, dayTargets, diffOf, leaveGap, logFor, loggedMeal, markCardio, pendingGap, pruneLog, removeLogItem, stopAdjustment } from './track.js';
import { AIError, aiMeal, aiRules, callAI, estimateTotal, slotTargets } from './ai.js';
import { BANDS, MAX_SCORE, QUESTIONS, activeEntry, addWellness, adjustWeek, assess, familiarSet, history as wellnessHistory, isComplete, totalOf, weekSettings, weekSummary, wellbeingNote, wellnessDue } from './wellness.js';
import { LOAD_GROUPS, MAX_CHANGE, closeWeeks, groupOf, planWeek, rxText, weekSoFar } from './load.js';
import { APP_VERSION, blankState, clearSaved, exportText, isStorageOK, loadState, parseBackup, saveState } from './store.js';
import { drawWeightChart, tapeHTML } from './charts.js';

const PREVIEW = typeof window !== 'undefined' && !!window.GAINLOOP_PREVIEW;
const today = () => isoDate();

let S = loadState();
const ui = { setup: null, checkin: null, eatDay: weekdayIndex(isoDate()), sheet: null, installEvent: null, lastRoute: '', copyText: '', picPaused: false, libFilter: 'all', libQuery: '', ideas: new Map(), aiSlot: 'any', aiBusy: false, aiError: '', ot: null, coachBusy: false, coachError: '', estBusy: false };
const rules = () => rulesOf(S);
const reduceMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Small picture of an exercise for lists
function thumb(exId) {
  const p = pictureFor(exId);
  if (!p) return '<span class="thumb thumb-none">Your own</span>';
  return `<span class="thumb"><img src="${thumbSrc(p)}" alt="" width="60" height="60" loading="lazy" decoding="async"></span>`;
}

// The how-to pictures: the start and end of the move, switching back and forth.
// Side by side when motion is turned down or the two were drawn from different angles; one picture for holds.
function pictureStage(ex) {
  const p = pictureFor(ex.id);
  if (!p) return '<div class="pic pic-none"><p>There’s no picture for exercises you add yourself. The video link below shows how others do it.</p></div>';
  const mode = p.mode === 'still' ? 'still' : p.mode === 'pair' || reduceMotion() ? 'pair' : 'loop';
  const label = mode === 'still' ? `Picture of ${lcFirst(ex.name)}` : `Pictures of the start and end of ${lcFirst(ex.name)}`;
  const frames = frameSrcs(p).map((src, i) => `<img class="pic-frame pic-f${i + 1}${p.flip === i + 1 ? ' flip' : ''}" src="${src}" alt="" decoding="async">`).join('');
  return `<figure class="pic pic-${mode}${mode === 'loop' && ui.picPaused ? ' paused' : ''}" role="img" aria-label="${esc(label)}">${frames}</figure>`;
}
// What an exercise needs, in a few words ('No equipment' rather than 'Nothing')
function kitText(exId, first = false) {
  const kit = GUIDES[exId]?.kit || [];
  if (!kit.length) return '';
  if (/^nothing/i.test(kit[0])) return 'No equipment';
  return first ? kit[0] : kit.map((k, i) => (i ? lcFirst(k) : k)).join(', ');
}
// Health items that change one part of the plan ('train' or 'food')
const healthFor = (area) => rules().items.filter((i) => i.areas?.includes(area));

// ---------- Icons ----------
const svg = (body) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
const I = {
  today: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15.2" r="1.7" class="fill"/>'),
  body: svg('<circle cx="10" cy="12" r="6.5"/><circle cx="10" cy="12" r="1.8"/><path d="M16.5 10.2h4.2v3.6h-4.2M18.4 10.2v1.6M20 10.2v1.1"/>'),
  train: svg('<path d="M7.5 12h9"/><rect x="2.5" y="9" width="3" height="6" rx="1"/><rect x="5" y="7" width="2.6" height="10" rx="1"/><rect x="18.5" y="9" width="3" height="6" rx="1"/><rect x="16.4" y="7" width="2.6" height="10" rx="1"/>'),
  eat: svg('<path d="M3.5 12h17a8.5 8.5 0 0 1-17 0Z"/><path d="M9 3.5c-.9.9.9 1.8 0 3.2M13 3.5c-.9.9.9 1.8 0 3.2"/>'),
  you: svg('<circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20.2c.6-3.8 3.5-6.1 7.2-6.1s6.6 2.3 7.2 6.1"/>'),
  back: svg('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
  next: svg('<path d="M9.5 5.5 16 12l-6.5 6.5"/>'),
  swap: svg('<path d="M4 8.5h13.5M14 5l3.5 3.5L14 12M20 15.5H6.5M10 12l-3.5 3.5L10 19"/>'),
  info: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2"/><circle cx="12" cy="7.9" r="1" class="fill"/>'),
  check: svg('<path d="m5 12.5 4.3 4.3L19 7.2"/>'),
  close: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  alert: svg('<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4.4"/><circle cx="12" cy="17" r="1" class="fill"/>'),
  share: svg('<path d="M12 3.5v11M8 7.2l4-3.7 4 3.7"/><path d="M7 10.5H5.5v10h13v-10H17"/>'),
  copy: svg('<rect x="8" y="8" width="11.5" height="12" rx="2"/><path d="M5 15.5V5.8C5 4.8 5.8 4 6.8 4h8.4"/>'),
  ai: svg('<path d="M11 3.5l1.8 4.9 4.9 1.8-4.9 1.8L11 16.9l-1.8-4.9-4.9-1.8 4.9-1.8Z"/><path d="M18 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z"/>'),
};

const mark = (size = 72) => `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
  <rect width="120" height="120" rx="28" class="mark-bg"/>
  <circle cx="58" cy="60" r="31" class="mark-ring"/>
  ${Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    const r2 = i % 3 === 0 ? 34 : 30;
    const x1 = 58 + Math.cos(a) * 26; const y1 = 60 + Math.sin(a) * 26;
    const x2 = 58 + Math.cos(a) * r2; const y2 = 60 + Math.sin(a) * r2;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="mark-tick"/>`;
  }).join('')}
  <rect x="86" y="53" width="20" height="14" rx="2.5" class="mark-tab"/>
</svg>`;

// ---------- Unit-aware formatting ----------
const U = () => S.units;
const fLen = (cm, dp = 1) => fmtLen(cm, U().len, dp);
const fBody = (kg, dp = 1) => fmtBody(kg, U().body, dp);
const fLift = (kg) => fmtLift(kg, U().lift);
const lenUnit = () => lenUnitLabel(U().len);
const liftUnit = () => (U().lift === 'lb' ? 'lb' : 'kg');
const kcal = (n) => `${fmtInt(n)} kcal`;
const fKgPlain = (kg, dp = 1) => (U().body === 'kg' ? `${round(kg, dp)} kg` : `${round(kgToLb(kg), dp)} lb`);

// ---------- Saving and feedback ----------
function save() {
  saveState(S);
}
function commit(message) {
  save();
  render();
  if (message) toast(message);
}

let toastTimer;
function toast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ---------- Small HTML builders ----------
// Read form controls through .elements so names like 'name' or 'style' never clash with form properties
const fe = (form, name) => form?.elements?.namedItem(name) || null;
const fval = (form, name) => fe(form, name)?.value ?? '';
const fchecked = (form, name) => !!fe(form, name)?.checked;
const field = (id, label, control, hint = '') => `<div class="field"><label for="${id}">${label}</label>${control}${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;

function numBox(id, value, unit, opts = {}) {
  const v = value === null || value === undefined || value === '' ? '' : value;
  return `<div class="input-unit${opts.small ? ' small' : ''}"><input id="${id}" name="${id}" inputmode="decimal" autocomplete="off" value="${esc(v)}"${opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : ''}${opts.live ? ` data-live="${opts.live}"` : ''}${opts.data || ''}><span class="unit">${unit}</span></div>`;
}

function seg(name, options, current, act = '') {
  return `<div class="seg" role="radiogroup">${options
    .map(([val, label]) => {
      const id = `${name}-${val}`;
      return `<input type="radio" id="${id}" name="${name}" value="${esc(val)}"${String(current) === String(val) ? ' checked' : ''}${act ? ` data-change="${act}"` : ''}><label for="${id}">${label}</label>`;
    })
    .join('')}</div>`;
}

function choices(name, options, current, disabled = {}) {
  return `<div class="choices">${options
    .map(([val, title, desc]) => {
      const id = `${name}-${val}`;
      const dis = disabled[val];
      return `<input type="radio" id="${id}" name="${name}" value="${esc(val)}"${String(current) === String(val) ? ' checked' : ''}${dis ? ' disabled' : ''}><label for="${id}"><span class="choice-title">${title}</span>${desc ? `<span class="choice-desc">${desc}</span>` : ''}${dis ? `<span class="choice-desc warn-text">${dis}</span>` : ''}</label>`;
    })
    .join('')}</div>`;
}

function chips(name, options, selected) {
  return `<div class="chips">${options
    .map(([val, label]) => {
      const id = `${name}-${val}`;
      return `<input type="checkbox" id="${id}" name="${name}" value="${esc(val)}"${selected.includes(val) ? ' checked' : ''}><label for="${id}">${label}</label>`;
    })
    .join('')}</div>`;
}

function bodyWeightControl(base, kg) {
  if (U().body === 'st') {
    const parts = kg ? stoneParts(kg) : { st: '', lb: '' };
    return `<div class="pair">${numBox(`${base}-st`, parts.st, 'st')}${numBox(`${base}-lb`, parts.lb === '' ? '' : round(parts.lb, 1), 'lb')}</div>`;
  }
  return numBox(base, kg ? bodyInputValue(kg, U().body) : '', U().body);
}

function readBodyWeight(form, base) {
  if (U().body === 'st') {
    const st = parseNum(fval(form, `${base}-st`));
    const lb = parseNum(fval(form, `${base}-lb`)) ?? 0;
    if (st === null && !lb) return null;
    return lbToKg((st || 0) * 14 + lb);
  }
  const v = parseNum(fval(form, base));
  if (v === null) return null;
  return U().body === 'lb' ? lbToKg(v) : v;
}

function heightControl(base, cm) {
  if (U().len === 'in') {
    const p = cm ? heightParts(cm) : { ft: '', inch: '' };
    return `<div class="pair">${numBox(`${base}-ft`, p.ft, 'ft')}${numBox(`${base}-in`, p.inch === '' ? '' : round(p.inch, 0), 'in')}</div>`;
  }
  return numBox(base, cm ? Math.round(cm) : '', 'cm');
}

function readHeight(form, base) {
  if (U().len === 'in') {
    const ft = parseNum(fval(form, `${base}-ft`));
    const inch = parseNum(fval(form, `${base}-in`)) ?? 0;
    if (ft === null) return null;
    return (ft * 12 + inch) * CM_PER_IN;
  }
  return parseNum(fval(form, base));
}

const lenValue = (cm) => (cm === null || cm === undefined ? '' : fmtLenNum(cm, U().len, 1));
const readLen = (form, id) => {
  const v = parseNum(fval(form, id));
  return v === null ? null : lenToCm(v, U().len);
};

function banner(html, kind = '') {
  return `<div class="banner${kind ? ` banner-${kind}` : ''}">${html}</div>`;
}

const backLink = (href, label) => `<a class="back" href="${href}">${I.back}<span>${label}</span></a>`;

// ---------- Install ----------
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function installHTML(compact = false) {
  if (PREVIEW) return `<p class="muted">This is a preview inside Claude. Put the files on a web host (the README shows how), open your link on your phone, then add it to your home screen.</p>`;
  if (isStandalone()) return `<p class="muted">${I.check} Installed on this device.</p>`;
  if (ui.installEvent) return `<button class="btn${compact ? ' btn-small' : ''}" data-act="install">Install Gainloop</button>`;
  if (isIOS()) return `<p class="muted">In Safari, tap ${I.share} Share, then <strong>Add to Home Screen</strong>. The home-screen app keeps its own data, separate from Safari, so set up there, or move your data across with a backup and <strong>Restore</strong>.</p>`;
  return `<p class="muted">In Chrome, open the menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>`;
}

// ---------- Views ----------

function welcomeView() {
  return `<section class="welcome">
    ${mark(84)}
    <h1 class="display">Gainloop</h1>
    <p class="lede">Build muscle with a plan that checks your tape measure and adjusts.</p>
    <ol class="loop">
      <li><strong>Measure</strong> your arms, chest, waist and a few more spots with a soft tape.</li>
      <li><strong>Get your plan:</strong> targets from your frame, training built around your equipment and the exercises you already do, and meals that fit your food rules and health.</li>
      <li><strong>Check in every two weeks.</strong> Calories and training adjust to what actually changed, and the app tells you why. Every Sunday, five quick questions on how you feel set how hard the week’s sessions are.</li>
    </ol>
    <div class="stack">
      <a class="btn btn-primary" href="#setup">Set up in about 3 minutes</a>
      <button class="btn" data-act="demo">Explore with example data</button>
      <a class="btn-link" href="#restore">Restore a backup</a>
    </div>
    <p class="fine">Your data stays on this device. No account needed. The AI helpers only send what they need, when you use them.</p>
  </section>`;
}

// ----- Setup and profile editing -----

function newDraft(mode) {
  if (mode === 'edit' && S.profile) {
    const p = S.profile;
    return { ...p, age: C.ageNow(p, today()), diet: { ...p.diet, avoid: [...(p.diet.avoid || [])] }, kg: C.currentWeight(S.weights, today()), frame: {}, cm: {} };
  }
  return { name: '', sex: 'male', age: '', heightCm: null, kg: null, experience: 'beginner', days: 3, minutes: 60, equipment: 'gym', pullupBar: false, goal: 'build', activity: 'medium', diet: { style: 'any', halal: false, avoid: [], dislikes: '' }, health: blankHealth(), myEx: [], customEx: [], frame: {}, cm: {} };
}

// Health and the exercises you already do have their own screens once you're set up, so editing skips them
const NEW_STEPS = ['about', 'health', 'training', 'exercises', 'goal', 'food', 'measure'];
const EDIT_STEPS = ['about', 'training', 'goal', 'food'];
const stepsFor = (mode) => (mode === 'edit' ? EDIT_STEPS : NEW_STEPS);

function setupView(mode = 'new') {
  if (!ui.setup || ui.setup.mode !== mode) ui.setup = { mode, step: 0, draft: newDraft(mode), error: '' };
  const st = ui.setup;
  const d = st.draft;
  const steps = stepsFor(mode);
  const name = steps[st.step];
  const last = st.step === steps.length - 1;
  let body = '';

  if (name === 'about') {
    body = `
      <h1 class="title">About you</h1>
      <p class="muted">Used for your calories, body fat estimate and targets.</p>
      ${field('firstname', 'First name <span class="opt">optional</span>', `<input id="firstname" name="firstname" autocomplete="given-name" maxlength="40" value="${esc(d.name || '')}">`)}
      <fieldset class="field"><legend>Sex</legend>${seg('sex', [['male', 'Male'], ['female', 'Female']], d.sex)}<p class="hint">The body fat and calorie formulas differ by sex.</p></fieldset>
      ${field('age', 'Age', numBox('age', d.age, 'years'))}
      <fieldset class="field"><legend>Measure lengths in</legend>${seg('u-len', [['cm', 'cm'], ['in', 'inches']], U().len, 'units-setup')}</fieldset>
      ${field(U().len === 'in' ? 'height-ft' : 'height', 'Height', heightControl('height', d.heightCm))}
      ${mode === 'new' ? `<fieldset class="field"><legend>Weigh yourself in</legend>${seg('u-body', [['kg', 'kg'], ['st', 'stone'], ['lb', 'lb']], U().body, 'units-setup')}</fieldset>
      ${field(U().body === 'st' ? 'weight-st' : 'weight', 'Weight today', bodyWeightControl('weight', d.kg))}` : ''}`;
  } else if (name === 'health') {
    body = `
      <h1 class="title">Health</h1>
      <p class="muted">Optional. If any of these apply, your training and meals are adjusted and you get safety notes. If none do, tap Continue.</p>
      ${healthFields(d.health || blankHealth())}
      <p class="fine">General guidance, not medical advice: your doctor’s or care team’s advice comes first. This stays on your phone.</p>`;
  } else if (name === 'training') {
    body = `
      <h1 class="title">Training</h1>
      <fieldset class="field"><legend>Lifting experience</legend>${choices('experience', Object.entries(C.EXPERIENCE).map(([k, v]) => [k, v.name, v.desc]), d.experience)}</fieldset>
      <fieldset class="field"><legend>Days a week</legend>${seg('days', [2, 3, 4, 5, 6].map((n) => [n, String(n)]), d.days)}</fieldset>
      <fieldset class="field"><legend>Time per session</legend>${seg('minutes', [45, 60, 75, 90].map((n) => [n, `${n} min`]), d.minutes)}</fieldset>
      <fieldset class="field"><legend>Where you train</legend>${choices('equipment', [['gym', 'A gym', 'Barbells, dumbbells, cables and machines.'], ['home', 'Home with dumbbells', 'A set of dumbbells and a bench.'], ['bw', 'Bodyweight only', 'No equipment. A backpack and a chair help.']], d.equipment)}</fieldset>
      <div class="field check"><input type="checkbox" id="pullupBar" name="pullupBar"${d.pullupBar ? ' checked' : ''}><label for="pullupBar">I have a pull-up bar at home</label></div>`;
  } else if (name === 'exercises') {
    body = `
      <h1 class="title">Exercises you already do</h1>
      <p class="muted">Optional. Add the ones you do now and your plan keeps them, building everything else around them. Any name works, like “bench”, “RDL” or “pull-ups”.</p>
      ${pickerHTML('setup')}`;
  } else if (name === 'goal') {
    const lean = C.leanAllowed({ ...d, ageSetOn: today() }, d.kg || C.currentWeight(S.weights, today()), today());
    body = `
      <h1 class="title">Goal</h1>
      <fieldset class="field"><legend>What you want</legend>${choices('goal', Object.entries(C.GOALS).map(([k, v]) => [k, v.name, v.desc]), lean.ok || d.goal !== 'lean' ? d.goal : 'build', lean.ok ? {} : { lean: lean.why })}</fieldset>
      <fieldset class="field"><legend>Outside training, your day is</legend>${choices('activity', Object.entries(C.ACTIVITY).map(([k, v]) => [k, v.name]), d.activity)}</fieldset>`;
  } else if (name === 'food') {
    body = `
      <h1 class="title">Food rules</h1>
      <p class="muted">Meals that break a rule are never put in your plan.</p>
      ${dietFields(d.diet)}`;
  } else if (name === 'measure') {
    body = `
      <h1 class="title">Measurements</h1>
      <p class="muted">A soft tape and five minutes. Skip any you can't do now and add them later.</p>
      <h2 class="h2">Your frame</h2>
      <p class="fine">Wrist and ankle size sets your targets. Measure once.</p>
      ${C.FRAME_SITES.map((s) => measureField(s.id, d.frame[s.id] ?? null, null, d.sex)).join('')}
      <h2 class="h2">Today</h2>
      ${C.sitesFor(d.sex).map((s) => measureField(s.id, d.cm[s.id] ?? null, null, d.sex)).join('')}`;
  }

  return `<section class="setup">
    <div class="steps" aria-label="Step ${st.step + 1} of ${steps.length}">
      ${mode === 'edit' && st.step === 0 ? backLink('#you', 'You') : st.step > 0 ? `<button class="back" data-act="setup-back">${I.back}<span>Back</span></button>` : '<a class="back" href="#welcome">' + I.back + '<span>Start</span></a>'}
      <span class="step-count">Step ${st.step + 1} of ${steps.length}</span>
    </div>
    <div class="step-bar"><span style="width:${((st.step + 1) / steps.length) * 100}%"></span></div>
    <form data-form="setup" novalidate>
      ${body}
      ${st.error ? `<p class="error" role="alert">${esc(st.error)}</p>` : ''}
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">${last ? (mode === 'edit' ? 'Save changes' : 'Make my plan') : 'Continue'}</button>
        ${name === 'measure' ? '<button class="btn-link" type="button" data-act="setup-skip">Skip measurements for now</button>' : ''}
      </div>
    </form>
  </section>`;
}

function dietFields(diet) {
  return `
    <fieldset class="field"><legend>Diet</legend>${seg('dietstyle', [['any', 'Anything'], ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan']], diet.style)}</fieldset>
    <div class="field check"><input type="checkbox" id="halal" name="halal"${diet.halal ? ' checked' : ''}><label for="halal">Halal</label></div>
    <fieldset class="field"><legend>Leave out</legend>${chips('avoid', AVOID_OPTIONS.map((o) => [o.id, o.name]), diet.avoid || [])}</fieldset>
    ${field('dislikes', 'Foods you don’t eat <span class="opt">optional</span>', `<input id="dislikes" name="dislikes" value="${esc(diet.dislikes || '')}" placeholder="mushrooms, olives">`, 'Separate with commas. Any meal with these in its name or ingredients is left out.')}`;
}

function readDiet(form) {
  return {
    style: fval(form, 'dietstyle') || 'any',
    halal: fchecked(form, 'halal'),
    avoid: [...form.querySelectorAll('input[name="avoid"]:checked')].map((i) => i.value),
    dislikes: fval(form, 'dislikes').trim().slice(0, 200),
  };
}

function measureField(site, valueCm, prev, sex, opts = {}) {
  const id = `m-${site}`;
  const how = C.siteHow(site, sex);
  return `<div class="field measure">
    <div class="measure-row">
      <label for="${id}">${C.siteName(site)}</label>
      ${numBox(id, valueCm !== null && valueCm !== undefined ? lenValue(valueCm) : '', lenUnit(), { small: true, live: 'measure', data: ` data-site="${site}"${opts.excludeId ? ` data-exclude="${opts.excludeId}"` : ''}` })}
    </div>
    <details class="how"><summary>How to measure</summary><p>${esc(how)}</p></details>
    ${prev ? `<p class="fine">Last: ${fLen(prev.v)} on ${fmtDate(prev.d, 'day')}</p>` : ''}
    <p class="warn" data-warn-for="${site}" hidden></p>
  </div>`;
}

function captureSetup(form, strict) {
  const st = ui.setup;
  const d = st.draft;
  st.error = '';
  const fail = (msg) => { if (strict) { st.error = msg; return false; } return true; };
  const name = stepsFor(st.mode)[st.step];
  if (name === 'about') {
    d.name = fval(form, 'firstname').trim().slice(0, 40);
    d.sex = fval(form, 'sex') || d.sex;
    const age = parseNum(fval(form, 'age'));
    d.age = age ?? '';
    const h = readHeight(form, 'height');
    d.heightCm = h;
    if (st.mode === 'new') d.kg = readBodyWeight(form, 'weight');
    if (!age || age < 13 || age > 100) return fail('Enter your age. Gainloop is for ages 13 and up.');
    if (!h || h < 120 || h > 230) return fail('Enter a height between 120 and 230 cm (about 4 to 7.5 ft).');
    if (st.mode === 'new' && (!d.kg || d.kg < 30 || d.kg > 250)) return fail('Enter your weight today.');
  } else if (name === 'health') {
    d.health = readHealth(form);
  } else if (name === 'training') {
    d.experience = fval(form, 'experience') || d.experience;
    d.days = Number(fval(form, 'days') || d.days);
    d.minutes = Number(fval(form, 'minutes') || d.minutes);
    d.equipment = fval(form, 'equipment') || d.equipment;
    d.pullupBar = fchecked(form, 'pullupBar');
  } else if (name === 'goal') {
    d.goal = fval(form, 'goal') || d.goal;
    d.activity = fval(form, 'activity') || d.activity;
    const lean = C.leanAllowed({ ...d, ageSetOn: today() }, d.kg || C.currentWeight(S.weights, today()), today());
    if (d.goal === 'lean' && !lean.ok) d.goal = 'build';
  } else if (name === 'food') {
    d.diet = readDiet(form);
  } else if (name === 'measure') {
    for (const s of C.FRAME_SITES) d.frame[s.id] = readLen(form, `m-${s.id}`);
    for (const s of C.sitesFor(d.sex)) d.cm[s.id] = readLen(form, `m-${s.id}`);
  }
  return true;
}

function finishSetup(withMeasures) {
  const d = ui.setup.draft;
  const t = today();
  const keep = { units: S.units, theme: S.theme };
  S = { ...blankState(), ...keep };
  S.profile = {
    name: d.name, sex: d.sex, age: Number(d.age), ageSetOn: t, heightCm: round(d.heightCm, 1), experience: d.experience, goal: d.goal,
    days: d.days, minutes: d.minutes, equipment: d.equipment, pullupBar: d.pullupBar, activity: d.activity, diet: d.diet,
    health: normHealth(d.health),
  };
  S.customExercises = [...(d.customEx || [])];
  S.myExercises = [...(d.myEx || [])];
  setCustomExercises(S.customExercises);
  S.weights = [{ d: t, kg: round(d.kg, 2) }];
  if (withMeasures) {
    if (d.frame.wrist && d.frame.ankle) S.frame = { wrist: round(d.frame.wrist, 1), ankle: round(d.frame.ankle, 1), d: t };
    const cm = Object.fromEntries(Object.entries(d.cm).filter(([, v]) => Number.isFinite(v) && v > 0).map(([k, v]) => [k, round(v, 1)]));
    if (Object.keys(cm).length) S.measures = [{ id: uid('m'), d: t, cm }];
  }
  startState(S, t);
  ui.setup = null;
  save();
  location.hash = '#today';
  toast('Your plan is ready');
}

function finishEdit() {
  const d = ui.setup.draft;
  const t = today();
  const before = { ...S.profile, diet: { ...S.profile.diet } };
  const ageChanged = Number(d.age) !== C.ageNow(S.profile, t);
  S.profile = {
    ...S.profile,
    name: d.name, sex: d.sex, heightCm: round(d.heightCm, 1), experience: d.experience, goal: d.goal, days: d.days, minutes: d.minutes,
    equipment: d.equipment, pullupBar: d.pullupBar, activity: d.activity, diet: d.diet,
    ...(ageChanged ? { age: Number(d.age), ageSetOn: t } : {}),
  };
  const items = afterProfileChange(S, before, t);
  ui.setup = null;
  save();
  location.hash = '#you';
  toast(items.length ? 'Saved. Your plan has been updated.' : 'Saved');
}

// ----- Today -----

function demoBanner() {
  if (!S.demo) return '';
  return banner(`<p><strong>You're looking at example data.</strong> Explore every screen, then set up with your own details.</p><button class="btn btn-small" data-act="start-own">Start my own</button>`, 'tape');
}

function storageBanner() {
  if (PREVIEW) return S.demo ? '' : banner('<p>Preview: anything you enter stays in this browser only. The installed app keeps it on your phone.</p>');
  if (!isStorageOK()) return banner(`<p>${I.alert} This browser isn't letting Gainloop save. Leave private browsing, or your data will be lost when you close the page.</p>`, 'warn');
  return '';
}

function todayView() {
  const t = today();
  const p = S.profile;
  const status = C.checkinStatus(S, t);
  const prog = S.program;
  const nextId = nextSessionId(prog, S.sessionsDone);
  const next = prog.sessions.find((s) => s.id === nextId);
  const doneToday = S.sessionsDone.filter((x) => x.d === t).map((x) => prog.sessions.find((s) => s.id === x.sid)?.name).filter(Boolean);
  const weighedToday = S.weights.find((w) => w.d === t);
  const trend = C.trendAt(S.weights, t);
  const rate = C.weightRate(S.weights, t);
  const prio = (prog.priorities || []).filter((x) => x.source === 'tape');
  const progress = C.siteProgress(S);
  const install = !PREVIEW && !isStandalone() && !S.installDismissed && (ui.installEvent || isIOS());
  const r = rules();
  // "Check with your doctor first" notes stay on Today until you tick them off, and come back if they change
  const ackKey = r.checkFirst.join('|');
  const healthCard = r.checkFirst.length && S.healthAck !== ackKey
    ? `<section class="banner banner-warn health-banner"><div><p><strong>Before you start</strong></p><ul class="notes">${r.checkFirst.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="banner-actions"><button class="btn btn-small" data-act="health-ack">Got it</button><a class="link" href="#health">Health notes</a></div></section>`
    : '';

  const checkinCard = status.due
    ? `<section class="card card-tape">
        <h2 class="h3">Check-in due</h2>
        <p>It's been ${plural(status.days, 'day')} since the last one. Log your weight${status.measureDue ? ' and measurements' : ''} and your plan adjusts. About 3 minutes.</p>
        <a class="btn btn-primary" href="#checkin">Start check-in</a>
      </section>`
    : '';

  const wk = weekNow(t);
  const nextWeek = next ? weekSession(next, wk) : null;
  const workout = next
    ? `<section class="card">
        <div class="card-top"><h2 class="h3">${doneToday.length ? 'Next time' : 'Next workout'}</h2><span class="muted">about ${nextWeek.minutes} min</span></div>
        ${doneToday.length ? `<p class="done-line">${I.check} Done today: ${esc(doneToday.join(', '))}</p>` : ''}
        <p class="big-name">${esc(next.name)}</p>
        <p class="muted">${nextWeek.slots.slice(0, 4).map((sl) => esc(exerciseById(sl.ex)?.name || '')).join(', ')}${nextWeek.slots.length > 4 ? ` and ${nextWeek.slots.length - 4} more` : ''}</p>
        ${wk.entry ? `<p class="week-line"><a class="link" href="#wellness">${esc(BANDS[wk.w.band].name)}</a>: ${esc(weekShort(wk.w))}.</p>` : ''}
        ${r.train.length ? `<p class="card-note">${esc(r.train[0])}</p>` : ''}
        <a class="btn ${doneToday.length || status.due ? '' : 'btn-primary'}" href="#session-${next.id}">Start ${esc(next.name)}</a>
      </section>`
    : '';

  const weigh = `<section class="section">
      <h2 class="h2">Weigh-in</h2>
      <form data-form="weigh" class="inline-form" novalidate>
        ${bodyWeightControl('weigh', weighedToday?.kg ?? null)}
        <button class="btn" type="submit">${weighedToday ? 'Update' : 'Save'}</button>
      </form>
      <p class="fine">${trend ? `7-day average ${fBody(trend.kg)} from ${plural(trend.n, 'weigh-in')}${rate ? `, ${rate.kgPerWeek >= 0 ? 'up' : 'down'} ${fKgPlain(Math.abs(rate.kgPerWeek), 2)} a week` : ''}.` : 'No weigh-ins this week yet.'} First thing in the morning is most consistent.</p>
    </section>`;

  const food = foodTodayHTML(t);

  let focus = '';
  if (prio.length && progress) {
    const sites = [...new Set(prio.map((x) => x.site))];
    const parts = sites.map((site) => {
      const row = progress.find((x) => x.site === site);
      return `${C.siteName(site).replace(' (flexed)', '').toLowerCase()} (${fLen(row.current)} of ${fLen(row.target)})`;
    });
    const muscles = prio.map((x) => muscleName(x.muscle).toLowerCase());
    const lead = sites.length > 1 ? `Your ${andList(parts)} are furthest from target.` : `Your ${parts[0]} is furthest from target.`;
    focus = `<p>${esc(lead)} ${esc(andList(muscles).replace(/^./, (c) => c.toUpperCase()))} get extra sets this block.</p>`;
  } else if (progress) {
    focus = '<p>No measurement is lagging behind the others, so every muscle gets its normal share of sets.</p>';
  } else if (p.sex === 'male') {
    focus = '<p>Add your wrist and ankle size to get targets for each muscle.</p><a class="link" href="#frame">Add frame measurements</a>';
  } else {
    focus = '<p>Your plan follows your weight trend and measurements. Re-measure every 4 weeks.</p>';
  }

  return `<header class="screen-head">
      <div><p class="date">${fmtDate(t, 'long')}</p><h1 class="title">${p.name ? `Hi ${esc(p.name)}` : 'Today'}</h1></div>
    </header>
    ${demoBanner()}${storageBanner()}
    ${healthCard}
    ${checkinCard}
    ${wellnessDueCard(t)}
    ${trackCardHTML(t)}
    ${workout}
    ${weigh}
    ${food}
    <section class="section"><div class="section-head"><h2 class="h2">Your focus</h2><a class="link" href="#body">Targets</a></div>${focus}
      ${!status.due ? `<p class="fine">Next check-in ${status.dueIn === 0 ? 'today' : `in ${plural(status.dueIn, 'day')}`}.</p>` : ''}</section>
    ${install ? `<section class="section install"><h2 class="h2">Put it on your home screen</h2>${installHTML(true)}<button class="btn-link" data-act="install-dismiss">Not now</button></section>` : ''}`;
}

// ----- Body -----

function stat(label, value, sub = '') {
  return `<div class="stat"><p class="stat-label">${label}</p><p class="stat-value">${value}</p>${sub ? `<p class="stat-sub">${sub}</p>` : ''}</div>`;
}

function bodyView() {
  const t = today();
  const p = S.profile;
  const kg = C.currentWeight(S.weights, t);
  const lean = C.leanSummary(S, t);
  const bf = C.bodyFatNow(S);
  const rate = C.weightRate(S.weights, t);
  const progress = C.siteProgress(S);
  const lag = new Set(C.laggingSites(progress).map((r) => r.site));
  const age = C.ageNow(p, t);
  const measures = [...S.measures].sort(C.byDate).reverse();

  const stats = `<div class="stats">
    ${stat('Weight', kg ? fBody(kg) : '–', rate ? `${fmtBodyDelta(rate.kgPerWeek, U().body, 2)} a week` : '7-day average')}
    ${stat('Body fat', bf ? `${round(bf.pct, 1)}%` : '–', bf ? (bf.source === 'manual' ? 'from your scan' : 'tape estimate') : '<a class="link" href="#measure">Add neck and waist</a>')}
    ${stat('Lean mass', lean ? fBody(lean.lbm) : '–', lean ? 'weight minus fat' : 'needs body fat')}
    ${stat('FFMI', lean ? round(lean.ffmi.norm, 1).toFixed(1) : '–', lean ? 'lean mass for your height' : '')}
  </div>`;

  let leanBlock = '';
  if (lean?.max) {
    const toD = (v) => (U().body === 'kg' ? v : kgToLb(v));
    const unit = U().body === 'kg' ? 'kg' : 'lb';
    leanBlock = `<section class="section">
      <div class="section-head"><h2 class="h2">Lean mass</h2><button class="icon-btn" data-act="info" data-topic="lean" aria-label="About lean mass targets">${I.info}</button></div>
      <div class="gauge">
        <div class="gauge-head"><span class="gauge-nums"><strong>${round(toD(lean.lbm), 1)}</strong> ${unit} now</span><span class="gauge-nums">aim ${round(toD(lean.aim), 1)} ${unit}</span></div>
        ${tapeHTML({ current: toD(lean.lbm), target: toD(lean.aim), unit: 'kg', minorStep: 1, majorEvery: unit === 'kg' ? 5 : 10, padLo: 4, padHi: 2, label: `Lean mass ${round(toD(lean.lbm), 1)} ${unit}, aim ${round(toD(lean.aim), 1)} ${unit}` })}
        <p class="gauge-foot">${Math.round(lean.pctOfAim * 100)}% of your aim. Your frame's ceiling at ${round(bf.pct, 0)}% body fat is ${round(toD(lean.max), 1)} ${unit}.</p>
      </div>
    </section>`;
  }

  let targets = '';
  if (progress) {
    const notes = [];
    if (age < 21) notes.push(`These targets assume you've finished growing. At ${age} your frame may still change, so treat them loosely.`);
    if (bf && bf.pct > 18) notes.push(`The targets assume about 8 to 10% body fat. At ${round(bf.pct, 0)}% your tape readings include more fat, so the real gap is bigger than the bars show.`);
    targets = `<section class="section">
      <div class="section-head"><h2 class="h2">Targets from your frame</h2><button class="icon-btn" data-act="info" data-topic="targets" aria-label="How targets work">${I.info}</button></div>
      <fieldset class="field compact"><legend>Aim for</legend>${seg('aim', [[85, '85%'], [90, '90%'], [95, '95%'], [100, '100%']], S.aimPct, 'aim')}<p class="hint">Share of the natural ceiling for your frame. Most people who train for years land around 85 to 95%.</p></fieldset>
      ${notes.map((n) => `<p class="note">${esc(n)}</p>`).join('')}
      <div class="gauges">
      ${progress.map((r) => {
        const cur = r.current !== null ? lenFromCm(r.current, U().len) : null;
        const tgt = lenFromCm(r.target, U().len);
        const gap = r.current !== null ? r.target - r.current : null;
        return `<div class="gauge">
          <div class="gauge-head"><span class="gauge-name">${C.siteName(r.site)}</span><span class="gauge-nums">${cur !== null ? `<strong>${fmtLenNum(r.current, U().len)}</strong> of ` : ''}${fmtLenNum(r.target, U().len)} ${lenUnit()}</span></div>
          ${tapeHTML({ current: cur, target: tgt, unit: U().len, label: `${C.siteName(r.site)}: ${cur !== null ? `${fLen(r.current)} now, ` : ''}target ${fLen(r.target)}` })}
          <p class="gauge-foot">${gap === null ? 'Not measured yet' : gap > 0 ? `${fLen(gap)} to go` : `${I.check} At or past your aim`}${lag.has(r.site) ? ' <span class="badge badge-tape">Priority</span>' : ''}</p>
        </div>`;
      }).join('')}
      </div>
    </section>`;
  } else if (p.sex === 'male') {
    targets = `<section class="section card">
      <h2 class="h3">Get targets for each muscle</h2>
      <p>Measure your wrist and ankle once. They set realistic upper limits for your arms, chest, thighs and calves.</p>
      <a class="btn" href="#frame">Add wrist and ankle</a>
    </section>`;
  } else {
    targets = `<section class="section"><h2 class="h2">Targets</h2>
      <p class="muted">Body-part targets come from research on men only, so for you Gainloop tracks your trend, lean mass and FFMI instead. Natural female physique athletes top out around an FFMI of 20.</p></section>`;
  }

  const weighins = [...S.weights].sort(C.byDate).reverse();
  const weightBlock = `<section class="section">
    <div class="section-head"><h2 class="h2">Weight</h2><span class="muted">7-day average</span></div>
    <div class="chart" data-chart="weight" tabindex="0" aria-label="Weight trend chart. Use the arrow keys to read values."></div>
    <details class="more"><summary>All weigh-ins (${weighins.length})</summary>
      <ul class="list">${weighins.map((w) => `<li class="row"><span class="row-label">${fmtDate(w.d)}</span><span class="row-main num">${fBody(w.kg)}</span><button class="icon-btn" data-act="del-weight" data-d="${w.d}" aria-label="Delete weigh-in on ${fmtDate(w.d)}">${I.close}</button></li>`).join('')}</ul>
    </details>
  </section>`;

  const history = `<section class="section">
    <div class="section-head"><h2 class="h2">Measurements</h2><a class="link" href="#measure">Add</a></div>
    ${measures.length ? `<ul class="list">${measures.map((m) => `<li><a class="row row-link" href="#measure-${m.id}">
      <span class="row-label">${fmtDate(m.d)}</span>
      <span class="row-main">${Object.entries(m.cm).map(([k, v]) => `${C.siteName(k).replace(' (flexed)', '')} ${fmtLenNum(v, U().len)}`).join(', ')}</span>
      ${I.next}</a></li>`).join('')}</ul>` : '<p class="empty">No measurements yet. Add your first set to see targets and body fat.</p>'}
  </section>`;

  const extras = `<section class="section">
    <h2 class="h2">Frame and body fat</h2>
    <ul class="list">
      <li><a class="row row-link" href="#frame"><span class="row-main">${S.frame ? `Wrist ${fLen(S.frame.wrist)}, ankle ${fLen(S.frame.ankle)}` : 'Add wrist and ankle size'}</span>${I.next}</a></li>
      <li><a class="row row-link" href="#bodyfat"><span class="row-main">${S.bfOverride ? `Body fat ${S.bfOverride.pct}% from a scan on ${fmtDate(S.bfOverride.d, 'day')}` : 'Have a body fat number from a scan or smart scale?'}</span>${I.next}</a></li>
    </ul>
  </section>`;

  return `<header class="screen-head"><h1 class="title">Body</h1><a class="btn btn-small btn-primary" href="#measure">Log measurements</a></header>
    ${demoBanner()}
    ${stats}
    ${leanBlock}
    ${targets}
    ${weightBlock}
    ${history}
    ${extras}`;
}

function measureView(id) {
  const t = today();
  const editing = id ? S.measures.find((m) => m.id === id) : null;
  if (id && !editing) return `${backLink('#body', 'Body')}<p class="empty">That entry no longer exists.</p>`;
  const d = editing ? editing.d : t;
  const sex = S.profile.sex;
  return `${backLink('#body', 'Body')}
    <header class="screen-head"><h1 class="title">${editing ? 'Edit measurements' : 'Log measurements'}</h1></header>
    <p class="muted">Same time of day, same side, tape snug but not digging in. Morning before food is most consistent.</p>
    <form data-form="measure" data-id="${editing ? editing.id : ''}" novalidate>
      ${field('m-date', 'Date', `<input type="date" id="m-date" name="m-date" value="${d}" max="${t}">`)}
      ${C.sitesFor(sex).map((s) => measureField(s.id, editing?.cm[s.id] ?? null, C.latestSite(S.measures, s.id, d, editing?.id), sex, { excludeId: editing?.id })).join('')}
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">Save measurements</button>
        ${editing ? `<button class="btn btn-danger" type="button" data-act="del-measure" data-id="${editing.id}">Delete this entry</button>` : ''}
      </div>
    </form>`;
}

function frameView() {
  const sex = S.profile.sex;
  return `${backLink('#body', 'Body')}
    <header class="screen-head"><h1 class="title">Your frame</h1></header>
    <p class="muted">Wrist and ankle are mostly bone, so they show how much muscle your frame can carry. Measure once; they don't change in adults.</p>
    ${sex === 'female' ? '<p class="note">The research behind body-part targets only covers men, so for you these are stored but not used for targets.</p>' : ''}
    <form data-form="frame" novalidate>
      ${C.FRAME_SITES.map((s) => measureField(s.id, S.frame?.[s.id] ?? null, null, sex)).join('')}
      <div class="form-actions"><button class="btn btn-primary" type="submit">Save frame</button></div>
    </form>`;
}

function bodyfatView() {
  const t = today();
  return `${backLink('#body', 'Body')}
    <header class="screen-head"><h1 class="title">Body fat from a scan</h1></header>
    <p class="muted">If you've had a DEXA or InBody scan, or use a smart scale, enter the number. It replaces the tape estimate until your next measurements.</p>
    <form data-form="bodyfat" novalidate>
      ${field('bf-pct', 'Body fat', numBox('bf-pct', S.bfOverride?.pct ?? '', '%'))}
      ${field('bf-date', 'Date', `<input type="date" id="bf-date" name="bf-date" value="${S.bfOverride?.d || t}" max="${t}">`)}
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">Save</button>
        ${S.bfOverride ? '<button class="btn btn-danger" type="button" data-act="del-bodyfat">Remove and use the tape estimate</button>' : ''}
      </div>
    </form>`;
}

// ----- Train -----

function trainView() {
  const p = S.profile;
  const prog = S.program;
  const nextId = nextSessionId(prog, S.sessionsDone);
  const lastDone = (sid) => [...S.sessionsDone].reverse().find((x) => x.sid === sid);
  const maxSets = Math.max(...Object.values(prog.weekly), 1);
  const priSet = new Set(prog.priorities.map((x) => x.muscle));
  // muscles the 6-exercise limit left without sets still show, at 0, so you can tap for why
  const muscles = MUSCLES.filter((m) => prog.weekly[m.id] > 0 || prog.capped?.[m.id] > 0);
  const eqName = { gym: 'gym', home: 'dumbbells at home', bw: 'bodyweight' }[p.equipment];
  const autoPri = prog.priorities.filter((x) => x.source === 'tape').map((x) => x.muscle);
  const r = rules();
  const mine = (prog.mine || []).filter((x) => exerciseById(x.id) && !isCardio(exerciseById(x.id)));
  const trainHealth = healthFor('train');

  const wk = weekNow();
  const sofar = weekSoFar(S, today());
  const pastLoads = [...(S.loads || [])].reverse().slice(0, 6);
  const loadRows = LOAD_GROUPS.map((g) => {
    const info = wk.plan.groups[g.id];
    const detail = info.base === null
      ? 'Your first full week of training sets the starting load.'
      : `Last week ${fLoad(info.base)}. This week ${fLoad(info.planned)} (${pctSigned(info.pct)}).`;
    return `<li class="row load-row"><span class="row-main"><span class="row-title">${g.name}</span><span class="fine">${esc(detail)}</span></span><span class="load-so-far"><strong>${fLoad(sofar[g.id])}</strong><span class="fine">so far</span></span></li>`;
  }).join('');
  const weekBox = `<section class="section week-box${wk.entry ? ` week-${wk.w.band}` : ''}">
        <div class="section-head"><h2 class="h2">This week</h2>${wk.entry ? '<a class="link" href="#wellness">Your answers</a>' : ''}</div>
        ${wk.entry
    ? `<p><strong>${esc(BANDS[wk.w.band].name)}</strong>, ${wk.entry.total} of ${MAX_SCORE} in your wellness check on ${fmtDate(wk.entry.d, 'day')}.</p>
           <ul class="notes">${weekSummary(wk.w, p).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    : `<p>Answer the weekly wellness check and your load goes up or down to match how you feel.</p>
           <a class="btn" href="#wellness-answer">Answer 5 questions</a>`}
        <h3 class="h3">Weekly load</h3>
        <p class="fine">Weight × reps × sets, added up for legs (with abs), push and pull. Worked out at the end of each week, and each week stays within ${round(MAX_CHANGE * 100)}% of the one before.</p>
        <ul class="list">${loadRows}</ul>
        ${pastLoads.length ? `<details class="note"><summary>Past weeks</summary><div class="load-table" role="table" aria-label="Load for each past week">
          <div class="load-head" role="row"><span role="columnheader">Week of</span>${LOAD_GROUPS.map((g) => `<span role="columnheader">${g.name}</span>`).join('')}</div>
          ${pastLoads.map((rec) => `<div role="row"><span role="cell">${fmtDate(rec.ws, 'day')}</span>${LOAD_GROUPS.map((g) => `<span role="cell">${rec[g.id]?.n ? fLoad(rec[g.id].load) : '–'}</span>`).join('')}</div>`).join('')}
        </div></details>` : ''}
      </section>`;

  return `<header class="screen-head"><div><h1 class="title">Train</h1><p class="muted">${esc(prog.split)}, ${p.days} days a week, ${eqName}</p></div></header>
    ${demoBanner()}
    ${weekBox}
    <section class="section">
      <h2 class="h2">Sessions</h2>
      <ul class="list">${prog.sessions.map((s) => {
        const ld = lastDone(s.id);
        const ws = weekSession(s, wk);
        return `<li><a class="row row-link" href="#session-${s.id}">
          <span class="row-main"><span class="row-title">${esc(s.name)}${s.id === nextId ? ' <span class="badge badge-ink">Next</span>' : ''}</span>
          <span class="fine">${plural(ws.slots.length, 'exercise')}, about ${ws.minutes} min${ld ? `, last done ${relDays(ld.d, today())}` : ''}</span></span>${I.next}</a></li>`;
      }).join('')}</ul>
      <p class="fine">Every session has exactly ${MAX_EXERCISES} exercises, cardio included.</p>
    </section>
    ${r.train.length ? `<section class="section">
      <div class="section-head"><h2 class="h2">Training safely</h2><a class="link" href="#health">Health</a></div>
      ${trainHealth.length ? `<p class="fine">Adjusted for ${esc(andList(trainHealth.map((i) => lcFirst(i.name))))}.</p>` : ''}
      <ul class="notes">${r.train.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </section>` : ''}
    <section class="section">
      <div class="section-head"><h2 class="h2">Exercises you already do</h2><a class="link" href="#myex">${mine.length ? 'Change' : 'Add'}</a></div>
      ${mine.length ? `<ul class="list">${mine.map((x) => {
        const ex = exerciseById(x.id);
        return `<li class="row"><button class="thumb-btn" data-act="guide" data-ex="${ex.id}" aria-label="How to do ${esc(ex.name)}">${thumb(ex.id)}</button>
          <span class="row-main"><span class="row-title">${esc(ex.name)}</span><span class="fine">${x.where.length ? `In ${esc(andList(x.where))}` : esc(x.why)}</span></span></li>`;
      }).join('')}</ul>` : '<p class="muted">Tell Gainloop what you do now and your plan keeps those exercises, building the rest around them.</p>'}
    </section>
    ${cardioSectionHTML()}
    <section class="section">
      <ul class="list">
        <li><a class="row row-link" href="#library"><span class="row-main"><span class="row-title">Exercise library</span><span class="fine">How to do all ${libraryCount()}, with the kit you need</span></span>${I.next}</a></li>
      </ul>
    </section>
    <section class="section">
      <div class="section-head"><h2 class="h2">Sets a week</h2><span class="muted">tap a muscle for why</span></div>
      <div class="bars">${muscles.map((m) => {
        const n = prog.weekly[m.id] || 0;
        const pri = priSet.has(m.id);
        return `<button class="bar-row" data-act="why-sets" data-m="${m.id}">
          <span class="bar-label">${m.name}${pri ? ' <span class="badge badge-tape">Priority</span>' : ''}</span>
          <span class="bar-track"><span class="bar-fill${pri ? ' pri' : ''}" style="width:${(n / maxSets) * 100}%"></span></span>
          <span class="bar-value">${n}</span>
        </button>`;
      }).join('')}</div>
    </section>
    <section class="section">
      <h2 class="h2">Your priorities</h2>
      ${autoPri.length ? `<p>From your measurements: <strong>${andList(autoPri.map((m) => muscleName(m).toLowerCase()))}</strong>. These change at check-ins.</p>` : ''}
      <p class="muted">${autoPri.length ? 'You can add up to two of your own.' : 'Pick up to two muscles to bring up. They get extra sets and move up the order.'}</p>
      ${chips('pins', MUSCLES.filter((m) => !autoPri.includes(m.id)).map((m) => [m.id, m.name]), S.pins)}
    </section>
    <section class="section">
      <h2 class="h2">How progress works</h2>
      <p>Each exercise has a rep range. Your load for the week is last week’s, up a little when you’re progressing and down a little when you’re deloading, never by more than ${round(MAX_CHANGE * 100)}%. It comes first from one or two more reps on your exercises, and once you reach the top of the range, from a heavier weight and fewer reps. Stop each set ${wk.w.stop} reps before you'd fail${wk.entry ? ' this week' : ''}.</p>
      <p class="muted">Your weekly wellness check decides which way it goes: a fresh week adds up to ${round(MAX_CHANGE * 100)}%, a normal week adds half that, a tired week takes off half that, and a lighter week takes off ${round(MAX_CHANGE * 100)}%. Poor sleep or stress holds it where it is.</p>
    </section>`;
}

function sessionView(sid) {
  const prog = S.program;
  const s = prog.sessions.find((x) => x.id === sid);
  if (!s) return `${backLink('#train', 'Train')}<p class="empty">That session isn't in your current plan.</p>`;
  const draft = S.drafts[sid] || {};
  const t = today();
  const r = rules();
  const wk = weekNow(t);
  const w = wk.w;
  const ws = weekSession(s, wk);
  return `${backLink('#train', 'Train')}
    <header class="screen-head"><div><h1 class="title">${esc(s.name)}</h1><p class="muted">${plural(ws.slots.length, 'exercise')}, about ${ws.minutes} min</p></div></header>
    ${wk.entry ? `<p class="note week-note-top"><a class="link" href="#wellness">${esc(BANDS[w.band].name)}</a>: ${esc(weekShort(w))}. Stop each set ${esc(w.stop)} reps before you’d fail.</p>` : ''}
    <ul class="notes week-loads">${[...new Set(ws.slots.map((sl) => groupOf(exerciseById(sl.ex))).filter(Boolean))].map((g) => `<li>${esc(loadLine(wk.plan.groups[g]))}</li>`).join('')}</ul>
    ${r.train.length ? `<details class="note session-notes"${S.sessionsDone.length ? '' : ' open'}><summary>Safety notes for your health</summary><ul class="notes">${r.train.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
    ${ws.slots.map((sl, i) => {
      const ex = exerciseById(sl.ex);
      if (!ex) return '';
      if (sl.cardio || isCardio(ex)) return cardioSlotHTML(sid, sl, ex, i, draft[ex.id] || {});
      const hist = (S.exLog[ex.id] || []).filter((h) => h.d < t);
      const last = hist[hist.length - 1];
      const rr = repRange(ex, r);
      const rx = wk.plan.rx.get(`${sid}:${i}`);
      const adv = rx
        ? { kg: rx.kg, text: rxText(rx, fLift) }
        : advice(ex, hist, fLift, rr, w.stop, { load: w.mode === 'progress' ? 'progress' : 'hold' });
      const dr = draft[ex.id] || {};
      const weight = dr.kg ?? (adv.kg !== null && adv.kg !== undefined ? liftInputValue(adv.kg, U().lift) : last && ex.load === 'kg' ? liftInputValue(last.kg, U().lift) : '');
      const repsLabel = ex.load === 's' ? 'Seconds' : 'Reps';
      const sore = soreFor(ex.id);
      const base = sl.base ? exerciseById(sl.base) : null;
      return `<article class="exercise${sl.priority ? ' is-priority' : ''}" data-ex="${ex.id}">
        <header class="ex-head">
          <div class="ex-title">
            <h2 class="h3">${esc(ex.name)}${sl.mine && !base ? ' <span class="badge badge-line">You do this</span>' : ''}</h2>
            <p class="fine">${muscleName(sl.m)}${sl.priority ? ' (priority)' : ''}, ${sl.sets} sets of ${repText(ex, rr)}, ${restText(ex)}</p>
          </div>
          <button class="icon-btn" data-act="swap" data-sid="${sid}" data-ex="${base ? base.id : ex.id}" aria-label="Swap ${esc(base ? base.name : ex.name)}">${I.swap}</button>
        </header>
        ${base ? `<p class="week-note">This week instead of ${esc(lcFirst(base.name))}. Your muscles are sore, and that one works them at full stretch, which is hardest on sore muscles. You already know this one, so it won’t add soreness of its own. <button class="btn-link" data-act="wellness-keep" data-ex="${base.id}">Do ${esc(lcFirst(base.name))} anyway</button></p>` : ''}
        <button class="ex-guide" data-act="guide" data-ex="${ex.id}">${thumb(ex.id)}<span class="ex-guide-text"><span>How to do it</span><span class="fine">${GUIDES[ex.id] ? esc(kitText(ex.id)) : 'Steps and a video link'}</span></span></button>
        ${sore.length ? `<p class="warn">${I.alert} ${sl.mine ? 'This one stays because you already do it.' : Object.values(S.swaps).includes(ex.id) ? 'You swapped this one in.' : 'Nothing else fits your equipment here.'} Go lighter if your ${esc(andList(sore))} ${hurtVerb(sore)}, or swap it.</p>` : ''}
        <p class="advice">${esc(adv.text)}</p>
        ${rx ? `<p class="fine">Load ${fLoad(rx.load)}, last ${rx.last.recent ? 'week' : 'time'} ${fLoad(rx.last.load)}</p>` : ''}
        ${last ? `<p class="fine">Last time, ${fmtDate(last.d, 'day')}: ${ex.load === 'kg' ? `${last.kg ? fLift(last.kg) : 'bodyweight'} × ` : ''}${last.reps.join(', ')}${ex.load === 's' ? ' s' : ''}</p>` : ''}
        <div class="log">
          ${ex.load === 'kg' ? `<div class="log-weight"><label for="w-${i}">Weight</label>${numBox(`w-${i}`, weight, liftUnit(), { small: true, live: 'set', data: ` data-sid="${sid}" data-ex="${ex.id}" data-field="kg"` })}</div>` : ''}
          <div class="log-reps"><span class="log-label" id="rl-${i}">${repsLabel}</span>
            <div class="rep-boxes" role="group" aria-labelledby="rl-${i}">${Array.from({ length: sl.sets }, (_, k) => `<input class="rep" inputmode="numeric" aria-label="Set ${k + 1} ${repsLabel.toLowerCase()}" placeholder="${rx?.reps[k] ?? ''}" value="${esc(dr.reps?.[k] ?? '')}" data-live="set" data-sid="${sid}" data-ex="${ex.id}" data-field="rep" data-k="${k}">`).join('')}</div>
          </div>
        </div>
        ${adv.nextEx ? `<button class="btn btn-small" data-act="swap-to" data-from="${ex.id}" data-to="${adv.nextEx}">Switch to ${esc(lcFirst(exerciseById(adv.nextEx).name))}</button>` : ''}
      </article>`;
    }).join('')}
    <div class="finish-bar"><button class="btn btn-primary btn-wide" data-act="finish" data-sid="${sid}">Finish workout</button></div>`;
}

// ----- Food log and getting back on track -----

const signedInt = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtInt(Math.abs(n))}`;
const kcalSigned = (n) => `${signedInt(n)} kcal`;
const slotName = (id) => SLOTS.find((s) => s.id === id)?.name || 'Meal';

// Which day of this week's meal plan a date is, or -1
function weekIndexOf(d) {
  if (!S.mealWeek) return -1;
  const i = daysBetween(S.mealWeek.start, d);
  return i >= 0 && i < 7 ? i : -1;
}

// Meal number i in the plan for date d, with that day's portions
function plannedMeal(d, i) {
  const di = weekIndexOf(d);
  const day = di >= 0 ? S.mealWeek.days[di] : null;
  const e = day?.meals[i];
  const m = e && mealsById(S).get(e.id);
  if (!m) return null;
  const mm = mealMacros(m);
  return { slot: e.slot, name: m.name, kcal: Math.round(mm.kcal * day.x), p: Math.round(mm.p * day.x), c: Math.round(mm.c * day.x), f: Math.round(mm.f * day.x) };
}

// What a meal slot usually holds on a day, for days whose plan isn't known any more
function plannedSlot(d, slot) {
  const di = weekIndexOf(d);
  if (di >= 0) {
    const i = S.mealWeek.days[di].meals.findIndex((e) => e.slot === slot);
    if (i >= 0) return { ...plannedMeal(d, i), mealIdx: i };
  }
  const t = dayTargets(S, d);
  const sh = SLOT_SHARE[slot] || 0.25;
  return { slot, name: `Your planned ${slot}`, kcal: Math.round(t.kcal * sh), p: Math.round(t.protein * sh), c: Math.round(t.carbs * sh), f: Math.round(t.fat * sh), mealIdx: null };
}

function dayWord(d, t = today()) {
  const n = daysBetween(d, t);
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n === -1) return 'tomorrow';
  return `on ${dayLong(weekdayIndex(d))}`;
}

function gapSentence(gap, t = today()) {
  const k = fmtInt(Math.abs(Math.round(gap.diff.kcal)));
  const more = gap.dir === 'over' ? 'more' : 'less';
  if (gap.days.length === 1) return `You ate about ${k} kcal ${more} than planned ${dayWord(gap.days[0].d, t)}.`;
  return `Over the last ${plural(daysBetween(gap.days[0].d, t) + 1, 'day')} you ate about ${k} kcal ${more} than planned.`;
}

const itemText = (it) => (it.kind === 'skip' ? `Skipped ${lcFirst(it.planned?.name || slotName(it.slot))}` : it.ate?.text || 'Something else');

function foodTodayHTML(t) {
  const di = weekIndexOf(t);
  const day = di >= 0 ? S.mealWeek.days[di] : null;
  if (!day) return '';
  const byId = mealsById(S);
  const tt = dayTargets(S, t);
  const items = logFor(S, t)?.items || [];
  const extras = items.filter((x) => x.kind === 'extra' || (x.kind === 'instead' && (x.mealIdx === null || x.mealIdx === undefined)));
  const diff = diffOf(items);
  const rows = day.meals.map((e, i) => {
    const m = byId.get(e.id);
    if (!m) return '';
    const lg = loggedMeal(S, t, i);
    const mm = mealMacros(m);
    const status = lg ? (lg.kind === 'skip' ? 'Skipped' : `Instead: ${lg.ate?.text || 'something else'}, ${fmtInt(lg.ate?.kcal || 0)} kcal`) : `As planned, ${fmtInt(Math.round(mm.kcal * day.x))} kcal`;
    return `<li><button class="row row-button food-row${lg ? ' is-changed' : ''}" data-act="log-meal" data-d="${t}" data-i="${i}">
      <span class="row-label">${slotName(e.slot)}</span>
      <span class="row-main"><span class="row-title">${esc(m.name)}</span><span class="fine">${esc(status)}</span></span>${I.next}</button></li>`;
  }).join('');
  const extraRows = extras.map((x) => `<li class="row food-row is-changed"><span class="row-label">${x.kind === 'extra' ? 'Extra' : 'Instead'}</span>
      <span class="row-main"><span class="row-title">${esc(x.ate?.text || 'Something else')}</span><span class="fine">${fmtInt(x.ate?.kcal || 0)} kcal, ${fmtInt(x.ate?.p || 0)} g protein</span></span>
      <button class="icon-btn" data-act="log-del" data-d="${t}" data-id="${x.id}" aria-label="Remove ${esc(x.ate?.text || 'this')}">${I.close}</button></li>`).join('');
  const summary = items.length
    ? `<p class="day-vs ${diff.kcal > 0 ? 'over' : diff.kcal < 0 ? 'under' : ''}">Today against your plan: <strong>${Math.abs(diff.kcal) < 1 ? 'on plan' : kcalSigned(Math.round(diff.kcal))}</strong>${Math.abs(diff.p) >= 5 ? `, ${signedInt(Math.round(diff.p))} g protein` : ''}</p>`
    : '<p class="fine">Your plan counts as eaten. Tap a meal if you skipped or swapped it.</p>';
  return `<section class="section">
      <div class="section-head"><h2 class="h2">Food today</h2><a class="link" href="#log">Food log</a></div>
      <p class="kpi"><span><strong>${fmtInt(tt.kcal)}</strong> kcal</span><span><strong>${tt.protein} g</strong> protein</span>${tt.delta ? `<span class="badge badge-tape">Back on track ${kcalSigned(tt.delta)}</span>` : ''}</p>
      <ul class="list">${rows}${extraRows}</ul>
      <button class="btn btn-small add-food" data-act="log-add" data-d="${t}">${I.plus} Something else I ate</button>
      ${summary}
    </section>`;
}

// The plan that's running today, or starts tomorrow
function currentPlan(t) {
  return (S.adjust || []).filter((a) => addDays(a.start, a.days) > t && daysBetween(t, a.start) <= 1).sort((a, b) => (a.start < b.start ? -1 : 1))[0] || null;
}

function cardioDueHTML(s) {
  const ex = exerciseById(s.ex);
  if (!ex) return '';
  return `<div class="cardio-due">
    <button class="thumb-btn" data-act="guide" data-ex="${ex.id}" aria-label="How to do ${esc(ex.name)}">${thumb(ex.id)}</button>
    <p class="cardio-due-text"><strong>${s.min} min ${esc(lcFirst(ex.name))}</strong><span class="fine">${EFFORTS[effortIndex(s.effort)].name} pace, about ${fmtInt(s.kcal)} kcal${s.late ? `, planned for ${dayLong(weekdayIndex(s.d))}` : s.d === today() ? ', today' : `, ${dayLong(weekdayIndex(s.d))}`}</span></p>
    <button class="btn btn-small" data-act="cardio-done" data-adj="${s.adj}" data-id="${s.id}">Done</button>
  </div>`;
}

function trackCardHTML(t) {
  const gap = pendingGap(S, t);
  if (gap && !gap.small) {
    return `<section class="card card-tape track-card">
      <h2 class="h3">Back on track</h2>
      <p>${esc(gapSentence(gap, t))} Gainloop can even it out over the next few days.</p>
      <div class="card-actions"><a class="btn btn-primary" href="#ontrack">See your options</a><button class="btn-link" data-act="gap-leave">Leave it</button></div>
    </section>`;
  }
  const a = currentPlan(t);
  if (!a) return '';
  const pr = adjustmentProgress(a, t);
  const tt = dayTargets(S, pr.started ? t : a.start);
  const due = cardioToDo(S, t).filter((s) => s.adj === a.id && s.d <= t);
  return `<section class="card track-card">
      <div class="card-top"><h2 class="h3">Back on track</h2><span class="muted">${pr.started ? `day ${pr.day} of ${a.days}` : 'starts tomorrow'}</span></div>
      <p>${pr.started ? `${kcal(tt.kcal)} today (${kcalSigned(tt.delta)})` : `${kcal(tt.kcal)} a day for ${plural(a.days, 'day')} (${kcalSigned(tt.delta)})`}. Protein stays at ${tt.protein} g.</p>
      ${due.map(cardioDueHTML).join('')}
      <a class="link" href="#ontrack">Plan details</a>
    </section>`;
}

function reassurance(gap) {
  const goal = S.profile.goal;
  if (gap.dir === 'over') {
    return goal === 'build'
      ? 'A day over your plan is normal and only adds a little extra. Evening it out keeps your weekly average where it should be, without big swings.'
      : 'One day over your plan doesn’t undo your progress. Evening it out keeps your weekly average on target, without big swings.';
  }
  return goal === 'lean'
    ? 'Eating much less than planned can cost muscle and make the next days harder. Adding some back keeps your weekly average where it should be.'
    : 'Eating less than planned slows your progress a little. Adding it back over the next few days keeps your weekly average on target.';
}

const windowName = (days) => ({ 3: '3 days', 7: 'A week', 14: '2 weeks' }[days] || plural(days, 'day'));

function otState(gap, rec) {
  if (!ui.ot || ui.ot.key !== gapKey(gap)) ui.ot = { key: gapKey(gap), days: rec, cardio: false, ex: null };
  return ui.ot;
}
const gapKey = (gap) => gap.days.flatMap((x) => x.items.map((i) => i.id)).join(',');

function ontrackFormHTML(gap, t) {
  const kg = C.currentWeight(S.weights, t);
  const first = catchUpOptions(S, gap);
  const st = otState(gap, first.recommended);
  const offer = st.cardio ? cardioOffer(S, gap, st.days, kg, rules(), st.ex) : null;
  const { options, recommended, total } = catchUpOptions(S, gap, offer);
  const sel = options.find((o) => o.days === st.days) || options.find((o) => o.days === recommended);
  const start = addDays(t, 1);
  const tStart = dayTargets(S, start);
  const n = S.nutrition;
  const shiftK = sel.perDay;
  const preview = `${kcal(clampKcal(tStart.kcal + shiftK))} a day from ${fmtDate(start, 'day')} for ${plural(sel.days, 'day')} (${kcalSigned(shiftK)} on your usual ${fmtInt(n.kcal)}). Protein stays at ${n.protein} g.`;
  const cardioOpts = cardioExercises().filter((e) => e.custom || e.eq.includes(S.profile.equipment));
  const curEx = offer ? exerciseById(offer.ex) : null;
  return `<section class="section">
      <p class="lede">${esc(gapSentence(gap, t))}</p>
      <ul class="list gap-days">${gap.days.map((x) => `<li class="row"><span class="row-main"><span class="row-title">${esc(fmtDate(x.d, 'long'))}</span><span class="fine">${esc(x.items.map(itemText).join(', '))}</span></span><span class="row-amount">${kcalSigned(Math.round(x.diff.kcal))}</span></li>`).join('')}</ul>
      <p>${esc(reassurance(gap))}</p>
    </section>
    <form data-form="ontrack" class="section" novalidate>
      <fieldset class="field"><legend>Spread it over</legend>
        <div class="options">${options.map((o) => `<input type="radio" id="ot-${o.days}" name="ot-days" value="${o.days}" data-change="ot"${o.days === sel.days ? ' checked' : ''}><label for="ot-${o.days}" class="option">
          <span class="row-title">${windowName(o.days)}${o.days === recommended ? ' <span class="badge badge-tape">Suggested</span>' : ''}</span>
          <span class="fine">${kcalSigned(o.perDay)} a day${o.capped ? `. That covers ${fmtInt(o.covers)} of the ${fmtInt(Math.abs(Math.round(total)))}: a bigger daily change wouldn’t be sensible, and check-ins pick up the rest` : ''}</span></label>`).join('')}</div>
      </fieldset>
      ${gap.dir === 'over' ? `<fieldset class="field"><legend>Cardio</legend>
        <div class="check-row"><input type="checkbox" id="ot-cardio" name="ot-cardio" data-change="ot"${st.cardio ? ' checked' : ''}><label for="ot-cardio">Add some cardio, so the food change is smaller</label></div>
        ${offer ? `<div class="field compact"><label for="ot-ex">Which cardio</label><select id="ot-ex" name="ot-ex" data-change="ot">${cardioOpts.map((e) => `<option value="${e.id}"${e.id === offer.ex ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}</select></div>
        <p class="fine">${offer.sessions} × ${offer.min} minutes of ${esc(lcFirst(curEx.name))} at ${EFFORTS[effortIndex(offer.effort)].name.toLowerCase()} pace, about ${fmtInt(offer.each)} kcal each. They’ll show on your Today screen.</p>` : ''}
      </fieldset>` : ''}
      <p class="note" id="ot-preview">${esc(preview)}</p>
      <p class="fine">Gainloop never moves a day by more than 15% of your usual calories or below your floor of ${fmtInt(n.floor || 0)} kcal, and protein stays the same. Missed a session or a day? Don’t make it up: your next check-in adjusts from your real weight.</p>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Use this plan</button><button class="btn" type="button" data-act="gap-leave">Leave it</button></div>
    </form>`;
}

function clampKcal(k) {
  const n = S.nutrition;
  return Math.max(n.floor || 0, Math.min(Math.round(n.kcal * 1.15), k));
}

function planHTML(a, t) {
  const pr = adjustmentProgress(a, t);
  const tt = dayTargets(S, pr.started ? t : a.start);
  const end = addDays(a.start, a.days - 1);
  const coach = a.coach
    ? `<div class="coach"><h3 class="h3">Coach’s note</h3><p>${esc(a.coach.message)}</p>${a.coach.tips?.length ? `<ul class="notes">${a.coach.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}<p class="fine">Written by AI from the plan above.</p></div>`
    : ui.coachBusy === a.id
      ? `<div class="coach"><p class="ai-wait">${I.ai} Writing a note on your plan…</p></div>`
      : `<div class="coach">${ui.coachError ? `<p class="warn-text">${esc(ui.coachError)}</p>` : ''}<button class="btn btn-small" data-act="coach" data-id="${a.id}">${I.ai} Get a coach’s note</button></div>`;
  return `<section class="section plan-box">
      <div class="section-head"><h2 class="h2">Your plan</h2><span class="muted">${pr.started ? `day ${pr.day} of ${a.days}` : `starts ${dayWord(a.start, t)}`}</span></div>
      <p><strong>${kcal(tt.kcal)} a day</strong> from ${fmtDate(a.start, 'day')} to ${fmtDate(end, 'day')} (${kcalSigned(tt.delta)}), with ${tt.carbs} g carbs and ${tt.fat} g fat. Protein stays at ${tt.protein} g. Your meal plan portions already match.</p>
      ${a.cardio.length ? `<h3 class="h3">Extra cardio</h3><ul class="list">${a.cardio.map((s) => {
        const ex = exerciseById(s.ex);
        return `<li class="row"><button class="thumb-btn" data-act="guide" data-ex="${s.ex}" aria-label="How to do ${esc(ex?.name || '')}">${thumb(s.ex)}</button><span class="row-main"><span class="row-title">${s.min} min ${esc(lcFirst(ex?.name || 'cardio'))}</span><span class="fine">${esc(fmtDate(s.d, 'long'))}, about ${fmtInt(s.kcal)} kcal</span></span>${s.done ? `<span class="added">${I.check} Done</span>` : `<button class="btn btn-small" data-act="cardio-done" data-adj="${a.id}" data-id="${s.id}">Done</button>`}</li>`;
      }).join('')}</ul>` : ''}
      ${coach}
      <button class="btn-link" data-act="plan-stop" data-id="${a.id}">Stop this plan</button>
    </section>`;
}

function ontrackView() {
  const t = today();
  const gap = pendingGap(S, t);
  const plans = (S.adjust || []).filter((a) => addDays(a.start, a.days) > t).sort((a, b) => (a.start < b.start ? -1 : 1));
  const showForm = gap && !gap.small;
  return `${backLink('#today', 'Today')}
    <header class="screen-head"><div><h1 class="title">Back on track</h1></div></header>
    ${showForm ? ontrackFormHTML(gap, t) : ''}
    ${plans.map((a) => planHTML(a, t)).join('')}
    ${!showForm && !plans.length ? `<section class="section"><p class="lede">You’re on track.</p><p>When you eat something that isn’t in your plan, or skip a meal, log it on Today. If it adds up to more than about ${fmtInt(200)} kcal, Gainloop offers to even it out over the next few days.</p><a class="btn" href="#log">Food log</a></section>` : ''}`;
}

function logView() {
  const t = today();
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, -i));
  return `${backLink('#today', 'Today')}
    <header class="screen-head"><div><h1 class="title">Food log</h1></div></header>
    <p class="muted">Your meal plan counts as eaten unless you log something different: a meal you skipped, something else instead, or something extra. Anything from the last ${LOOKBACK} days can be evened out on <a class="link" href="#ontrack">Back on track</a>.</p>
    ${days.map((d, i) => {
      const items = logFor(S, d)?.items || [];
      const diff = diffOf(items);
      return `<section class="log-day">
        <div class="section-head"><h2 class="h3">${i === 0 ? 'Today' : i === 1 ? 'Yesterday' : esc(fmtDate(d, 'long'))}</h2><span class="${items.length ? (diff.kcal > 0 ? 'over-text' : 'under-text') : 'muted'}">${items.length ? (Math.abs(diff.kcal) < 1 ? 'on plan' : `${kcalSigned(Math.round(diff.kcal))} vs plan`) : 'as planned'}</span></div>
        ${items.length ? `<ul class="list">${items.map((x) => `<li class="row"><span class="row-main"><span class="row-title">${esc(itemText(x))}</span><span class="fine">${x.kind === 'extra' ? 'Extra' : x.kind === 'skip' ? `−${fmtInt(x.planned?.kcal || 0)} kcal` : `Instead of ${esc(lcFirst(x.planned?.name || slotName(x.slot)))}`}${x.ate ? `, ${fmtInt(x.ate.kcal)} kcal` : ''}${x.handled && x.handled !== 'leave' ? ', evened out' : ''}</span></span>
          <button class="icon-btn" data-act="log-del" data-d="${d}" data-id="${x.id}" aria-label="Remove">${I.close}</button></li>`).join('')}</ul>` : ''}
        ${i < LOOKBACK ? `<button class="btn-link" data-act="log-add" data-d="${d}">${I.plus} Add something for ${i === 0 ? 'today' : i === 1 ? 'yesterday' : 'this day'}</button>` : ''}
      </section>`;
    }).join('')}`;
}

// ----- Sheets for logging food -----

function logMealSheet(sh) {
  const pm = plannedMeal(sh.d, sh.i);
  if (!pm) return '<p>That meal isn’t in your plan any more.</p>';
  if (sh.mode === 'instead') return foodForm({ d: sh.d, kind: 'instead', i: sh.i, slot: pm.slot });
  const cur = loggedMeal(S, sh.d, sh.i);
  const opt = (v, label, on) => `<li><button class="row row-button${on ? ' is-on' : ''}" data-act="log-meal-set" data-v="${v}"><span class="row-main"><span class="row-title">${label}</span></span>${on ? I.check : I.next}</button></li>`;
  return `<p class="muted">In your plan: ${fmtInt(pm.kcal)} kcal and ${pm.p} g protein.</p>
    <ul class="list">${opt('ate', 'I ate it as planned', !cur)}${opt('skip', 'I didn’t eat it', cur?.kind === 'skip')}${opt('instead', 'I had something else instead', cur?.kind === 'instead')}</ul>`;
}

function foodForm({ d, kind, i = null, slot = null }) {
  const past = d !== today();
  return `<form data-form="log-food" data-d="${d}" data-kind="${kind}"${i !== null ? ` data-i="${i}"` : ''}${slot ? ` data-slot="${slot}"` : ''} novalidate>
    <div class="field"><label for="lf-text">What did you eat${kind === 'instead' ? ' instead' : ''}?</label><textarea id="lf-text" name="lf-text" rows="2" maxlength="300" placeholder="Two slices of pepperoni pizza and a can of cola"></textarea></div>
    <button class="btn btn-small" type="button" data-act="log-estimate">${I.ai} Estimate with AI</button>
    <div id="lf-est" aria-live="polite"></div>
    <fieldset class="field macro-grid"><legend>For all of it</legend>
      ${numBox('lf-kcal', '', 'kcal', { small: true })}${numBox('lf-p', '', 'g protein', { small: true })}${numBox('lf-c', '', 'g carbs', { small: true })}${numBox('lf-f', '', 'g fat', { small: true })}
    </fieldset>
    ${kind === 'extra' && past ? `<div class="field compact"><label for="lf-slot">Was it instead of a meal?</label><select id="lf-slot" name="lf-slot"><option value="">No, it was extra</option>${SLOTS.map((s) => `<option value="${s.id}">Instead of ${s.name.toLowerCase()}</option>`).join('')}</select></div>` : ''}
    <div class="form-actions"><button class="btn btn-primary" type="submit">Save</button></div>
    <p class="fine">Estimating sends only what you type to Cloudflare’s AI. You can change the numbers before saving.</p>
  </form>`;
}

function cardioSectionHTML() {
  const t = today();
  const fin = CARDIO_FINISH[S.profile.goal] || CARDIO_FINISH.build;
  const pace = EFFORTS[effortIndex(fin.effort)].name.toLowerCase();
  const mineCardio = (S.program.mine || []).filter((x) => isCardio(exerciseById(x.id)));
  const extra = cardioToDo(S, t);
  const options = cardioExercises().filter((e) => !e.custom && e.eq.includes(S.profile.equipment) && !(S.myExercises || []).includes(e.id));
  return `<section class="section">
      <div class="section-head"><h2 class="h2">Cardio</h2><a class="link" href="#library-cardio">All cardio</a></div>
      ${extra.length ? `<h3 class="h3">Extra, to get back on track</h3>${extra.map(cardioDueHTML).join('')}` : ''}
      ${mineCardio.length ? `<ul class="list">${mineCardio.map((x) => {
        const ex = exerciseById(x.id);
        return `<li class="row"><button class="thumb-btn" data-act="guide" data-ex="${ex.id}" aria-label="How to do ${esc(ex.name)}">${thumb(ex.id)}</button>
          <span class="row-main"><span class="row-title">${esc(ex.name)}</span><span class="fine">${x.where.length ? `${fin.min} min at ${pace} pace, at the end of ${esc(andList(x.where))}` : esc(x.why)}</span></span>
          <button class="icon-btn" data-act="mine-toggle" data-id="${ex.id}" aria-label="Remove ${esc(ex.name)}">${I.close}</button></li>`;
      }).join('')}</ul>` : `<p class="muted">Add the cardio you like. It goes at the end of two sessions a week, ${fin.min} minutes at ${pace} pace${S.profile.goal === 'build' ? ', so it helps your heart and recovery without eating into your gains' : ''}.</p>`}
      ${options.length ? `<div class="add-chips">${options.map((e) => `<button class="chip-btn" data-act="mine-toggle" data-id="${e.id}">${I.plus}<span>${esc(e.name)}</span></button>`).join('')}</div>` : ''}
    </section>`;
}

function cardioSlotHTML(sid, sl, ex, i, dr) {
  const t = today();
  const hist = (S.exLog[ex.id] || []).filter((h) => h.d < t && h.min);
  const last = hist[hist.length - 1];
  const effort = sl.effort || 'easy';
  const adv = cardioAdvice(ex, hist, sl.min || ex.rr?.[0] || 20, effort);
  const burn = cardioKcal(ex, adv.min, C.currentWeight(S.weights, t), effort);
  const sore = soreFor(ex.id);
  const felt = [['easy', 'Easy'], ['ok', 'About right'], ['hard', 'Hard']].map(([v, l]) => `<input type="radio" id="cf-${i}-${v}" name="cf-${i}" value="${v}"${dr.felt === v ? ' checked' : ''} data-live="set" data-sid="${sid}" data-ex="${ex.id}" data-field="felt"><label for="cf-${i}-${v}">${l}</label>`).join('');
  return `<article class="exercise is-cardio" data-ex="${ex.id}" data-cardio="1">
      <header class="ex-head">
        <div class="ex-title"><h2 class="h3">${esc(ex.name)}${sl.mine ? ' <span class="badge badge-line">You do this</span>' : ''}</h2>
          <p class="fine">Cardio to finish, ${adv.min} min${burn ? `, about ${fmtInt(burn)} kcal` : ''}</p></div>
        <button class="icon-btn" data-act="swap" data-sid="${sid}" data-ex="${ex.id}" aria-label="Swap ${esc(ex.name)}">${I.swap}</button>
      </header>
      <button class="ex-guide" data-act="guide" data-ex="${ex.id}">${thumb(ex.id)}<span class="ex-guide-text"><span>How to do it</span><span class="fine">${GUIDES[ex.id] ? esc(kitText(ex.id)) : 'Steps and a video link'}</span></span></button>
      ${sore.length ? `<p class="warn">${I.alert} Go easy if your ${esc(andList(sore))} ${hurtVerb(sore)}, or swap it for something gentler, like the bike or cross trainer.</p>` : ''}
      <p class="advice">${esc(adv.text)}</p>
      ${last ? `<p class="fine">Last time, ${fmtDate(last.d, 'day')}: ${last.min} min${last.felt ? `, felt ${last.felt === 'ok' ? 'about right' : last.felt}` : ''}</p>` : ''}
      <div class="log log-cardio">
        <div class="log-weight"><label for="cm-${i}">Minutes</label>${numBox(`cm-${i}`, dr.min ?? '', 'min', { small: true, live: 'set', data: ` data-sid="${sid}" data-ex="${ex.id}" data-field="min"` })}</div>
        <div class="log-felt"><span class="log-label" id="cfl-${i}">How did it feel?</span><div class="seg" role="radiogroup" aria-labelledby="cfl-${i}">${felt}</div></div>
      </div>
    </article>`;
}

// ----- Eat -----

function eatView() {
  const t = today();
  const n = S.nutrition;
  const week = S.mealWeek;
  const byId = mealsById(S);
  const { allowed, hidden } = allowedMeals(S);
  const di = ui.eatDay;
  const day = week.days[di];
  const tot = day ? dayTotals(day, byId) : null;
  const dt = dayTargets(S, weekDate(S, di));
  const diet = S.profile.diet;
  const carbs = rules().carbCounts;
  const foodHealth = healthFor('food');
  const ruleBits = [
    diet.style !== 'any' ? (diet.style === 'vegan' ? 'Vegan' : 'Vegetarian') : '',
    diet.halal ? 'Halal' : '',
    diet.avoid.length ? `no ${diet.avoid.map((a) => AVOID_OPTIONS.find((o) => o.id === a)?.name.toLowerCase()).join(', ')}` : '',
    diet.dislikes ? `not ${diet.dislikes}` : '',
  ].filter(Boolean);
  const counts = {};
  for (const m of allowed) counts[m.slot] = (counts[m.slot] || 0) + 1;
  const thin = ['breakfast', 'lunch', 'dinner'].filter((s) => (counts[s] || 0) < 3);
  const todayIdx = weekdayIndex(t);

  return `<header class="screen-head"><h1 class="title">Eat</h1><a class="btn btn-small" href="#shop">Shopping list</a></header>
    ${demoBanner()}
    <section class="targets">
      <p class="target-kcal"><strong>${fmtInt(dt.kcal)}</strong> kcal ${dt.delta ? `on ${dayLong(di)}` : 'a day'}</p>
      <p class="macros"><span><strong>${dt.protein} g</strong> protein</span><span><strong>${dt.carbs} g</strong> carbs</span><span><strong>${dt.fat} g</strong> fat</span></p>
      ${dt.delta ? `<p class="fine adj-note">Back on track: ${kcalSigned(dt.delta)} on your usual ${fmtInt(n.kcal)}. <a class="link" href="#ontrack">Plan details</a></p>` : ''}
      <button class="btn-link" data-act="info" data-topic="calories">Why these numbers</button>
    </section>
    <section class="section">
      <div class="rules-line"><p>${ruleBits.length ? esc(ruleBits.join(', ').replace(/^./, (c) => c.toUpperCase())) : 'No food rules set.'}</p><a class="link" href="#rules">Edit rules</a></div>
      ${foodHealth.length ? `<div class="rules-line"><p class="fine">Adjusted for ${esc(andList(foodHealth.map((i) => lcFirst(i.name))))}${carbs ? ', with carbs shown on every meal' : ''}.</p><a class="link" href="#health">Health</a></div>` : ''}
      ${hidden.length ? `<button class="btn-link" data-act="hidden-meals">${plural(hidden.length, 'meal')} left out by your rules</button>` : ''}
      ${thin.length ? `<p class="note">Only a few ${andList(thin)} options fit your rules, so they repeat. <a class="link" href="#mealnew">Add your own meals</a> for more variety.</p>` : ''}
    </section>
    <div class="days" role="tablist" aria-label="Day of the week">${week.days.map((_, i) => `<button role="tab" class="day${i === di ? ' on' : ''}${i === todayIdx ? ' today' : ''}" aria-selected="${i === di}" data-act="eat-day" data-i="${i}"><span>${dayShort(i)}</span><span class="day-num">${fmtDate(addDays(week.start, i), 'day').split(' ')[0]}</span></button>`).join('')}</div>
    ${day && day.meals.length ? `<ul class="meals">${day.meals.map((e, i) => {
      const m = byId.get(e.id);
      if (!m) return '';
      const mm = mealMacros(m);
      return `<li><button class="meal" data-act="meal-open" data-i="${i}">
        <span class="meal-slot">${SLOTS.find((s) => s.id === e.slot).name}</span>
        <span class="meal-name">${esc(m.name)}</span>
        <span class="meal-meta">${Math.round(mm.kcal * day.x)} kcal, ${Math.round(mm.p * day.x)} g protein${carbs ? `, ${Math.round(mm.c * day.x)} g carbs` : ''}${day.x !== 1 ? `, ${day.x} portions` : ''}</span>
      </button></li>`;
    }).join('')}</ul>
    <div class="day-total">
      ${meter('Calories', tot.kcal, dt.kcal, 'kcal')}
      ${meter('Protein', tot.p, dt.protein, 'g', true)}
      ${carbs ? meter('Carbs', tot.c, dt.carbs, 'g', false, true) : ''}
    </div>` : '<p class="empty">No meals fit all of your rules. Loosen a rule or add your own meals.</p>'}
    <div class="actions-row">
      <a class="btn btn-primary" href="#pantry">Cook with what you have</a>
      <button class="btn" data-act="meals-reshuffle">New meal ideas</button>
      <a class="btn" href="#mealnew">Add your own meal</a>
    </div>`;
}

function meter(label, value, target, unit, atLeast = false, atMost = false) {
  const ratio = target ? value / target : 0;
  const close = atLeast ? ratio >= 0.95 : atMost ? ratio <= 1.05 : Math.abs(ratio - 1) <= 0.05;
  return `<div class="meter">
    <div class="meter-head"><span>${label}</span><span><strong>${fmtInt(value)} ${unit}</strong> ${atLeast ? `aim for ${fmtInt(target)}+` : atMost ? `up to about ${fmtInt(target)}` : `of ${fmtInt(target)}`}</span></div>
    <div class="meter-track"><span class="meter-fill${close ? ' ok' : ''}" style="width:${Math.min(100, ratio * 100)}%"></span></div>
  </div>`;
}

function shopView() {
  const week = S.mealWeek;
  const byId = mealsById(S);
  const list = shoppingList(week, byId);
  const ticks = S.shopTicks[week.start] || {};
  const order = ['Meat and fish', 'Dairy and eggs', 'Plant protein', 'Fruit and veg', 'Bread, grains and potatoes', 'Tins and jars', 'Cupboard'];
  const groups = order.filter((g) => list.groups.has(g));
  return `${backLink('#eat', 'Eat')}
    <header class="screen-head"><div><h1 class="title">Shopping list</h1><p class="muted">${fmtDate(week.start, 'day')} to ${fmtDate(addDays(week.start, 6), 'day')}, all 7 days</p></div><button class="btn btn-small" data-act="copy-shop">${I.copy} Copy</button></header>
    ${groups.map((g) => `<section class="section"><h2 class="h2">${g}</h2><ul class="list shop">${list.groups.get(g).map((it) => `<li class="row"><input type="checkbox" id="sh-${it.id}" data-change="shop-tick" data-id="${it.id}"${ticks[it.id] ? ' checked' : ''}><label for="sh-${it.id}" class="row-main">${esc(it.name)}</label><span class="row-amount">${esc(it.amount)}</span></li>`).join('')}</ul></section>`).join('')}
    ${list.ai.length ? `<section class="section"><h2 class="h2">For your AI meals</h2><ul class="list">${list.ai.map((x) => `<li class="row"><span class="row-main">${esc(x.name)}</span><span class="row-amount">${esc(x.amount)}</span></li>`).join('')}</ul></section>` : ''}
    ${list.custom.length ? `<section class="section"><h2 class="h2">Your own meals</h2><ul class="list">${list.custom.map((c) => `<li class="row"><span class="row-main">${esc(c.name)}</span><span class="row-amount">${c.portions} portions</span></li>`).join('')}</ul></section>` : ''}
    ${list.pantry.length ? `<section class="section"><h2 class="h2">Check you have</h2><p>${esc(list.pantry.join(', '))}</p></section>` : ''}`;
}

function shopText() {
  const list = shoppingList(S.mealWeek, mealsById(S));
  const lines = [`Gainloop shopping list, week of ${fmtDate(S.mealWeek.start, 'day')}`];
  for (const [g, items] of list.groups) {
    lines.push('', g);
    for (const it of items) lines.push(`- ${it.name}: ${it.amount}`);
  }
  if (list.ai.length) { lines.push('', 'For your AI meals'); for (const x of list.ai) lines.push(`- ${x.name}: ${x.amount}`); }
  if (list.custom.length) { lines.push('', 'Your own meals'); for (const c of list.custom) lines.push(`- ${c.name}: ${c.portions} portions`); }
  if (list.pantry.length) lines.push('', `Check you have: ${list.pantry.join(', ')}`);
  return lines.join('\n');
}

const FLAG_OPTIONS = [['meat', 'Meat'], ['fish', 'Fish'], ['dairy', 'Dairy'], ['egg', 'Eggs'], ['gluten', 'Gluten'], ['nuts', 'Nuts or peanuts'], ['soy', 'Soy'], ['sesame', 'Sesame'], ['pork', 'Pork or alcohol']];

function mealNewView() {
  return `${backLink('#eat', 'Eat')}
    <header class="screen-head"><h1 class="title">Add your own meal</h1></header>
    <p class="muted">Type the numbers for one portion. The planner scales portions like any other meal and still applies your food rules.</p>
    <form data-form="mealnew" novalidate>
      ${field('mn-name', 'Name', '<input id="mn-name" name="mn-name" maxlength="60" placeholder="Chicken biryani">')}
      <fieldset class="field"><legend>Meal</legend>${seg('mn-slot', SLOTS.map((s) => [s.id, s.name]), 'dinner')}</fieldset>
      <div class="grid-2">
        ${field('mn-kcal', 'Calories', numBox('mn-kcal', '', 'kcal'))}
        ${field('mn-p', 'Protein', numBox('mn-p', '', 'g'))}
        ${field('mn-c', 'Carbs', numBox('mn-c', '', 'g'))}
        ${field('mn-f', 'Fat', numBox('mn-f', '', 'g'))}
      </div>
      <fieldset class="field"><legend>Contains</legend>${chips('mn-flags', FLAG_OPTIONS, [])}</fieldset>
      <div class="form-actions"><button class="btn btn-primary" type="submit">Add meal</button></div>
    </form>
    ${S.customMeals.length ? `<section class="section"><h2 class="h2">Your meals</h2><ul class="list">${S.customMeals.map((m) => {
      const mm = mealMacros(m);
      return `<li class="row"><span class="row-main">${esc(m.name)}<span class="fine"> ${SLOTS.find((s) => s.id === m.slot)?.name || ''}${m.gen ? ' from your foods' : ''}, ${Math.round(mm.kcal)} kcal, ${Math.round(mm.p)} g protein a portion</span></span><button class="icon-btn" data-act="del-meal" data-id="${m.id}" aria-label="Delete ${esc(m.name)}">${I.close}</button></li>`;
    }).join('')}</ul></section>` : ''}`;
}

function rulesView() {
  return `${backLink('#eat', 'Eat')}
    <header class="screen-head"><h1 class="title">Food rules</h1></header>
    <p class="muted">These are hard rules. A meal that breaks one is never used, and you can always see what was left out.</p>
    <form data-form="rules" novalidate>
      ${dietFields(S.profile.diet)}
      <div class="form-actions"><button class="btn btn-primary" type="submit">Save rules</button></div>
    </form>`;
}

// ----- You -----

function youView() {
  const p = S.profile;
  const t = today();
  const eq = { gym: 'Gym', home: 'Home with dumbbells', bw: 'Bodyweight only' }[p.equipment];
  const rows = [
    ['Age', `${C.ageNow(p, t)}`],
    ['Height', fmtHeight(p.heightCm, U().len)],
    ['Goal', C.GOALS[p.goal].name],
    ['Training', `${p.days} days, ${p.minutes} min, ${eq.toLowerCase()}`],
    ['Experience', C.EXPERIENCE[p.experience].name],
  ];
  return `<header class="screen-head"><h1 class="title">${p.name ? esc(p.name) : 'You'}</h1><a class="btn btn-small" href="#profile">Edit details</a></header>
    ${demoBanner()}
    <section class="section"><ul class="list">${rows.map(([k, v]) => `<li class="row"><span class="row-label">${k}</span><span class="row-main">${esc(v)}</span></li>`).join('')}
      <li><a class="row row-link" href="#health"><span class="row-label">Health</span><span class="row-main">${esc(healthSummary(p.health))}</span>${I.next}</a></li></ul></section>
    <section class="section">
      <h2 class="h2">Units</h2>
      <fieldset class="field compact"><legend>Lengths</legend>${seg('pu-len', [['cm', 'cm'], ['in', 'inches']], U().len, 'units')}</fieldset>
      <fieldset class="field compact"><legend>Body weight</legend>${seg('pu-body', [['kg', 'kg'], ['st', 'stone'], ['lb', 'lb']], U().body, 'units')}</fieldset>
      <fieldset class="field compact"><legend>Weights you lift</legend>${seg('pu-lift', [['kg', 'kg'], ['lb', 'lb']], U().lift, 'units')}</fieldset>
    </section>
    <section class="section">
      <h2 class="h2">Appearance</h2>
      ${seg('theme', [['auto', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']], S.theme, 'theme')}
    </section>
    <section class="section"><h2 class="h2">Home screen</h2>${installHTML()}</section>
    <section class="section">
      <h2 class="h2">Your data</h2>
      <p class="muted">Everything is stored on this device only. Make a backup now and then, and before you switch phones.</p>
      <div class="actions-row">
        ${PREVIEW ? '' : '<button class="btn" data-act="backup-download">Download backup</button>'}
        <button class="btn" data-act="backup-copy">${I.copy} Copy backup</button>
        <a class="btn" href="#restore">Restore</a>
      </div>
    </section>
    <section class="section">
      <ul class="list">
        <li><a class="row row-link" href="#changes"><span class="row-main">Plan changes and why</span>${I.next}</a></li>
        <li><a class="row row-link" href="#maths"><span class="row-main">How the numbers work</span>${I.next}</a></li>
      </ul>
    </section>
    <section class="section">
      <button class="btn btn-danger" data-act="reset">Delete all my data</button>
    </section>
    <p class="fine footer-note">Gainloop ${APP_VERSION}. Not medical advice. If you have a health condition or are under 18, check with a doctor or a qualified coach before changing your diet or training.</p>
    <p class="fine">Exercise pictures: <a href="${PICTURE_CREDIT_URL}" target="_blank" rel="noopener">${PICTURE_CREDIT}</a>.</p>`;
}

function restoreView() {
  return `${backLink(S.profile ? '#you' : '#welcome', S.profile ? 'You' : 'Start')}
    <header class="screen-head"><h1 class="title">Restore a backup</h1></header>
    <p class="muted">This replaces everything on this device with the backup.</p>
    <form data-form="restore" novalidate>
      ${field('rs-file', 'Backup file', '<input type="file" id="rs-file" name="rs-file" accept=".json,application/json">')}
      ${field('rs-text', 'Or paste the backup text', '<textarea id="rs-text" name="rs-text" rows="5" placeholder="{&quot;app&quot;:&quot;gainloop&quot;, …}"></textarea>')}
      <div class="form-actions"><button class="btn btn-primary" type="submit">Restore</button></div>
    </form>`;
}

function changesView() {
  const list = [...S.changes].reverse();
  const kind = { setup: 'Set up', checkin: 'Check-in', measure: 'New measurements', edit: 'Details changed', track: 'Back on track', 'track-stop': 'Back on track stopped', wellness: 'Wellness check' };
  return `${backLink('#you', 'You')}
    <header class="screen-head"><h1 class="title">Plan changes</h1></header>
    <p class="muted">Every change to your calories and training, with the reason.</p>
    ${list.length ? `<ol class="timeline">${list.map((c) => `<li>
      <p class="tl-head"><strong>${kind[c.kind] || 'Update'}</strong> <span class="muted">${fmtDate(c.d, 'full')}</span></p>
      <ul>${c.items.map((it) => `<li><p class="tl-text">${esc(it.text)}</p>${it.why ? `<p class="fine">${esc(it.why)}</p>` : ''}</li>`).join('')}</ul>
    </li>`).join('')}</ol>` : '<p class="empty">No changes yet.</p>'}`;
}

function mathsView() {
  return `${backLink(S.profile ? '#you' : '#welcome', S.profile ? 'You' : 'Start')}
    <header class="screen-head"><h1 class="title">How the numbers work</h1></header>
    <section class="section prose">
      <h2 class="h2">Body fat</h2>
      <p>Estimated from your height, neck and waist (plus hips for women) with the US Navy tape formula. It's usually within a few percent of a scan, and the trend matters more than the exact number. If you have a scan result, enter it and it takes over.</p>
      <h2 class="h2">Targets from your frame</h2>
      <p>Casey Butt studied drug-free bodybuilders and found that wrist and ankle size, along with height, predict how much muscle someone can carry. Gainloop uses his published formulas for maximum lean mass and for chest, arm, forearm, neck, thigh and calf at about 8 to 10% body fat. They are upper estimates and run high for most people, so your aim starts at 90% of them. They were built from men's data, so women get trend tracking instead.</p>
      <p>Because tape readings include fat, lean mass is the fairer measure of progress. It's compared with the ceiling at your current body fat.</p>
      <h2 class="h2">Which muscles get extra sets</h2>
      <p>Each measured site is compared with its target. Any site at least 3 points behind the middle of the pack becomes a priority, up to two at a time. Arms map to triceps and biceps, chest to chest and back, thighs to quads and hamstrings. Every other muscle keeps a minimum number of sets.</p>
      <h2 class="h2">Calories</h2>
      <p>Your starting point is the Mifflin-St Jeor equation, adjusted for your daily activity and training days. Building muscle adds 150 to 300 kcal, recomp stays at maintenance and leaning out takes off up to 20%. Calories never go below your resting burn or 1,600 kcal for men and 1,400 for women.</p>
      <p>Every two weeks, a check-in compares how fast your 7-day average weight is moving with the target pace: about 1.25% of body weight a month for newer lifters, 0.75% with some experience and 0.4% when experienced. The first change waits until you have about 3 weeks of weigh-ins. If you're more than 0.1 kg a week off pace (or a third of the target pace, if that's bigger), calories move by half the gap, at most 250 kcal at a time. If weight is on pace but your waist is growing while arms and chest aren't, calories come down 100.</p>
      <h2 class="h2">Training</h2>
      <p>Weekly sets start at 10 to 14 per major muscle depending on experience, then get fitted to your days and session length.</p>
      <p>Every session has exactly ${MAX_EXERCISES} exercises, cardio included, and each exercise at most ${MAX_SETS} sets. A muscle gets one exercise in a session, or two when there’s room, such as a pull-down and a row for your back. Places go out in order of importance: your priorities first, then quads, chest and back, hamstrings and shoulders, then arms, calves, glutes and abs. If a session still has fewer than ${MAX_EXERCISES}, a muscle that is short of sets gets one, then a big exercise splits into two, so the session is always full. With very little equipment a session may borrow an exercise from another muscle.</p>
      <h2 class="h2">Weekly load</h2>
      <p>Load is weight lifted × reps × sets, added up over the week for three groups: legs (quads, hamstrings, glutes, calves and abs), push (chest, shoulders and triceps) and pull (back, biceps and forearms). Bodyweight exercises count as a share of your body weight, all of it for pull-ups, chin-ups and dips and about two thirds for the rest. Cardio and timed holds aren’t part of it.</p>
      <p>At the end of each week, Monday to Sunday, Gainloop adds up what you logged. If you logged only part of the plan, that week is scaled up to a full week, as long as you did at least half of it. The next week’s load for each group is then planned to be within ${round(MAX_CHANGE * 100)}% of that, up when you’re progressing and down when you’re deloading. If your plan has changed so much that last week no longer matches what you would repeat, the starting point is the last session of each exercise instead.</p>
      <p>The load is then shared out over your exercises. The sets stay as planned and the reps change first, one or two more or fewer in a set. Once an exercise reaches the top of its rep range, it moves to the next weight and the reps start again lower, which is double progression. A change of ${round(MAX_CHANGE * 100)}% is small: about one rep on each exercise, or one small weight jump on one of them. An exercise you haven’t logged yet, or have only logged without a weight, is left to you the first time.</p>
      <h2 class="h2">Weekly wellness check</h2>
      <p>Every Sunday, five questions on fatigue, sleep, muscle soreness, stress and mood, each scored from 5 (best) to 1, so the total runs from 5 to 25. They come from a wellness questionnaire McLean and colleagues used with professional rugby league players, and a systematic review of athlete monitoring found that simple self-reported measures like these track how you’re coping with training better than common objective measures such as blood tests and heart rate.</p>
      <p>Your score is compared with your normal: the average of up to 6 recent check-ins once you have 3, kept between 13 and 19, and 15 until then. Three or more above normal is a fresh week, from 1 below to 2 above is normal, 2 to 4 below is tired, and more than that, or a score of 9 or less, is a lighter week. Any answer of 1 makes it a tired week at most, a fresh week needs no answer below 3, and a second tired week in a row becomes a lighter week.</p>
      <ul class="notes">
        <li><strong>Fresh:</strong> load up ${round(MAX_CHANGE * 100)}%, and stop 1 rep before failure (1 or 2 if you’re newer to lifting). Leaning out, it goes up ${round(MAX_CHANGE * 50, 1)}% because a calorie deficit limits recovery.</li>
        <li><strong>Normal:</strong> load up ${round(MAX_CHANGE * 50, 1)}%, and stop 1 or 2 reps before failure.</li>
        <li><strong>Tired:</strong> load down ${round(MAX_CHANGE * 50, 1)}%, and stop 2 or 3 reps before failure.</li>
        <li><strong>Lighter:</strong> load down ${round(MAX_CHANGE * 100)}%, and stop 3 or 4 reps before failure. Leaning out, the weights stay where they can and the reps come down, because heavy weights help you keep muscle in a deficit.</li>
      </ul>
      <p>The size of the change is kept small on purpose: a deload of this kind follows an international expert consensus on deloading, which says to cut the load, train further from failure and keep the familiar main lifts. All six exercises stay in every session.</p>
      <p>Single answers matter too. With restless sleep or insomnia, or when you’re stressed, your load doesn’t go up that week and sets stop 2 or 3 reps from failure: poor sleep can lower how much you can lift, and stress slows recovery from hard training. With sore muscles, exercises that load a muscle at full stretch, like Romanian deadlifts, split squats and flyes, cause the most soreness, so each swaps for a gentler one you have already logged. A new exercise would bring soreness of its own. Your health rules always win: with high blood pressure or a heart condition, sets never go closer to failure than they allow.</p>
      <p>Two weeks running of low scores for sleep, stress or mood bring a gentle note that it can help to talk to someone. The answers stay on your phone and are never sent anywhere.</p>
      <h2 class="h2">Exercises you already do</h2>
      <p>Your exercises go to the front of the list for their muscle, so they’re picked first wherever your equipment allows. If one doesn’t fit its usual place, like a chin-up when your biceps get curls, it takes the place of one of the planner’s own picks for that muscle. If you do more exercises for a muscle than it has places in your week, the extras are left out and the app says why.</p>
      <p>Exercises you add yourself get a standard rep range for how you track them: 8 to 12 reps with weights, 8 to 15 with bodyweight, or 20 to 60 seconds for holds.</p>
      <h2 class="h2">Meal ideas from the AI</h2>
      <p>When you type the food you have, Gainloop asks an AI model running on Cloudflare (OpenAI’s open gpt-oss model on Workers AI) for meals that use only those foods, plus oil, salt, spices, herbs, garlic and lemon. It sends your food list, the calories and protein for that meal and your food rules, such as halal, allergies and carb limits. Your health conditions themselves aren’t sent, only what they change about food. Nothing else is sent, and Cloudflare doesn’t use it to train AI.</p>
      <p>Before you see an idea, the app adds up its calories again from each ingredient, sizes the portion to that meal’s share of your day (breakfast about a quarter, lunch and dinner about 30% each, a snack 15%), and checks every ingredient against your food rules. Ideas that break a rule are left out, and ideas that use a food you didn’t list are kept apart. The AI’s numbers are estimates, so check labels if you count closely.</p>
      <p>Amounts of rice, pasta, noodles, oats, lentils, oil, butter, eggs and chicken are also checked against typical label values. The usual slip is counting dry rice as if it were cooked, which would have you cook nearly three times too much, so the app gives the dry weight that matches the calories instead. Foods the steps never use are taken out before the meal is sized, the steps are checked against your food rules too, and ideas that stir sweet foods like oats or banana into a meat or fish dish are left out.</p>
      <h2 class="h2">Cooking from a list</h2>
      <p>The tick list works on your phone without the AI: a protein food, a carb and vegetables for lunch and dinner, and simpler combinations for breakfast and snacks, sized with the rest of the day to hit your calories. It only shows meals you can make from what you tick. Recipes you’re one food short of are kept in a separate list for your next shop.</p>
      <h2 class="h2">Food log and getting back on track</h2>
      <p>Your meal plan counts as eaten unless you log something different: a meal you skipped, something else instead, or something extra. Each entry keeps what was planned and what you ate, so the difference stays right even if the plan changes later. The AI can estimate what something was, and you can change its numbers.</p>
      <p>When what you logged in the last week adds up to more than about 200 kcal either way, Gainloop offers to spread it over 3 days, a week or 2 weeks, starting tomorrow. The suggestion is the shortest that keeps each day within 10% of your usual calories. No day ever moves more than 15%, or below your calorie floor. Protein stays the same, and the change comes from carbs and fat (45% from carbs with diabetes, 60% otherwise). If you ate more than planned, up to 3 cardio sessions a week can cover up to half of it, so the food change is smaller. Anything a sensible change can’t cover is left to your check-ins, which adjust from your real weight. A short coach’s note is written by the AI from the plan, but the numbers are always worked out by the app.</p>
      <h2 class="h2">Cardio</h2>
      <p>Cardio you add goes at the end of two sessions a week: 15 minutes at an easy pace while building muscle, 20 minutes for recomp and 25 for leaning out, moderate. Calories burned are estimated from the 2024 Adult Compendium of Physical Activities: the activity’s energy cost (MET) minus resting, times your weight and the time. With a sore knee, back or shoulder, running, jumping and rowing are flagged, and back-on-track cardio picks something easier on the joints. With a heart condition, cardio is kept easy to moderate.</p>
      <h2 class="h2">Health conditions</h2>
      <p>These follow general guidance and are deliberately cautious. Your doctor’s or care team’s advice comes first.</p>
      <ul class="notes">
        <li><strong>Diabetes:</strong> carbs are capped at about 45% of calories, a moderate limit, since there’s no single right amount. Protein, then fat, make up the rest. Meals with added sugar are left out, the planner leans toward meals where carbs are no more than half the calories, and every meal shows its carbs. You’re reminded to check your glucose before training, because training can lower it, especially if you take insulin or a sulfonylurea.</li>
        <li><strong>High blood pressure and heart conditions:</strong> every set is at least 8 reps (10 with a heart condition), stopping 2 to 3 reps short of failure, with reminders not to hold your breath. With high blood pressure, meals built on salty cheese are swapped out while each meal slot keeps at least 3 options.</li>
        <li><strong>Kidney disease:</strong> protein is set to 0.8 g per kg of body weight, the amount the KDIGO kidney guideline suggests for adults with stage 3 to 5 chronic kidney disease who aren’t on dialysis, and protein shakes are left out.</li>
        <li><strong>Coeliac disease:</strong> gluten is a hard rule, including standard oats.</li>
        <li><strong>High cholesterol:</strong> meals built on fatty cheese, paneer or lamb are swapped out while there are other options.</li>
        <li><strong>Pain:</strong> exercises that tend to load your lower back, knees or shoulders are left out whenever that muscle has another option. Ones you already do stay in, with a reminder to go lighter.</li>
      </ul>
      <h2 class="h2">Sources</h2>
      <ul class="sources">
        <li><a href="https://weighttraining.nz/cb_calculator.php" target="_blank" rel="noopener">Casey Butt lean mass formula</a></li>
        <li><a href="https://mennohenselmans.com/ffmi-calculator/" target="_blank" rel="noopener">Menno Henselmans on FFMI and the formula's limits</a></li>
        <li><a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noopener">Mifflin-St Jeor equation (1990)</a></li>
        <li><a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5317029/" target="_blank" rel="noopener">Key points from the American Diabetes Association’s exercise guidance</a></li>
        <li><a href="https://professional.heart.org/en/science-news/resistance-exercise-training-in-individuals-with-and-without-cardiovascular-disease-2023-update" target="_blank" rel="noopener">American Heart Association: resistance training with and without heart disease (2023)</a></li>
        <li><a href="https://kdigo.org/guidelines/ckd-evaluation-and-management/" target="_blank" rel="noopener">KDIGO 2024 guideline for chronic kidney disease</a></li>
        <li><a href="https://pacompendium.com/wp-content/uploads/2024/01/2024-adult-compendium_1_2024.pdf" target="_blank" rel="noopener">2024 Adult Compendium of Physical Activities</a></li>
        <li><a href="https://pubmed.ncbi.nlm.nih.gov/20861526/" target="_blank" rel="noopener">McLean and others (2010): fatigue in rugby league players, with the wellness questionnaire</a></li>
        <li><a href="https://bjsm.bmj.com/content/50/5/281" target="_blank" rel="noopener">Saw, Main and Gastin (2016): self-reported measures in athlete monitoring, a systematic review</a></li>
        <li><a href="https://doi.org/10.1186/s40798-023-00633-0" target="_blank" rel="noopener">Bell and others (2023): an international Delphi consensus on deloading</a></li>
        <li><a href="https://openrepository.aut.ac.nz/items/92cefeac-7c32-44f1-bfbc-f48f4a5dd8cf/full" target="_blank" rel="noopener">Helms and others (2016): training by reps in reserve</a></li>
        <li><a href="https://pubmed.ncbi.nlm.nih.gov/29422383/" target="_blank" rel="noopener">Knowles and others (2018): poor sleep and muscle strength</a></li>
        <li><a href="https://pubmed.ncbi.nlm.nih.gov/24343323/" target="_blank" rel="noopener">Stults-Kolehmainen and others (2014): stress slows recovery after hard training</a></li>
        <li><a href="https://developers.cloudflare.com/workers-ai/platform/privacy/" target="_blank" rel="noopener">Cloudflare Workers AI: how your data is used</a></li>
      </ul>
    </section>`;
}

// ----- Check-in -----

function checkinView() {
  const t = today();
  if (!ui.checkin) ui.checkin = { step: 0 };
  const st = ui.checkin;
  const status = C.checkinStatus(S, t);
  const trend = C.trendAt(S.weights, t);
  const weighedToday = S.weights.find((w) => w.d === t);
  const head = (title) => `${backLink('#today', 'Today')}
    <div class="steps"><span class="step-count">Check-in, step ${st.step + 1} of 3</span></div>
    <div class="step-bar"><span style="width:${((st.step + 1) / 3) * 100}%"></span></div>
    <h1 class="title">${title}</h1>`;

  if (st.step === 0) {
    return `${head('Weight')}
      <p class="muted">${trend ? `Your 7-day average is ${fBody(trend.kg)} from ${plural(trend.n, 'weigh-in')}.` : 'No weigh-ins in the last week.'} Add today's if you haven't.</p>
      <form data-form="ci-weight" novalidate>
        ${field(U().body === 'st' ? 'ciw-st' : 'ciw', 'Today’s weight', bodyWeightControl('ciw', weighedToday?.kg ?? null))}
        <div class="form-actions"><button class="btn btn-primary" type="submit">Continue</button></div>
      </form>`;
  }
  if (st.step === 1) {
    const recent = status.sinceMeasure !== null && status.sinceMeasure < 21;
    return `${head('Measurements')}
      <p class="muted">${recent ? `You measured ${relDays(addDays(t, -status.sinceMeasure), t)}. Every 4 weeks is plenty, so you can skip this.` : 'Measure the same way as last time. Skip any you can’t do.'}</p>
      <form data-form="ci-measure" novalidate>
        ${C.sitesFor(S.profile.sex).map((s) => measureField(s.id, null, C.latestSite(S.measures, s.id), S.profile.sex)).join('')}
        <div class="form-actions">
          <button class="btn btn-primary" type="submit">Continue</button>
          <button class="btn-link" type="button" data-act="ci-skip">Skip measurements</button>
        </div>
      </form>`;
  }
  const a = analyseCheckin(S, t, (n, dp = 1) => fKgPlain(n, dp));
  ui.checkin.analysis = a;
  return `${head('What changes')}
    <ul class="changes">${a.items.map((it) => `<li class="change change-${it.area}">
      <p class="change-text">${esc(it.text)}</p>
      <p class="fine">${esc(it.why)}</p>
    </li>`).join('')}</ul>
    <div class="form-actions">
      <button class="btn btn-primary" data-act="ci-apply">${a.items.some((i) => i.area !== 'note' && !/stay/.test(i.text)) ? 'Apply changes' : 'Finish check-in'}</button>
    </div>`;
}

// ----- Weekly wellness check -----

// This week's settings from the check-in in force today (a normal week if there isn't one), the sessions
// as they run this week, and the load plan for legs, push and pull. Worked out once per screen.
let weekCache = null;
function weekNow(d = today()) {
  if (weekCache && weekCache.d === d) return weekCache;
  const entry = activeEntry(S, d);
  const w = weekSettings(entry, S.profile, rules());
  const adj = adjustWeek(S.program, w, { profile: S.profile, rules: rules(), familiar: familiarSet(S, d), keep: entry?.keep || [] });
  const sessions = S.program.sessions.map((x) => adj.get(x.id));
  const plan = planWeek(S, sessions, { settings: w, rangeOf: (ex) => repRange(ex, rules()), t: d });
  weekCache = { d, entry, w, adj, plan };
  return weekCache;
}

// One session as it runs this week
function weekSession(s, wk = weekNow()) {
  return wk.adj.get(s.id) || { ...s, slots: s.slots.map((sl, i) => ({ ...sl, i, planned: sl })) };
}

// 'Tired week: load down about 2.5%'
function weekShort(w) {
  const pct = `${round(Math.abs(w.delta) * 100, 1)}%`;
  return w.mode === 'progress' ? `load up about ${pct}` : w.mode === 'deload' ? `load down about ${pct}` : 'load held where it is';
}

// kg × reps × sets in your unit, to the nearest 10 so it reads easily
const fLoad = (kg) => `${fmtInt(Math.round((U().lift === 'lb' ? kgToLb(kg) : kg) / 10) * 10)} ${liftUnit()}`;
function loadLine(info) {
  if (info.base === null) return `${info.name}: your first full week of training sets your starting load.`;
  return `${info.name} load: ${fLoad(info.planned)} this week, ${pctSigned(info.pct)} on ${info.rebased ? 'your last session of each exercise' : 'last week'} (${fLoad(info.base)}).`;
}
const pctSigned = (p) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%`;

function wellnessDueCard(t) {
  const due = wellnessDue(S, t);
  if (!due.due) return '';
  const text = due.first
    ? 'Five quick questions on your energy, sleep, soreness, stress and mood. Your sessions for the week adjust to your answers.'
    : weekdayIndex(t) === 6
      ? 'It’s Sunday: five quick questions, and the coming week’s sessions adjust to how you feel.'
      : `Your last one was ${relDays(due.last.d, t)}. Five quick questions, and this week’s sessions adjust to how you feel.`;
  return `<section class="card card-tape wellness-card">
      <h2 class="h3">Weekly wellness check</h2>
      <p>${esc(text)} About a minute.</p>
      <a class="btn btn-primary" href="#wellness-answer">Answer now</a>
    </section>`;
}

function wellnessForm() {
  const t = today();
  const mine = (S.wellness || []).find((e) => e.d === t);
  const a = ui.wq || { ...(mine?.a || {}) };
  ui.wq = a;
  return `${backLink(activeEntry(S, t) ? '#wellness' : '#today', activeEntry(S, t) ? 'This week' : 'Today')}
    <header class="screen-head"><h1 class="title">Weekly wellness check</h1></header>
    <p class="muted">Answer for how you’ve felt over the last week. Best on Sunday morning, before the new week. Your sessions for the next 7 days adjust to your answers, and they stay on this phone.</p>
    <form data-form="wellness" class="wq-form" novalidate>
      ${QUESTIONS.map((q) => `<fieldset class="wq" id="wq-${q.id}">
        <legend class="h3">${esc(q.name)}</legend>
        <div class="choices wq-options">${[5, 4, 3, 2, 1].map((v) => `<input type="radio" id="wq-${q.id}-${v}" name="wq-${q.id}" value="${v}" data-change="wellness"${a[q.id] === v ? ' checked' : ''}><label for="wq-${q.id}-${v}"><span class="wq-num">${v}</span><span class="wq-text">${esc(q.options[v - 1])}</span></label>`).join('')}</div>
      </fieldset>`).join('')}
      <div class="finish-bar wq-bar">
        <p class="wq-total" id="wq-total" aria-live="polite">${wqTotalText(a)}</p>
        <button class="btn btn-primary btn-wide" type="submit">Save and set my week</button>
      </div>
    </form>`;
}

function wqTotalText(a) {
  const n = QUESTIONS.filter((q) => a[q.id]).length;
  if (!n) return 'Each answer scores from 5 (best) to 1.';
  if (!isComplete(a)) return `<strong>${totalOf(a)}</strong> so far, ${n} of ${QUESTIONS.length} answered`;
  const others = { ...S, wellness: (S.wellness || []).filter((e) => e.d !== today()) };
  const res = assess(others, a, today());
  return `<strong>${res.total}</strong> of ${MAX_SCORE}: a ${BANDS[res.band].name.toLowerCase()}`;
}

function wellnessView(param) {
  const t = today();
  const entry = activeEntry(S, t);
  if (param === 'answer' || !entry) return wellnessForm();
  ui.wq = null;
  const w = weekSettings(entry, S.profile, rules());
  const summary = weekSummary(w, S.profile);
  const note = wellbeingNote(S, entry);
  const past = wellnessHistory(S).reverse();
  const isToday = entry.d === t;
  return `${backLink('#today', 'Today')}
    <header class="screen-head"><div><p class="date">Wellness check, ${fmtDate(entry.d, 'long')}</p><h1 class="title">${BANDS[entry.band].name}</h1></div></header>
    <section class="gauge wq-gauge">
      <div class="gauge-head"><span class="gauge-nums"><strong>${entry.total}</strong> of ${MAX_SCORE}</span><span class="gauge-nums">your normal ${fmtScore(entry.normal)}</span></div>
      ${tapeHTML({ current: entry.total, target: entry.normal, unit: 'score', minorStep: 1, majorEvery: 5, padLo: Math.min(entry.total, entry.normal) - 5, padHi: MAX_SCORE - Math.max(entry.total, entry.normal), label: `Score ${entry.total} of ${MAX_SCORE}, your normal ${fmtScore(entry.normal)}` })}
      <ul class="notes wq-why">${entry.why.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </section>
    ${note ? `<p class="note">${esc(note)}</p>` : ''}
    <section class="section wq-week">
      <h2 class="h2">This week’s training</h2>
      <ul class="notes">${summary.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <a class="btn btn-primary" href="#train">See this week’s sessions</a>
    </section>
    <section class="section">
      <div class="section-head"><h2 class="h2">Your answers</h2><a class="link" href="#wellness-answer">${isToday ? 'Change' : 'Answer again'}</a></div>
      <ul class="list">${QUESTIONS.map((q) => `<li class="row wq-row"><span class="wq-num${entry.a[q.id] <= 2 ? ' low' : ''}">${entry.a[q.id]}</span><span class="row-main"><span class="row-title">${esc(q.name)}</span><span class="fine">${esc(q.options[entry.a[q.id] - 1])}</span></span></li>`).join('')}</ul>
    </section>
    ${past.length > 1 ? `<section class="section">
      <h2 class="h2">Past weeks</h2>
      <div class="bars">${past.slice(0, 12).map((e) => `<div class="bar-row wq-bar-row">
        <span class="bar-label">${fmtDate(e.d, 'day')} <span class="fine">${esc(BANDS[e.band]?.short || '')}</span></span>
        <span class="bar-track"><span class="bar-fill${e.band === 'tired' || e.band === 'lighter' ? ' low' : ''}" style="width:${(e.total / MAX_SCORE) * 100}%"></span></span>
        <span class="bar-value">${e.total}</span>
      </div>`).join('')}</div>
    </section>` : ''}
    <p class="fine">The questions come from a wellness questionnaire used with athletes. Your score is compared with your own normal, the average of your recent weeks, because everyone answers a little differently. <a class="link" href="#maths">How it works</a></p>`;
}

const fmtScore = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// ----- Exercise guides, your exercises and the library -----

function soreFor(exId) {
  const r = rules();
  return PAIN.filter((p) => r.pain.includes(p.id) && STRESS[p.id]?.includes(exId)).map((p) => p.word);
}
// 'your knees hurt' but 'your lower back hurts'
const sorePlural = (sore) => sore.length > 1 || /s$/.test(sore[0] || '');
const hurtVerb = (sore) => (sorePlural(sore) ? 'hurt' : 'hurts');

function guideSheet(sh) {
  const ex = exerciseById(sh.ex);
  if (!ex) return '<p>That exercise isn’t in the library any more.</p>';
  const g = GUIDES[ex.id];
  const rr = repRange(ex, rules());
  const also = (g?.also || []).map((m) => muscleName(m).toLowerCase());
  const mine = (S.myExercises || []).includes(ex.id);
  const sore = soreFor(ex.id);
  const fromSwap = sh.back?.type === 'swap' ? sh.back : null;
  const pic = pictureFor(ex.id);
  const looping = pic && pic.mode !== 'still' && pic.mode !== 'pair' && !reduceMotion();
  const actions = fromSwap
    ? `<button class="btn btn-primary" data-act="swap-to" data-from="${fromSwap.ex}" data-to="${ex.id}">Use this instead</button>
       <button class="btn" data-act="sheet-back">Back to the list</button>`
    : (S.profile ? `<button class="btn" data-act="mine-toggle" data-id="${ex.id}">${isCardio(ex) ? (mine ? 'Remove from my cardio' : 'Add to my cardio') : mine ? 'Remove from exercises I already do' : 'Add to exercises I already do'}</button>` : '');
  return `<div class="guide">${pictureStage(ex)}
    ${pic?.note ? `<p class="pic-note">${esc(pic.note)}</p>` : ''}
    <div class="guide-bar"><p class="guide-meta"><span>${repText(ex, rr)}</span><span>${restText(ex)}</span></p>${looping ? `<button class="pic-toggle" data-act="pic-toggle" aria-pressed="${ui.picPaused}">${ui.picPaused ? 'Play' : 'Pause'}</button>` : ''}</div>
    <p class="guide-works">${isCardio(ex) ? `Works your heart and lungs${also.length ? `, plus your ${andList(also)}` : ''}.` : `Works your ${muscleName(ex.m).toLowerCase()}${also.length ? `, plus your ${andList(also)}` : ''}.`}</p>
    ${isCardio(ex) ? cardioGuideHTML(ex) : ''}
    ${sore.length ? `<p class="note">${I.alert} You said your ${andList(sore)} ${hurtVerb(sore)}. This one can load ${sorePlural(sore) ? 'them' : 'it'}, so go lighter, or swap it for something else if it hurts.</p>` : ''}
    ${g ? `<h3 class="h3">You’ll need</h3><ul class="kit-list">${g.kit.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
    <h3 class="h3">How to do it</h3><ol class="steps-list">${g.how.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    ${ex.cue ? `<p class="note"><strong>Tip:</strong> ${esc(ex.cue)}</p>` : ''}
    <div class="form-actions">
      ${actions}
      <a class="btn-link" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`how to do ${ex.name}`)}" target="_blank" rel="noopener">Watch videos of it on YouTube</a>
    </div>
    ${pic ? `<p class="fine pic-credit">Pictures: <a href="${PICTURE_CREDIT_URL}" target="_blank" rel="noopener">RepDB (repdb.co)</a></p>` : ''}
  </div>`;
}

// How hard to go, and roughly what it burns for you
function cardioGuideHTML(ex) {
  const kg = S.profile ? C.currentWeight(S.weights, today()) : null;
  return `<ul class="effort-list">${EFFORTS.map((e) => `<li><strong>${e.name}:</strong> ${e.talk.toLowerCase()}${kg ? `, about ${fmtInt(cardioKcal(ex, 30, kg, e.id))} kcal in 30 minutes for you` : ''}</li>`).join('')}</ul>`;
}

// The exercise picker is used in setup (ctx 'setup', saved at the end) and on its own screen (ctx 'state')
function pickerData(ctx) {
  if (ctx === 'setup' && ui.setup) {
    const d = ui.setup.draft;
    d.myEx ||= [];
    d.customEx ||= [];
    return { mine: d.myEx, customs: d.customEx };
  }
  return { mine: S.myExercises, customs: S.customExercises };
}

function syncCustoms() {
  const extra = ui.setup?.draft?.customEx || [];
  setCustomExercises([...(S.customExercises || []), ...extra.filter((c) => !(S.customExercises || []).some((x) => x.id === c.id))]);
}

function pickedHTML(ctx) {
  const { mine } = pickerData(ctx);
  if (!mine.length) return '<p class="empty">None added yet.</p>';
  const report = ctx === 'state' ? new Map((S.program?.mine || []).map((x) => [x.id, x])) : new Map();
  return `<ul class="list">${mine.map((id) => {
    const ex = exerciseById(id);
    if (!ex) return '';
    const rep = report.get(id);
    const where = rep ? (rep.where.length ? `In ${andList(rep.where)}` : rep.why) : muscleName(ex.m);
    return `<li class="row"><button class="thumb-btn" data-act="guide" data-ex="${id}" aria-label="How to do ${esc(ex.name)}">${thumb(id)}</button><span class="row-main"><span class="row-title">${esc(ex.name)}</span><span class="fine">${esc(where)}</span></span><button class="icon-btn" data-act="ex-remove" data-id="${id}" data-ctx="${ctx}" aria-label="Remove ${esc(ex.name)}">${I.close}</button></li>`;
  }).join('')}</ul>`;
}

function resultsHTML(q, ctx) {
  const query = String(q || '').trim();
  if (!query) return '';
  const { mine } = pickerData(ctx);
  const res = searchExercises(query, { limit: 6 });
  const exact = res.some((e) => namesMatch(query, e));
  return res.map((e) => `<li><button class="row row-button" data-act="ex-add" data-id="${e.id}" data-ctx="${ctx}">${thumb(e.id)}<span class="row-main"><span class="row-title">${esc(e.name)}</span><span class="fine">${muscleName(e.m)}</span></span>${mine.includes(e.id) ? `<span class="added">${I.check} Added</span>` : I.plus}</button></li>`).join('')
    + (exact ? '' : `<li><button class="row row-button" data-act="ex-custom" data-name="${esc(query)}" data-ctx="${ctx}"><span class="row-main"><span class="row-title">Add “${esc(query)}” as your own exercise</span><span class="fine">For anything that isn’t in the list</span></span>${I.plus}</button></li>`);
}

function pickerHTML(ctx) {
  return `<div class="field"><label for="ex-q">Search exercises</label><input id="ex-q" type="search" autocomplete="off" enterkeyhint="search" placeholder="bench press, squats, pull-ups" data-live="ex-search" data-ctx="${ctx}"></div>
    <ul class="list picker-results" id="ex-results" aria-live="polite"></ul>
    <h2 class="h3 picked-head">Your exercises</h2>
    <div id="ex-picked">${pickedHTML(ctx)}</div>`;
}

function refreshPicker(ctx) {
  const q = document.getElementById('ex-q');
  const res = document.getElementById('ex-results');
  const picked = document.getElementById('ex-picked');
  if (res && q) res.innerHTML = resultsHTML(q.value, ctx);
  if (picked) picked.innerHTML = pickedHTML(ctx);
}

function customExSheet(sh) {
  return `<form data-form="custom-ex" data-ctx="${sh.ctx}" novalidate>
    ${field('ce-name', 'Name', `<input id="ce-name" name="ce-name" maxlength="50" value="${esc(sh.name || '')}">`)}
    <fieldset class="field"><legend>Main muscle it works</legend>${seg('ce-m', [...MUSCLES.map((m) => [m.id, m.name]), [CARDIO.id, CARDIO.name]], sh.m || 'chest')}</fieldset>
    <fieldset class="field"><legend>How you track it</legend>${seg('ce-load', [['kg', 'Weight and reps'], ['bw', 'Reps only'], ['s', 'Seconds'], ['min', 'Minutes']], 'kg')}<p class="hint">Cardio is always tracked in minutes.</p></fieldset>
    <div class="form-actions"><button class="btn btn-primary" type="submit">Add exercise</button></div>
  </form>`;
}

function myExView() {
  return `${backLink('#train', 'Train')}
    <header class="screen-head"><h1 class="title">Exercises you already do</h1></header>
    <p class="muted">Your plan keeps these where your equipment and session length allow, and builds the rest around them.</p>
    ${pickerHTML('state')}
    <p class="fine">Changing this list rebuilds your sessions. The weights and reps you’ve logged are kept.</p>`;
}

const libraryCount = () => allExercises().filter((e) => !e.custom).length;

function libraryList(q, f) {
  let list = String(q || '').trim() ? searchExercises(q, { limit: 60 }) : allExercises();
  if (f && f !== 'all') list = list.filter((e) => e.m === f);
  if (!list.length) return '<li class="empty">No exercises match.</li>';
  return list.map((e) => `<li><button class="row row-button" data-act="guide" data-ex="${e.id}">${thumb(e.id)}<span class="row-main"><span class="row-title">${esc(e.name)}</span><span class="fine">${muscleName(e.m)}${GUIDES[e.id] ? `, ${esc(lcFirst(kitText(e.id, true)))}` : ', your own'}</span></span>${I.next}</button></li>`).join('');
}

function libraryView(param) {
  if (param === CARDIO.id && ui.libRoute !== param) ui.libFilter = CARDIO.id;
  ui.libRoute = param;
  return `${backLink('#train', 'Train')}
    <header class="screen-head"><div><h1 class="title">Exercise library</h1><p class="muted">${libraryCount()} exercises, each with how to do it${customExercises().length ? `, plus ${customExercises().length} of your own` : ''}</p></div></header>
    <div class="field compact"><input id="lib-q" type="search" autocomplete="off" aria-label="Search exercises" placeholder="Search by name or muscle" value="${esc(ui.libQuery)}" data-live="lib-search"></div>
    <div class="filter-row">${seg('lib-m', [['all', 'All'], [CARDIO.id, CARDIO.name], ...MUSCLES.map((m) => [m.id, m.name])], ui.libFilter, 'lib-filter')}</div>
    <ul class="list" id="lib-list">${libraryList(ui.libQuery, ui.libFilter)}</ul>`;
}

// ----- Cook with what you have -----

function useLabel() {
  return ui.eatDay === weekdayIndex(today()) ? 'today' : dayLong(ui.eatDay);
}

function ideaCard(m, slot, kind, missing = []) {
  const mm = mealMacros(m);
  if (kind === 'gen') ui.ideas.set(m.id, m);
  return `<article class="idea">
    <p class="idea-name">${esc(m.name)}</p>
    <p class="idea-meta">${kind === 'gen' ? 'Made from your foods' : 'Recipe'}, ${Math.round(mm.kcal)} kcal, ${Math.round(mm.p)} g protein${rules().carbCounts ? `, ${Math.round(mm.c)} g carbs` : ''} a portion</p>
    ${missing.length ? `<p class="need">You’d also need ${esc(andList(missing.map((id) => lcFirst(INGREDIENTS[id].name))))}</p>` : ''}
    <p class="idea-items">${esc(mealLines(m, 1).join(', '))}</p>
    ${m.how ? `<details class="how"><summary>How to make it</summary><p>${esc(m.how)}</p></details>` : ''}
    <div class="idea-actions"><button class="btn btn-small" data-act="pantry-use" data-kind="${kind}" data-id="${m.id}" data-slot="${slot}">Use for ${esc(useLabel())}’s ${slot}</button></div>
  </article>`;
}

// Only meals made entirely from the foods you ticked (plus the cupboard basics). Recipes you're one food
// short of are kept apart, in a closed list, for when you're shopping.
function pantryResults() {
  const have = S.pantry.have;
  ui.ideas = new Map();
  ui.pantryCount = 0;
  if (!have.length) return '<p class="empty">Tick a few foods above to see what you can make.</p>';
  const diet = dietOf(S);
  const r = rules();
  const { allowed } = allowedMeals(S);
  const short = [];
  const slots = SLOTS.map((slot) => {
    const ideas = mealIdeas(slot.id, have, diet, r, 2);
    // a recipe with the same name as an idea made from your foods would just repeat it
    const names = new Set(ideas.map((i) => i.name.toLowerCase()));
    const matched = matchRecipes(allowed, have, slot.id).filter((x) => !x.meal.gen && !ideas.some((i) => i.id === x.meal.id) && !names.has(x.meal.name.toLowerCase()));
    const recipes = matched.filter((x) => !x.missing.length).slice(0, 2);
    short.push(...matched.filter((x) => x.missing.length === 1).slice(0, 2).map((x) => ({ ...x, slot: slot.id })));
    ui.pantryCount += ideas.length + recipes.length;
    const hint = slot.id === 'snack' ? 'Add something like yogurt, eggs, tuna or fruit.' : slot.id === 'breakfast' ? 'Add eggs, oats with milk, or yogurt.' : 'Add a protein food, like chicken, eggs, tofu, fish or beans.';
    return `<section class="slot-head"><h3 class="h3">${slot.name}</h3>
      ${ideas.length || recipes.length ? `<div class="ideas">${ideas.map((m) => ideaCard(m, slot.id, 'gen')).join('')}${recipes.map((x) => ideaCard(x.meal, slot.id, 'recipe')).join('')}</div>` : `<p class="empty">Nothing yet. ${hint}</p>`}
    </section>`;
  }).join('');
  return `<h2 class="h2">What you can make</h2>${slots}
    ${short.length ? `<details class="short-list"><summary><span class="row-title">One food short (${short.length})</span><span class="fine">Recipes that need one thing you didn’t tick, for your next shop</span></summary>
      <div class="ideas">${short.map((x) => ideaCard(x.meal, x.slot, 'recipe', x.missing)).join('')}</div></details>` : ''}`;
}

const pantryBarText = () => (ui.pantryCount ? `See ${plural(ui.pantryCount, 'meal idea')}` : '');

// After ticking a food: redraw the ideas without redrawing the ticks, so focus and scroll stay put
function updatePantry() {
  const box = document.getElementById('pantry-results');
  if (box) box.innerHTML = pantryResults();
  const clear = document.querySelector('[data-act="pantry-clear"]');
  if (clear) clear.hidden = !S.pantry.have.length;
  const sum = document.getElementById('have-summary');
  if (sum) sum.textContent = haveSummary();
  const bar = document.getElementById('pantry-bar');
  if (bar) {
    bar.hidden = !ui.pantryCount || !document.querySelector('.food-picker[open]');
    bar.querySelector('button').textContent = pantryBarText();
  }
}

function haveSummary() {
  const names = S.pantry.have.filter((id) => INGREDIENTS[id]).map((id) => lcFirst(INGREDIENTS[id].name));
  if (!names.length) return 'Nothing ticked yet';
  return names.length > 4 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : andList(names);
}

function pantryView() {
  const groups = pickableIngredients(dietOf(S), rules());
  const have = S.pantry.have;
  const results = pantryResults();
  return `${backLink('#eat', 'Eat')}
    <header class="screen-head"><h1 class="title">Cook with what you have</h1></header>
    ${aiBoxHTML()}
    <h2 class="h2 pick-head">Or tick foods from a list</h2>
    <p class="muted">These ideas are put together on your phone from the foods you tick, sized to your calories and following your food rules${rules().items.length ? ' and health' : ''}. They only use what you tick.</p>
    <details class="food-picker">
      <summary><span class="row-title">Your foods</span><span class="fine" id="have-summary">${esc(haveSummary())}</span></summary>
      ${groups.map((g) => `<section class="food-group"><h2 class="h3">${g.group}</h2><div class="chips">${g.items.map((it) => `<input type="checkbox" id="pf-${it.id}" value="${it.id}" data-change="pantry"${have.includes(it.id) ? ' checked' : ''}><label for="pf-${it.id}">${esc(it.name)}</label>`).join('')}</div></section>`).join('')}
      <p class="fine pantry-foot">Oil, garlic, spices, herbs and lemon are assumed. Foods your rules leave out aren’t listed. <button class="btn-link" data-act="pantry-clear"${have.length ? '' : ' hidden'}>Untick everything</button></p>
    </details>
    <div id="pantry-results">${results}</div>
    <div class="finish-bar pantry-bar" id="pantry-bar" hidden><button class="btn btn-primary btn-wide" data-act="pantry-show">${pantryBarText()}</button></div>`;
}

// The "See meal ideas" bar is for when the ideas are below the screen; it hides once they're in view
let pantryIO = null;
function watchPantryBar() {
  pantryIO?.disconnect();
  pantryIO = null;
  const res = document.getElementById('pantry-results');
  const bar = document.getElementById('pantry-bar');
  if (!res || !bar || typeof IntersectionObserver === 'undefined') return;
  pantryIO = new IntersectionObserver(([e]) => bar.classList.toggle('away', e.isIntersecting || e.boundingClientRect.top < 0));
  pantryIO.observe(res);
}

// ----- Meal ideas from the AI -----

const AI_SLOTS = [['any', 'Any meal'], ['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Snack']];

// One request per meal, run side by side so each idea shows as soon as it's ready
function aiRequests(slot) {
  if (slot === 'any') return ['breakfast', 'lunch', 'dinner'].map((s) => ({ slot: s, style: '' }));
  return [{ slot, style: 'quick and simple, 25 minutes or less' }, { slot, style: 'something a bit different, that could also be cooked in a batch' }];
}

function aiIdeaCard(m) {
  const carbs = rules().carbCounts;
  return `<article class="idea ai-idea">
    <p class="idea-name">${esc(m.name)}</p>
    <p class="idea-meta">${esc(slotName(m.slot))}${m.mins ? `, about ${m.mins} min` : ''}, ${fmtInt(m.kcal)} kcal, ${fmtInt(m.p)} g protein${carbs ? `, ${fmtInt(m.c)} g carbs` : ''}</p>
    ${m.extras?.length ? `<p class="need">Also uses ${esc(andList(m.extras.map(lcFirst)))}, which wasn’t in your list</p>` : ''}
    <p class="idea-items">${esc(mealLines(m, 1).join(', '))}</p>
    ${m.steps?.length ? `<details class="how"><summary>How to make it</summary><ol class="steps-list">${m.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>` : ''}
    ${needsHalalNote(m, S.profile.diet) ? '<p class="fine">Use halal meat.</p>' : ''}
    <div class="idea-actions"><button class="btn btn-small" data-act="ai-use" data-id="${m.id}">Use for ${esc(useLabel())}’s ${esc(m.slot)}</button></div>
  </article>`;
}

function aiResultsHTML() {
  const res = S.pantry.ai;
  const busy = ui.aiBusy;
  if (busy) {
    const done = res?.meals?.length || 0;
    return `<div class="ai-wait" role="status"><span class="ai-dots" aria-hidden="true"></span><p><strong>Putting meals together from your food…</strong><br><span class="fine">Each idea shows as soon as it’s ready, usually within 20 to 30 seconds.${done ? ` ${plural(done, 'idea')} ready so far.` : ''}</span></p></div>
      ${done ? `<div class="ideas">${res.meals.filter((m) => !m.extras?.length).map(aiIdeaCard).join('')}</div>` : ''}`;
  }
  if (ui.aiError) return `<p class="note warn-note">${esc(ui.aiError)}</p>`;
  if (!res?.meals) return '';
  const fit = res.meals.filter((m) => !m.extras?.length);
  const extra = res.meals.filter((m) => m.extras?.length);
  const left = [
    res.left ? `${plural(res.left, 'idea')} that didn’t fit your food rules` : '',
    res.odd ? `${plural(res.odd, 'idea')} that mixed foods that don’t go together` : '',
  ].filter(Boolean);
  const empty = left.length
    ? 'None of these ideas passed the app’s checks. Try “Get different ideas”, or add another food.'
    : 'The AI couldn’t make a full meal from just those foods. Add a protein food (like eggs, chicken, beans or yogurt) and a carb (like rice, bread or potatoes).';
  return `${left.length ? `<p class="fine">Left out ${andList(left)}.</p>` : ''}
    ${fit.length ? `<div class="ideas">${fit.map(aiIdeaCard).join('')}</div>` : `<p class="empty">${empty}</p>`}
    ${extra.length ? `<details class="short-list"><summary><span class="row-title">Ideas that need one more food (${extra.length})</span><span class="fine">They use something you didn’t list</span></summary><div class="ideas">${extra.map(aiIdeaCard).join('')}</div></details>` : ''}
    <p class="fine ai-foot">Ideas and amounts are AI estimates: check labels if you count closely. <button class="btn-link" data-act="ai-again">Get different ideas</button></p>`;
}

function updateAIResults() {
  const box = document.getElementById('ai-results');
  if (box) box.innerHTML = aiResultsHTML();
  const btn = document.querySelector('form[data-form="ai-meals"] button[type="submit"]');
  if (btn) {
    btn.disabled = ui.aiBusy;
    btn.textContent = ui.aiBusy ? 'Thinking…' : 'Get meal ideas';
  }
}

async function runAIMeals(foods, slot, again = false) {
  // sized for the day the meal would go into (the day picked on Eat), including any back-on-track change
  const day = dayTargets(S, weekDate(S, ui.eatDay));
  const targets = slotTargets(day);
  const diet = dietOf(S);
  const r = rules();
  const reqs = aiRequests(slot);
  const before = again ? (S.pantry.ai?.meals || []).map((m) => m.name).join(', ') : '';
  S.pantry.ai = { text: foods, slot, at: today(), meals: [], left: 0, odd: 0 };
  ui.aiBusy = true;
  ui.aiError = '';
  updateAIResults();
  let failure = null;
  await Promise.all(reqs.map(async (q) => {
    try {
      const body = await callAI({ task: 'meals', foods, slot: q.slot, count: 1, style: q.style, avoidNames: before, targets: { [q.slot]: targets[q.slot] }, rules: aiRules(diet, r) });
      for (const raw of body.meals || []) {
        const s = SLOTS.some((x) => x.id === raw.slot) ? raw.slot : q.slot;
        const m = aiMeal(raw, s, targets[s], { diet, rules: r, have: foods });
        if (!m) continue;
        if (m.breaks.length) { S.pantry.ai.left += 1; continue; }
        if (m.odd) { S.pantry.ai.odd += 1; continue; }
        if (S.pantry.ai.meals.some((x) => x.id === m.id || x.name.toLowerCase() === m.name.toLowerCase())) continue;
        S.pantry.ai.meals.push(m);
      }
    } catch (err) {
      failure ||= err;
    }
    updateAIResults();
  }));
  ui.aiBusy = false;
  if (!S.pantry.ai.meals.length && failure) ui.aiError = failure instanceof AIError ? failure.message : 'The AI couldn’t answer just now. Try again in a minute.';
  save();
  updateAIResults();
}

function aiBoxHTML() {
  return `<section class="ai-box">
      <h2 class="h2">${I.ai} Tell the AI what food you have</h2>
      <form data-form="ai-meals" novalidate>
        <div class="field"><label for="ai-foods" class="sr-only">Your food</label>
          <textarea id="ai-foods" name="ai-foods" rows="3" maxlength="600" placeholder="chicken thighs, rice, peppers, onions, yogurt, chapati, eggs">${esc(S.pantry.text || '')}</textarea></div>
        <fieldset class="field compact"><legend>Ideas for</legend>${seg('ai-slot', AI_SLOTS, ui.aiSlot, 'ai-slot')}</fieldset>
        <button class="btn btn-primary btn-wide" type="submit"${ui.aiBusy ? ' disabled' : ''}>${ui.aiBusy ? 'Thinking…' : 'Get meal ideas'}</button>
      </form>
      <p class="fine">The AI only uses the foods you list, plus oil, salt, spices, herbs, garlic and lemon. Meals are sized to your plan and follow your food rules${rules().items.length ? ' and health' : ''}. Getting ideas sends this list, your meal targets and your food rules to Cloudflare’s AI, and nothing else. It isn’t used to train AI.</p>
      <div id="ai-results" aria-live="polite">${aiResultsHTML()}</div>
    </section>`;
}

// ----- Health -----

function healthFields(h) {
  return `
    <fieldset class="field"><legend>Diabetes</legend>${seg('hl-diabetes', DIABETES, h.diabetes)}</fieldset>
    <fieldset class="field"><legend>Other conditions</legend>${chips('hl-cond', CONDITIONS.map((c) => [c.id, c.name]), h.conditions)}</fieldset>
    <fieldset class="field"><legend>Pain or an injury in your</legend>${chips('hl-pain', PAIN.map((c) => [c.id, c.name]), h.pain)}</fieldset>
    ${field('hl-other', 'Anything else <span class="opt">optional</span>', `<input id="hl-other" name="hl-other" maxlength="120" value="${esc(h.other || '')}">`, 'Gainloop can’t adjust for this automatically, but it will remind you to check your plan with your GP.')}`;
}

function readHealth(form) {
  return normHealth({
    diabetes: fval(form, 'hl-diabetes') || 'none',
    conditions: [...form.querySelectorAll('input[name="hl-cond"]:checked')].map((i) => i.value),
    pain: [...form.querySelectorAll('input[name="hl-pain"]:checked')].map((i) => i.value),
    other: fval(form, 'hl-other').trim(),
  });
}

function healthView() {
  const h = normHealth(S.profile.health);
  const r = rules();
  const list = (arr) => `<ul class="notes">${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return `${backLink('#you', 'You')}
    <header class="screen-head"><h1 class="title">Health</h1></header>
    <p class="muted">Optional, and it stays on this phone. It changes your plan and adds safety notes, but it isn’t medical advice: your doctor’s or care team’s advice comes first.</p>
    ${r.checkFirst.length ? `<div class="banner banner-warn"><div>${list(r.checkFirst)}</div></div>` : ''}
    ${r.items.length ? `<section class="section"><h2 class="h2">What changes in your plan</h2><ul class="health-list">${r.items.map((it) => `<li><p class="h3">${esc(it.name)}</p><p>${esc(it.changes.map((c, i) => (i ? lcFirst(c) : c)).join(', '))}.</p></li>`).join('')}</ul></section>` : ''}
    ${r.train.length ? `<section class="section"><h2 class="h2">When you train</h2>${list(r.train)}</section>` : ''}
    ${r.food.length ? `<section class="section"><h2 class="h2">Food</h2>${list(r.food)}</section>` : ''}
    <section class="section"><h2 class="h2">${hasHealth(h) ? 'Your details' : 'Add health details'}</h2>
      <form data-form="health" novalidate>${healthFields(h)}<div class="form-actions"><button class="btn btn-primary" type="submit">Save</button></div></form>
    </section>`;
}

// ---------- Routing ----------

const VIEWS = {
  welcome: welcomeView,
  setup: () => setupView('new'),
  profile: () => setupView('edit'),
  today: todayView,
  body: bodyView,
  measure: measureView,
  frame: frameView,
  bodyfat: bodyfatView,
  train: trainView,
  session: sessionView,
  eat: eatView,
  shop: shopView,
  mealnew: mealNewView,
  rules: rulesView,
  you: youView,
  restore: restoreView,
  changes: changesView,
  maths: mathsView,
  checkin: checkinView,
  myex: myExView,
  library: libraryView,
  pantry: pantryView,
  health: healthView,
  ontrack: ontrackView,
  log: logView,
  wellness: wellnessView,
};

const TAB_OF = {
  today: 'today', checkin: 'today', ontrack: 'today', log: 'today', wellness: 'today', body: 'body', measure: 'body', frame: 'body', bodyfat: 'body',
  train: 'train', session: 'train', myex: 'train', library: 'train',
  eat: 'eat', shop: 'eat', mealnew: 'eat', rules: 'eat', pantry: 'eat',
  you: 'you', profile: 'you', restore: 'you', changes: 'you', maths: 'you', health: 'you',
};
const TITLES = { today: 'Today', body: 'Body', train: 'Train', eat: 'Eat', you: 'You' };

function route() {
  const h = decodeURIComponent(location.hash.replace(/^#/, ''));
  const [name, ...rest] = h.split('-');
  let r = { name: name || '', param: rest.join('-') };
  if (!S.profile) {
    if (!['welcome', 'setup', 'restore', 'maths'].includes(r.name)) r = { name: 'welcome', param: '' };
  } else if (!VIEWS[r.name] || r.name === 'welcome' || r.name === 'setup') {
    r = { name: 'today', param: '' };
  }
  return r;
}

function renderTabs(r) {
  const nav = document.getElementById('tabs');
  if (!nav) return;
  const show = !!S.profile && !['setup', 'profile', 'welcome'].includes(r.name);
  nav.hidden = !show;
  document.body.classList.toggle('has-tabs', show);
  if (!show) return;
  const active = TAB_OF[r.name];
  nav.innerHTML = ['today', 'body', 'train', 'eat', 'you'].map((t) => `<a class="tab" href="#${t}"${active === t ? ' aria-current="page"' : ''}>${I[t]}<span>${TITLES[t]}</span></a>`).join('');
}

function render() {
  syncCustoms();
  const r = route();
  const view = document.getElementById('view');
  if (S.profile) pruneLog(S, today());
  if (S.profile && ensureCurrentWeek(S, today())) save();
  // the end of each week: work out what you lifted in the week that has just finished
  weekCache = null;
  if (S.profile && closeWeeks(S, today())) save();
  if (r.name !== 'checkin') ui.checkin = null;
  if (r.name !== 'wellness') ui.wq = null;
  if (r.name !== 'setup' && r.name !== 'profile') ui.setup = null;
  view.innerHTML = VIEWS[r.name](r.param);
  renderTabs(r);
  document.body.dataset.route = r.name;
  const key = `${r.name}-${r.param}`;
  if (key !== ui.lastRoute) {
    window.scrollTo(0, 0);
    ui.lastRoute = key;
    const h1 = view.querySelector('h1');
    document.title = r.name === 'welcome' || !h1 ? 'Gainloop' : `${h1.textContent.trim()} – Gainloop`;
  }
  drawCharts();
  warmPictures();
  if (r.name === 'pantry') watchPantryBar();
  else { pantryIO?.disconnect(); pantryIO = null; }
  renderSheet();
}

function drawCharts() {
  const el = document.querySelector('[data-chart="weight"]');
  if (!el) return;
  const body = U().body;
  drawWeightChart(el, S.weights, {
    today: today(),
    toDisplay: (kg) => (body === 'kg' ? kg : kgToLb(kg)),
    fmt: (kg) => fBody(kg),
    unitLabel: body === 'kg' ? 'kg' : 'lb',
  });
}

// ---------- Sheets (bottom panels) ----------

function openSheet(sheet) {
  ui.sheet = sheet;
  renderSheet();
  setTimeout(() => document.querySelector('.sheet button, .sheet a')?.focus(), 30);
}

function closeSheet() {
  ui.sheet = null;
  renderSheet();
}

function renderSheet() {
  const root = document.getElementById('sheet-root');
  if (!root) return;
  const sh = ui.sheet;
  document.documentElement.classList.toggle('sheet-open', !!sh);
  if (!sh) { root.innerHTML = ''; return; }
  // keep the scroll position when the same sheet is drawn again (after a toggle, say)
  const prev = root.querySelector('.sheet');
  const keepScroll = prev && prev.dataset.key === sheetKey(sh) ? prev.scrollTop : 0;
  root.innerHTML = `<div class="sheet-backdrop" data-act="sheet-close"></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" data-key="${esc(sheetKey(sh))}">
      <header class="sheet-head"><h2 id="sheet-title" class="h2">${sh.title}</h2><button class="icon-btn" data-act="sheet-close" aria-label="Close">${I.close}</button></header>
      <div class="sheet-body">${sheetBody(sh)}</div>
    </section>`;
  const sheet = root.querySelector('.sheet');
  if (keepScroll) sheet.scrollTop = keepScroll;
}

const sheetKey = (sh) => `${sh.type}:${sh.ex ?? sh.i ?? ''}:${sh.mode || ''}`;

function sheetBody(sh) {
  if (sh.type === 'guide') return guideSheet(sh);
  if (sh.type === 'custom-ex') return customExSheet(sh);
  if (sh.type === 'html') return sh.html;
  if (sh.type === 'confirm') {
    return `<p>${sh.text}</p><div class="form-actions"><button class="btn ${sh.danger ? 'btn-danger' : 'btn-primary'}" data-act="${sh.act}" data-confirmed="1"${sh.data || ''}>${sh.confirm}</button><button class="btn" data-act="sheet-close">Cancel</button></div>`;
  }
  if (sh.type === 'meal') return mealSheet(sh);
  if (sh.type === 'log-meal') return logMealSheet(sh);
  if (sh.type === 'log-food') return foodForm(sh);
  if (sh.type === 'swap') return swapSheet(sh);
  if (sh.type === 'copy') return `<p class="muted">Select all of this text and copy it, then keep it somewhere safe, like your notes or email.</p><textarea class="copy-area" rows="8" readonly>${esc(sh.text)}</textarea>`;
  return '';
}

function mealSheet(sh) {
  const byId = mealsById(S);
  const day = S.mealWeek.days[sh.day];
  const e = day.meals[sh.i];
  const m = byId.get(e?.id);
  if (!m) return '<p>That meal has gone.</p>';
  if (sh.mode === 'swap') {
    const { allowed } = allowedMeals(S);
    const carbs = rules().carbCounts;
    const meta = (mm) => `${Math.round(mm.kcal)} kcal, ${Math.round(mm.p)} g protein${carbs ? `, ${Math.round(mm.c)} g carbs` : ''} a portion`;
    const have = S.pantry.have;
    // From the foods you said you have: new meals made from them, then recipes you can make without shopping
    const gen = have.length ? mealIdeas(e.slot, have, dietOf(S), rules(), 3).filter((g) => g.id !== e.id) : [];
    for (const g of gen) ui.ideas.set(g.id, g);
    const ready = have.length ? matchRecipes(allowed, have, e.slot).filter((x) => !x.missing.length && x.meal.id !== e.id && !gen.some((g) => g.id === x.meal.id)).slice(0, 3) : [];
    const fromHave = gen.length || ready.length
      ? `<h3 class="h3">From the foods you have</h3>
        <ul class="list">${gen.map((g) => `<li><button class="row row-button" data-act="meal-swap-gen" data-id="${g.id}"><span class="row-main"><span class="row-title">${esc(g.name)}</span><span class="fine">New idea from your foods, ${meta(mealMacros(g))}</span></span>${I.next}</button></li>`).join('')}${ready.map((x) => `<li><button class="row row-button" data-act="meal-swap" data-to="${x.meal.id}"><span class="row-main"><span class="row-title">${esc(x.meal.name)}</span><span class="fine">You have everything, ${meta(x.macros)}</span></span>${I.next}</button></li>`).join('')}</ul>
        <p class="fine"><a class="link" href="#pantry">Change your foods</a></p>`
      : `<p class="note">${have.length ? 'Nothing for this meal from the foods you ticked yet.' : 'Tell Gainloop what food you have and it suggests meals you can make with it.'} <a class="link" href="#pantry">${have.length ? 'Add more foods' : 'Pick your foods'}</a></p>`;
    const opts = swapOptions(day, sh.i, allowed, targetsFor(S, weekDate(S, sh.day))).filter((o) => !gen.some((g) => g.id === o.meal.id) && !ready.some((x) => x.meal.id === o.meal.id));
    return `<p class="muted">Swapping changes portion sizes for the day so you still hit your calories.</p>
      ${fromHave}
      <h3 class="h3 swap-all">All ${(SLOTS.find((s) => s.id === e.slot)?.name || 'meal').toLowerCase()} options</h3>
      <ul class="list">${opts.map((o) => `<li><button class="row row-button" data-act="meal-swap" data-to="${o.meal.id}"><span class="row-main">${esc(o.meal.name)}<span class="fine"> ${meta(o.macros)}</span></span>${I.next}</button></li>`).join('')}</ul>
      ${opts.length ? '' : '<p class="empty">Nothing else fits this slot with your rules.</p>'}`;
  }
  const mm = mealMacros(m);
  const x = day.x;
  const lines = mealLines(m, x);
  const pantry = pantryLine(m);
  return `<p class="muted">${SLOTS.find((s) => s.id === e.slot).name}${m.gen ? ', made from your foods' : m.ai ? ', an AI idea' : ''}${m.mins ? `, about ${m.mins} min` : ''}${x !== 1 ? `, ${x} portions` : ''}</p>
    <p class="macros"><span><strong>${Math.round(mm.kcal * x)}</strong> kcal</span><span><strong>${Math.round(mm.p * x)} g</strong> protein</span><span><strong>${Math.round(mm.c * x)} g</strong> carbs</span><span><strong>${Math.round(mm.f * x)} g</strong> fat</span></p>
    ${needsHalalNote(m, S.profile.diet) ? `<p class="note">Use halal meat.</p>` : ''}
    ${lines.length ? `<h3 class="h3">You need</h3><ul class="ingredients">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p class="muted">Your own meal. Portion size scales with your calories.</p>'}
    ${pantry.length ? `<p class="fine">Plus ${esc(pantry.join(', '))}.</p>` : ''}
    ${m.steps?.length ? `<h3 class="h3">How to make it</h3><ol class="steps-list">${m.steps.map((st) => `<li>${esc(st)}</li>`).join('')}</ol>` : m.how ? `<h3 class="h3">How to make it</h3><p>${esc(m.how)}</p>` : ''}
    <div class="form-actions"><button class="btn" data-act="meal-swap-open">${I.swap} Swap this meal</button></div>`;
}

function swapSheet(sh) {
  const cur = exerciseById(sh.ex);
  if (!cur) return '<p>That exercise isn’t in your plan any more.</p>';
  const r = rules();
  const opts = swapChoices(cur.m, S.profile).filter((e) => e.id !== cur.id);
  // easier on a sore joint first, then the rest
  const sorted = [...opts.filter((e) => !soreFor(e.id).length), ...opts.filter((e) => soreFor(e.id).length)];
  return `<p class="muted">Pick another ${muscleName(cur.m).toLowerCase()} exercise. It replaces ${esc(lcFirst(cur.name))} everywhere in your plan. Tap a picture to see how it’s done.</p>
    <ul class="list">${sorted.map((e) => {
      const sore = soreFor(e.id);
      return `<li class="row swap-row"><button class="thumb-btn" data-act="guide" data-ex="${e.id}" data-back="swap" aria-label="How to do ${esc(e.name)}">${thumb(e.id)}</button><button class="row-pick" data-act="swap-to" data-from="${cur.id}" data-to="${e.id}"><span class="row-main"><span class="row-title">${esc(e.name)}</span><span class="fine">${repText(e, repRange(e, r))}${e.load === 'bw' ? ', bodyweight' : ''}${sore.length ? `, can load your ${esc(andList(sore))}` : ''}</span></span>${I.next}</button></li>`;
    }).join('')}</ul>
    ${opts.length ? '' : '<p class="empty">No other exercise for this muscle fits your equipment.</p>'}`;
}

function infoSheet(topic) {
  const n = S.nutrition;
  const p = S.profile;
  const r = rules();
  if (topic === 'calories') {
    const changed = n.kcal - (n.maintenance + n.adj);
    const gainPerMonth = p.goal === 'build' ? (C.currentWeight(S.weights, today()) * C.MONTHLY_GAIN_PCT[p.experience]) / 100 : 0;
    return {
      title: 'Why these numbers',
      html: `<ul class="explain">
        <li><strong>Maintenance estimate: ${kcal(n.maintenance)}.</strong> From your weight, height, age, daily activity and ${p.days} training days.</li>
        <li><strong>${C.GOALS[p.goal].name}: ${n.adj >= 0 ? '+' : '−'}${Math.abs(n.adj)} kcal.</strong> ${p.goal === 'build' ? `Aims for about ${fKgPlain(gainPerMonth, 1)} a month, slow enough that most of it is muscle.` : p.goal === 'lean' ? 'Aims to lose about 0.5% of your weight a week.' : 'Recomp keeps you at maintenance.'}</li>
        ${changed ? `<li><strong>Check-ins: ${changed > 0 ? '+' : '−'}${Math.abs(changed)} kcal.</strong> Adjusted from how your weight actually moved.</li>` : '<li><strong>Check-ins:</strong> every two weeks your weight trend is compared with the target pace, and calories move if you’re off.</li>'}
        <li><strong>Protein ${n.protein} g.</strong> ${r.standardProtein ? 'A standard 0.8 g per kg of body weight, because of your kidney condition. If your kidney team gives you a different target, follow theirs.' : `About ${p.goal === 'lean' ? '2.0' : '1.8'} g per kg of body weight.`}</li>
        <li><strong>Fat ${n.fat} g, carbs ${n.carbs} g.</strong> ${r.carbCap ? 'Carbs are capped at about 45% of calories because of your diabetes. Protein and fat make up the rest, and every meal shows its carbs so you can count them.' : 'At least a quarter of calories from fat, carbs fill the rest for training.'}</li>
      </ul><a class="link" href="#changes">See every change</a>`,
    };
  }
  if (topic === 'targets') {
    return {
      title: 'How targets work',
      html: `<p>Your wrist and ankle are mostly bone, so they show how big your frame is. Casey Butt's formulas turn those and your height into the measurements a drug-free lifter could reach at about 8 to 10% body fat after many years.</p>
        <p>They're upper estimates and run high, which is why your aim is a share of them. The yellow tape fills up to your latest reading and the notch marks your aim.</p>
        <p>Any site at least 3 points behind the others becomes a priority and those muscles get extra sets.</p><a class="link" href="#maths">How the numbers work</a>`,
    };
  }
  if (topic === 'lean') {
    return {
      title: 'Lean mass',
      html: '<p>Lean mass is your weight minus fat: muscle, bone, organs and water. It’s a fairer progress measure than the tape because fat doesn’t count. The ceiling comes from your frame and current body fat, and your aim is the same share of it as your measurement targets.</p>',
    };
  }
  return { title: '', html: '' };
}

// ---------- Actions ----------

function sessionDraft(sid, exId) {
  S.drafts[sid] ||= {};
  S.drafts[sid][exId] ||= {};
  return S.drafts[sid][exId];
}

async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    openSheet({ type: 'copy', title: 'Copy this text', text });
  }
}

const ACTIONS = {
  demo() {
    S = seedDemo(today());
    S.units = { ...S.units };
    save();
    location.hash = '#today';
    render();
  },
  'start-own'(el) {
    if (!el.dataset.confirmed) {
      openSheet({ type: 'confirm', title: 'Start with your own details?', text: 'This clears the example data and takes you through setup.', confirm: 'Clear and set up', act: 'start-own' });
      return;
    }
    const keep = { units: S.units, theme: S.theme };
    S = { ...blankState(), ...keep };
    clearSaved();
    closeSheet();
    location.hash = '#setup';
    render();
  },
  'sheet-close'() { closeSheet(); },
  'setup-back'() {
    const form = document.querySelector('form[data-form="setup"]');
    if (form) captureSetup(form, false);
    ui.setup.error = '';
    ui.setup.step = Math.max(0, ui.setup.step - 1);
    render();
  },
  'setup-skip'() { finishSetup(false); },
  install() {
    const ev = ui.installEvent;
    if (!ev) return;
    ev.prompt();
    ev.userChoice?.finally(() => { ui.installEvent = null; render(); });
  },
  'install-dismiss'() { S.installDismissed = true; commit(); },
  info(el) { openSheet({ type: 'html', ...infoSheet(el.dataset.topic) }); },
  'del-weight'(el) {
    if (!el.dataset.confirmed) {
      openSheet({ type: 'confirm', title: 'Delete this weigh-in?', text: `${fmtDate(el.dataset.d)}: ${fBody(S.weights.find((w) => w.d === el.dataset.d)?.kg)}`, confirm: 'Delete', danger: true, act: 'del-weight', data: ` data-d="${el.dataset.d}"` });
      return;
    }
    S.weights = S.weights.filter((w) => w.d !== el.dataset.d);
    closeSheet();
    commit('Weigh-in deleted');
  },
  'del-measure'(el) {
    if (!el.dataset.confirmed) {
      openSheet({ type: 'confirm', title: 'Delete these measurements?', text: 'This can’t be undone. Your plan will update from the remaining entries.', confirm: 'Delete', danger: true, act: 'del-measure', data: ` data-id="${el.dataset.id}"` });
      return;
    }
    S.measures = S.measures.filter((m) => m.id !== el.dataset.id);
    afterBodyChange(S, today());
    closeSheet();
    save();
    location.hash = '#body';
    toast('Measurements deleted');
  },
  'del-bodyfat'() {
    S.bfOverride = null;
    save();
    location.hash = '#body';
    toast('Using the tape estimate');
  },
  'why-sets'(el) {
    const m = el.dataset.m;
    openSheet({ type: 'html', title: `${muscleName(m)}: ${S.program.weekly[m] || 0} sets a week`, html: `<p>${esc(whySets(S.program, m, S.profile))}</p>` });
  },
  swap(el) {
    openSheet({ type: 'swap', title: 'Swap exercise', sid: el.dataset.sid, ex: el.dataset.ex });
  },
  // Keep your usual exercise this week instead of the gentler one the wellness check picked
  'wellness-keep'(el) {
    const entry = activeEntry(S, today());
    if (!entry) return;
    entry.keep = [...new Set([...(entry.keep || []), el.dataset.ex])];
    commit(`Back to ${lcFirst(exerciseById(el.dataset.ex)?.name || 'your usual exercise')} this week`);
  },
  'swap-to'(el) {
    const from = el.dataset.from;
    const to = el.dataset.to;
    const root = Object.keys(S.swaps).find((k) => S.swaps[k] === from) || from;
    if (to === root) delete S.swaps[root];
    else S.swaps[root] = to;
    refreshProgram(S);
    closeSheet();
    commit(`Swapped to ${lcFirst(exerciseById(to).name)}`);
  },
  finish(el) {
    const sid = el.dataset.sid;
    const t = today();
    const logged = [];
    for (const art of document.querySelectorAll('article.exercise[data-ex]')) {
      const exId = art.dataset.ex;
      if (art.dataset.cardio) {
        const min = parseNum(art.querySelector('[data-field="min"]')?.value);
        if (!min || min <= 0) continue;
        const felt = art.querySelector('[data-field="felt"]:checked')?.value || null;
        S.exLog[exId] = (S.exLog[exId] || []).filter((h) => h.d !== t).concat({ d: t, min: Math.round(min), felt });
        logged.push(exId);
        continue;
      }
      const reps = [...art.querySelectorAll('input.rep')].map((r) => parseNum(r.value)).filter((r) => r !== null && r > 0).map((r) => Math.round(r));
      if (!reps.length) continue;
      const ex = exerciseById(exId);
      const w = ex.load === 'kg' ? parseNum(art.querySelector('[data-field="kg"]')?.value) : null;
      const entry = { d: t, kg: w !== null ? round(liftToKg(w, U().lift), 2) : (ex.load === 'kg' ? 0 : null), reps };
      S.exLog[exId] = (S.exLog[exId] || []).filter((h) => h.d !== t).concat(entry);
      logged.push(exId);
    }
    if (!logged.length && !el.dataset.confirmed) {
      openSheet({ type: 'confirm', title: 'Nothing logged yet', text: 'Mark this workout as done without saving any sets?', confirm: 'Mark as done', act: 'finish', data: ` data-sid="${sid}"` });
      return;
    }
    S.sessionsDone = S.sessionsDone.filter((x) => !(x.d === t && x.sid === sid)).concat({ d: t, sid });
    delete S.drafts[sid];
    closeSheet();
    save();
    location.hash = '#today';
    toast(logged.length ? `Workout saved: ${plural(logged.length, 'exercise')} logged` : 'Workout marked as done');
  },
  'eat-day'(el) { ui.eatDay = Number(el.dataset.i); render(); },
  'meal-open'(el) {
    const i = Number(el.dataset.i);
    const m = mealsById(S).get(S.mealWeek.days[ui.eatDay].meals[i].id);
    openSheet({ type: 'meal', title: esc(m.name), day: ui.eatDay, i, mode: 'detail' });
  },
  'meal-swap-open'() { ui.sheet = { ...ui.sheet, mode: 'swap', title: 'Swap meal' }; renderSheet(); },
  'meal-swap'(el) {
    const sh = ui.sheet;
    const byId = mealsById(S);
    S.mealWeek.days[sh.day] = applySwap(S.mealWeek.days[sh.day], sh.i, el.dataset.to, targetsFor(S, weekDate(S, sh.day)), byId);
    closeSheet();
    commit(`Swapped to ${lcFirst(byId.get(el.dataset.to).name)}`);
  },
  'meals-reshuffle'() {
    refreshMeals(S, today(), true);
    commit('New meal ideas for this week');
  },
  'hidden-meals'() {
    const { hidden } = allowedMeals(S);
    openSheet({ type: 'html', title: 'Left out by your rules', html: `<ul class="list">${hidden.map((h) => `<li class="row"><span class="row-main">${esc(h.meal.name)}<span class="fine"> ${esc(h.reasons.join(', '))}</span></span></li>`).join('')}</ul><a class="link" href="#rules">Edit rules</a>` });
  },
  'copy-shop'() { copyText(shopText(), 'Shopping list copied'); },
  'del-meal'(el) {
    S.customMeals = S.customMeals.filter((m) => m.id !== el.dataset.id);
    refreshMeals(S, today(), false);
    commit('Meal deleted');
  },
  'backup-download'() {
    if (downloadText(`gainloop-backup-${today()}.json`, exportText(S))) toast('Backup downloaded');
  },
  'backup-copy'() { copyText(exportText(S), 'Backup copied. Paste it somewhere safe.'); },
  reset(el) {
    if (!el.dataset.confirmed) {
      openSheet({ type: 'confirm', title: 'Delete all your data?', text: 'Your profile, weigh-ins, measurements, workouts and meal plans will be removed from this device. Make a backup first if you might want them back.', confirm: 'Delete everything', danger: true, act: 'reset' });
      return;
    }
    const keep = { theme: S.theme };
    S = { ...blankState(), ...keep };
    clearSaved();
    closeSheet();
    location.hash = '#welcome';
    render();
  },
  'ci-skip'() { ui.checkin.step = 2; render(); },
  'ci-apply'() {
    const t = today();
    const a = analyseCheckin(S, t, (n, dp = 1) => fKgPlain(n, dp));
    applyCheckin(S, t, a);
    ui.checkin = null;
    save();
    location.hash = '#today';
    toast('Check-in done');
  },

  // ----- Exercise guides and the exercises you already do -----
  guide(el) {
    const ex = exerciseById(el.dataset.ex);
    if (!ex) return;
    const back = el.dataset.back && ui.sheet ? { ...ui.sheet } : null;
    openSheet({ type: 'guide', title: esc(ex.name), ex: ex.id, back });
  },
  'sheet-back'() {
    if (!ui.sheet?.back) { closeSheet(); return; }
    ui.sheet = ui.sheet.back;
    renderSheet();
  },
  'pic-toggle'(el) {
    // remembered while the app is open, so the next exercise you look at stays paused too
    ui.picPaused = !ui.picPaused;
    el.closest('.guide')?.querySelector('.pic-loop')?.classList.toggle('paused', ui.picPaused);
    el.textContent = ui.picPaused ? 'Play' : 'Pause';
    el.setAttribute('aria-pressed', String(ui.picPaused));
  },
  'mine-toggle'(el) {
    const id = el.dataset.id;
    const had = S.myExercises.includes(id);
    S.myExercises = had ? S.myExercises.filter((x) => x !== id) : [...S.myExercises, id];
    if (!had && S.swaps[id]) delete S.swaps[id];
    refreshProgram(S);
    save();
    render();
    const rep = (S.program.mine || []).find((x) => x.id === id);
    toast(had ? 'Removed from your exercises. Sessions updated.' : rep?.where.length ? `Added. It’s in ${andList(rep.where)}.` : `Added. ${rep?.why || ''}`.trim());
  },
  'ex-add'(el) {
    const { ctx, id } = el.dataset;
    const ex = exerciseById(id);
    const { mine } = pickerData(ctx);
    if (!ex) return;
    if (mine.includes(id)) { toast('Already in your list'); return; }
    mine.push(id);
    // saying you do it overrides an earlier swap away from it
    if (ctx === 'state' && S.swaps[id]) delete S.swaps[id];
    afterMineChange(ctx, `Added ${lcFirst(ex.name)}`);
  },
  'ex-remove'(el) {
    const { ctx, id } = el.dataset;
    const { mine } = pickerData(ctx);
    const i = mine.indexOf(id);
    if (i >= 0) mine.splice(i, 1);
    afterMineChange(ctx, `Removed ${lcFirst(exerciseById(id)?.name || 'it')}`);
  },
  'ex-custom'(el) {
    openSheet({ type: 'custom-ex', title: 'Add your own exercise', name: el.dataset.name, ctx: el.dataset.ctx });
  },
  'health-ack'() {
    S.healthAck = rules().checkFirst.join('|');
    commit();
  },

  // ----- Cooking with what you have -----
  'pantry-clear'() {
    S.pantry.have = [];
    save();
    render();
  },
  'pantry-show'() {
    document.getElementById('pantry-results')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  },
  'pantry-use'(el) {
    const { kind, id, slot } = el.dataset;
    const meal = kind === 'gen' ? ui.ideas.get(id) : mealsById(S).get(id);
    if (!meal || !S.mealWeek) { toast('That idea has gone. Tick your foods again.'); return; }
    const when = useLabel();
    useMeal(meal, ui.eatDay, slot, null);
    save();
    location.hash = '#eat';
    toast(`${meal.name} added to ${when}’s ${slot}`);
  },
  // ----- Food log and back on track -----
  'log-meal'(el) {
    const d = el.dataset.d;
    const i = Number(el.dataset.i);
    const pm = plannedMeal(d, i);
    if (!pm) return;
    openSheet({ type: 'log-meal', title: esc(pm.name), d, i, mode: 'choose' });
  },
  'log-meal-set'(el) {
    const sh = ui.sheet;
    if (!sh) return;
    if (el.dataset.v === 'instead') {
      ui.sheet = { ...sh, mode: 'instead', title: 'What did you have instead?' };
      renderSheet();
      return;
    }
    clearMealLog(sh.d, sh.i);
    if (el.dataset.v === 'skip') {
      const pm = plannedMeal(sh.d, sh.i);
      addLogItem(S, sh.d, { kind: 'skip', slot: pm.slot, mealIdx: sh.i, planned: pm, ate: null });
    }
    closeSheet();
    commit(el.dataset.v === 'skip' ? 'Logged as skipped' : 'Back to as planned');
  },
  'log-add'(el) {
    const d = el.dataset.d;
    openSheet({ type: 'log-food', title: d === today() ? 'Something else you ate' : `Something you ate ${dayWord(d)}`, d, kind: 'extra' });
  },
  'log-del'(el) {
    removeLogItem(S, el.dataset.d, el.dataset.id);
    commit('Removed from your log');
  },
  async 'log-estimate'() {
    const form = document.querySelector('form[data-form="log-food"]');
    const box = document.getElementById('lf-est');
    const text = fval(form, 'lf-text').trim();
    if (!text) { toast('Say what you ate first'); return; }
    if (ui.estBusy || !box) return;
    ui.estBusy = true;
    box.innerHTML = `<p class="ai-wait">${I.ai} Estimating…</p>`;
    try {
      const body = await callAI({ task: 'estimate', text });
      const tot = estimateTotal(body.items);
      for (const [k, name] of [['kcal', 'lf-kcal'], ['p', 'lf-p'], ['c', 'lf-c'], ['f', 'lf-f']]) {
        const inp = fe(form, name);
        if (inp) inp.value = tot[k];
      }
      form.dataset.src = 'ai';
      box.innerHTML = `<ul class="est-list">${(body.items || []).map((x) => `<li><span>${esc(x.food)}${x.amount ? ` <span class="fine">${esc(x.amount)}</span>` : ''}</span><span>${fmtInt(x.kcal)} kcal</span></li>`).join('')}</ul>
        <p class="fine">${body.confidence === 'low' ? 'A rough guess.' : 'An estimate.'} Change the numbers if you know better.</p>`;
    } catch (err) {
      box.innerHTML = `<p class="warn-text">${esc(err?.message || 'The AI couldn’t answer.')} You can type the calories yourself.</p>`;
    } finally {
      ui.estBusy = false;
    }
  },
  'gap-leave'() {
    leaveGap(S, today());
    ui.ot = null;
    save();
    if (route().name === 'ontrack') location.hash = '#today';
    else render();
    toast('Left as it is. Your check-ins adjust from your real weight.');
  },
  coach(el) { requestCoach(el.dataset.id); },
  'cardio-done'(el) {
    const t = today();
    const s = markCardio(S, el.dataset.adj, el.dataset.id, true, t);
    if (s) S.exLog[s.ex] = (S.exLog[s.ex] || []).filter((h) => h.d !== t).concat({ d: t, min: s.min, felt: null });
    commit('Cardio done');
  },
  'plan-stop'(el) {
    if (!el.dataset.confirmed) {
      openSheet({ type: 'confirm', title: 'Stop this plan?', text: 'Your calories go back to your usual target from today. What you logged stays in your food log.', confirm: 'Stop the plan', act: 'plan-stop', data: ` data-id="${el.dataset.id}"` });
      return;
    }
    stopAdjustment(S, el.dataset.id);
    rescaleMeals(S);
    S.changes.push({ d: today(), kind: 'track-stop', items: [{ area: 'calories', text: 'Back-on-track plan stopped', why: `Calories are back to your usual ${kcal(S.nutrition.kcal)} a day.` }] });
    closeSheet();
    commit('Plan stopped');
  },

  // ----- AI meal ideas -----
  'ai-use'(el) {
    const m = (S.pantry.ai?.meals || []).find((x) => x.id === el.dataset.id);
    if (!m || !S.mealWeek) { toast('That idea has gone. Ask the AI again.'); return; }
    const when = useLabel();
    useMeal(m, ui.eatDay, m.slot, null);
    save();
    location.hash = '#eat';
    toast(`${m.name} added to ${when}’s ${m.slot}`);
  },
  'ai-again'() {
    if (!S.pantry.text || ui.aiBusy) return;
    runAIMeals(S.pantry.text, ui.aiSlot, true);
  },
  'meal-swap-gen'(el) {
    const sh = ui.sheet;
    const meal = ui.ideas.get(el.dataset.id);
    if (!meal || !sh) return;
    useMeal(meal, sh.day, null, sh.i);
    closeSheet();
    commit(`Swapped to ${lcFirst(meal.name)}`);
  },
};

// Back to "as planned" for meal number i on date d
function clearMealLog(d, i) {
  const day = S.foodLog?.[d];
  if (!day) return;
  day.items = day.items.filter((x) => !(x.mealIdx === i && (x.kind === 'skip' || x.kind === 'instead')));
  if (!day.items.length) delete S.foodLog[d];
}

// A short, kind note from the AI on a back-on-track plan. The plan itself is already set.
async function requestCoach(id) {
  const a = (S.adjust || []).find((x) => x.id === id);
  if (!a || ui.coachBusy) return;
  ui.coachBusy = id;
  ui.coachError = '';
  if (route().name === 'ontrack') render();
  const days = (a.from || []).map((d) => {
    const items = (logFor(S, d)?.items || []).filter((x) => x.handled === a.id);
    return { label: dayLong(weekdayIndex(d)), kcal: Math.round(diffOf(items).kcal), foods: items.map(itemText).join(', ') };
  });
  const tt = dayTargets(S, a.start);
  const counts = new Map();
  for (const c of a.cardio) counts.set(c.ex, (counts.get(c.ex) || 0) + 1);
  try {
    const body = await callAI({
      task: 'coach',
      goal: S.profile.goal,
      gap: { kcal: a.gap.kcal, days },
      plan: { days: a.days, kcal: tt.kcal, perDay: a.kcal, protein: tt.protein, cardio: [...counts].map(([ex, count]) => ({ name: exerciseById(ex)?.name || 'cardio', min: a.cardio.find((c) => c.ex === ex).min, count })) },
      rules: aiRules(dietOf(S), rules()),
    });
    const live = (S.adjust || []).find((x) => x.id === id);
    if (live && body.message) live.coach = { message: body.message, tips: body.tips || [] };
    save();
  } catch (err) {
    ui.coachError = err instanceof AIError ? err.message : 'The coach note couldn’t load. Your plan is set either way.';
  } finally {
    ui.coachBusy = false;
    if (route().name === 'ontrack') render();
  }
}

// After the list of exercises you already do changes. In setup it's saved at the end.
function afterMineChange(ctx, message) {
  if (ctx === 'state') {
    refreshProgram(S);
    save();
  }
  refreshPicker(ctx);
  if (message) toast(ctx === 'state' ? `${message}. Sessions updated.` : message);
}

// Put a meal into a day of the plan: in place of meal number `index`, or the first meal in `slot`
function useMeal(meal, di, slot, index) {
  if ((meal.gen || meal.ai) && !S.customMeals.some((m) => m.id === meal.id)) {
    const keep = { ...meal };
    delete keep.extras;
    delete keep.breaks;
    delete keep.odd;
    S.customMeals.push(keep);
  }
  const targets = targetsFor(S, weekDate(S, di));
  const byId = mealsById(S);
  const day = S.mealWeek.days[di];
  const i = index ?? day.meals.findIndex((e) => e.slot === slot);
  if (i >= 0) {
    S.mealWeek.days[di] = applySwap(day, i, meal.id, targets, byId);
    return;
  }
  const order = SLOTS.map((s) => s.id);
  const meals = [...day.meals, { slot, id: meal.id }].sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
  S.mealWeek.days[di] = rescaleDay({ ...day, meals }, targets, byId);
}

const CHANGES = {
  'units-setup'(el) {
    const form = el.closest('form');
    captureSetup(form, false);
    const key = el.name === 'u-len' ? 'len' : 'body';
    S.units = { ...S.units, [key]: el.value };
    save();
    render();
  },
  units(el) {
    const key = { 'pu-len': 'len', 'pu-body': 'body', 'pu-lift': 'lift' }[el.name];
    S.units = { ...S.units, [key]: el.value };
    commit();
  },
  theme(el) {
    S.theme = el.value;
    applyTheme();
    commit();
  },
  aim(el) {
    S.aimPct = Number(el.value);
    afterBodyChange(S, today());
    commit();
  },
  'shop-tick'(el) {
    const wk = S.mealWeek.start;
    S.shopTicks = { [wk]: { ...(S.shopTicks[wk] || {}), [el.dataset.id]: el.checked } };
    save();
  },
  pantry(el) {
    const have = new Set(S.pantry.have);
    if (el.checked) have.add(el.value);
    else have.delete(el.value);
    S.pantry.have = [...have];
    save();
    updatePantry();
  },
  ot(el) {
    const form = el.closest('form');
    ui.ot = { ...(ui.ot || {}), days: Number(fval(form, 'ot-days')) || ui.ot?.days || 7, cardio: fchecked(form, 'ot-cardio'), ex: fval(form, 'ot-ex') || ui.ot?.ex || null };
    render();
  },
  'ai-slot'(el) { ui.aiSlot = el.value; },
  wellness(el) {
    ui.wq = { ...(ui.wq || {}), [el.name.replace(/^wq-/, '')]: Number(el.value) };
    const box = document.getElementById('wq-total');
    if (box) box.innerHTML = wqTotalText(ui.wq);
  },
  'lib-filter'(el) {
    ui.libFilter = el.value;
    const list = document.getElementById('lib-list');
    if (list) list.innerHTML = libraryList(ui.libQuery, ui.libFilter);
  },
};

const LIVE = {
  measure(el) {
    const site = el.dataset.site;
    const warn = document.querySelector(`[data-warn-for="${site}"]`);
    if (!warn) return;
    const v = parseNum(el.value);
    const dateEl = document.getElementById('m-date');
    const prev = C.latestSite(S.measures, site, dateEl ? dateEl.value : today(), el.dataset.exclude || null);
    const w = v === null ? null : C.readingWarning(site, lenToCm(v, U().len), prev);
    warn.hidden = !w;
    if (w) warn.innerHTML = `${I.alert} That's ${fmtLenDelta(w.diff, U().len)} on ${fmtDate(w.prevDate, 'day')}. Worth measuring again to be sure.`;
  },
  set(el) {
    const dr = sessionDraft(el.dataset.sid, el.dataset.ex);
    if (el.dataset.field === 'kg') dr.kg = el.value;
    else if (el.dataset.field === 'min') dr.min = el.value;
    else if (el.dataset.field === 'felt') dr.felt = el.value;
    else {
      dr.reps ||= [];
      dr.reps[Number(el.dataset.k)] = el.value;
    }
    save();
  },
  'ex-search'(el) {
    const res = document.getElementById('ex-results');
    if (res) res.innerHTML = resultsHTML(el.value, el.dataset.ctx);
  },
  'lib-search'(el) {
    ui.libQuery = el.value;
    const list = document.getElementById('lib-list');
    if (list) list.innerHTML = libraryList(ui.libQuery, ui.libFilter);
  },
};

const FORMS = {
  wellness(form) {
    const a = {};
    for (const q of QUESTIONS) {
      const v = Number(fval(form, `wq-${q.id}`));
      if (v) a[q.id] = v;
    }
    if (!isComplete(a)) {
      const miss = QUESTIONS.find((q) => !a[q.id]);
      toast(`Answer ${QUESTIONS.length - Object.keys(a).length === 1 ? 'the last question' : 'every question'} first`);
      document.getElementById(`wq-${miss.id}`)?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    const t = today();
    const entry = addWellness(S, t, a);
    // answering again the same day replaces that day's note in your plan changes
    S.changes = S.changes.filter((c) => !(c.kind === 'wellness' && c.d === t));
    S.changes.push({ d: t, kind: 'wellness', items: wellnessChangeItems(S, entry) });
    ui.wq = null;
    save();
    location.hash = '#wellness';
    toast(`${BANDS[entry.band].name}: your sessions are set`);
  },
  setup(form) {
    const st = ui.setup;
    if (!captureSetup(form, true)) { render(); return; }
    const steps = stepsFor(st.mode).length;
    if (st.step < steps - 1) {
      st.step += 1;
      render();
      return;
    }
    if (st.mode === 'edit') finishEdit();
    else finishSetup(true);
  },
  weigh(form) {
    const kg = readBodyWeight(form, 'weigh');
    if (!kg || kg < 30 || kg > 300) { toast('Enter your weight first'); return; }
    const t = today();
    const trend = C.trendAt(S.weights, t);
    S.weights = S.weights.filter((w) => w.d !== t).concat({ d: t, kg: round(kg, 2) });
    commit(trend && Math.abs(kg - trend.kg) > 2.5 ? 'Saved. That’s a big jump from your average; check the scale is on a hard floor.' : 'Weigh-in saved');
  },
  measure(form) {
    const t = today();
    const d = fval(form, 'm-date') || t;
    if (d > t) { toast('The date can’t be in the future'); return; }
    const cm = {};
    for (const s of C.sitesFor(S.profile.sex)) {
      const v = readLen(form, `m-${s.id}`);
      if (v !== null && v > 5 && v < 250) cm[s.id] = round(v, 1);
    }
    if (!Object.keys(cm).length) { toast('Enter at least one measurement'); return; }
    const id = form.dataset.id;
    if (id) S.measures = S.measures.map((m) => (m.id === id ? { ...m, d, cm } : m));
    else S.measures.push({ id: uid('m'), d, cm });
    const items = afterBodyChange(S, t);
    save();
    location.hash = '#body';
    toast(items.length ? 'Saved. Your priorities changed; see Train.' : 'Measurements saved');
  },
  frame(form) {
    const wrist = readLen(form, 'm-wrist');
    const ankle = readLen(form, 'm-ankle');
    if (!wrist || !ankle || wrist < 10 || wrist > 30 || ankle < 14 || ankle > 40) { toast('Enter both wrist and ankle'); return; }
    S.frame = { wrist: round(wrist, 1), ankle: round(ankle, 1), d: today() };
    afterBodyChange(S, today());
    save();
    location.hash = '#body';
    toast('Frame saved');
  },
  bodyfat(form) {
    const pct = parseNum(fval(form, 'bf-pct'));
    const d = fval(form, 'bf-date') || today();
    if (pct === null || pct < 3 || pct > 60) { toast('Enter a body fat percentage between 3 and 60'); return; }
    S.bfOverride = { pct: round(pct, 1), d };
    afterBodyChange(S, today());
    save();
    location.hash = '#body';
    toast('Body fat saved');
  },
  mealnew(form) {
    const name = fval(form, 'mn-name').trim();
    const kcalV = parseNum(fval(form, 'mn-kcal'));
    const p = parseNum(fval(form, 'mn-p')) ?? 0;
    const c = parseNum(fval(form, 'mn-c')) ?? 0;
    const f = parseNum(fval(form, 'mn-f')) ?? 0;
    if (!name || !kcalV || kcalV < 30 || kcalV > 3000) { toast('Add a name and the calories for one portion'); return; }
    let flags = [...form.querySelectorAll('input[name="mn-flags"]:checked')].map((i) => i.value);
    if (flags.includes('pork')) flags = flags.concat(['alcohol', 'meat']);
    S.customMeals.push({ id: uid('c'), custom: true, name: name.slice(0, 60), slot: fval(form, 'mn-slot') || 'dinner', kcal: Math.round(kcalV), p: Math.round(p), c: Math.round(c), f: Math.round(f), flags });
    refreshMeals(S, today(), false);
    save();
    location.hash = '#eat';
    toast('Meal added to your options');
  },
  rules(form) {
    const t = today();
    const before = { ...S.profile, diet: { ...S.profile.diet } };
    S.profile = { ...S.profile, diet: readDiet(form) };
    afterProfileChange(S, before, t);
    save();
    location.hash = '#eat';
    toast('Rules saved and meal plan rebuilt');
  },
  async restore(form) {
    let text = fval(form, 'rs-text');
    const file = fe(form, 'rs-file')?.files?.[0];
    if (file) text = await file.text();
    if (!text.trim()) { toast('Choose a backup file or paste the text'); return; }
    try {
      const restored = parseBackup(text);
      S = restored;
      S.demo = false;
      save();
      applyTheme();
      location.hash = '#today';
      render();
      toast('Backup restored');
    } catch (err) {
      toast(err.message);
    }
  },
  'ci-weight'(form) {
    const kg = readBodyWeight(form, 'ciw');
    const t = today();
    if (kg && kg > 30 && kg < 300) S.weights = S.weights.filter((w) => w.d !== t).concat({ d: t, kg: round(kg, 2) });
    save();
    ui.checkin.step = 1;
    render();
  },
  'ci-measure'(form) {
    const cm = {};
    for (const s of C.sitesFor(S.profile.sex)) {
      const v = readLen(form, `m-${s.id}`);
      if (v !== null && v > 5 && v < 250) cm[s.id] = round(v, 1);
    }
    if (Object.keys(cm).length) S.measures.push({ id: uid('m'), d: today(), cm });
    save();
    ui.checkin.step = 2;
    render();
  },
  'custom-ex'(form) {
    const typed = fval(form, 'ce-name').trim().replace(/\s+/g, ' ').slice(0, 50);
    if (!typed) { toast('Give the exercise a name'); return; }
    const name = typed.charAt(0).toUpperCase() + typed.slice(1);
    const m = fval(form, 'ce-m') || 'chest';
    const load = fval(form, 'ce-load') || 'kg';
    const ctx = form.dataset.ctx;
    const { mine, customs } = pickerData(ctx);
    // Exercises you add get a standard rep range for how you track them, and fit any equipment
    const ex = {
      id: uid('u'), name, m, k: ['biceps', 'triceps', 'calves', 'abs', 'forearms'].includes(m) ? 'i' : 'c', load,
      rr: load === 's' ? [20, 60] : load === 'bw' ? [8, 15] : [8, 12], step: 2.5, eq: ['gym', 'home', 'bw'], custom: true,
    };
    if (m === CARDIO.id || load === 'min') Object.assign(ex, { m: CARDIO.id, k: 'c', load: 'min', rr: [15, 40], met: [4, 6, 8] });
    customs.push(ex);
    mine.push(ex.id);
    syncCustoms();
    closeSheet();
    if (ctx === 'state') { refreshProgram(S); save(); }
    const q = document.getElementById('ex-q');
    if (q) q.value = '';
    refreshPicker(ctx);
    toast(ctx === 'state' ? `Added ${name}. Sessions updated.` : `Added ${name}`);
  },
  'log-food'(form) {
    const d = form.dataset.d;
    const k = parseNum(fval(form, 'lf-kcal'));
    if (!k || k < 1 || k > 8000) { toast('Add the calories, or tap Estimate with AI'); return; }
    const num = (name) => Math.max(0, Math.round(parseNum(fval(form, name)) || 0));
    const ate = { text: fval(form, 'lf-text').trim().replace(/\s+/g, ' ').slice(0, 120) || 'Something else', kcal: Math.round(k), p: num('lf-p'), c: num('lf-c'), f: num('lf-f'), src: form.dataset.src || 'manual' };
    if (form.dataset.kind === 'instead') {
      const i = Number(form.dataset.i);
      const pm = plannedMeal(d, i);
      clearMealLog(d, i);
      addLogItem(S, d, { kind: 'instead', slot: pm?.slot || form.dataset.slot || null, mealIdx: i, planned: pm, ate });
    } else {
      const slot = fval(form, 'lf-slot');
      if (slot) {
        const pl = plannedSlot(d, slot);
        if (pl.mealIdx !== null) clearMealLog(d, pl.mealIdx);
        addLogItem(S, d, { kind: 'instead', slot, mealIdx: pl.mealIdx, planned: pl, ate });
      } else {
        addLogItem(S, d, { kind: 'extra', ate });
      }
    }
    closeSheet();
    commit('Logged');
  },
  ontrack() {
    const t = today();
    const gap = pendingGap(S, t);
    if (!gap || gap.small) { render(); return; }
    const st = ui.ot || {};
    const offer = st.cardio ? cardioOffer(S, gap, st.days, C.currentWeight(S.weights, t), rules(), st.ex) : null;
    const adj = applyCatchUp(S, t, { days: st.days || 7, cardio: offer, rules: rules() });
    if (!adj) return;
    rescaleMeals(S);
    const tt = dayTargets(S, adj.start);
    const items = [{ area: 'calories', text: `${kcalSigned(adj.kcal)} a day for ${plural(adj.days, 'day')}, from ${fmtDate(adj.start, 'day')}`, why: `${gapSentence(gap, t)} Spreading it out keeps your weekly average on target. Protein stays at ${tt.protein} g, and carbs and fat carry the change.` }];
    if (adj.cardio.length) items.push({ area: 'training', text: `${plural(adj.cardio.length, 'extra cardio session')} of ${adj.cardio[0].min} minutes`, why: `${exerciseById(adj.cardio[0].ex)?.name || 'Cardio'} at ${adj.cardio[0].effort} pace, about ${fmtInt(adj.cardio[0].kcal)} kcal each, so the food change can be smaller.` });
    S.changes.push({ d: t, kind: 'track', items });
    ui.ot = null;
    save();
    render();
    window.scrollTo(0, 0);
    toast('Plan set. Your meal portions now match it.');
    requestCoach(adj.id);
  },
  'ai-meals'(form) {
    const text = fval(form, 'ai-foods').trim().replace(/\s+/g, ' ');
    if (text.length < 3) { toast('List a few foods you have first'); return; }
    if (ui.aiBusy) return;
    S.pantry.text = text.slice(0, 600);
    ui.aiSlot = fval(form, 'ai-slot') || ui.aiSlot;
    save();
    runAIMeals(S.pantry.text, ui.aiSlot);
  },
  health(form) {
    const t = today();
    const before = { ...S.profile, health: normHealth(S.profile.health) };
    S.profile = { ...S.profile, health: readHealth(form) };
    const items = afterProfileChange(S, before, t);
    save();
    render();
    window.scrollTo(0, 0);
    toast(items.length ? 'Saved. Your plan has been updated.' : 'Saved');
  },
};

// ---------- Wiring ----------

// In the preview, the page that hosts Gainloop may set its own light or dark theme: keep it for 'Match phone'
const HOST_THEME = PREVIEW ? document.documentElement.dataset.theme : undefined;

function applyTheme() {
  const root = document.documentElement;
  if (S.theme === 'light' || S.theme === 'dark') root.dataset.theme = S.theme;
  else if (HOST_THEME) root.dataset.theme = HOST_THEME;
  else delete root.dataset.theme;
  const dark = S.theme === 'dark' || (S.theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.content = dark ? '#15191d' : '#f3f3ef'; });
}

function registerSW() {
  if (PREVIEW || !('serviceWorker' in navigator)) return;
  if (window.self !== window.top) return;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (location.protocol !== 'https:' && !local) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

function wire() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('submit', (e) => {
    const form = e.target;
    const fn = FORMS[form.dataset.form];
    if (!fn) return;
    e.preventDefault();
    fn(form, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-live]');
    if (el && LIVE[el.dataset.live]) LIVE[el.dataset.live](el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset?.change && CHANGES[el.dataset.change]) { CHANGES[el.dataset.change](el, e); return; }
    if (el.name === 'pins' && S.profile) {
      const picked = [...document.querySelectorAll('input[name="pins"]:checked')].map((i) => i.value);
      if (picked.length > C.MAX_PINS) {
        el.checked = false;
        toast(`Pick up to ${C.MAX_PINS} at a time`);
        return;
      }
      S.pins = picked;
      refreshProgram(S);
      commit(picked.includes(el.value) && el.checked ? `${muscleName(el.value)} is now a priority` : 'Priorities updated');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.sheet) closeSheet();
    // Enter in a search box searches; it shouldn't submit the setup form around it
    if (e.key === 'Enter' && e.target.matches?.('input[type="search"]')) {
      e.preventDefault();
      e.target.blur();
    }
  });
  // opening or closing the food list shows or hides its "See meal ideas" bar
  document.addEventListener('toggle', (e) => { if (e.target.matches?.('.food-picker')) updatePantry(); }, true);
  window.addEventListener('hashchange', () => {
    ui.sheet = null; // a link inside a sheet goes to a new screen, so the sheet closes
    render();
  });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    ui.installEvent = e;
    if (['today', 'you'].includes(route().name)) render();
  });
  window.addEventListener('appinstalled', () => { ui.installEvent = null; render(); });
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawCharts, 150); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveState(S, true); });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
}

// A plan saved by an older version may name exercises that have since been replaced, or be built the
// old way with more than 6 exercises in a session: rebuild it
function repairProgram() {
  if (!S.profile || !S.program) return;
  syncCustoms();
  const missing = S.program.sessions.some((s) => s.slots.some((sl) => !exerciseById(sl.ex)));
  const before = Math.max(...S.program.sessions.map((s) => s.slots.length));
  const oldFewest = Math.min(...S.program.sessions.map((s) => s.slots.length));
  if (missing || S.program.v !== PROGRAM_VERSION) {
    refreshProgram(S);
    if (before !== MAX_EXERCISES || oldFewest !== MAX_EXERCISES) {
      S.changes.push({ d: today(), kind: 'edit', items: [{ area: 'training', text: `Every session now has exactly ${MAX_EXERCISES} exercises`, why: `Your sessions had between ${oldFewest} and ${before}. Each muscle gets one exercise of up to ${MAX_SETS} sets in a session (two when there’s room), and a session with fewer than ${MAX_EXERCISES} is filled out. Your weekly load for legs, push and pull is also tracked now.` }] });
    }
    save();
  }
}

// Ask the service worker to keep the pictures you'll need (every thumbnail, plus the full pictures for your
// sessions and your own exercises), so they show at the gym without signal. Only when that list changes.
let warmKey = '';
function warmPictures() {
  if (PREVIEW || !S.program || !('serviceWorker' in navigator)) return;
  const ids = new Set([...S.program.sessions.flatMap((s) => s.slots.map((sl) => sl.ex)), ...(S.myExercises || [])]);
  const key = [...ids].sort().join(',');
  if (key === warmKey) return;
  warmKey = key;
  const urls = new Set();
  for (const e of allExercises()) {
    const p = pictureFor(e.id);
    if (p) urls.add(thumbSrc(p));
  }
  for (const id of ids) {
    const p = pictureFor(id);
    if (p) frameSrcs(p).forEach((u) => urls.add(u));
  }
  navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'warm', urls: [...urls] })).catch(() => {});
}

function boot() {
  if (PREVIEW && !S.profile) S = seedDemo(today());
  repairProgram();
  applyTheme();
  wire();
  render();
  registerSW();
  if (!PREVIEW && S.profile && navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

boot();
