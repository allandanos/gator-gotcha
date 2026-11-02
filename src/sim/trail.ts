import { TRAIL } from '../config.js';
import { add, dist, fromAngle, normalize, scale, sub, type Vec } from '../core/vec.js';
import { clampToArena } from './collision.js';

/** Ducklings never leave the arena (they ignore obstacles: no physics). */
const DUCKLING_MARGIN = 10;

/** Enough history for the last duckling to look `TRAIL.lag` ticks back per place in line. */
export const HISTORY_LENGTH = TRAIL.max * TRAIL.lag + 1;

export function pushHistory(history: readonly Vec[], pos: Vec): Vec[] {
  return [pos, ...history.slice(0, HISTORY_LENGTH - 1)];
}

/** `p` moved onto the circle of radius `TRAIL.spacing` around `leader`, keeping its bearing. */
function atSpacing(p: Vec, leader: Vec, facing: number): Vec {
  const dir = normalize(sub(p, leader));
  const away = dir.x === 0 && dir.y === 0 ? fromAngle(facing + Math.PI) : dir;
  return add(leader, scale(away, TRAIL.spacing));
}

/**
 * One tick of following, no physics: each duckling steers for where the duck was
 * `TRAIL.lag × place` ticks ago, but only if that point is at least a spacing back from the
 * duckling ahead (otherwise it holds its ground). Then it is held exactly one spacing away.
 */
export function followTrail(
  ducklings: readonly Vec[],
  history: readonly Vec[],
  duckPos: Vec,
  facing: number,
): Vec[] {
  const out: Vec[] = [];
  let leader = duckPos;
  for (let i = 0; i < ducklings.length; i++) {
    const prev = ducklings[i] as Vec;
    // Until the history reaches back that far (just hatched), hold position.
    const target = history[(i + 1) * TRAIL.lag];
    const aim =
      target && dist(target, leader) >= TRAIL.spacing && dist(target, prev) < dist(leader, prev)
        ? target
        : prev;
    const p = clampToArena(atSpacing(aim, leader, facing), DUCKLING_MARGIN);
    out.push(p);
    leader = p;
  }
  return out;
}

/** Add up to `n` ducklings to the tail (capped at `TRAIL.max`), lined up behind it. */
export function hatchDucklings(
  ducklings: readonly Vec[],
  n: number,
  duckPos: Vec,
  facing: number,
): readonly Vec[] {
  const room = Math.min(n, TRAIL.max - ducklings.length);
  if (room <= 0) return ducklings;
  const out = [...ducklings];
  const back = fromAngle(facing + Math.PI, TRAIL.spacing);
  for (let i = 0; i < room; i++) {
    const tail = out[out.length - 1] ?? duckPos;
    out.push(clampToArena({ x: tail.x + back.x, y: tail.y + back.y }, DUCKLING_MARGIN));
  }
  return out;
}
