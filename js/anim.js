// Exercise animations: a simple jointed figure drawn in SVG and moved by the pose functions in data/poses.js.
// Units are "figure units": a standing adult is about 100 tall and the floor is at y = 150.
// Side views face right. Front views face the viewer.

export const FLOOR = 150;
// Segment lengths. Torso is split at the middle of the spine so crunches can curl.
export const L = { lower: 16, upper: 16, neck: 9, head: 6.8, ua: 17, fa: 14.5, hand: 4.5, th: 26, sh: 25, ankle: 3.5 };
export const ARM = L.fa + L.hand;
export const LEG = L.th + L.sh;
export const TORSO = L.lower + L.upper;

// ---------- Small geometry helpers ----------
const RAD = Math.PI / 180;
export const dir = (a) => [Math.cos(a * RAD), Math.sin(a * RAD)];
export const at = (p, a, len) => [p[0] + Math.cos(a * RAD) * len, p[1] + Math.sin(a * RAD) * len];
export const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
export const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
export const lerp = (a, b, t) => a + (b - a) * t;
export const angOf = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]) / RAD;
export const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
export const rot = (v, a) => {
  const c = Math.cos(a * RAD);
  const s = Math.sin(a * RAD);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
};
// A point `along` units in direction a from p, then `side` units to the right-hand normal (a + 90)
export const off = (p, a, along, across = 0) => add(at(p, a, along), dir(a + 90), across);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Two-bone inverse kinematics: the middle joint (knee or elbow) for a limb from a to b.
// bend +1 or -1 picks which side of the line a→b the joint sits on.
export function ik(a, b, l1, l2, bend) {
  const d = clamp(dist(a, b), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.001);
  const base = angOf(a, b);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  return at(a, base - bend * (Math.acos(clamp(cosA, -1, 1)) / RAD), l1);
}

// ---------- Building a pose ----------

// Arm from the shoulder. spec: { to: grip point, bend } or { a1, a2 } (absolute angles); optional hand angle.
function arm(sh, spec) {
  if (!spec) return null;
  let el;
  let wr;
  if (spec.to) {
    el = ik(sh, spec.to, L.ua, ARM, spec.bend ?? 1);
    const a = angOf(el, spec.to);
    wr = at(el, a, L.fa);
    const gr = spec.hand === undefined ? at(wr, a, L.hand) : at(wr, spec.hand, L.hand);
    return { el, wr, gr };
  }
  el = at(sh, spec.a1, L.ua);
  wr = at(el, spec.a2, L.fa);
  return { el, wr, gr: at(wr, spec.hand ?? spec.a2, L.hand) };
}

// Leg from the hip. spec: { to: ankle point, bend } or { a1, a2 }; optional foot angle (0 = flat, toes forward).
function leg(hip, spec, flip = 1) {
  if (!spec) return null;
  let kn;
  let an;
  if (spec.to) {
    kn = ik(hip, spec.to, L.th, L.sh, spec.bend ?? 1);
    an = at(kn, angOf(kn, spec.to), L.sh);
  } else {
    kn = at(hip, spec.a1, L.th);
    an = at(kn, spec.a2, L.sh);
  }
  const fa = spec.foot ?? 0;
  return { kn, an, heel: add(an, rot([-3 * flip, L.ankle], fa)), toe: add(an, rot([10.5 * flip, L.ankle], fa)) };
}

// Side view. spec: { hip, torso: angle or [lower, upper], neck?, sh?: shoulder override,
//   arm: { n, f }, leg: { n, f }, faceLeft? }
export function side(spec) {
  const [la, ua] = Array.isArray(spec.torso) ? spec.torso : [spec.torso, spec.torso];
  let hip = spec.hip;
  let mid;
  let sh;
  if (spec.sh && !hip) {
    // build down from the shoulder (hanging, dips)
    sh = spec.sh;
    mid = at(sh, ua + 180, L.upper);
    hip = at(mid, la + 180, L.lower);
  } else {
    mid = at(hip, la, L.lower);
    sh = at(mid, ua, L.upper);
  }
  if (spec.shrug) sh = at(sh, ua, spec.shrug);
  const head = at(sh, spec.neck ?? ua, L.neck);
  const flip = spec.faceLeft ? -1 : 1;
  return {
    view: 'side',
    hip,
    mid,
    sh,
    head,
    n: { ...arm(sh, spec.arm?.n), ...leg(hip, spec.leg?.n, flip) },
    f: { ...arm(sh, spec.arm?.f ?? spec.arm?.n), ...leg(hip, spec.leg?.f ?? spec.leg?.n, flip) },
    hideFarArm: !!spec.hideFarArm,
    hideFarLeg: !!spec.hideFarLeg,
  };
}

// Front view: the figure faces you. spec: { hip: pelvis centre, torso: length (shorter when bent over),
//   tilt: degrees the torso leans sideways, shoulderW, hipW, arm: { l, r }, leg: { l, r }, headLift }
export function front(spec) {
  const tl = spec.torso ?? TORSO;
  const tilt = spec.tilt ?? 0;
  const hip = spec.hip;
  const shc = at(hip, -90 + tilt, tl);
  const sw = spec.shoulderW ?? 11;
  const hw = spec.hipW ?? 7;
  const sl = add(shc, [-sw, 0]);
  const sr = add(shc, [sw, 0]);
  const hl = add(hip, [-hw, 0]);
  const hr = add(hip, [hw, 0]);
  const head = add(shc, [0, -(spec.neck ?? L.neck)]);
  // Seen from the front a bent knee points at you, so the leg is drawn straight from hip to ankle
  const fl = (p, s, sideSign) => {
    if (!s) return null;
    let g;
    if (s.to) {
      const an = s.to;
      g = { kn: mix(p, an, L.th / LEG), an };
    } else {
      g = leg(p, s);
    }
    if (!g) return null;
    return { ...g, heel: add(g.an, [-2 * sideSign, L.ankle]), toe: add(g.an, [5 * sideSign, L.ankle]) };
  };
  return {
    view: 'front',
    hip,
    shc,
    head,
    sl,
    sr,
    hl,
    hr,
    l: { ...arm(sl, spec.arm?.l), ...fl(hl, spec.leg?.l, -1) },
    r: { ...arm(sr, spec.arm?.r), ...fl(hr, spec.leg?.r, 1) },
    hideHead: !!spec.hideHead,
    hideLegs: !!spec.hideLegs,
  };
}

// ---------- Equipment ----------
// z: 'back' (behind the figure), 'mid' (in front of the body, behind the near arm), 'front' (on top).
export const K = {
  line: (a, b, w = 3, cls = 'frame', z = 'back') => ({ tag: 'line', a, b, w, cls, z }),
  circle: (p, r, cls = 'plate', z = 'mid') => ({ tag: 'circle', p, r, cls, z }),
  rect: (x, y, w, h, cls = 'pad', z = 'back', rx = 2) => ({ tag: 'rect', x, y, w, h, rx, cls, z }),
  poly: (pts, cls = 'pad', z = 'back') => ({ tag: 'poly', pts, cls, z }),
  // a pad drawn along a line from a to b, `th` thick, offset to one side
  pad: (a, b, th = 5, cls = 'pad', z = 'back') => {
    const ang = angOf(a, b);
    const n = dir(ang + 90);
    return { tag: 'poly', pts: [a, b, add(b, n, th), add(a, n, th)], cls, z, round: true };
  },
  // barbell seen end-on: a plate with a hub
  plate: (p, r = 10, z = 'mid') => [{ tag: 'circle', p, r, cls: 'plate', z }, { tag: 'circle', p, r: Math.max(1.6, r * 0.22), cls: 'hub', z }],
  // dumbbell seen end-on
  db: (p, z = 'mid', r = 5.2) => [{ tag: 'circle', p, r, cls: 'plate', z }, { tag: 'circle', p, r: 1.5, cls: 'hub', z }],
  // dumbbell standing on end (goblet, overhead extension): two bells and a handle
  dbV: (p, a = 90, z = 'front') => {
    const top = at(p, a + 180, 2);
    const bot = at(p, a, 11);
    return [
      { tag: 'line', a: top, b: bot, w: 2.2, cls: 'kit', z },
      { tag: 'circle', p: top, r: 4.4, cls: 'plate', z },
      { tag: 'circle', p: bot, r: 4.4, cls: 'plate', z },
    ];
  },
  // dumbbell seen side-on (lateral raises, flyes from the front)
  dbSide: (p, a = 0, z = 'front') => {
    const e1 = at(p, a, 5);
    const e2 = at(p, a + 180, 5);
    return [
      { tag: 'line', a: e1, b: e2, w: 2, cls: 'kit', z },
      { tag: 'line', a: at(e1, a + 90, 3.6), b: at(e1, a - 90, 3.6), w: 3.4, cls: 'plate-line', z },
      { tag: 'line', a: at(e2, a + 90, 3.6), b: at(e2, a - 90, 3.6), w: 3.4, cls: 'plate-line', z },
    ];
  },
  kb: (p, z = 'mid') => [
    { tag: 'circle', p: add(p, [0, 6.5]), r: 5.6, cls: 'plate', z },
    { tag: 'path', d: `M${p[0] - 3.4} ${p[1] + 3.4} Q${p[0]} ${p[1] - 3.2} ${p[0] + 3.4} ${p[1] + 3.4}`, w: 1.8, cls: 'kit', z },
  ],
  // pull-up bar or dip bar end-on, with its upright
  bar: (p, z = 'back') => [{ tag: 'circle', p, r: 2.4, cls: 'metal', z }],
  // a cable from a pulley to a handle
  cable: (from, to, z = 'back') => [
    { tag: 'line', a: from, b: to, w: 1.1, cls: 'cable', z },
    { tag: 'circle', p: from, r: 2.6, cls: 'metal', z },
  ],
  // flat bench from x1 to x2 with its top at y
  bench: (x1, x2, y, z = 'back') => [
    { tag: 'rect', x: x1, y, w: x2 - x1, h: 5, rx: 2, cls: 'pad', z },
    { tag: 'line', a: [x1 + 6, y + 5], b: [x1 + 6, FLOOR], w: 2.6, cls: 'frame', z },
    { tag: 'line', a: [x2 - 6, y + 5], b: [x2 - 6, FLOOR], w: 2.6, cls: 'frame', z },
  ],
  box: (x1, x2, y, z = 'back') => [{ tag: 'rect', x: x1, y, w: x2 - x1, h: FLOOR - y, rx: 1.5, cls: 'pad', z }],
  backpack: (p, z = 'mid') => [{ tag: 'rect', x: p[0] - 6, y: p[1] - 1, w: 12, h: 15, rx: 4, cls: 'plate', z }, { tag: 'line', a: add(p, [-3, -1]), b: add(p, [3, -1]), w: 1.6, cls: 'kit', z }],
  bottle: (p, z = 'mid') => [{ tag: 'rect', x: p[0] - 2.6, y: p[1] - 2, w: 5.2, h: 12, rx: 2, cls: 'plate', z }],
};

const flat = (list) => [list].flat(Infinity).filter(Boolean);

// ---------- Drawing ----------
const W = { torso: 14, neck: 6.2, ua: 7.6, fa: 6.4, hand: 5, th: 10.5, sh: 8, foot: 4.4 };

// Segments of one limb. With cut, each limb first gets a thin outline in the background colour,
// so it stays readable where it crosses the body.
function segs(list, cls, cut) {
  const out = [];
  if (cut) for (const [a, b, w] of list) out.push({ tag: 'line', a, b, w: w + 3, cls: 'cut' });
  for (const [a, b, w] of list) out.push({ tag: 'line', a, b, w, cls });
  return out;
}

function limbPrims(j, from, cls, legs, arms, cut = false) {
  const out = [];
  if (legs && j.kn) out.push(...segs([[from.hip, j.kn, W.th], [j.kn, j.an, W.sh], [j.heel, j.toe, W.foot]], cls, cut));
  if (arms && j.el) out.push(...segs([[from.sh, j.el, W.ua], [j.el, j.wr, W.fa], [j.wr, j.gr, W.hand]], cls, cut));
  return out;
}

export function posePrims(pose) {
  const kit = flat(pose.kit || []);
  const z = (name) => kit.filter((k) => (k.z || 'back') === name);
  const prims = [...z('back')];
  if (pose.view === 'side') {
    if (!pose.hideFarLeg) prims.push(...limbPrims(pose.f, pose, 'fig-far', true, false));
    if (!pose.hideFarArm) prims.push(...limbPrims(pose.f, pose, 'fig-far', false, true));
    prims.push({ tag: 'polyline', pts: [pose.hip, pose.mid, pose.sh], w: W.torso, cls: 'fig' });
    prims.push({ tag: 'line', a: pose.sh, b: mix(pose.sh, pose.head, 0.7), w: W.neck, cls: 'fig' });
    prims.push({ tag: 'circle', p: pose.head, r: L.head, cls: 'fig' });
    prims.push(...z('mid'));
    prims.push(...limbPrims(pose.n, pose, 'fig', true, false, true));
    prims.push(...limbPrims(pose.n, pose, 'fig', false, true, true));
  } else {
    const legs = (j, hp) => (j.kn ? [
      { tag: 'line', a: hp, b: j.kn, w: W.th, cls: 'fig' },
      { tag: 'line', a: j.kn, b: j.an, w: W.sh, cls: 'fig' },
      { tag: 'line', a: j.heel, b: j.toe, w: W.foot, cls: 'fig' },
    ] : []);
    if (!pose.hideLegs) prims.push(...legs(pose.l, pose.hl), ...legs(pose.r, pose.hr));
    prims.push({ tag: 'poly', pts: [pose.sl, pose.sr, pose.hr, pose.hl], cls: 'fig', round: true });
    if (!pose.hideHead) {
      prims.push({ tag: 'line', a: pose.shc, b: mix(pose.shc, pose.head, 0.7), w: W.neck, cls: 'fig' });
      prims.push({ tag: 'circle', p: pose.head, r: L.head + 1.5, cls: 'cut-fill' });
      prims.push({ tag: 'circle', p: pose.head, r: L.head, cls: 'fig' });
    }
    prims.push(...z('mid'));
    const arms = (j, s) => (j.el ? segs([[s, j.el, W.ua], [j.el, j.wr, W.fa], [j.wr, j.gr, W.hand]], 'fig', true) : []);
    prims.push(...arms(pose.l, pose.sl), ...arms(pose.r, pose.sr));
  }
  prims.push(...z('front'));
  return prims;
}

const f1 = (n) => Math.round(n * 10) / 10;
const ptsAttr = (pts) => pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' ');

function attrsOf(p) {
  switch (p.tag) {
    case 'line': return { el: 'line', a: { x1: f1(p.a[0]), y1: f1(p.a[1]), x2: f1(p.b[0]), y2: f1(p.b[1]), 'stroke-width': p.w } };
    case 'polyline': return { el: 'polyline', a: { points: ptsAttr(p.pts), 'stroke-width': p.w } };
    case 'circle': return { el: 'circle', a: { cx: f1(p.p[0]), cy: f1(p.p[1]), r: p.r } };
    case 'rect': return { el: 'rect', a: { x: f1(p.x), y: f1(p.y), width: f1(p.w), height: f1(p.h), rx: p.rx ?? 2 } };
    case 'poly': return { el: 'polygon', a: { points: ptsAttr(p.pts), ...(p.round ? { 'stroke-width': 3.5 } : {}) } };
    case 'path': return { el: 'path', a: { d: p.d, 'stroke-width': p.w ?? 2 } };
    default: return null;
  }
}

function boundsOf(prims) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const take = (x, y, r = 0) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
  for (const p of prims) {
    if (p.tag === 'line') { take(p.a[0], p.a[1], p.w / 2); take(p.b[0], p.b[1], p.w / 2); }
    else if (p.tag === 'polyline') for (const q of p.pts) take(q[0], q[1], p.w / 2);
    else if (p.tag === 'circle') take(p.p[0], p.p[1], p.r);
    else if (p.tag === 'rect') { take(p.x, p.y); take(p.x + p.w, p.y + p.h); }
    else if (p.tag === 'poly') for (const q of p.pts) take(q[0], q[1], 2);
  }
  return { x0, y0, x1, y1 };
}

// ---------- Animation specs ----------
let SPECS = null;
let PATTERNS = null;
export function registerPoses(specs, patterns) {
  SPECS = specs;
  PATTERNS = patterns;
}
export const hasAnimation = (exId) => !!(SPECS && SPECS[exId] && PATTERNS[SPECS[exId].p]);

export function poseAt(exId, t) {
  const spec = SPECS[exId];
  const pose = PATTERNS[spec.p](t, spec.o || {});
  return pose;
}

const viewCache = new Map();
export function viewBoxFor(exId) {
  if (viewCache.has(exId)) return viewCache.get(exId);
  let b = null;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const bb = boundsOf(posePrims(poseAt(exId, t)));
    b = b ? { x0: Math.min(b.x0, bb.x0), y0: Math.min(b.y0, bb.y0), x1: Math.max(b.x1, bb.x1), y1: Math.max(b.y1, bb.y1) } : bb;
  }
  const spec = SPECS[exId];
  const floor = spec.floor !== false && b.y1 > FLOOR - 30;
  if (floor) b.y1 = Math.max(b.y1, FLOOR + 1);
  const pad = 7;
  let x = b.x0 - pad;
  let y = b.y0 - pad;
  let w = b.x1 - b.x0 + pad * 2;
  let h = b.y1 - b.y0 + pad * 2;
  const ratio = 4 / 3;
  const minH = 96;
  if (h < minH) { y -= (minH - h) / 2; h = minH; }
  if (w / h < ratio) { const nw = h * ratio; x -= (nw - w) / 2; w = nw; } else { const nh = w / ratio; y -= (nh - h) / 2; h = nh; }
  if (floor && y + h < FLOOR + 3) y = FLOOR + 3 - h;
  const vb = { x: f1(x), y: f1(y), w: f1(w), h: f1(h), floor };
  viewCache.set(exId, vb);
  return vb;
}

function floorPrim(vb) {
  return vb.floor ? [{ tag: 'line', a: [vb.x - 5, FLOOR + 0.5], b: [vb.x + vb.w + 5, FLOOR + 0.5], w: 1.4, cls: 'floor' }] : [];
}

// Static picture of an exercise at one moment (0 = start, 1 = turnaround)
export function poseSVG(exId, t = 1, cls = 'anim') {
  if (!hasAnimation(exId)) return '';
  const vb = viewBoxFor(exId);
  const prims = [...floorPrim(vb), ...posePrims(poseAt(exId, t))];
  const body = prims.map((p) => {
    const r = attrsOf(p);
    if (!r) return '';
    return `<${r.el} class="${p.cls}" ${Object.entries(r.a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`;
  }).join('');
  return `<svg class="${cls}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" aria-hidden="true" focusable="false">${body}</svg>`;
}

// Timing for one rep: pause at the start, move, pause at the turnaround, come back.
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2);
export function phaseToT(phase, spec = {}) {
  if (spec.hold) return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  const h0 = 0.12;
  const mv = spec.fast ? 0.3 : 0.36;
  const h1 = 0.12;
  if (phase < h0) return 0;
  if (phase < h0 + mv) return ease((phase - h0) / mv);
  if (phase < h0 + mv + h1) return 1;
  return 1 - ease((phase - h0 - mv - h1) / (1 - h0 - mv - h1));
}

const NS = 'http://www.w3.org/2000/svg';

// Live animation inside `host`. Returns controls. Pauses itself when off screen or when the tab is hidden.
export function mountAnimation(host, exId, { autoplay = true } = {}) {
  if (!hasAnimation(exId)) return null;
  const spec = SPECS[exId];
  const vb = viewBoxFor(exId);
  const svgEl = document.createElementNS(NS, 'svg');
  svgEl.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  svgEl.setAttribute('class', 'anim');
  svgEl.setAttribute('aria-hidden', 'true');
  host.innerHTML = '';
  host.append(svgEl);
  let nodes = [];
  let key = '';
  const draw = (t) => {
    const prims = [...floorPrim(vb), ...posePrims(poseAt(exId, t))];
    const list = prims.map((p) => ({ p, r: attrsOf(p) })).filter((x) => x.r);
    const k = list.map((x) => `${x.r.el}.${x.p.cls}`).join('|');
    if (k !== key) {
      svgEl.textContent = '';
      nodes = list.map(({ p, r }) => {
        const n = document.createElementNS(NS, r.el);
        n.setAttribute('class', p.cls);
        svgEl.append(n);
        return n;
      });
      key = k;
    }
    list.forEach(({ r }, i) => {
      for (const [a, v] of Object.entries(r.a)) nodes[i].setAttribute(a, v);
    });
  };
  const cycle = (spec.secs || 3) * 1000;
  let playing = false;
  let raf = 0;
  let start = 0;
  let offset = 0;
  let visible = true;
  const frame = (now) => {
    if (!playing) return;
    if (!start) start = now - offset;
    const phase = ((now - start) % cycle) / cycle;
    draw(phaseToT(phase, spec));
    raf = requestAnimationFrame(frame);
  };
  const run = () => { if (playing && visible && !document.hidden) { cancelAnimationFrame(raf); start = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); };
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) run(); else stop();
  }) : null;
  io?.observe(host);
  const onVis = () => (document.hidden ? stop() : run());
  document.addEventListener('visibilitychange', onVis);
  const api = {
    get playing() { return playing; },
    play() { playing = true; run(); },
    pause(t = null) {
      playing = false;
      stop();
      offset = start ? (performance.now() - start) % cycle : 0;
      if (t !== null) draw(t);
    },
    show(t) { playing = false; stop(); draw(t); },
    destroy() { playing = false; stop(); io?.disconnect(); document.removeEventListener('visibilitychange', onVis); },
  };
  draw(autoplay ? 0 : 1);
  if (autoplay) api.play();
  return api;
}
