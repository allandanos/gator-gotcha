import { MODES, SCORE } from '../config.js';
import type { World } from './types.js';

export function computeScore(eggs: number, time: number): number {
  return eggs * SCORE.perEgg + Math.floor(time) * SCORE.perSecond;
}

/** Score for a world under its own rules. Rush pays eggs, plus a bonus for lasting to the buzzer. */
export function scoreOf(w: Pick<World, 'rules' | 'eggsCollected' | 'time' | 'status'>): number {
  if (w.rules.scoring === 'rush') {
    return w.eggsCollected * SCORE.perEgg + (w.status === 'timeUp' ? MODES.rush.clutchBonus : 0);
  }
  return computeScore(w.eggsCollected, w.time);
}
