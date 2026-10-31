import { resolveCircleRect, segmentIntersectsRect } from './geometry.js';
import { moveCircle } from './collision.js';
import type { Obstacle } from './types.js';

const box: Obstacle = { kind: 'log', x: 100, y: 100, w: 100, h: 40 };

describe('geometry & collision', () => {
  it('pushes a circle out of a rect', () => {
    const p = resolveCircleRect({ x: 150, y: 95 }, 10, box);
    expect(p.y).toBeCloseTo(90);
    const inside = resolveCircleRect({ x: 105, y: 120 }, 10, box);
    expect(inside.x).toBeCloseTo(90);
  });

  it('exits through each nearest edge when the center is inside', () => {
    expect(resolveCircleRect({ x: 195, y: 120 }, 10, box).x).toBeCloseTo(210);
    expect(resolveCircleRect({ x: 150, y: 102 }, 10, box).y).toBeCloseTo(90);
    expect(resolveCircleRect({ x: 150, y: 138 }, 10, box).y).toBeCloseTo(150);
  });

  it('detects segment intersections including axis-parallel segments', () => {
    expect(segmentIntersectsRect({ x: 0, y: 120 }, { x: 300, y: 120 }, box)).toBe(true);
    expect(segmentIntersectsRect({ x: 0, y: 0 }, { x: 300, y: 0 }, box)).toBe(false);
    expect(segmentIntersectsRect({ x: 150, y: 0 }, { x: 150, y: 300 }, box)).toBe(true);
    expect(segmentIntersectsRect({ x: 50, y: 0 }, { x: 50, y: 300 }, box)).toBe(false);
  });

  it('does not tunnel through a thin obstacle at high speed', () => {
    const wall: Obstacle = { kind: 'log', x: 300, y: 0, w: 10, h: 1000 };
    const p = moveCircle({ x: 250, y: 500 }, { x: 400, y: 0 }, 16, [wall]);
    expect(p.x).toBeLessThanOrEqual(284 + 1e-6);
  });

  it('keeps circles inside the arena', () => {
    const p = moveCircle({ x: 20, y: 20 }, { x: -100, y: -100 }, 16, []);
    expect(p).toEqual({ x: 16, y: 16 });
  });
});
