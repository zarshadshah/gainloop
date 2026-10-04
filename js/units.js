// Everything is stored in cm and kg. These helpers convert for display and input.
import { round } from './util.js';

export const CM_PER_IN = 2.54;
export const LB_PER_KG = 2.2046226218;

export const parseNum = (value) => {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// ---- Length ----
export const lenFromCm = (cm, unit) => (unit === 'in' ? cm / CM_PER_IN : cm);
export const lenToCm = (v, unit) => (unit === 'in' ? v * CM_PER_IN : v);
export const lenUnitLabel = (unit) => (unit === 'in' ? 'in' : 'cm');

const trimZero = (s) => s.replace(/\.0$/, '');

export const fmtLenNum = (cm, unit, dp = 1) => trimZero(round(lenFromCm(cm, unit), dp).toFixed(dp));
export const fmtLen = (cm, unit, dp = 1) => `${fmtLenNum(cm, unit, dp)} ${lenUnitLabel(unit)}`;
export const fmtLenDelta = (cmDelta, unit, dp = 1) => {
  const v = round(lenFromCm(cmDelta, unit), dp);
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${trimZero(Math.abs(v).toFixed(dp))} ${lenUnitLabel(unit)}`;
};

export const fmtHeight = (cm, unit) => {
  if (unit !== 'in') return `${Math.round(cm)} cm`;
  const totalIn = cm / CM_PER_IN;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round(totalIn - ft * 12);
  if (inch === 12) { ft += 1; inch = 0; }
  return `${ft} ft ${inch} in`;
};

export const heightParts = (cm) => {
  const totalIn = cm / CM_PER_IN;
  let ft = Math.floor(totalIn / 12);
  let inch = round(totalIn - ft * 12, 1);
  if (inch >= 12) { ft += 1; inch = 0; }
  return { ft, inch };
};

// ---- Body weight: kg, stone or lb ----
export const kgToLb = (kg) => kg * LB_PER_KG;
export const lbToKg = (lb) => lb / LB_PER_KG;

export const stoneParts = (kg) => {
  const totalLb = kgToLb(kg);
  let st = Math.floor(totalLb / 14);
  let lb = round(totalLb - st * 14, 1);
  if (lb >= 14) { st += 1; lb = 0; }
  return { st, lb };
};

export const fmtBody = (kg, unit, dp = 1) => {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return '–';
  if (unit === 'lb') return `${trimZero(round(kgToLb(kg), dp).toFixed(dp))} lb`;
  if (unit === 'st') {
    const { st, lb } = stoneParts(kg);
    return `${st} st ${trimZero(lb.toFixed(1))} lb`;
  }
  return `${trimZero(round(kg, dp).toFixed(dp))} kg`;
};

export const fmtBodyDelta = (kgDelta, unit, dp = 1) => {
  const useLb = unit === 'lb' || unit === 'st';
  const v = round(useLb ? kgToLb(kgDelta) : kgDelta, dp);
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${trimZero(Math.abs(v).toFixed(dp))} ${useLb ? 'lb' : 'kg'}`;
};

// Number shown in a single-field body-weight input (kg or lb)
export const bodyInputValue = (kg, unit) => {
  if (kg === null || kg === undefined) return '';
  return unit === 'lb' ? String(round(kgToLb(kg), 1)) : String(round(kg, 1));
};

// ---- Lifting weights: kg or lb ----
export const liftFromKg = (kg, unit) => (unit === 'lb' ? kgToLb(kg) : kg);
export const liftToKg = (v, unit) => (unit === 'lb' ? lbToKg(v) : v);
export const fmtLift = (kg, unit) => {
  if (kg === null || kg === undefined) return '';
  const v = unit === 'lb' ? round(kgToLb(kg), 1) : round(kg, 2);
  return `${trimZero(String(v))} ${unit === 'lb' ? 'lb' : 'kg'}`;
};
export const liftInputValue = (kg, unit) => {
  if (kg === null || kg === undefined) return '';
  const v = unit === 'lb' ? round(kgToLb(kg), 1) : round(kg, 2);
  return trimZero(String(v));
};
