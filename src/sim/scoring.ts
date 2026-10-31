import { SCORE } from '../config.js';

export function computeScore(eggs: number, time: number): number {
  return eggs * SCORE.perEgg + Math.floor(time) * SCORE.perSecond;
}
