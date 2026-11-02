import { CYCLE, MODES } from '../config.js';
import { clamp } from '../core/vec.js';
import type { RunRules } from './rules.js';

/** Night begins once day and dusk have passed. */
const NIGHTFALL = CYCLE.daySec + CYCLE.duskSec;
/** One full day → dusk → night cycle. */
const PERIOD = NIGHTFALL + CYCLE.nightSec;

/** Seconds into the current cycle. */
function phaseOf(time: number): number {
  return time - Math.floor(time / PERIOD) * PERIOD;
}

/** Whether the run is in night at `time`: always for night levels, in phases for Classic. */
export function isNightAt(rules: RunRules, time: number): boolean {
  return rules.night || (rules.dayNight && phaseOf(time) >= NIGHTFALL);
}

export interface SenseFactors {
  readonly cone: number;
  readonly hear: number;
}

/** The gator's sight and hearing multipliers at `time`. Dusk still counts as day. */
export function senseFactors(rules: RunRules, time: number): SenseFactors {
  if (rules.dayNight && !rules.night && isNightAt(rules, time)) {
    return { cone: MODES.night.coneRangeFactor, hear: MODES.night.hearFactor };
  }
  return { cone: rules.coneRangeFactor, hear: rules.hearFactor };
}

/**
 * Render-only fog strength 0..1: rising through dusk, full at night, then lifting over the first
 * `duskSec` of the next day.
 */
export function fogAlpha(rules: RunRules, time: number): number {
  if (rules.night) return 1;
  if (!rules.dayNight) return 0;
  const p = phaseOf(time);
  if (p >= NIGHTFALL) return 1;
  const dusk = clamp((p - CYCLE.daySec) / CYCLE.duskSec, 0, 1);
  const dawn = time >= PERIOD ? clamp(1 - p / CYCLE.duskSec, 0, 1) : 0;
  return Math.max(dusk, dawn);
}

/** Seconds until day breaks, or null while it's day or the rules don't cycle. */
export function secondsToDawn(rules: RunRules, time: number): number | null {
  if (!rules.dayNight || rules.night || !isNightAt(rules, time)) return null;
  return PERIOD - phaseOf(time);
}

/** Seconds until night falls, or null while it's night or the rules don't cycle. */
export function secondsToNight(rules: RunRules, time: number): number | null {
  if (!rules.dayNight || rules.night || isNightAt(rules, time)) return null;
  return NIGHTFALL - phaseOf(time);
}
