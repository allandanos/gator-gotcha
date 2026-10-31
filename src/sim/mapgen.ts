import { ARENA, DUCK, GATOR, MAP } from '../config.js';
import { hashSeed, Rng } from '../core/rng.js';
import { dist, type Vec } from '../core/vec.js';
import { circleIntersectsRect, rectsOverlap } from './geometry.js';
import { buildNav, cellOf, floodCount, freeCells } from './nav.js';
import type { GameMap, Obstacle } from './types.js';

function randomObstacle(rng: Rng): Obstacle {
  if (rng.chance(0.55)) {
    const length = rng.range(MAP.log.minLength, MAP.log.maxLength);
    const t = MAP.log.thickness;
    const horizontal = rng.chance(0.6);
    const w = horizontal ? length : t;
    const h = horizontal ? t : length;
    return { kind: 'log', x: rng.range(0, ARENA.width - w), y: rng.range(0, ARENA.height - h), w, h };
  }
  const w = rng.range(MAP.reeds.minSize, MAP.reeds.maxSize);
  const h = rng.range(MAP.reeds.minSize, MAP.reeds.maxSize);
  return { kind: 'reeds', x: rng.range(0, ARENA.width - w), y: rng.range(0, ARENA.height - h), w, h };
}

/** Obstacles keep a gator-sized gap from the arena walls. */
function fitsWalls(o: Obstacle): boolean {
  const g = MAP.minGap;
  return o.x >= g && o.y >= g && o.x + o.w <= ARENA.width - g && o.y + o.h <= ARENA.height - g;
}

function pickSpawns(rng: Rng): { duck: Vec; gator: Vec } {
  const margin = 120;
  const duck = { x: rng.range(margin, ARENA.width * 0.3), y: rng.range(margin, ARENA.height - margin) };
  for (;;) {
    const gator = {
      x: rng.range(ARENA.width * 0.65, ARENA.width - margin),
      y: rng.range(margin, ARENA.height - margin),
    };
    if (dist(duck, gator) >= MAP.minSpawnDistance) return { duck, gator };
  }
}

function placeObstacles(rng: Rng, spawns: readonly Vec[]): Obstacle[] {
  const out: Obstacle[] = [];
  for (let tries = 0; tries < MAP.maxPlacementTries && out.length < MAP.obstacleTarget; tries++) {
    const o = randomObstacle(rng);
    if (!fitsWalls(o)) continue;
    if (spawns.some((s) => circleIntersectsRect(s, MAP.spawnClearRadius, o))) continue;
    if (out.some((e) => rectsOverlap(e, o, MAP.minGap))) continue;
    out.push(o);
  }
  return out;
}

function isConnected(obstacles: readonly Obstacle[], from: Vec): boolean {
  const nav = buildNav(obstacles, GATOR.radius);
  return floodCount(nav, cellOf(nav, from)) === freeCells(nav).length;
}

/**
 * Generate a deterministic map for a seed. Obstacles are rejected if they would
 * leave any free area unreachable by the gator (and hence the duck, which is smaller).
 */
export function generateMap(seed: string): GameMap {
  const rng = new Rng(hashSeed(seed));
  for (let attempt = 0; attempt < MAP.maxRegenerations; attempt++) {
    const spawns = pickSpawns(rng);
    const obstacles = placeObstacles(rng, [spawns.duck, spawns.gator]);
    if (!isConnected(obstacles, spawns.gator)) continue;
    return {
      seed,
      obstacles,
      nav: buildNav(obstacles, GATOR.radius),
      duckSpawn: spawns.duck,
      gatorSpawn: spawns.gator,
    };
  }
  // Extremely unlikely: fall back to an empty swamp rather than fail.
  const spawns = pickSpawns(rng);
  return { seed, obstacles: [], nav: buildNav([], GATOR.radius), duckSpawn: spawns.duck, gatorSpawn: spawns.gator };
}

/** Whether a circle of radius r at p is clear of every obstacle. */
export function isOpen(map: GameMap, p: Vec, r: number = DUCK.radius): boolean {
  return !map.obstacles.some((o) => circleIntersectsRect(p, r, o));
}
