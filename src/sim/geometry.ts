import { clamp, type Vec } from '../core/vec';
import type { Obstacle } from './types';

export function circleIntersectsRect(c: Vec, r: number, o: Obstacle): boolean {
  const nx = clamp(c.x, o.x, o.x + o.w);
  const ny = clamp(c.y, o.y, o.y + o.h);
  return (c.x - nx) ** 2 + (c.y - ny) ** 2 < r * r;
}

/** Push a circle out of a rectangle along the shortest axis. Returns the corrected center. */
export function resolveCircleRect(c: Vec, r: number, o: Obstacle): Vec {
  const nx = clamp(c.x, o.x, o.x + o.w);
  const ny = clamp(c.y, o.y, o.y + o.h);
  const dx = c.x - nx;
  const dy = c.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return c;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { x: nx + (dx / d) * r, y: ny + (dy / d) * r };
  }
  // Center is inside the rect: exit through the nearest edge.
  const left = c.x - o.x;
  const right = o.x + o.w - c.x;
  const top = c.y - o.y;
  const bottom = o.y + o.h - c.y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: o.x - r, y: c.y };
  if (m === right) return { x: o.x + o.w + r, y: c.y };
  if (m === top) return { x: c.x, y: o.y - r };
  return { x: c.x, y: o.y + o.h + r };
}

/** Slab test: does segment a→b cross the rectangle? */
export function segmentIntersectsRect(a: Vec, b: Vec, o: Obstacle): boolean {
  return segmentEntryT(a, b, o) !== null;
}

/** Parametric t (0..1) where segment a→b first enters the rectangle, or null if it misses. */
export function segmentEntryT(a: Vec, b: Vec, o: Obstacle): number | null {
  let tMin = 0;
  let tMax = 1;
  const d = { x: b.x - a.x, y: b.y - a.y };
  const axes: Array<[number, number, number, number]> = [
    [a.x, d.x, o.x, o.x + o.w],
    [a.y, d.y, o.y, o.y + o.h],
  ];
  for (const [p, dp, lo, hi] of axes) {
    if (Math.abs(dp) < 1e-9) {
      if (p < lo || p > hi) return null;
      continue;
    }
    let t1 = (lo - p) / dp;
    let t2 = (hi - p) / dp;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }
  return tMin;
}

export function rectsOverlap(a: Obstacle, b: Obstacle, gap: number): boolean {
  return (
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap
  );
}
