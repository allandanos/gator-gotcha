import { DUCK, GATOR } from '../config.js';
import { difficultyLevel, gatorStats } from './difficulty.js';
import { rulesForMode } from './rules.js';
import { computeScore, scoreOf } from './scoring.js';
import { createWorld } from './world.js';

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

  it('applies mode factors and the difficulty floor', () => {
    const classic = gatorStats(0, 0);
    expect(classic.hearRadius).toBe(GATOR.splashHearRadius);
    const night = gatorStats(0, 0, rulesForMode('night'));
    expect(night.coneRange).toBeCloseTo(classic.coneRange * 0.65);
    expect(night.hearRadius).toBeCloseTo(GATOR.splashHearRadius * 1.5);
    const rush = gatorStats(0, 0, rulesForMode('rush'));
    expect(rush.level).toBeCloseTo(0.2);
    expect(gatorStats(1e6, 1e6, rulesForMode('rush')).level).toBe(1);
  });

  it('scores eggs and whole seconds', () => {
    expect(computeScore(3, 12.9)).toBe(3 * 100 + 12 * 10);
  });

  it('scores rush runs on eggs plus a bonus for surviving the clock', () => {
    const w = createWorld('score', rulesForMode('rush'));
    expect(scoreOf({ ...w, eggsCollected: 4, time: 60 })).toBe(400);
    expect(scoreOf({ ...w, eggsCollected: 4, time: 90, status: 'timeUp' })).toBe(900);
    const c = createWorld('score');
    expect(scoreOf({ ...c, eggsCollected: 3, time: 12.9 })).toBe(computeScore(3, 12.9));
  });
});
