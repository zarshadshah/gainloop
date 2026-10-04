// Drawing: the tape gauge (a strip of measuring tape with your reading and target on it)
// and the weight trend chart. No libraries.
import { addDays, daysBetween, esc, fmtDate } from './util.js';
import { trendAt } from './calc.js';

const pct = (v, lo, hi) => `${(((v - lo) / (hi - lo)) * 100).toFixed(3)}%`;

// A segment of tape measure. Values in display units (cm, in or kg).
export function tapeHTML({ current, target, unit, label, minorStep, majorEvery, padLo, padHi }) {
  const isIn = unit === 'in';
  const minor = minorStep ?? (isIn ? 0.25 : 0.5);
  const both = [current, target].filter((v) => Number.isFinite(v));
  if (!both.length) return '';
  const lo = Math.floor(Math.min(...both) - (padLo ?? (isIn ? 0.75 : 2)));
  const hi = Math.ceil(Math.max(...both) + (padHi ?? (isIn ? 0.5 : 1)));
  const span = hi - lo;
  const every = majorEvery ?? (span <= 12 ? 1 : span <= 24 ? 2 : 5);
  const ticks = [];
  const n = Math.round(span / minor);
  for (let i = 0; i <= n; i += 1) {
    const v = lo + i * minor;
    const whole = Math.abs(v - Math.round(v)) < 1e-6;
    const major = whole && Math.round(v) % every === 0;
    const mid = !major && whole && minor < 1;
    if (v <= lo + 1e-6 || v >= hi - 1e-6) continue;
    ticks.push(`<span class="tick${major ? ' major' : mid ? ' mid' : ''}" style="left:${pct(v, lo, hi)}"></span>`);
    if (major) ticks.push(`<span class="tick-num" style="left:${pct(v, lo, hi)}">${Math.round(v)}</span>`);
  }
  const fill = Number.isFinite(current) ? `<span class="tape-fill" style="width:${pct(Math.min(current, hi), lo, hi)}"></span>` : '';
  const now = Number.isFinite(current) ? `<span class="tape-now" style="left:${pct(current, lo, hi)}"></span>` : '';
  const aim = Number.isFinite(target) ? `<span class="tape-target" style="left:${pct(target, lo, hi)}"></span>` : '';
  return `<div class="tape" role="img" aria-label="${esc(label)}">${fill}${ticks.join('')}${now}${aim}</div>`;
}

// ---------- Weight chart ----------

function niceStep(range) {
  const candidates = [0.2, 0.5, 1, 2, 5, 10];
  for (const c of candidates) if (range / c <= 4) return c;
  return 20;
}

export function drawWeightChart(el, weights, { today, toDisplay, fmt, unitLabel, days = 56 }) {
  const sorted = [...weights].filter((w) => w.d <= today).sort((a, b) => (a.d < b.d ? -1 : 1));
  if (sorted.length < 2) {
    el.innerHTML = '<p class="empty">Weigh in on two or more days to see your trend here.</p>';
    return;
  }
  const first = sorted[0].d;
  const start = daysBetween(first, today) > days - 1 ? addDays(today, -(days - 1)) : first;
  const total = Math.max(1, daysBetween(start, today));
  const pts = sorted.filter((w) => w.d >= start);
  const byDay = new Map(pts.map((w) => [w.d, w.kg]));
  const trend = [];
  for (let i = 0; i <= total; i += 1) {
    const d = addDays(start, i);
    const t = trendAt(sorted, d);
    if (t) trend.push({ d, v: toDisplay(t.kg), kg: t.kg });
  }

  const W = Math.max(280, Math.round(el.clientWidth || 340));
  const H = 188;
  const pad = { l: 38, r: 14, t: 16, b: 28 };
  const values = [...pts.map((p) => toDisplay(p.kg)), ...trend.map((t) => t.v)];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1) { const mid = (max + min) / 2; min = mid - 0.5; max = mid + 0.5; }
  const step = niceStep(max - min);
  const y0 = Math.floor(min / step) * step;
  const y1 = Math.ceil(max / step) * step;
  const x = (d) => pad.l + (daysBetween(start, d) / total) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b);

  const grid = [];
  for (let v = y0; v <= y1 + 1e-9; v += step) {
    const yy = y(v).toFixed(1);
    grid.push(`<line x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}" class="grid"/>`);
    grid.push(`<text x="${pad.l - 6}" y="${yy}" class="axis" text-anchor="end" dominant-baseline="middle">${+v.toFixed(1)}</text>`);
  }
  const xTicks = [];
  const tickCount = W < 360 ? 3 : 4;
  for (let i = 0; i < tickCount; i += 1) {
    const d = addDays(start, Math.round((total * i) / (tickCount - 1)));
    const anchor = i === 0 ? 'start' : i === tickCount - 1 ? 'end' : 'middle';
    xTicks.push(`<text x="${x(d).toFixed(1)}" y="${H - 8}" class="axis" text-anchor="${anchor}">${fmtDate(d, 'day')}</text>`);
  }
  const dots = pts.map((p) => `<circle cx="${x(p.d).toFixed(1)}" cy="${y(toDisplay(p.kg)).toFixed(1)}" r="3" class="dot"/>`).join('');
  const line = trend.map((t, i) => `${i ? 'L' : 'M'}${x(t.d).toFixed(1)},${y(t.v).toFixed(1)}`).join('');
  const area = trend.length > 1 ? `${line}L${x(trend[trend.length - 1].d).toFixed(1)},${y(y0).toFixed(1)}L${x(trend[0].d).toFixed(1)},${y(y0).toFixed(1)}Z` : '';
  const last = trend[trend.length - 1];
  const endX = x(last.d);
  const endY = y(last.v);

  el.innerHTML = `
    <svg class="wchart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      ${grid.join('')}
      <path d="${area}" class="area"/>
      ${dots}
      <path d="${line}" class="trend"/>
      <line class="cross" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}" visibility="hidden"/>
      <circle class="cross-dot" r="5" visibility="hidden"/>
      <circle cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="5" class="end"/>
      <text x="${endX.toFixed(1)}" y="${(endY - 12).toFixed(1)}" class="end-label" text-anchor="end">${esc(fmt(last.kg))}</text>
      ${xTicks.join('')}
      <text x="${pad.l}" y="${pad.t - 5}" class="axis">${esc(unitLabel)}</text>
    </svg>
    <div class="chart-tip" hidden></div>`;

  const svg = el.querySelector('svg');
  const tip = el.querySelector('.chart-tip');
  const cross = svg.querySelector('.cross');
  const crossDot = svg.querySelector('.cross-dot');
  let idx = trend.length - 1;

  const show = (i) => {
    idx = Math.max(0, Math.min(trend.length - 1, i));
    const t = trend[idx];
    const cx = x(t.d);
    cross.setAttribute('x1', cx);
    cross.setAttribute('x2', cx);
    cross.setAttribute('visibility', 'visible');
    crossDot.setAttribute('cx', cx);
    crossDot.setAttribute('cy', y(t.v));
    crossDot.setAttribute('visibility', 'visible');
    const weighed = byDay.get(t.d);
    tip.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'tip-date';
    head.textContent = fmtDate(t.d);
    const avg = document.createElement('div');
    avg.innerHTML = '<span class="tip-key"></span><strong></strong> 7-day average';
    avg.querySelector('strong').textContent = fmt(t.kg);
    tip.append(head, avg);
    if (weighed !== undefined) {
      const w = document.createElement('div');
      w.innerHTML = '<span class="tip-key dotkey"></span><strong></strong> weighed';
      w.querySelector('strong').textContent = fmt(weighed);
      tip.append(w);
    }
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = `${Math.min(W - tw, Math.max(0, cx - tw / 2))}px`;
  };
  const hide = () => {
    cross.setAttribute('visibility', 'hidden');
    crossDot.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  };
  const nearest = (clientX) => {
    const r = svg.getBoundingClientRect();
    const px = clientX - r.left;
    let best = 0;
    let bestD = Infinity;
    trend.forEach((t, i) => {
      const dd = Math.abs(x(t.d) - px);
      if (dd < bestD) { bestD = dd; best = i; }
    });
    return best;
  };
  svg.addEventListener('pointermove', (e) => show(nearest(e.clientX)));
  svg.addEventListener('pointerdown', (e) => show(nearest(e.clientX)));
  svg.addEventListener('pointerleave', hide);
  el.onkeydown = (e) => {
    if (e.key === 'ArrowLeft') { show(idx - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { show(idx + 1); e.preventDefault(); }
    if (e.key === 'Escape') hide();
  };
  el.onfocus = () => show(idx);
  el.onblur = hide;
}
