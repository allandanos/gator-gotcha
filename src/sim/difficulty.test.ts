import { DUCK, GATOR } from '../config.js';
import { difficultyLevel, gatorStats } from './difficulty.js';
import { computeScore } from './scoring.js';

describe('difficulty', () => {
  it('ramps monotonically with time and eggs, and caps', () => {
    expect(difficultyLevel(0, 0)).toBe(0);
    expect(difficultyLevel(30, 0)).toBeLessThan(difficultyLevel(60, 0));
    expect(difficultyLevel(30, 0)).toBeLessThan(difficultyLevel(30, 5));
    expect(difficultyLevel(10_000, 1000)).toBe(1);
  });

  it('keeps max gator speed below duck sprint speed', () => {
    const s = gatorStats(1e6, 1e6);
    expect(s.speed).toBe(GATOR.maxSpeed);
    expect(s.speed).toBeLessThan(DUCK.sprintSpeed);
    expect(s.coneRange).toBe(GATOR.coneRangeMax);
  });

  it('scores eggs and whole seconds', () => {
    expect(computeScore(3, 12.9)).toBe(3 * 100 + 12 * 10);
  });
});
