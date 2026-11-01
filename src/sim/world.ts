import { DUCK, EGGS, GATOR, ARENA } from '../config.js';
import { hashSeed, Rng } from '../core/rng.js';
import { angleOf, dist, sub, type Vec } from '../core/vec.js';
import { gatorStats } from './difficulty.js';
import { createDuck, updateDuck } from './duck.js';
import { createGator, snoutOf, updateGator } from './gator.js';
import { generateMap, isOpen } from './mapgen.js';
import { CLASSIC, type RunRules } from './rules.js';
import type { Egg, GameEvent, GameMap, InputState, RunStatus, World } from './types.js';

const EGG_SPAWN_TRIES = 200;
const EGG_MIN_SPACING = 80;
const EGG_WALL_MARGIN = 40;

function spawnEgg(
  rng: Rng,
  map: GameMap,
  id: number,
  duck: Vec,
  gator: Vec,
  others: readonly Egg[],
): Egg {
  let pos: Vec = map.duckSpawn;
  for (let i = 0; i < EGG_SPAWN_TRIES; i++) {
    pos = {
      x: rng.range(EGG_WALL_MARGIN, ARENA.width - EGG_WALL_MARGIN),
      y: rng.range(EGG_WALL_MARGIN, ARENA.height - EGG_WALL_MARGIN),
    };
    if (
      isOpen(map, pos, EGGS.radius + 8) &&
      dist(pos, duck) >= EGGS.minDistFromDuck &&
      dist(pos, gator) >= EGGS.minDistFromGator &&
      others.every((e) => dist(e.pos, pos) >= EGG_MIN_SPACING)
    ) {
      break;
    }
  }
  return { id, pos };
}

function refillEggs(
  rng: Rng,
  w: Pick<World, 'map' | 'rules' | 'duck' | 'gator' | 'eggs' | 'nextEggId'>,
) {
  const eggs = [...w.eggs];
  let nextEggId = w.nextEggId;
  while (eggs.length < w.rules.eggsOnField) {
    eggs.push(spawnEgg(rng, w.map, nextEggId++, w.duck.pos, w.gator.pos, eggs));
  }
  return { eggs, nextEggId };
}

export function createWorld(seed: string, rules: RunRules = CLASSIC): World {
  const map = generateMap(seed);
  const rng = new Rng(hashSeed(seed) ^ 0x9e3779b9);
  const duck = createDuck(map.duckSpawn);
  const gator = createGator(map.gatorSpawn, angleOf(sub(map.duckSpawn, map.gatorSpawn)));
  const base = { map, rules, duck, gator, eggs: [] as Egg[], nextEggId: 0 };
  const { eggs, nextEggId } = refillEggs(rng, base);
  return {
    ...base,
    eggs,
    nextEggId,
    rngState: rng.state,
    time: 0,
    eggsCollected: 0,
    timesSpotted: 0,
    status: 'playing',
    events: [],
  };
}

export function isCaught(duckPos: Vec, gator: World['gator']): boolean {
  return (
    dist(duckPos, snoutOf(gator)) < GATOR.catchRadius + DUCK.radius ||
    dist(duckPos, gator.pos) < GATOR.radius + DUCK.radius - 4
  );
}

function goalReached(rules: RunRules, time: number, eggs: number): boolean {
  const goal = rules.goal;
  if (!goal) return false;
  return (
    (goal.eggs === undefined || eggs >= goal.eggs) &&
    (goal.surviveSec === undefined || time >= goal.surviveSec)
  );
}

/** A catch beats the goal, and the goal beats the clock, when they land on the same tick. */
function endStatus(
  rules: RunRules,
  duckPos: Vec,
  gator: World['gator'],
  time: number,
  eggs: number,
): RunStatus {
  if (isCaught(duckPos, gator)) return 'caught';
  if (goalReached(rules, time, eggs)) return 'cleared';
  if (rules.timeLimit !== null && time >= rules.timeLimit) return 'timeUp';
  return 'playing';
}

/** Pure simulation step: returns a new world. */
export function step(w: World, input: InputState, dt: number): World {
  if (w.status !== 'playing') return w.events.length ? { ...w, events: [] } : w;
  const rng = new Rng(w.rngState);
  const events: GameEvent[] = [];

  const duck = updateDuck(w.duck, input, w.map.obstacles, dt);
  if (duck.sprinting && !w.duck.sprinting) events.push({ type: 'sprintStart' });

  const picked = w.eggs.filter((e) => dist(e.pos, duck.pos) < EGGS.radius + DUCK.radius);
  const remaining = w.eggs.filter((e) => !picked.includes(e));
  for (const e of picked) events.push({ type: 'pickup', pos: e.pos });
  const eggsCollected = w.eggsCollected + picked.length;
  const time = w.time + dt;

  const gatorResult = updateGator(w.gator, {
    duckPos: duck.pos,
    map: w.map,
    stats: gatorStats(time, eggsCollected, w.rules),
    rng,
    dt,
    splash: picked[0]?.pos ?? null,
  });
  events.push(...gatorResult.events);
  const gator = gatorResult.gator;

  const { eggs, nextEggId } = refillEggs(rng, {
    map: w.map,
    rules: w.rules,
    duck,
    gator,
    eggs: remaining,
    nextEggId: w.nextEggId,
  });

  const status = endStatus(w.rules, duck.pos, gator, time, eggsCollected);
  if (status === 'caught') events.push({ type: 'caught', pos: duck.pos });
  else if (status !== 'playing') events.push({ type: status });
  const timesSpotted =
    w.timesSpotted + gatorResult.events.filter((e) => e.type === 'spotted').length;

  return {
    ...w,
    rngState: rng.state,
    time,
    eggsCollected,
    timesSpotted,
    nextEggId,
    duck,
    gator,
    eggs,
    status,
    events,
  };
}
