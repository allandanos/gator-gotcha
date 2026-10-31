import { ARENA, GATOR, MAP } from '../config.js';
import { dist } from '../core/vec.js';
import { circleIntersectsRect, rectsOverlap } from './geometry.js';
import { generateMap } from './mapgen.js';
import { cellOf, floodCount, freeCells } from './nav.js';

describe('generateMap', () => {
  it('is deterministic per seed', () => {
    expect(generateMap('swamp1')).toEqual(generateMap('swamp1'));
    expect(generateMap('swamp1').obstacles).not.toEqual(generateMap('swamp2').obstacles);
  });

  it('keeps every free area reachable across 200 seeds', () => {
    for (let i = 0; i < 200; i++) {
      const m = generateMap(`s${i}`);
      expect(floodCount(m.nav, cellOf(m.nav, m.gatorSpawn))).toBe(freeCells(m.nav).length);
    }
  });

  it('places spawns clear of obstacles and far apart', () => {
    for (let i = 0; i < 50; i++) {
      const m = generateMap(`p${i}`);
      expect(dist(m.duckSpawn, m.gatorSpawn)).toBeGreaterThanOrEqual(MAP.minSpawnDistance);
      for (const o of m.obstacles) {
        expect(circleIntersectsRect(m.duckSpawn, MAP.spawnClearRadius, o)).toBe(false);
        expect(circleIntersectsRect(m.gatorSpawn, GATOR.radius, o)).toBe(false);
      }
    }
  });

  it('places a meaningful number of non-overlapping obstacles inside the arena', () => {
    const m = generateMap('layout');
    expect(m.obstacles.length).toBeGreaterThanOrEqual(8);
    m.obstacles.forEach((a, i) => {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x + a.w).toBeLessThanOrEqual(ARENA.width);
      m.obstacles.slice(i + 1).forEach((b) => expect(rectsOverlap(a, b, 0)).toBe(false));
    });
  });
});
