import { BANK, MODES, SCORE } from '../config.js';
import type { World } from './types.js';

/** What banking a trail of `n` ducklings pays: grows faster than the chain length. */
export function bankValue(n: number): number {
  return Math.round(BANK.base * n * (1 + BANK.growth * n));
}

/** Classic score: eggs plus survival time. */
export function computeScore(eggs: number, time: number): number {
  return eggs * SCORE.perEgg + Math.floor(time) * SCORE.perSecond;
}

/** Duckling Dash score: whatever was banked, plus survival time. Unbanked ducklings are worth nothing. */
export function bankedScore(banked: number, time: number): number {
  return banked + Math.floor(time) * SCORE.perSecond;
}

/** Score for a world under its own rules. Rush pays eggs, plus a bonus for lasting to the buzzer. */
export function scoreOf(
  w: Pick<World, 'rules' | 'eggsCollected' | 'banked' | 'time' | 'status'>,
): number {
  if (w.rules.scoring === 'rush') {
    return w.eggsCollected * SCORE.perEgg + (w.status === 'timeUp' ? MODES.rush.clutchBonus : 0);
  }
  return w.rules.ducklings ? bankedScore(w.banked, w.time) : computeScore(w.eggsCollected, w.time);
}
