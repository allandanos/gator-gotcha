import { GATOR } from '../config';
import { angleDiff, angleOf, dist, fromAngle, sub, type Vec } from '../core/vec';
import { segmentEntryT, segmentIntersectsRect } from './geometry';
import type { Obstacle } from './types';

export interface Cone {
  readonly origin: Vec;
  readonly heading: number;
  readonly range: number;
  /** Full cone angle in radians. */
  readonly angle: number;
}

export function hasLineOfSight(a: Vec, b: Vec, obstacles: readonly Obstacle[]): boolean {
  return !obstacles.some((o) => segmentIntersectsRect(a, b, o));
}

export function inCone(cone: Cone, p: Vec): boolean {
  const d = dist(cone.origin, p);
  if (d > cone.range) return false;
  if (d <= GATOR.proximitySense) return true;
  return Math.abs(angleDiff(cone.heading, angleOf(sub(p, cone.origin)))) <= cone.angle / 2;
}

export function canSee(cone: Cone, p: Vec, obstacles: readonly Obstacle[]): boolean {
  return inCone(cone, p) && hasLineOfSight(cone.origin, p, obstacles);
}

/** Distance a ray travels from `origin` before hitting an obstacle, capped at `maxLen`. */
export function rayDistance(origin: Vec, angle: number, maxLen: number, obstacles: readonly Obstacle[]): number {
  const d = fromAngle(angle, maxLen);
  const end = { x: origin.x + d.x, y: origin.y + d.y };
  let best = 1;
  for (const o of obstacles) {
    const t = segmentEntryT(origin, end, o);
    if (t !== null && t < best) best = t;
  }
  return best * maxLen;
}

/** Polygon outline of what the gator can actually see (cone clipped by obstacles). */
export function visibleConePolygon(cone: Cone, obstacles: readonly Obstacle[], rays = 40): Vec[] {
  const pts: Vec[] = [cone.origin];
  for (let i = 0; i <= rays; i++) {
    const a = cone.heading - cone.angle / 2 + (cone.angle * i) / rays;
    const r = rayDistance(cone.origin, a, cone.range, obstacles);
    const o = fromAngle(a, r);
    pts.push({ x: cone.origin.x + o.x, y: cone.origin.y + o.y });
  }
  return pts;
}
