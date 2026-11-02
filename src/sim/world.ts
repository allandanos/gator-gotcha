import { ARENA, DUCK, EGGS, GATOR, GOLDEN, NEST, SNAP } from '../config.js';
import { hashSeed, Rng } from '../core/rng.js';
import { angleOf, dist, sub, type Vec } from '../core/vec.js';
import { gatorStats } from './difficulty.js';
import { createDuck, updateDuck } from './duck.js';
import { createGator, snoutOf, updateGator } from './gator.js';
import { generateMap, isOpen } from './mapgen.js';
import { CLASSIC, type RunRules } from './rules.js';
import { bankValue } from './scoring.js';
import { hasLineOfSight, visibleTail } from './sight.js';
import { followTrail, hatchDucklings, pushHistory } from './trail.js';
import type { Duck, Egg, GameEvent, InputState, RunStatus, World } from './types.js';

const EGG_SPAWN_TRIES = 200;
const EGG_MIN_SPACING = 80;
const EGG_WALL_MARGIN = 40;

function spawnEgg(
  rng: Rng,
  w: Pick<World, 'map' | 'rules'> & { readonly nest: Vec },
  id: number,
  duck: Vec,
  gator: Vec,
  others: readonly Egg[],
): Egg {
  const season1 = w.rules.ducklings;
  // Rolled only under Season 1 rules, so other modes draw exactly the same random numbers.
  const golden = season1 && !others.some((e) => e.golden) && rng.chance(GOLDEN.chance);
  let pos: Vec = w.map.duckSpawn;
  for (let i = 0; i < EGG_SPAWN_TRIES; i++) {
    pos = {
      x: rng.range(EGG_WALL_MARGIN, ARENA.width - EGG_WALL_MARGIN),
      y: rng.range(EGG_WALL_MARGIN, ARENA.height - EGG_WALL_MARGIN),
    };
    if (
      isOpen(w.map, pos, EGGS.radius + 8) &&
      dist(pos, duck) >= EGGS.minDistFromDuck &&
      dist(pos, gator) >= EGGS.minDistFromGator &&
      (!season1 || dist(pos, w.nest) >= NEST.eggClearance) &&
      others.every((e) => dist(e.pos, pos) >= EGG_MIN_SPACING)
    ) {
      break;
    }
  }
  return { id, pos, golden };
}

function refillEggs(
  rng: Rng,
  w: Pick<World, 'map' | 'rules' | 'nest' | 'duck' | 'gator' | 'eggs' | 'nextEggId'>,
) {
  const eggs = [...w.eggs];
  let nextEggId = w.nextEggId;
  while (eggs.length < w.rules.eggsOnField) {
    eggs.push(spawnEgg(rng, w, nextEggId++, w.duck.pos, w.gator.pos, eggs));
  }
  return { eggs, nextEggId };
}

export function createWorld(seed: string, rules: RunRules = CLASSIC): World {
  const map = generateMap(seed);
  const rng = new Rng(hashSeed(seed) ^ 0x9e3779b9);
  const duck = createDuck(map.duckSpawn);
  const gator = createGator(map.gatorSpawn, angleOf(sub(map.duckSpawn, map.gatorSpawn)));
  const base = { map, rules, nest: map.duckSpawn, duck, gator, eggs: [] as Egg[], nextEggId: 0 };
  const { eggs, nextEggId } = refillEggs(rng, base);
  return {
    ...base,
    eggs,
    nextEggId,
    rngState: rng.state,
    time: 0,
    eggsCollected: 0,
    timesSpotted: 0,
    ducklings: [],
    trailHistory: [],
    banked: 0,
    bankedDucklings: 0,
    goldenEggs: 0,
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

type Progress = Pick<World, 'time' | 'eggsCollected' | 'bankedDucklings'>;

function goalReached(rules: RunRules, p: Progress): boolean {
  const goal = rules.goal;
  if (!goal) return false;
  return (
    (goal.eggs === undefined || p.eggsCollected >= goal.eggs) &&
    (goal.ducklings === undefined || p.bankedDucklings >= goal.ducklings) &&
    (goal.surviveSec === undefined || p.time >= goal.surviveSec)
  );
}

/** A catch beats the goal, and the goal beats the clock, when they land on the same tick. */
/** `snapped`: the gator's mouth is full this tick, so the duck can't also be caught. */
function endStatus(
  rules: RunRules,
  duckPos: Vec,
  gator: World['gator'],
  p: Progress,
  snapped: boolean,
): RunStatus {
  if (!snapped && isCaught(duckPos, gator)) return 'caught';
  if (goalReached(rules, p)) return 'cleared';
  if (rules.timeLimit !== null && p.time >= rules.timeLimit) return 'timeUp';
  return 'playing';
}

interface Pickups {
  readonly picked: readonly Egg[];
  readonly ducklings: readonly Vec[];
  readonly goldenEggs: number;
}

/** Eggs the duck touched this step; under Season 1 they hatch onto the trail. */
function collectEggs(w: World, duck: Duck, ducklings: readonly Vec[], events: GameEvent[]): Pickups {
  const picked = w.eggs.filter((e) => dist(e.pos, duck.pos) < EGGS.radius + DUCK.radius);
  let trail = ducklings;
  let goldenEggs = w.goldenEggs;
  for (const e of picked) {
    events.push({ type: 'pickup', pos: e.pos });
    if (!w.rules.ducklings) continue;
    if (e.golden) {
      goldenEggs++;
      events.push({ type: 'goldenPickup', pos: e.pos });
    }
    const before = trail.length;
    trail = hatchDucklings(trail, e.golden ? GOLDEN.ducklings : 1, duck.pos, duck.facing);
    if (trail.length > before) events.push({ type: 'hatch', pos: e.pos, count: trail.length });
  }
  return { picked, ducklings: trail, goldenEggs };
}

/** The splash this step's pickups make: a golden egg is the loud one. */
function splashOf(picked: readonly Egg[], hearRadius: number): { pos: Vec; radius: number } | null {
  const loud = picked.find((e) => e.golden);
  const egg = loud ?? picked[0];
  if (!egg) return null;
  return { pos: egg.pos, radius: loud ? hearRadius * GOLDEN.splashFactor : hearRadius };
}

/**
 * Pure simulation step: returns a new world. Order: duck move (trail follows) → pickups
 * (hatch) → banking at the nest → gator → tail snap → duck catch.
 */
export function step(w: World, input: InputState, dt: number): World {
  if (w.status !== 'playing') return w.events.length ? { ...w, events: [] } : w;
  const rng = new Rng(w.rngState);
  const events: GameEvent[] = [];
  const season1 = w.rules.ducklings;

  const duck = updateDuck(w.duck, input, w.map.obstacles, dt);
  if (duck.sprinting && !w.duck.sprinting) events.push({ type: 'sprintStart' });
  const trailHistory = season1 ? pushHistory(w.trailHistory, duck.pos) : w.trailHistory;
  const followed = season1 ? followTrail(w.ducklings, trailHistory, duck.pos, duck.facing) : w.ducklings;

  const pickups = collectEggs(w, duck, followed, events);
  const remaining = w.eggs.filter((e) => !pickups.picked.includes(e));
  const eggsCollected = w.eggsCollected + pickups.picked.length;
  const time = w.time + dt;

  let ducklings = pickups.ducklings;
  let banked = w.banked;
  let bankedDucklings = w.bankedDucklings;
  if (season1 && ducklings.length > 0 && dist(duck.pos, w.nest) <= NEST.radius) {
    const value = bankValue(ducklings.length);
    events.push({ type: 'banked', pos: w.nest, count: ducklings.length, value });
    banked += value;
    bankedDucklings += ducklings.length;
    ducklings = [];
  }

  const stats = gatorStats(time, eggsCollected, w.rules, ducklings.length);
  const splash = splashOf(pickups.picked, stats.hearRadius);
  const gatorResult = updateGator(w.gator, {
    duckPos: duck.pos,
    map: w.map,
    stats,
    rng,
    dt,
    splash: splash?.pos ?? null,
    splashRadius: splash?.radius,
    tail: visibleTail(ducklings),
  });
  events.push(...gatorResult.events);
  let gator = gatorResult.gator;

  // The gator takes the last duckling instead of the duck (never through cover), then stops to
  // swallow. That tick the duck is safe: the duckling was the sacrifice.
  const tail = ducklings[ducklings.length - 1];
  const snapped =
    tail !== undefined &&
    gator.stun <= 0 &&
    isCaught(tail, gator) &&
    hasLineOfSight(snoutOf(gator), tail, w.map.obstacles);
  if (snapped) {
    events.push({ type: 'snapped', pos: tail });
    ducklings = ducklings.slice(0, -1);
    gator = { ...gator, stun: SNAP.stunSeconds };
  }

  const { eggs, nextEggId } = refillEggs(rng, {
    map: w.map,
    rules: w.rules,
    nest: w.nest,
    duck,
    gator,
    eggs: remaining,
    nextEggId: w.nextEggId,
  });

  const progress = { time, eggsCollected, bankedDucklings };
  const status = endStatus(w.rules, duck.pos, gator, progress, snapped);
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
    ducklings,
    trailHistory,
    banked,
    bankedDucklings,
    goldenEggs: pickups.goldenEggs,
    status,
    events,
  };
}
