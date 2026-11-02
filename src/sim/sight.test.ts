import { TRAIL } from '../config.js';
import {
  canSee,
  hasLineOfSight,
  inCone,
  rayDistance,
  spotsDuck,
  visibleConePolygon,
  visibleTail,
  type Cone,
} from './sight.js';
import type { Obstacle } from './types.js';

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

describe('trail visibility', () => {
  const trail = (n: number) => Array.from({ length: n }, (_, i) => ({ x: -50 - i * 22, y: 0 }));

  it('exposes the tail only from TRAIL.visibleFrom ducklings on', () => {
    expect(visibleTail([])).toBeNull();
    expect(visibleTail(trail(TRAIL.visibleFrom - 1))).toBeNull();
    expect(visibleTail(trail(TRAIL.visibleFrom))).toEqual(trail(TRAIL.visibleFrom).at(-1));
  });

  it('spots a hidden duck through its visible tail, but not a short trail', () => {
    const hiddenDuck = { x: 200, y: 0 }; // behind the log
    const tail = { x: 200, y: 60 }; // in the cone, clear line
    expect(spotsDuck(cone, hiddenDuck, null, [log])).toBe(false);
    expect(spotsDuck(cone, hiddenDuck, tail, [log])).toBe(true);
    expect(spotsDuck(cone, { x: 200, y: 50 }, null, [log])).toBe(true);
  });

  it('cannot see a tail that is itself behind cover', () => {
    expect(spotsDuck(cone, { x: 200, y: 0 }, { x: 210, y: 0 }, [log])).toBe(false);
  });
});
