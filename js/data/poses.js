// Movement patterns for the exercise animations. Each pattern takes t (0 = start, 1 = the turnaround point)
// and options, and returns a pose built with side() or front() plus the equipment (kit).
// Coordinates: figure units, floor at y = 150, side views face right.
import { ARM, FLOOR, K, L, add, angOf, at, dir, front, lerp, off, rot, side } from '../anim.js';

const AY = FLOOR - L.ankle; // ankle height with the foot flat on the floor
const lp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const arc = (a, b, t, lift) => { const p = lp(a, b, t); return [p[0], p[1] - lift * Math.sin(Math.PI * t)]; };
const both = (n, f) => ({ n, f: f ?? n });

// Hand-held equipment for a grip point
function held(kind, g, z = 'mid', ang = 90) {
  if (kind === 'bb') return K.plate(g, 10, z);
  if (kind === 'ez') return K.plate(g, 7.5, z);
  if (kind === 'db') return K.db(g, z);
  if (kind === 'pack') return K.backpack(add(g, [0, 2]), z);
  if (kind === 'bottle') return K.bottle(g, z);
  if (kind === 'dbV') return K.dbV(g, ang, z);
  if (kind === 'kb') return K.kb(g, z);
  return null;
}
const barFrame = (g) => [K.line([66, FLOOR], [66, 18], 4), K.line([66, g[1]], [g[0], g[1]], 3), ...K.bar(g, 'mid')];
const standLegs = (ax = 100, fx = ax - 3) => ({ n: { to: [ax, AY], bend: 1 }, f: { to: [fx, AY], bend: 1 } });

export const PATTERNS = {
  // ---------- Legs ----------
  squat(t, o) {
    const goblet = o.kit === 'goblet';
    const hip = [lerp(97, goblet ? 79 : 74, t), lerp(96, goblet ? 123 : 121, t)];
    const ta = lerp(-87, goblet ? -66 : -52, t);
    const pose = side({ hip, torso: ta, neck: lerp(-88, -74, t), leg: standLegs() });
    let kit;
    if (goblet) {
      const g = off(pose.sh, ta, -8, 8);
      Object.assign(pose, side({ hip, torso: ta, neck: lerp(-88, -74, t), leg: standLegs(), arm: both({ to: g, bend: -1 }) }));
      kit = K.dbV(add(g, [1, -3]), 90, 'front');
    } else {
      const bar = off(pose.sh, ta, -2, -6);
      Object.assign(pose, side({ hip, torso: ta, neck: lerp(-88, -72, t), leg: standLegs(), arm: both({ to: bar, bend: 1 }) }));
      kit = K.plate(bar, 10, 'back');
    }
    pose.kit = kit;
    return pose;
  },

  hack(t) {
    const ta = -68;
    const hip = lp([94, 99], [74, 121], t);
    const legs = { n: { to: [104, AY - 4], bend: 1 }, f: { to: [101, AY - 4], bend: 1 } };
    const pose = side({ hip, torso: ta, neck: -76, leg: legs });
    const back0 = off(hip, ta, -4, -7.5);
    const back1 = off(hip, ta, 36, -7.5);
    Object.assign(pose, side({ hip, torso: ta, neck: -76, leg: legs, arm: both({ to: off(pose.sh, ta, 2, 1), bend: -1 }) }));
    pose.kit = [
      K.line([44, 136], [98, 40], 3, 'frame'),
      K.pad(back0, back1, -5),
      K.rect(off(pose.sh, ta, 4, -2)[0] - 5, off(pose.sh, ta, 4, -2)[1] - 3, 10, 6, 'pad', 'front', 3),
      K.rect(86, FLOOR - 4, 36, 4, 'pad', 'back', 1),
    ];
    return pose;
  },

  boxPistol(t) {
    const hip = lp([96, 96], [77, 121], t);
    const ta = lerp(-86, -58, t);
    const pose = side({
      hip, torso: ta, neck: lerp(-88, -70, t),
      leg: { n: { to: [100, AY], bend: 1 }, f: { a1: lerp(70, -2, t), a2: lerp(82, 4, t), foot: lerp(0, -70, t) } },
      arm: both({ a1: lerp(84, -6, t), a2: lerp(86, -6, t) }),
    });
    pose.kit = K.box(56, 84, 123);
    return pose;
  },

  splitSquat(t) {
    const hip = lp([94, 99], [90, 121], t);
    const ta = lerp(-87, -82, t);
    const pose = side({
      hip, torso: ta, neck: -86,
      leg: { n: { to: [120, AY], bend: 1 }, f: { to: [52, 116], bend: 1, foot: 160 } },
      arm: both({ a1: 91, a2: 91 }),
    });
    pose.kit = [K.bench(26, 62, 122), K.db(pose.n.gr, 'front'), K.db(pose.f.gr, 'back')];
    return pose;
  },

  lunge(t) {
    const rear = arc([104, AY], [62, AY - 5], t, 8);
    const hip = lp([102, 96], [89, 121], t);
    const pose = side({
      hip, torso: lerp(-88, -84, t), neck: -87,
      leg: { n: { to: [110, AY], bend: 1 }, f: { to: rear, bend: 1, foot: lerp(0, 52, t) } },
      arm: both({ a1: 91, a2: 91 }),
    });
    pose.kit = [K.db(pose.n.gr, 'front'), K.db(pose.f.gr, 'back')];
    return pose;
  },

  stepUp(t) {
    const top = 116;
    const e = (x) => 1 - (1 - x) * (1 - x);
    const hip = [lerp(92, 109, e(t)), lerp(101, 63, t)];
    const ft = Math.min(1, Math.max(0, (t - 0.35) / 0.55));
    const far = ft <= 0 ? [84, AY] : ft >= 1 ? [104, top - L.ankle] : arc([84, AY], [104, top - L.ankle], ft, 24);
    const pose = side({
      hip, torso: lerp(-76, -88, t), neck: -86,
      leg: { n: { to: [113, top - L.ankle], bend: 1 }, f: { to: far, bend: 1, foot: ft > 0 && ft < 1 ? 20 : 0 } },
      arm: both({ a1: 91, a2: 91 }),
    });
    pose.kit = [K.box(98, 138, top), K.db(pose.n.gr, 'front'), K.db(pose.f.gr, 'back')];
    return pose;
  },

  legPress(t) {
    const hip = [86, 118];
    const ra = -38;
    const an = at(hip, ra, lerp(48, 25, t));
    const fa = -142;
    const pose = side({
      hip, torso: -140, neck: -120,
      leg: both({ to: an, bend: 1, foot: fa }),
      arm: both({ to: [90, 124], bend: 1 }),
    });
    const sole0 = add(pose.n.heel, rot([0, 0], 0));
    const sole1 = pose.n.toe;
    const plateA = at(sole0, angOf(sole1, sole0), 4);
    const plateB = at(sole1, angOf(sole0, sole1), 6);
    pose.kit = [
      K.line(at(hip, ra, 6), at(hip, ra, 82), 3, 'frame'),
      K.pad(plateA, plateB, -4, 'plate', 'front'),
      K.pad(off(hip, -140, -4, 7.5), off(hip, -140, 38, 7.5), 5),
      K.rect(76, 124, 26, 5, 'pad', 'back', 2),
      K.line([90, 129], [96, FLOOR], 2.6, 'frame'),
    ];
    return pose;
  },

  legExt(t) {
    const hip = [88, 108];
    const a2 = lerp(94, 4, t);
    const pose = side({
      hip, torso: -97, neck: -92,
      leg: both({ a1: 0, a2, foot: a2 - 94 }),
      arm: both({ to: [94, 113], bend: 1 }),
    });
    const kn = pose.n.kn;
    const pad = add(at(kn, a2, 20), dir(a2 - 90), 6.5);
    pose.kit = [
      K.rect(76, 113, 34, 5, 'pad', 'back', 2),
      K.pad([80.5, 113], [80.5, 72], -5),
      K.line([84, 118], [84, FLOOR], 2.6, 'frame'),
      K.line(kn, pad, 2.4, 'frame', 'mid'),
      K.circle(pad, 4.6, 'pad', 'front'),
    ];
    return pose;
  },

  hinge(t, o) {
    const hip = lp([97, 96], [77, 99], t);
    const ta = lerp(-87, -24, t);
    const pose = side({ hip, torso: ta, neck: lerp(-88, -32, t), leg: standLegs(), arm: both({ a1: lerp(89, 91, t), a2: lerp(89, 91, t) }) });
    pose.kit = o.kit === 'db' ? [K.db(pose.n.gr, 'front'), K.db(pose.f.gr, 'back')] : held(o.kit, pose.n.gr, 'mid');
    return pose;
  },

  deadlift(t) {
    // starts on the floor
    const g0 = [104, FLOOR - 11];
    const sh0 = [105, g0[1] - (ARM + L.ua) + 1];
    const hip0 = at(sh0, 142, 32);
    const hip = lp(hip0, [97, 96], t);
    const ta = lerp(angOf(hip0, sh0), -87, t);
    const pose = side({ hip, torso: ta, neck: lerp(-40, -88, t), leg: standLegs(), arm: both({ a1: 90, a2: 90 }) });
    pose.kit = K.plate(pose.n.gr, 11, 'mid');
    return pose;
  },

  slRdl(t) {
    const hip = lp([96, 96], [86, 98], t);
    const ta = lerp(-87, -8, t);
    const pose = side({
      hip, torso: ta, neck: lerp(-88, -16, t),
      leg: { n: { to: [100, AY], bend: 1 }, f: { a1: lerp(93, 172, t), a2: lerp(95, 172, t), foot: lerp(0, 80, t) } },
      arm: { n: { a1: 90, a2: 90 }, f: { a1: lerp(90, 60, t), a2: lerp(90, 60, t) } },
    });
    pose.kit = K.db(pose.n.gr, 'front');
    return pose;
  },

  kbSwing(t) {
    const hip = lp([78, 101], [97, 96], t);
    const ta = lerp(-26, -88, t);
    const a = lerp(112, -6, t);
    const pose = side({ hip, torso: ta, neck: lerp(-36, -88, t), leg: { n: { to: [102, AY], bend: 1 }, f: { to: [99, AY], bend: 1 } }, arm: both({ a1: a, a2: a }) });
    pose.kit = K.kb(add(pose.n.gr, [-1, -2]), 'front');
    return pose;
  },

  legCurl(t) {
    const hip = [94, 104];
    const a2 = lerp(2, -98, t);
    const pose = side({
      hip, torso: 180, neck: 186,
      leg: both({ a1: 0, a2, foot: a2 + 92 }),
      arm: both({ to: [58, 121], bend: -1 }),
    });
    const kn = pose.n.kn;
    const pad = add(at(kn, a2, 22), dir(a2 - 90), 6.5);
    pose.kit = [
      K.rect(44, 111, 76, 6, 'pad', 'back', 2.5),
      K.line([52, 117], [52, FLOOR], 2.6, 'frame'),
      K.line([112, 117], [112, FLOOR], 2.6, 'frame'),
      K.line(kn, pad, 2.4, 'frame', 'mid'),
      K.circle(pad, 4.6, 'pad', 'front'),
    ];
    return pose;
  },

  sliderCurl(t) {
    const hip = lp([88, 132], [92, 118], t);
    const sh = [58, 141];
    const ta = angOf(hip, sh);
    const ank = lp([140, 143], [110, AY], t);
    const pose = side({ hip, torso: ta, neck: ta, leg: both({ to: ank, bend: -1, foot: lerp(-60, -12, t) }), arm: both({ to: [84, 146], bend: 1 }) });
    pose.kit = K.rect(pose.n.heel[0] - 7, FLOOR - 2.5, 14, 2.5, 'plate', 'front', 1);
    return pose;
  },

  nordic(t) {
    const kn = [96, 145];
    const a = lerp(-90, -32, t);
    const hip = at(kn, a, L.th);
    const pose = side({
      hip, torso: a, neck: a,
      leg: both({ a1: a + 180, a2: 180, foot: 180 }),
      arm: both({ a1: lerp(88, 40, t), a2: lerp(80, 20, t) }),
    });
    pose.kit = [K.rect(56, 128, 24, 20, 'pad', 'front', 3), K.rect(64, FLOOR - 4, 46, 4, 'pad', 'back', 1)];
    return pose;
  },

  hipThrust(t, o) {
    const hip = lp([86, 137], [93, 111], t);
    const edge = [62, 112];
    const ta = angOf(hip, edge);
    const pose = side({ hip, torso: ta, neck: ta - 22, leg: both({ to: [120, AY], bend: -1 }) });
    const bar = add(hip, [0, -10]);
    Object.assign(pose, side({ hip, torso: ta, neck: ta - 22, leg: both({ to: [120, AY], bend: -1 }), arm: both({ to: add(bar, [-3, 1]), bend: 1 }) }));
    pose.kit = [K.bench(28, 64, 118), o.kit === 'db' ? K.db(bar, 'front') : K.plate(bar, 10, 'mid')];
    return pose;
  },

  bridge(t) {
    const hip = lp([82, 139], [88, 118], t);
    const sh = [56, 141];
    const ta = angOf(hip, sh);
    return side({
      hip, torso: ta, neck: ta,
      leg: { n: { to: [106, AY], bend: -1 }, f: { a1: ta + 180 - 18, a2: ta + 180 - 18, foot: -60 } },
      arm: both({ to: [82, 146.5], bend: 1 }),
    });
  },

  kickback(t) {
    const hip = [92, 100];
    const a1 = lerp(92, 146, t);
    const pose = side({
      hip, torso: -66, neck: -70,
      leg: { n: { a1, a2: lerp(94, 152, t), foot: lerp(0, 60, t) }, f: { to: [100, AY], bend: 1 } },
      arm: both({ to: [136, 82], bend: 1 }),
    });
    pose.kit = [K.line([140, FLOOR], [140, 30], 4, 'frame'), ...K.cable([138, 146], pose.n.an)];
    return pose;
  },

  calf(t, o) {
    const step = o.kit === 'step';
    const top = step ? 136 : 140;
    const toe = [118, top];
    const fa = lerp(24, -30, t);
    const an = add(toe, rot([-10.5, -L.ankle], fa));
    const hip = [an[0] - 1, an[1] - 50.6];
    const pose = side({
      hip, torso: -89, neck: -89,
      leg: { n: { to: an, bend: 1, foot: fa }, f: step ? { a1: 98, a2: 150, foot: 60 } : { to: add(an, [-2, 0]), bend: 1, foot: fa } },
      arm: step ? { n: { to: [146, hip[1] - 14], bend: 1 }, f: { a1: 92, a2: 92 } } : both({ to: [hip[0] + 6, hip[1] - 38], bend: 1 }),
    });
    pose.kit = step
      ? [K.box(96, 126, top), K.line([150, FLOOR], [150, 30], 4, 'frame')]
      : [K.box(98, 128, top), K.rect(pose.sh[0] - 7, pose.sh[1] - 11, 14, 6, 'pad', 'front', 3), K.line([70, FLOOR], [70, 40], 4, 'frame'), K.line([70, pose.sh[1] - 8], [pose.sh[0] - 6, pose.sh[1] - 8], 3, 'frame')];
    return pose;
  },

  seatedCalf(t) {
    const toe = [118, 140];
    const fa = lerp(24, -30, t);
    const an = add(toe, rot([-10.5, -L.ankle], fa));
    const pose = side({
      hip: [84, 112], torso: -88, neck: -88,
      leg: both({ to: an, bend: -1, foot: fa }),
      arm: both({ to: [104, 99], bend: 1 }),
    });
    const kn = pose.n.kn;
    pose.kit = [K.box(98, 128, 140), K.rect(72, 117, 26, 5, 'pad', 'back', 2), K.line([84, 122], [84, FLOOR], 2.6, 'frame'), K.rect(kn[0] - 9, kn[1] - 11, 18, 6, 'pad', 'front', 3)];
    return pose;
  },

  // ---------- Chest and shoulders ----------
  bench(t, o) {
    const hip = [101, 113];
    const g = lp([71, 79], [83, 103], t);
    const pose = side({ hip, torso: 180, neck: 182, leg: both({ to: [124, AY], bend: 1 }), arm: both({ to: g, bend: -1 }) });
    pose.kit = [K.bench(48, 118, 119), o.kit === 'db' ? [K.db(pose.n.gr, 'front'), K.db(add(pose.f.gr, [-1, -1]), 'back')] : K.plate(g, 10, 'mid')];
    return pose;
  },

  incline(t, o) {
    const hip = [99, 114];
    const ta = -150;
    const s0 = side({ hip, torso: ta, neck: -146 }).sh;
    const g = lp([s0[0] + 1, s0[1] - 34], [s0[0] + 9, s0[1] + 7], t);
    const pose = side({ hip, torso: ta, neck: -146, leg: both({ to: [124, AY], bend: 1 }), arm: both({ to: g, bend: -1 }) });
    pose.kit = [
      K.rect(84, 120, 30, 5, 'pad', 'back', 2),
      K.pad(off(hip, ta, -6, -7.5), off(hip, ta, 38, -7.5), -5),
      K.line([96, 125], [96, FLOOR], 2.6, 'frame'),
      K.line(off(hip, ta, 20, -12), [70, FLOOR], 2.6, 'frame'),
      o.kit === 'bb' ? K.plate(g, 10, 'mid') : [K.db(pose.n.gr, 'front'), K.db(add(pose.f.gr, [-1, -1]), 'back')],
    ];
    return pose;
  },

  machinePress(t) {
    const hip = [88, 114];
    const s0 = side({ hip, torso: -90 }).sh;
    const g = lp([s0[0] + 8, s0[1] + 4], [s0[0] + 33, s0[1] + 4], t);
    const pose = side({ hip, torso: -90, neck: -90, leg: both({ to: [116, AY], bend: 1 }), arm: both({ to: g, bend: -1 }) });
    pose.kit = [
      K.rect(76, 120, 28, 5, 'pad', 'back', 2),
      K.pad([80.5, 119], [80.5, 70], -5),
      K.line([88, 125], [88, FLOOR], 2.6, 'frame'),
      K.line([128, 26], g, 3, 'frame', 'mid'),
      K.line([136, FLOOR], [136, 22], 4, 'frame'),
      K.circle(g, 3, 'metal', 'front'),
    ];
    return pose;
  },

  pushUp(t, o) {
    const feetUp = o.feet === 'box';
    const blocks = o.hands === 'blocks';
    const gy = blocks ? FLOOR - 9 : FLOOR - 2;
    const toe = feetUp ? [48, 124] : [48, FLOOR];
    const an = add(toe, [3.5, -11]);
    const topY = gy - 34;
    const botY = blocks ? gy + 3 : gy - 13;
    const len = L.sh + L.th + 32;
    const th0 = Math.asin((topY - an[1]) / len) * 180 / Math.PI;
    const th1 = Math.asin((botY - an[1]) / len) * 180 / Math.PI;
    const th = lerp(th0, th1, t);
    const gx = an[0] + len * Math.cos(th0 * Math.PI / 180);
    const hip = at(an, th, L.sh + L.th);
    const pose = side({ hip, torso: th, neck: th - 6, leg: both({ a1: th + 180, a2: th + 180, foot: 80 }), arm: both({ to: [gx, gy], bend: -1 }) });
    pose.kit = [feetUp ? K.box(22, 66, 124) : null, blocks ? [K.rect(gx - 9, gy + 2, 18, FLOOR - gy - 2, 'plate', 'back', 1)] : null];
    return pose;
  },

  pike(t, o) {
    const feetUp = o.feet === 'box';
    const toeY = feetUp ? 124 : FLOOR;
    const an = [62, toeY - 11];
    const gx = 120;
    const hip = lp(feetUp ? [86, 82] : [84, 92], feetUp ? [92, 86] : [90, 98], t);
    const ta = angOf(hip, [gx, FLOOR - 2]) + lerp(-6, 14, t);
    const pose = side({ hip, torso: ta, neck: ta + 10, leg: both({ to: an, bend: 1, foot: 70 }) });
    Object.assign(pose, side({ hip, torso: ta, neck: ta + lerp(6, 18, t), leg: both({ to: an, bend: 1, foot: 70 }), arm: both({ to: [gx, FLOOR - 2], bend: -1 }) }));
    pose.kit = feetUp ? K.box(30, 74, 124) : null;
    return pose;
  },

  dip(t) {
    const g = [100, 92];
    const sh = lp([97, 59], [105, 76], t);
    const ta = lerp(-86, -68, t);
    const pose = side({ sh, torso: ta, neck: lerp(-86, -64, t), leg: both({ a1: lerp(100, 96, t), a2: lerp(148, 140, t), foot: 60 }), arm: both({ to: g, bend: 1 }) });
    pose.kit = [K.line([104, 94], [104, FLOOR], 3.2, 'frame'), ...K.bar(g, 'mid')];
    return pose;
  },

  cableFly(t) {
    const hip = [100, 96];
    const gl = lp([62, 66], [96, 89], t);
    const gr = lp([138, 66], [104, 89], t);
    const pose = front({ hip, leg: { l: { to: [92, AY], bend: -1 }, r: { to: [108, AY], bend: 1 } }, arm: { l: { to: gl, bend: -1 }, r: { to: gr, bend: 1 } } });
    pose.kit = [K.line([48, FLOOR], [48, 22], 4), K.line([152, FLOOR], [152, 22], 4), ...K.cable([50, 28], gl), ...K.cable([150, 28], gr)];
    return pose;
  },

  pecDeck(t) {
    const c = 100;
    const hip = [c, 116];
    const pose = front({ hip, hideLegs: false, leg: { l: { to: [90, AY], bend: -1 }, r: { to: [110, AY], bend: 1 } } });
    const sy = pose.sl[1];
    const elL = [lerp(pose.sl[0] - 17, c - 5, t), sy + 2];
    const elR = [lerp(pose.sr[0] + 17, c + 5, t), sy + 2];
    pose.l = { ...pose.l, el: elL, wr: add(elL, [0, -14.5]), gr: add(elL, [0, -19]) };
    pose.r = { ...pose.r, el: elR, wr: add(elR, [0, -14.5]), gr: add(elR, [0, -19]) };
    pose.kit = [
      K.rect(c - 14, pose.shc[1] - 8, 28, 50, 'pad', 'back', 4),
      K.rect(elL[0] - 3.5, elL[1] - 24, 7, 26, 'pad', 'front', 3),
      K.rect(elR[0] - 3.5, elR[1] - 24, 7, 26, 'pad', 'front', 3),
      K.rect(c - 16, 121, 32, 5, 'pad', 'back', 2),
    ];
    return pose;
  },

  dbFly(t) {
    // seen from the end of the bench, lying on your back
    const c = 100;
    const pose = front({ hip: [c, 117], torso: 12, shoulderW: 12, hipW: 12, hideHead: true, leg: { l: { to: [84, AY], bend: 1 }, r: { to: [116, AY], bend: -1 } } });
    const gl = lp([96, 74], [64, 106], t);
    const gr = lp([104, 74], [136, 106], t);
    const p2 = front({ hip: [c, 117], torso: 12, shoulderW: 12, hipW: 12, hideHead: true, leg: { l: { to: [84, AY], bend: 1 }, r: { to: [116, AY], bend: -1 } }, arm: { l: { to: gl, bend: 1 }, r: { to: gr, bend: -1 } } });
    Object.assign(pose, p2);
    pose.kit = [
      K.circle([c, pose.shc[1] - 5], L.head, 'fig-far', 'back'),
      K.rect(c - 16, 118, 32, 5, 'pad', 'back', 2),
      K.line([c, 123], [c, FLOOR], 3, 'frame'),
      K.db(gl, 'front'),
      K.db(gr, 'front'),
    ];
    return pose;
  },

  ohp(t) {
    const hip = [97, 96];
    const s0 = side({ hip, torso: -88 }).sh;
    const g = lp([s0[0] + 8, s0[1] + 3], [s0[0] + 1, s0[1] - 34], t);
    const pose = side({ hip, torso: lerp(-88, -90, t), neck: lerp(-96, -88, t), leg: standLegs(), arm: both({ to: g, bend: -1 }) });
    pose.kit = K.plate(g, 9.5, 'mid');
    return pose;
  },

  seatedPress(t) {
    const hip = [91, 115];
    const s0 = side({ hip, torso: -90 }).sh;
    const g = lp([s0[0] + 3, s0[1] - 3], [s0[0] + 1, s0[1] - 34], t);
    const pose = side({ hip, torso: -90, neck: -90, leg: both({ to: [118, AY], bend: 1 }), arm: both({ to: g, bend: -1 }) });
    pose.kit = [K.rect(78, 121, 28, 5, 'pad', 'back', 2), K.pad([83.5, 120], [83.5, 74], -5), K.line([90, 126], [90, FLOOR], 2.6, 'frame'), K.db(pose.n.gr, 'front'), K.db(add(pose.f.gr, [-1, -1]), 'back')];
    return pose;
  },

  lateral(t, o) {
    const hip = [100, 96];
    const al = lerp(97, 178, t);
    const ar = lerp(83, 2, t);
    const pose = front({
      hip, leg: { l: { to: [93, AY], bend: -1 }, r: { to: [107, AY], bend: 1 } },
      arm: { l: { a1: al, a2: al - 10 }, r: { a1: ar, a2: ar + 10 } },
    });
    pose.kit = [held(o.kit, pose.l.gr, 'front'), held(o.kit, pose.r.gr, 'front')];
    return pose;
  },

  cableLateral(t) {
    const hip = [100, 96];
    const ar = lerp(108, 4, t);
    const pose = front({
      hip, leg: { l: { to: [93, AY], bend: -1 }, r: { to: [107, AY], bend: 1 } },
      arm: { l: { to: [70, 92], bend: 1 }, r: { a1: ar, a2: ar + 8 } },
    });
    pose.kit = [K.line([66, FLOOR], [66, 30], 4), ...K.cable([68, 144], pose.r.gr)];
    return pose;
  },

  rearFly(t) {
    const hip = [100, 100];
    const al = lerp(94, 176, t);
    const ar = lerp(86, 4, t);
    const pose = front({
      hip, torso: 13, neck: -6, shoulderW: 12,
      leg: { l: { to: [90, AY], bend: -1 }, r: { to: [110, AY], bend: 1 } },
      arm: { l: { a1: al, a2: al - 10 }, r: { a1: ar, a2: ar + 10 } },
    });
    pose.kit = [K.db(pose.l.gr, 'front'), K.db(pose.r.gr, 'front')];
    return pose;
  },

  facePull(t) {
    const hip = [96, 96];
    const s0 = side({ hip, torso: -93 }).sh;
    const pose0 = side({ hip, torso: -93, neck: -90 });
    const g = lp([s0[0] + 32, s0[1] - 4], [pose0.head[0] + 6, pose0.head[1] + 1], t);
    const pose = side({ hip, torso: -93, neck: -90, leg: { n: { to: [104, AY], bend: 1 }, f: { to: [88, AY], bend: 1 } }, arm: both({ to: g, bend: -1 }) });
    pose.kit = [K.line([146, FLOOR], [146, 30], 4), ...K.cable([142, s0[1] - 4], g)];
    return pose;
  },

  shrug(t) {
    const pose = side({ hip: [97, 96], torso: -88, neck: -88, shrug: lerp(0, 5, t), leg: standLegs(), arm: both({ a1: 91, a2: 91 }) });
    pose.kit = [K.db(pose.n.gr, 'front'), K.db(pose.f.gr, 'back')];
    return pose;
  },

  // ---------- Back ----------
  pullUp(t, o) {
    const g = [100, 30];
    const sh = lp([97, 64], [o.chin ? 102 : 100, 39], t);
    const ta = lerp(-92, -100, t);
    const pose = side({ sh, torso: ta, neck: lerp(-92, -84, t), leg: both({ a1: lerp(93, 102, t), a2: lerp(100, 116, t), foot: 40 }), arm: both({ to: g, bend: o.chin ? -1 : -1 }) });
    pose.kit = barFrame(g);
    return pose;
  },

  hangingKnee(t) {
    const g = [100, 30];
    const pose = side({ sh: [98, 64], torso: lerp(-92, -98, t), neck: -90, leg: both({ a1: lerp(94, -16, t), a2: lerp(100, 86, t), foot: 40 }), arm: both({ to: g, bend: -1 }) });
    pose.kit = barFrame(g);
    return pose;
  },

  hang(t) {
    const g = [100, 30];
    const pose = side({ sh: [97 + t * 1.2, 64], torso: -92 + t, neck: -90, leg: both({ a1: 93, a2: 100, foot: 40 }), arm: both({ to: g, bend: -1 }) });
    pose.kit = barFrame(g);
    return pose;
  },

  pulldown(t) {
    const hip = [88, 113];
    const ta = lerp(-95, -103, t);
    const s0 = side({ hip, torso: -95 }).sh;
    const s = side({ hip, torso: ta }).sh;
    const g = lp([s0[0] + 7, s0[1] - 34], [s[0] + 8, s[1] + 3], t);
    const pose = side({ hip, torso: ta, neck: lerp(-92, -96, t), leg: both({ to: [116, AY], bend: 1 }), arm: both({ to: g, bend: 1 }) });
    pose.kit = [
      K.rect(74, 119, 30, 5, 'pad', 'back', 2),
      K.line([86, 124], [86, FLOOR], 2.6, 'frame'),
      K.rect(104, 97, 14, 6, 'pad', 'front', 3),
      K.line([62, FLOOR], [62, 12], 4),
      K.line([62, 14], [s0[0] + 8, 14], 3),
      ...K.cable([s0[0] + 8, 16], g),
      K.circle(g, 2.6, 'metal', 'front'),
    ];
    return pose;
  },

  cableRow(t) {
    const hip = [80, 121];
    const ta = lerp(-72, -95, t);
    const s = side({ hip, torso: ta }).sh;
    const g = lp([s[0] + 33, s[1] + 9], off(hip, ta, 10, 10), t);
    const pose = side({ hip, torso: ta, neck: ta + 4, leg: both({ to: [124, 128], bend: 1, foot: -70 }), arm: both({ to: g, bend: -1 }) });
    pose.kit = [
      K.rect(56, 126, 44, 5, 'pad', 'back', 2),
      K.line([64, 131], [64, FLOOR], 2.6, 'frame'),
      K.line([92, 131], [92, FLOOR], 2.6, 'frame'),
      K.pad([129, 146], [133, 113], 4, 'plate'),
      K.line([156, FLOOR], [156, 104], 4),
      ...K.cable([152, 124], g),
      K.circle(g, 2.6, 'metal', 'front'),
    ];
    return pose;
  },

  csRow(t) {
    const hip = [72, 112];
    const ta = -38;
    const s = side({ hip, torso: ta }).sh;
    const g = lp([s[0] + 1, s[1] + 35], [s[0] - 7, s[1] + 9], t);
    const pose = side({ hip, torso: ta, neck: -26, leg: both({ to: [62, AY], bend: 1 }), arm: both({ to: g, bend: -1 }) });
    pose.kit = [
      K.pad(off(hip, ta, -4, 7.5), off(hip, ta, 33, 7.5), 5),
      K.line(off(hip, ta, 14, 12), [86, FLOOR], 2.6, 'frame'),
      K.line(off(hip, ta, 2, 12), [70, FLOOR], 2.6, 'frame'),
      K.db(pose.n.gr, 'front'),
      K.db(add(pose.f.gr, [-1, -1]), 'back'),
    ];
    return pose;
  },

  oneArmRow(t) {
    const hip = [76, 100];
    const ta = -10;
    const s = side({ hip, torso: ta }).sh;
    const g = lp([s[0] + 1, s[1] + 34], [s[0] - 12, s[1] + 8], t);
    const pose = side({
      hip, torso: ta, neck: -16,
      leg: { n: { to: [88, AY], bend: 1 }, f: { a1: 86, a2: 178, foot: 170 } },
      arm: { n: { to: g, bend: -1 }, f: { to: [s[0] + 5, 118], bend: 1 } },
    });
    pose.kit = [K.bench(46, 122, 119), K.db(pose.n.gr, 'front')];
    return pose;
  },

  bentRow(t, o) {
    const hip = [78, 103];
    const ta = -38;
    const s = side({ hip, torso: ta }).sh;
    const g = lp([s[0] + 1, s[1] + 34], off(hip, ta, 18, 11), t);
    const pose = side({ hip, torso: ta, neck: -30, leg: standLegs(101, 98), arm: both({ to: g, bend: -1 }) });
    pose.kit = held(o.kit, g, 'mid');
    return pose;
  },

  proneY(t) {
    const hip = [90, 143];
    const ua = lerp(0, -9, t);
    const a = lerp(2, -18, t);
    return side({ hip, torso: [0, ua], neck: ua - 4, leg: both({ a1: 180, a2: 180, foot: 160 }), arm: both({ a1: a, a2: a }) });
  },

  pullover(t) {
    const hip = [92, 124];
    const ta = angOf(hip, [62, 113]);
    const a1 = lerp(-86, -190, t);
    const pose = side({ hip, torso: ta, neck: ta + 6, leg: both({ to: [124, AY], bend: 1 }), arm: both({ a1, a2: a1 - lerp(0, 8, t) }) });
    pose.kit = [K.rect(52, 119, 22, 5, 'pad', 'back', 2), K.line([63, 124], [63, FLOOR], 3, 'frame'), K.dbV(pose.n.gr, a1 - lerp(0, 8, t), 'front')];
    return pose;
  },

  straightArm(t) {
    const hip = [94, 96];
    const a = lerp(-40, 98, t);
    const pose = side({ hip, torso: -74, neck: -78, leg: standLegs(100, 97), arm: both({ a1: a, a2: a }) });
    pose.kit = [K.line([150, FLOOR], [150, 18], 4), ...K.cable([146, 24], pose.n.gr), K.circle(pose.n.gr, 2.6, 'metal', 'front')];
    return pose;
  },

  // ---------- Arms ----------
  curl(t, o) {
    const a2 = lerp(88, -58, t);
    const pose = side({ hip: [97, 96], torso: -88, neck: -88, leg: standLegs(), arm: both({ a1: 93, a2 }) });
    if (o.kit === 'cable') pose.kit = [K.line([136, FLOOR], [136, 110], 4), ...K.cable([132, 144], pose.n.gr), K.circle(pose.n.gr, 2.6, 'metal', 'front')];
    else if (o.kit === 'db') pose.kit = [K.db(pose.n.gr, 'front'), K.db(pose.f.gr, 'back')];
    else pose.kit = held(o.kit, pose.n.gr, 'mid');
    return pose;
  },

  inclineCurl(t) {
    const hip = [96, 114];
    const a2 = lerp(91, -40, t);
    const pose = side({ hip, torso: -126, neck: -110, leg: both({ to: [122, AY], bend: 1 }), arm: both({ a1: 92, a2 }) });
    pose.kit = [K.rect(84, 120, 28, 5, 'pad', 'back', 2), K.pad(off(hip, -126, -6, -7.5), off(hip, -126, 38, -7.5), -5), K.line([96, 125], [96, FLOOR], 2.6), K.db(pose.n.gr, 'front'), K.db(add(pose.f.gr, [-1, 0]), 'back')];
    return pose;
  },

  preacher(t) {
    const hip = [86, 116];
    const ta = -72;
    const a2 = lerp(52, -86, t);
    const pose = side({ hip, torso: ta, neck: -76, leg: both({ to: [114, AY], bend: 1 }), arm: both({ a1: 44, a2 }) });
    const sh = pose.sh;
    pose.kit = [K.rect(74, 122, 26, 5, 'pad', 'back', 2), K.line([86, 127], [86, FLOOR], 2.6), K.pad(off(sh, 44, 3, 4.5), off(sh, 44, 21, 4.5), 5, 'pad', 'back'), K.line(off(sh, 44, 18, 9), [118, FLOOR], 2.6), K.plate(pose.n.gr, 7.5, 'mid')];
    return pose;
  },

  pushdown(t) {
    const a2 = lerp(-32, 88, t);
    const pose = side({ hip: [96, 96], torso: -82, neck: -84, leg: standLegs(101, 97), arm: both({ a1: 94, a2 }) });
    pose.kit = [K.line([140, FLOOR], [140, 20], 4), ...K.cable([136, 26], pose.n.gr), K.line(add(pose.n.gr, [-3, 1]), add(pose.n.gr, [3, -1]), 2.4, 'kit', 'front')];
    return pose;
  },

  ohCableExt(t) {
    const hip = [94, 98];
    const a2 = lerp(152, -48, t);
    const pose = side({ hip, torso: -60, neck: -62, leg: { n: { to: [118, AY], bend: 1 }, f: { to: [84, AY], bend: 1 } }, arm: both({ a1: -52, a2 }) });
    pose.kit = [K.line([40, FLOOR], [40, 20], 4), ...K.cable([44, 30], pose.n.gr)];
    return pose;
  },

  ohExt(t) {
    const a2 = lerp(112, -92, t);
    const pose = side({ hip: [97, 96], torso: -88, neck: -86, leg: standLegs(), arm: both({ a1: -97, a2 }) });
    pose.kit = K.dbV(pose.n.gr, a2, 'front');
    return pose;
  },

  skull(t) {
    const hip = [101, 113];
    const a2 = lerp(-100, 168, t);
    const pose = side({ hip, torso: 180, neck: 182, leg: both({ to: [124, AY], bend: 1 }), arm: both({ a1: -100, a2: t < 0.5 ? lerp(-100, -170, t * 2) : lerp(-170, -192, (t - 0.5) * 2) }) });
    pose.kit = [K.bench(48, 118, 119), K.plate(pose.n.gr, 7.5, 'mid')];
    void a2;
    return pose;
  },

  kickbackArm(t) {
    const hip = [80, 100];
    const ta = -20;
    const pose = side({ hip, torso: ta, neck: -26, leg: standLegs(100, 97), arm: { n: { a1: 168, a2: lerp(94, 170, t) }, f: { to: [116, 104], bend: 1 } } });
    pose.kit = [K.db(pose.n.gr, 'front'), K.bench(104, 140, 108)];
    return pose;
  },

  benchDip(t) {
    const g = [84, 116];
    const sh = lp([87, 82], [90, 100], t);
    const pose = side({ sh, torso: -90, neck: -88, leg: both({ to: [146, AY], bend: 1 }), arm: both({ to: g, bend: 1 }) });
    pose.kit = K.bench(48, 86, 116);
    return pose;
  },

  wristCurl(t) {
    const hip = [80, 114];
    const pose = side({ hip, torso: -62, neck: -66, leg: both({ to: [110, AY], bend: 1 }), arm: both({ a1: 80, a2: 4, hand: lerp(64, -44, t) }) });
    pose.kit = [K.rect(66, 119, 34, 5, 'pad', 'back', 2), K.line([80, 124], [80, FLOOR], 2.6), K.db(pose.n.gr, 'front')];
    return pose;
  },

  farmer(t) {
    const pose = side({ hip: [97, 96], torso: -88 - t * 0.8, neck: -88, leg: standLegs(), arm: both({ a1: 90.5, a2: 90.5 }) });
    pose.kit = [K.db(pose.n.gr, 'front'), K.db(pose.f.gr, 'back')];
    return pose;
  },

  towel(t) {
    const hip = [100, 96];
    const pose = front({
      hip, leg: { l: { to: [93, AY], bend: -1 }, r: { to: [107, AY], bend: 1 } },
      arm: { l: { a1: 122, a2: lerp(-6, 6, t) }, r: { a1: 58, a2: lerp(186, 174, t) } },
    });
    const y = (pose.l.gr[1] + pose.r.gr[1]) / 2;
    const z = lerp(-3, 3, t);
    pose.kit = [{ tag: 'polyline', pts: [[86, y + 6], [90, y - z], [95, y + z], [100, y - z], [105, y + z], [110, y - z], [114, y + 6]], w: 5, cls: 'towel', z: 'mid' }];
    return pose;
  },

  // ---------- Core ----------
  cableCrunch(t) {
    const hip = [96, 120];
    const la = lerp(-82, -58, t);
    const ua = lerp(-80, 24, t);
    const p0 = side({ hip, torso: [la, ua], neck: ua + 8 });
    const g = add(p0.head, [4, 3]);
    const pose = side({ hip, torso: [la, ua], neck: ua + 8, leg: both({ a1: 90, a2: 180, foot: 180 }), arm: both({ to: g, bend: 1 }) });
    pose.kit = [K.line([150, FLOOR], [150, 14], 4), ...K.cable([146, 20], g)];
    return pose;
  },

  crunch(t) {
    const hip = [98, 141];
    const ua = lerp(180, 210, t);
    const p0 = side({ hip, torso: [180, ua], neck: ua + 10 });
    return side({ hip, torso: [180, ua], neck: ua + 10, leg: both({ to: [124, AY], bend: 1 }), arm: both({ to: add(p0.head, [3, -1]), bend: 1 }) });
  },

  reverseCrunch(t) {
    const sh = [62, 141];
    const la = lerp(180, 148, t);
    return side({ sh, torso: [la, 180], neck: 182, leg: both({ a1: lerp(-90, -128, t), a2: lerp(0, -46, t), foot: lerp(0, -40, t) }), arm: both({ to: [92, 146.5], bend: 1 }) });
  },

  deadBug(t) {
    const hip = [96, 141];
    return side({
      hip, torso: 180, neck: 182,
      leg: { n: { a1: -90, a2: 0 }, f: { a1: lerp(-90, -12, t), a2: lerp(0, -10, t), foot: lerp(0, -60, t) } },
      arm: { n: { a1: lerp(-90, -172, t), a2: lerp(-90, -172, t) }, f: { a1: -90, a2: -90 } },
    });
  },

  legRaise(t) {
    const hip = [96, 141];
    const a = lerp(-4, -88, t);
    return side({ hip, torso: 180, neck: 182, leg: both({ a1: a, a2: a, foot: lerp(-80, -170, t) }), arm: both({ to: [104, 146.5], bend: 1 }) });
  },

  plank(t) {
    const toe = [48, FLOOR];
    const an = add(toe, [3.5, -11]);
    const th = -6.2 + lerp(-0.5, 0.5, t);
    const hip = at(an, th, L.sh + L.th);
    const p0 = side({ hip, torso: th, neck: th - 8 });
    const el = [p0.sh[0], FLOOR - 3.2];
    return side({ hip, torso: th, neck: th - 8, leg: both({ a1: th + 180, a2: th + 180, foot: 80 }), arm: both({ a1: angOf(p0.sh, el), a2: 0, hand: 0 }) });
  },

  hipAbduction(t) {
    const c = 100;
    const pose = front({ hip: [c, 112], hideLegs: true });
    const knL = [lerp(c - 8, c - 22, t), 121];
    const knR = [lerp(c + 8, c + 22, t), 121];
    const anL = [lerp(c - 9, c - 18, t), AY];
    const anR = [lerp(c + 9, c + 18, t), AY];
    pose.hideLegs = false;
    pose.l = { ...pose.l, kn: knL, an: anL, heel: add(anL, [2, L.ankle]), toe: add(anL, [-5, L.ankle]) };
    pose.r = { ...pose.r, kn: knR, an: anR, heel: add(anR, [-2, L.ankle]), toe: add(anR, [5, L.ankle]) };
    const pl = front({ hip: [c, 112], arm: { l: { to: [c - 18, 116], bend: 1 }, r: { to: [c + 18, 116], bend: -1 } } });
    pose.l = { ...pose.l, el: pl.l.el, wr: pl.l.wr, gr: pl.l.gr };
    pose.r = { ...pose.r, el: pl.r.el, wr: pl.r.wr, gr: pl.r.gr };
    pose.kit = [
      K.rect(c - 15, pose.shc[1] - 6, 30, 42, 'pad', 'back', 4),
      K.rect(c - 18, 114, 36, 5, 'pad', 'back', 2),
      K.rect(knL[0] - 9, knL[1] - 7, 5, 14, 'pad', 'front', 2.5),
      K.rect(knR[0] + 4, knR[1] - 7, 5, 14, 'pad', 'front', 2.5),
    ];
    return pose;
  },
};

// Which pattern each exercise uses. secs: seconds per rep; hold: a static hold that gently moves.
export const SPECS = {
  bench: { p: 'bench', o: { kit: 'bb' } },
  'db-bench': { p: 'bench', o: { kit: 'db' } },
  'incline-db': { p: 'incline', o: { kit: 'db' } },
  'incline-bench': { p: 'incline', o: { kit: 'bb' } },
  'machine-press': { p: 'machinePress' },
  'cable-fly': { p: 'cableFly', floor: true },
  'pec-deck': { p: 'pecDeck' },
  'db-fly': { p: 'dbFly' },
  'push-up': { p: 'pushUp' },
  'feet-up-push-up': { p: 'pushUp', o: { feet: 'box' } },
  'deficit-push-up': { p: 'pushUp', o: { hands: 'blocks' } },
  'diamond-push-up': { p: 'pushUp' },
  dips: { p: 'dip', floor: false },
  'lat-pulldown': { p: 'pulldown' },
  'cable-row': { p: 'cableRow' },
  'cs-row': { p: 'csRow' },
  'one-arm-row': { p: 'oneArmRow' },
  'bb-row': { p: 'bentRow', o: { kit: 'bb' } },
  'backpack-row': { p: 'bentRow', o: { kit: 'pack' } },
  'pull-up': { p: 'pullUp' },
  'chin-up': { p: 'pullUp', o: { chin: true } },
  'prone-y': { p: 'proneY' },
  'db-pullover': { p: 'pullover' },
  'straight-arm': { p: 'straightArm' },
  shrug: { p: 'shrug', secs: 2.4 },
  'face-pull': { p: 'facePull' },
  ohp: { p: 'ohp' },
  'db-press': { p: 'seatedPress' },
  'lateral-raise': { p: 'lateral', o: { kit: 'db' } },
  'bottle-lateral': { p: 'lateral', o: { kit: 'bottle' } },
  'cable-lateral': { p: 'cableLateral' },
  'rear-delt-fly': { p: 'rearFly' },
  'pike-push-up': { p: 'pike' },
  'feet-up-pike': { p: 'pike', o: { feet: 'box' } },
  'ez-curl': { p: 'curl', o: { kit: 'ez' } },
  'db-curl': { p: 'curl', o: { kit: 'db' } },
  'hammer-curl': { p: 'curl', o: { kit: 'db' } },
  'cable-curl': { p: 'curl', o: { kit: 'cable' } },
  'backpack-curl': { p: 'curl', o: { kit: 'pack' } },
  'reverse-curl': { p: 'curl', o: { kit: 'ez' } },
  'incline-curl': { p: 'inclineCurl' },
  'preacher-curl': { p: 'preacher' },
  pushdown: { p: 'pushdown' },
  'oh-cable-ext': { p: 'ohCableExt' },
  'db-oh-ext': { p: 'ohExt' },
  'skull-crusher': { p: 'skull' },
  'cg-bench': { p: 'bench', o: { kit: 'bb' } },
  'db-kickback': { p: 'kickbackArm' },
  'bench-dip': { p: 'benchDip' },
  squat: { p: 'squat', o: { kit: 'bb' } },
  'goblet-squat': { p: 'squat', o: { kit: 'goblet' } },
  'hack-squat': { p: 'hack' },
  'leg-press': { p: 'legPress' },
  'split-squat': { p: 'splitSquat' },
  'leg-ext': { p: 'legExt' },
  'step-up': { p: 'stepUp', secs: 3.4 },
  'reverse-lunge': { p: 'lunge', secs: 3.2 },
  'box-pistol': { p: 'boxPistol' },
  rdl: { p: 'hinge', o: { kit: 'bb' } },
  'db-rdl': { p: 'hinge', o: { kit: 'db' } },
  deadlift: { p: 'deadlift' },
  'sl-rdl': { p: 'slRdl' },
  'kb-swing': { p: 'kbSwing', secs: 1.8, fast: true },
  'leg-curl': { p: 'legCurl' },
  'slider-curl': { p: 'sliderCurl' },
  nordic: { p: 'nordic', secs: 3.6 },
  'hip-thrust': { p: 'hipThrust', o: { kit: 'bb' } },
  'db-hip-thrust': { p: 'hipThrust', o: { kit: 'db' } },
  'glute-bridge': { p: 'bridge' },
  'cable-kickback': { p: 'kickback' },
  'hip-abduction': { p: 'hipAbduction' },
  'standing-calf': { p: 'calf', o: { kit: 'machine' }, secs: 2.4 },
  'step-calf': { p: 'calf', o: { kit: 'step' }, secs: 2.4 },
  'seated-calf': { p: 'seatedCalf', secs: 2.4 },
  'cable-crunch': { p: 'cableCrunch' },
  crunch: { p: 'crunch', secs: 2.4 },
  'hanging-knee': { p: 'hangingKnee' },
  'dead-bug': { p: 'deadBug' },
  'reverse-crunch': { p: 'reverseCrunch' },
  'leg-raise': { p: 'legRaise' },
  plank: { p: 'plank', hold: true, secs: 4 },
  'wrist-curl': { p: 'wristCurl', secs: 2.2 },
  'farmer-hold': { p: 'farmer', hold: true, secs: 4 },
  'dead-hang': { p: 'hang', hold: true, secs: 4 },
  'towel-wring': { p: 'towel', secs: 2 },
};
