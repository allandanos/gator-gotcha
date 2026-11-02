import type { GatorMode } from '../sim/types';
import { DEATHCAM_FRAMES, DEATHCAM_SECONDS, DEATHCAM_SPEED } from './feel';

/** The death cam's footage source: the last few seconds of sim worlds, stored by reference. */
export function pushFrame<T>(frames: readonly T[], frame: T, cap = DEATHCAM_FRAMES): readonly T[] {
  return frames.length < cap
    ? [...frames, frame]
    : [...frames.slice(frames.length - cap + 1), frame];
}

/** The frame where the gator last switched into chase, or null if it never did inside the buffer. */
export function spottedIndex(
  frames: readonly { readonly gator: { readonly mode: GatorMode } }[],
): number | null {
  for (let i = frames.length - 1; i > 0; i--) {
    if (frames[i]?.gator.mode === 'chase' && frames[i - 1]?.gator.mode !== 'chase') return i;
  }
  return null;
}

/** Seconds of wall time the death cam runs: slowed footage, or a held still frame. */
export function deathcamDuration(
  count: number,
  still: boolean,
  hz = DEATHCAM_FRAMES / DEATHCAM_SECONDS,
): number {
  return still ? DEATHCAM_SECONDS : count / hz / DEATHCAM_SPEED;
}

export interface DeathcamFrame {
  readonly index: number;
  /** Interpolation towards `index + 1`. */
  readonly alpha: number;
}

/** Which buffered frame to show `elapsed` seconds into the death cam. */
export function deathcamFrame(
  count: number,
  elapsed: number,
  still: boolean,
  spotted: number | null,
  hz = DEATHCAM_FRAMES / DEATHCAM_SECONDS,
): DeathcamFrame {
  const last = Math.max(0, count - 1);
  if (still) return { index: spotted ?? last, alpha: 0 };
  const pos = elapsed * DEATHCAM_SPEED * hz;
  const index = Math.floor(pos);
  return index >= last ? { index: last, alpha: 0 } : { index, alpha: pos - index };
}
