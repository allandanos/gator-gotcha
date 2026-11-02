import { DIFFICULTY, GATOR } from '../config.js';
import { clamp, lerp } from '../core/vec.js';
import { CLASSIC, type RunRules } from './rules.js';

export interface GatorStats {
  readonly level: number;
  readonly speed: number;
  readonly coneRange: number;
  readonly coneAngle: number;
  /** How far an egg-pickup splash carries. */
  readonly hearRadius: number;
}

/** Difficulty 0..1 from elapsed time and eggs collected. */
export function difficultyLevel(time: number, eggs: number, startLevel = 0): number {
  return clamp(startLevel + time / DIFFICULTY.timeToMax + eggs * DIFFICULTY.perEgg, 0, 1);
}

/** `carried` ducklings count as eggs on top of those collected: a long trail raises the heat. */
export function gatorStats(
  time: number,
  eggs: number,
  rules: RunRules = CLASSIC,
  carried = 0,
): GatorStats {
  const level = difficultyLevel(time, eggs + carried, rules.startLevel);
  return {
    level,
    speed: lerp(GATOR.baseSpeed, GATOR.maxSpeed, level),
    coneRange: lerp(GATOR.coneRangeMin, GATOR.coneRangeMax, level) * rules.coneRangeFactor,
    coneAngle: lerp(GATOR.coneAngleMin, GATOR.coneAngleMax, level),
    hearRadius: GATOR.splashHearRadius * rules.hearFactor,
  };
}
