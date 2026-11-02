import { DUCK, GATOR } from '../config.js';
import { difficultyLevel, gatorStats } from './difficulty.js';
import { rulesForMode } from './rules.js';
import { bankValue, computeScore, scoreOf } from './scoring.js';
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

  it('counts carried ducklings as eggs, so a long trail raises the pressure', () => {
    expect(gatorStats(30, 2, undefined, 6).level).toBeCloseTo(gatorStats(30, 8).level);
    expect(gatorStats(30, 2, undefined, 6).speed).toBeGreaterThan(gatorStats(30, 2).speed);
  });

  it('scores banked value and whole seconds', () => {
    expect(computeScore(560, 12.9)).toBe(560 + 12 * 10);
  });

  it('pays more per duckling the longer the banked chain (appendix values)', () => {
    expect([1, 3, 4, 6, 10, 12].map(bankValue)).toEqual([110, 390, 560, 960, 2000, 2640]);
  });

  it('scores rush runs on eggs plus a bonus for surviving the clock', () => {
    const w = createWorld('score', rulesForMode('rush'));
    expect(scoreOf({ ...w, eggsCollected: 4, time: 60 })).toBe(400);
    expect(scoreOf({ ...w, eggsCollected: 4, time: 90, status: 'timeUp' })).toBe(900);
    // Rush ignores the bank; Classic ignores raw eggs: only banked ducklings pay.
    expect(scoreOf({ ...w, eggsCollected: 4, banked: 560, time: 60 })).toBe(400);
    const c = createWorld('score');
    expect(scoreOf({ ...c, eggsCollected: 3, banked: 0, time: 12.9 })).toBe(120);
    expect(scoreOf({ ...c, eggsCollected: 3, banked: 390, time: 12.9 })).toBe(computeScore(390, 12.9));
  });
});
