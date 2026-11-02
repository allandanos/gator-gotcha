import { DUCK, GATOR } from '../config';
import { dist, type Vec } from '../core/vec';
import { snoutOf } from '../sim/gator';
import type { GatorMode, RunStatus } from '../sim/types';

/** The slice of a World the run stats read. */
export interface RunStatsWorld {
  readonly duck: { readonly pos: Vec };
  readonly gator: { readonly pos: Vec; readonly heading: number; readonly mode: GatorMode };
  readonly time: number;
  readonly eggsCollected: number;
  readonly timesSpotted: number;
  readonly status: RunStatus;
}

export interface RunStats {
  /** Seconds the gator was not chasing. */
  readonly unseenSec: number;
  /** Smallest gap between the duck and the jaws while alive, in world units; Infinity until seen. */
  readonly closest: number;
  readonly spotted: number;
  readonly eggs: number;
  readonly sec: number;
}

export const EMPTY_RUN_STATS: RunStats = {
  unseenSec: 0,
  closest: Infinity,
  spotted: 0,
  eggs: 0,
  sec: 0,
};

const CATCH_GAP = GATOR.catchRadius + DUCK.radius;

/** Fold one sim step into the stats. */
export function addTick(s: RunStats, w: RunStatsWorld, dt: number): RunStats {
  const gap = Math.max(0, dist(w.duck.pos, snoutOf(w.gator)) - CATCH_GAP);
  return {
    unseenSec: s.unseenSec + (w.gator.mode === 'chase' ? 0 : dt),
    closest: w.status === 'playing' ? Math.min(s.closest, gap) : s.closest,
    spotted: w.timesSpotted,
    eggs: w.eggsCollected,
    sec: w.time,
  };
}

/** The closest call in duck lengths, or null if the run never got going. */
export function closestDucks(s: RunStats): number | null {
  return Number.isFinite(s.closest) ? s.closest / (DUCK.radius * 2) : null;
}

export function eggsPerMinute(s: RunStats): number {
  return s.sec > 0 ? s.eggs / (s.sec / 60) : 0;
}
