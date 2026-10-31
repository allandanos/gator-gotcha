import { GATOR, SIM_DT } from '../config';
import { Rng } from '../core/rng';
import { dist } from '../core/vec';
import { gatorStats } from './difficulty';
import { createGator, updateGator, type GatorContext } from './gator';
import { buildNav } from './nav';
import type { GameMap, Gator, Obstacle } from './types';

const mapWith = (obstacles: Obstacle[]): GameMap => ({
  seed: 't',
  obstacles,
  nav: buildNav(obstacles, GATOR.radius),
  duckSpawn: { x: 100, y: 100 },
  gatorSpawn: { x: 800, y: 500 },
});

const ctx = (map: GameMap, duckPos: GatorContext['duckPos'], extra: Partial<GatorContext> = {}): GatorContext => ({
  duckPos,
  map,
  stats: gatorStats(0, 0),
  rng: new Rng(1),
  dt: SIM_DT,
  splash: null,
  ...extra,
});

const ready = (g: Gator): Gator => ({ ...g, grace: 0 });

describe('gator AI', () => {
  const open = mapWith([]);

  it('does not see during spawn grace', () => {
    const g = createGator({ x: 800, y: 500 }, 0);
    const r = updateGator(g, ctx(open, { x: 900, y: 500 }));
    expect(r.gator.mode).toBe('wander');
  });

  it('switches wander → chase on sight and emits spotted', () => {
    const g = ready(createGator({ x: 800, y: 500 }, 0));
    const r = updateGator(g, ctx(open, { x: 950, y: 500 }));
    expect(r.gator.mode).toBe('chase');
    expect(r.events).toContainEqual({ type: 'spotted' });
  });

  it('moves toward the duck while chasing', () => {
    let g = ready(createGator({ x: 800, y: 500 }, 0));
    const duck = { x: 1000, y: 500 };
    const before = dist(g.pos, duck);
    for (let i = 0; i < 30; i++) g = updateGator(g, ctx(open, duck)).gator;
    expect(dist(g.pos, duck)).toBeLessThan(before);
  });

  it('switches chase → search when line of sight breaks', () => {
    const wall: Obstacle = { kind: 'log', x: 900, y: 300, w: 36, h: 400 };
    const map = mapWith([wall]);
    const chasing: Gator = { ...ready(createGator({ x: 800, y: 500 }, 0)), mode: 'chase', lastSeen: { x: 880, y: 500 } };
    const r = updateGator(chasing, ctx(map, { x: 1000, y: 500 }));
    expect(r.gator.mode).toBe('search');
    expect(r.gator.target).toEqual({ x: 880, y: 500 });
    expect(r.events).toContainEqual({ type: 'lost' });
  });

  it('returns to wander after sweeping the search point', () => {
    let g: Gator = {
      ...ready(createGator({ x: 800, y: 500 }, Math.PI)),
      mode: 'search',
      target: { x: 805, y: 500 },
      waitTimer: GATOR.searchSweepTime,
    };
    const hidden = { x: 100, y: 900 };
    for (let t = 0; t < GATOR.searchSweepTime + 0.5 && g.mode === 'search'; t += SIM_DT) {
      g = updateGator(g, ctx(open, hidden)).gator;
    }
    expect(g.mode).toBe('wander');
    expect(g.target).not.toBeNull();
  });

  it('investigates a nearby splash', () => {
    const g = ready(createGator({ x: 800, y: 500 }, 0));
    const r = updateGator(g, ctx(open, { x: 100, y: 100 }, { splash: { x: 700, y: 700 } }));
    expect(r.gator.mode).toBe('search');
    expect(r.gator.target).toEqual({ x: 700, y: 700 });
  });

  it('paths around an obstacle while wandering to a target', () => {
    const wall: Obstacle = { kind: 'log', x: 900, y: 200, w: 36, h: 600 };
    const map = mapWith([wall]);
    let g: Gator = { ...ready(createGator({ x: 800, y: 500 }, 0)), target: { x: 1100, y: 500 }, waitTimer: 99 };
    const hidden = { x: 100, y: 950 };
    for (let i = 0; i < 60 * 12; i++) g = updateGator(g, ctx(map, hidden)).gator;
    expect(g.pos.x).toBeGreaterThan(1000);
  });
});
