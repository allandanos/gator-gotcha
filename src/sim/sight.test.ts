import { canSee, hasLineOfSight, inCone, rayDistance, visibleConePolygon, type Cone } from './sight';
import type { Obstacle } from './types';

const cone: Cone = { origin: { x: 0, y: 0 }, heading: 0, range: 300, angle: Math.PI / 2 };
const log: Obstacle = { kind: 'log', x: 100, y: -20, w: 30, h: 40 };

describe('sight', () => {
  it('sees a target in the cone with clear line of sight', () => {
    expect(canSee(cone, { x: 200, y: 50 }, [])).toBe(true);
  });

  it('is blocked by an obstacle', () => {
    expect(canSee(cone, { x: 200, y: 0 }, [log])).toBe(false);
    expect(hasLineOfSight({ x: 0, y: 0 }, { x: 200, y: 0 }, [log])).toBe(false);
  });

  it('does not see outside the angle or range', () => {
    expect(inCone(cone, { x: 100, y: 150 })).toBe(false);
    expect(inCone(cone, { x: -200, y: 0 })).toBe(false);
    expect(inCone(cone, { x: 301, y: 0 })).toBe(false);
  });

  it('senses very close targets behind it', () => {
    expect(inCone(cone, { x: -40, y: 0 })).toBe(true);
  });

  it('measures ray distance to the first obstacle', () => {
    expect(rayDistance({ x: 0, y: 0 }, 0, 300, [log])).toBeCloseTo(100);
    expect(rayDistance({ x: 0, y: 0 }, Math.PI, 300, [log])).toBeCloseTo(300);
  });

  it('builds a clipped cone polygon', () => {
    const poly = visibleConePolygon(cone, [log], 8);
    expect(poly).toHaveLength(10);
    expect(poly[0]).toEqual(cone.origin);
  });
});
