import { angleDiff, limit, normalize, turnToward, len } from './vec.js';

describe('vec', () => {
  it('normalizes and handles zero', () => {
    expect(len(normalize({ x: 3, y: 4 }))).toBeCloseTo(1);
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('limits length', () => {
    expect(len(limit({ x: 30, y: 40 }, 5))).toBeCloseTo(5);
    expect(limit({ x: 1, y: 0 }, 5)).toEqual({ x: 1, y: 0 });
  });

  it('computes wrapped angle differences', () => {
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(angleDiff(0, -0.5)).toBeCloseTo(-0.5);
  });

  it('turns toward a target by at most the step', () => {
    expect(turnToward(0, 1, 0.25)).toBeCloseTo(0.25);
    expect(turnToward(0, 0.1, 0.25)).toBeCloseTo(0.1);
    expect(turnToward(0, -1, 0.25)).toBeCloseTo(-0.25);
  });
});
