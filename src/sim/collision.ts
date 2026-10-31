import { ARENA } from '../config.js';
import { add, clamp, len, scale, type Vec } from '../core/vec.js';
import { resolveCircleRect } from './geometry.js';
import type { Obstacle } from './types.js';

/** Keep a circle inside the arena bounds. */
export function clampToArena(p: Vec, r: number): Vec {
  return { x: clamp(p.x, r, ARENA.width - r), y: clamp(p.y, r, ARENA.height - r) };
}

/**
 * Move a circle by `delta`, sub-stepping so it can never tunnel through an obstacle,
 * and sliding along surfaces it hits.
 */
export function moveCircle(
  pos: Vec,
  delta: Vec,
  r: number,
  obstacles: readonly Obstacle[],
): Vec {
  const steps = Math.max(1, Math.ceil(len(delta) / (r * 0.5)));
  const stepDelta = scale(delta, 1 / steps);
  let p = pos;
  for (let i = 0; i < steps; i++) {
    p = add(p, stepDelta);
    for (const o of obstacles) p = resolveCircleRect(p, r, o);
    p = clampToArena(p, r);
  }
  return p;
}
