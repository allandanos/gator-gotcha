import { DUCK, GATOR } from '../config';
import { dist, type Vec } from '../core/vec';
import { snoutOf } from '../sim/gator';
import type { RunStatus } from '../sim/types';
import { NEAR_MISS_MARGIN, NEAR_MISS_SURVIVE_TICKS } from './feel';

const THRESHOLD = GATOR.catchRadius + DUCK.radius + NEAR_MISS_MARGIN;

/** The slice of a World near-miss detection reads. */
export interface NearMissWorld {
  readonly duck: { readonly pos: Vec };
  readonly gator: { readonly pos: Vec; readonly heading: number };
  readonly status: RunStatus;
}

export interface NearMissState {
  /** Ticks survived since the close pass that is waiting to count, or null. */
  readonly pending: number | null;
  /** Whether the duck was inside the margin last tick; a new pass needs it to leave first. */
  readonly inside: boolean;
  readonly count: number;
  /** True only on the tick a near miss is confirmed. */
  readonly fired: boolean;
}

export const NEAR_MISS_START: NearMissState = {
  pending: null,
  inside: false,
  count: 0,
  fired: false,
};

/** Client-only, never scored: a close pass that the duck survives for NEAR_MISS_SURVIVE_TICKS. */
export function nearMisses(prev: NearMissState, next: NearMissWorld): NearMissState {
  const inside = dist(next.duck.pos, snoutOf(next.gator)) < THRESHOLD;
  if (next.status === 'caught') return { ...prev, pending: null, inside, fired: false };
  const entered = inside && !prev.inside;
  const pending = prev.pending !== null ? prev.pending + 1 : entered ? 0 : null;
  if (pending !== null && pending >= NEAR_MISS_SURVIVE_TICKS) {
    return { pending: null, inside, count: prev.count + 1, fired: true };
  }
  return { pending, inside, count: prev.count, fired: false };
}
