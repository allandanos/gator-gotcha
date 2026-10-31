import { datan2, dcos, dhypot, dsin } from './dmath.js';

export interface Vec {
  readonly x: number;
  readonly y: number;
}

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const len = (a: Vec): number => dhypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => dhypot(a.x - b.x, a.y - b.y);
export const fromAngle = (a: number, l = 1): Vec => ({ x: dcos(a) * l, y: dsin(a) * l });
export const angleOf = (a: Vec): number => datan2(a.y, a.x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function normalize(a: Vec): Vec {
  const l = len(a);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

/** Clamp vector length to at most `max`. */
export function limit(a: Vec, max: number): Vec {
  const l = len(a);
  return l > max ? scale(a, max / l) : a;
}

/** Signed smallest difference b - a, in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Rotate angle `from` toward `to` by at most `maxStep`. */
export function turnToward(from: number, to: number, maxStep: number): number {
  const d = angleDiff(from, to);
  return Math.abs(d) <= maxStep ? to : from + Math.sign(d) * maxStep;
}
