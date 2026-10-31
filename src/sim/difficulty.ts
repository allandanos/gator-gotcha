import { DIFFICULTY, GATOR } from '../config';
import { clamp, lerp } from '../core/vec';

export interface GatorStats {
  readonly level: number;
  readonly speed: number;
  readonly coneRange: number;
  readonly coneAngle: number;
}

/** Difficulty 0..1 from elapsed time and eggs collected. */
export function difficultyLevel(time: number, eggs: number): number {
  return clamp(time / DIFFICULTY.timeToMax + eggs * DIFFICULTY.perEgg, 0, 1);
}

export function gatorStats(time: number, eggs: number): GatorStats {
  const level = difficultyLevel(time, eggs);
  return {
    level,
    speed: lerp(GATOR.baseSpeed, GATOR.maxSpeed, level),
    coneRange: lerp(GATOR.coneRangeMin, GATOR.coneRangeMax, level),
    coneAngle: lerp(GATOR.coneAngleMin, GATOR.coneAngleMax, level),
  };
}
