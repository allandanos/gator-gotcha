import { SCORE } from '../config';

export function computeScore(eggs: number, time: number): number {
  return eggs * SCORE.perEgg + Math.floor(time) * SCORE.perSecond;
}
