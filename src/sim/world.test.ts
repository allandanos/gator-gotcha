import { EGGS, GATOR, GOLDEN, NEST, SIM_DT, SNAP, TRAIL } from '../config.js';
import { Rng } from '../core/rng.js';
import { dist } from '../core/vec.js';
import { bankValue, scoreOf } from './scoring.js';
import type { InputState, World } from './types.js';
import { CLASSIC, rulesForMode } from './rules.js';
import { createWorld, step } from './world.js';

/** Golden-egg test swamp (phase 2 appendix): the first `gold<n>` seed with one on the opening field. */
const GOLDEN_SEED = 'gold0';

const scripted = (seed: number) => {
  const rng = new Rng(seed);
  const inputs: InputState[] = [];
  for (let i = 0; i < 600; i++) {
    inputs.push({ move: { x: rng.range(-1, 1), y: rng.range(-1, 1) }, sprint: rng.chance(0.3) });
  }
  return inputs;
};

const play = (w: World, inputs: InputState[]): World =>
  inputs.reduce((s, i) => step(s, i, SIM_DT), w);

describe('world', () => {
  it('starts with a full set of eggs and playing status', () => {
    const w = createWorld('abc');
    expect(w.eggs).toHaveLength(EGGS.onField);
    expect(w.status).toBe('playing');
  });

  it('is deterministic for the same seed and input script', () => {
    const inputs = scripted(9);
    expect(play(createWorld('replay'), inputs)).toEqual(play(createWorld('replay'), inputs));
  });

  it('does not mutate the previous world', () => {
    const w = createWorld('immut');
    const snapshot = JSON.stringify(w);
    step(w, { move: { x: 1, y: 0 }, sprint: true }, SIM_DT);
    expect(JSON.stringify(w)).toBe(snapshot);
  });

  it('collects an egg the duck walks onto and respawns one', () => {
    const w = createWorld('eggs');
    const egg = w.eggs[0]!;
    const placed: World = { ...w, duck: { ...w.duck, pos: { x: egg.pos.x - 20, y: egg.pos.y } } };
    const after = step(placed, { move: { x: 1, y: 0 }, sprint: false }, SIM_DT);
    expect(after.eggsCollected).toBe(1);
    expect(after.eggs).toHaveLength(EGGS.onField);
    expect(after.events.some((e) => e.type === 'pickup')).toBe(true);
  });

  it('ends the run when the gator reaches the duck and then freezes', () => {
    const w = createWorld('chomp');
    const near: World = {
      ...w,
      duck: { ...w.duck, pos: { x: w.gator.pos.x + 30, y: w.gator.pos.y } },
    };
    const after = step(near, { move: { x: 0, y: 0 }, sprint: false }, SIM_DT);
    expect(after.status).toBe('caught');
    expect(after.events.some((e) => e.type === 'caught')).toBe(true);
    const frozen = step(after, { move: { x: 1, y: 0 }, sprint: false }, SIM_DT);
    expect(frozen.time).toBe(after.time);
    expect(frozen.events).toHaveLength(0);
  });

  it('emits sprintStart once when a sprint begins', () => {
    const w = createWorld('sprint');
    const a = step(w, { move: { x: 1, y: 0 }, sprint: true }, SIM_DT);
    const b = step(a, { move: { x: 1, y: 0 }, sprint: true }, SIM_DT);
    expect(a.events).toContainEqual({ type: 'sprintStart' });
    expect(b.events).not.toContainEqual({ type: 'sprintStart' });
  });
});

describe('world under run rules', () => {
  const idle = { move: { x: 0, y: 0 }, sprint: false };
  const farFromGator = (w: World): World => ({
    ...w,
    gator: { ...w.gator, pos: { x: 60, y: 60 }, grace: 99 },
    duck: { ...w.duck, pos: { x: 1500, y: 900 } },
  });

  it('spawns the rule set’s egg count', () => {
    expect(createWorld('abc', rulesForMode('rush')).eggs).toHaveLength(8);
    expect(createWorld('abc', rulesForMode('rush')).rules.mode).toBe('rush');
  });

  it('ends with timeUp when the clock runs out', () => {
    const w = farFromGator(createWorld('clock', rulesForMode('rush')));
    const before = step({ ...w, time: 90 - SIM_DT * 2 }, idle, SIM_DT);
    expect(before.status).toBe('playing');
    const after = step(before, idle, SIM_DT);
    expect(after.status).toBe('timeUp');
    expect(after.events).toContainEqual({ type: 'timeUp' });
  });

  it('never times out without a limit', () => {
    const w = farFromGator(createWorld('clock'));
    expect(step({ ...w, time: 10_000 }, idle, SIM_DT).status).toBe('playing');
  });

  it('clears an egg goal, and the goal beats the clock on the same tick', () => {
    const rules = { ...CLASSIC, mode: 'campaign' as const, goal: { eggs: 1 }, timeLimit: 1 };
    const w = farFromGator(createWorld('goal', rules));
    const egg = w.eggs[0]!;
    const placed: World = {
      ...w,
      time: 1 - SIM_DT / 2,
      duck: { ...w.duck, pos: { x: egg.pos.x - 20, y: egg.pos.y } },
    };
    const after = step(placed, { move: { x: 1, y: 0 }, sprint: false }, SIM_DT);
    expect(after.status).toBe('cleared');
    expect(after.events).toContainEqual({ type: 'cleared' });
  });

  it('clears a survival goal', () => {
    const rules = { ...CLASSIC, mode: 'campaign' as const, goal: { surviveSec: 5 } };
    const w = farFromGator(createWorld('survive', rules));
    expect(step({ ...w, time: 5 - SIM_DT / 2 }, idle, SIM_DT).status).toBe('cleared');
    expect(step({ ...w, time: 4 }, idle, SIM_DT).status).toBe('playing');
  });

  it('lets a catch win over a goal on the same tick', () => {
    const rules = { ...CLASSIC, mode: 'campaign' as const, goal: { surviveSec: 1 } };
    const w = createWorld('chomp', rules);
    const near: World = {
      ...w,
      time: 1,
      duck: { ...w.duck, pos: { x: w.gator.pos.x + 30, y: w.gator.pos.y } },
    };
    expect(step(near, idle, SIM_DT).status).toBe('caught');
  });

  it('counts times spotted', () => {
    let s = createWorld('spot');
    expect(s.timesSpotted).toBe(0);
    let count = 0;
    for (const i of scripted(4)) {
      s = step(s, i, SIM_DT);
      count += s.events.filter((e) => e.type === 'spotted').length;
    }
    expect(s.timesSpotted).toBe(count);
  });
});

describe('season 1: ducklings, snapping, banking, golden egg', () => {
  const IDLE: InputState = { move: { x: 0, y: 0 }, sprint: false };
  /** A world with the gator parked far away, quiet and in grace, so nothing interferes. */
  const calm = (seed: string, rules = CLASSIC): World => {
    const w = createWorld(seed, rules);
    return { ...w, gator: { ...w.gator, pos: { x: 1550, y: 950 }, grace: 999 } };
  };
  /** Put the duck just left of egg 0 and step into it. */
  const grab = (w: World, egg = w.eggs[0]!): World =>
    step(
      { ...w, duck: { ...w.duck, pos: { x: egg.pos.x - 20, y: egg.pos.y } } },
      { move: { x: 1, y: 0 }, sprint: false },
      SIM_DT,
    );
  const withTrail = (w: World, n: number, at = w.duck.pos): World => ({
    ...w,
    ducklings: Array.from({ length: n }, (_, i) => ({ x: at.x - (i + 1) * TRAIL.spacing, y: at.y })),
  });

  it('starts with an empty trail and the nest on the duck spawn', () => {
    const w = createWorld('nest');
    expect(w).toMatchObject({ ducklings: [], banked: 0, bankedDucklings: 0, goldenEggs: 0 });
    expect(w.nest).toEqual(w.map.duckSpawn);
  });

  it('hatches a duckling per egg and emits hatch with the trail length', () => {
    const w = calm('hatch');
    const egg = w.eggs.find((e) => !e.golden)!;
    const after = grab(w, egg);
    expect(after.ducklings).toHaveLength(1);
    expect(after.events).toContainEqual({ type: 'hatch', pos: egg.pos, count: 1 });
  });

  it('hatches nothing in Egg Rush, which keeps the old rules', () => {
    const after = grab(calm('hatch', rulesForMode('rush')));
    expect(after.eggsCollected).toBe(1);
    expect(after.ducklings).toEqual([]);
    expect(after.eggs.every((e) => !e.golden)).toBe(true);
  });

  it('banks the trail inside the nest: pays bankValue(n), clears the trail, emits banked', () => {
    const w = withTrail(calm('bank'), 4);
    const out = step({ ...w, duck: { ...w.duck, pos: w.nest } }, IDLE, SIM_DT);
    expect(out.events).toContainEqual({ type: 'banked', pos: w.nest, count: 4, value: bankValue(4) });
    expect(out).toMatchObject({ ducklings: [], banked: 560, bankedDucklings: 4 });
    expect(scoreOf(out)).toBe(560);
  });

  it('does not bank outside the nest radius or with an empty trail', () => {
    const w = calm('bank');
    const outside = { x: w.nest.x + NEST.radius + 30, y: w.nest.y };
    const away = step(withTrail({ ...w, duck: { ...w.duck, pos: outside } }, 3), IDLE, SIM_DT);
    expect(away.banked).toBe(0);
    expect(away.ducklings).toHaveLength(3);
    const empty = step({ ...w, duck: { ...w.duck, pos: w.nest } }, IDLE, SIM_DT);
    expect(empty.events.some((e) => e.type === 'banked')).toBe(false);
  });

  it('lets the gator snap the last duckling instead of the duck, then stuns it', () => {
    const w0 = withTrail(calm('snap'), 5, { x: 600, y: 500 });
    const tail = w0.ducklings[4]!;
    // Gator facing the tail with its snout on it, far enough from the duck to leave it alone.
    const gator = { ...w0.gator, pos: { x: tail.x - 30, y: tail.y }, heading: 0, grace: 999 };
    const w = { ...w0, duck: { ...w0.duck, pos: { x: 600, y: 500 } }, gator };
    const out = step(w, IDLE, SIM_DT);
    expect(out.status).toBe('playing');
    expect(out.ducklings).toHaveLength(4);
    expect(out.events.some((e) => e.type === 'snapped')).toBe(true);
    expect(out.gator.stun).toBeCloseTo(SNAP.stunSeconds);
    // Stunned: it doesn't take another one even though the next tail drifts by.
    const later = step(out, IDLE, SIM_DT);
    expect(later.ducklings).toHaveLength(4);
    expect(later.gator.pos).toEqual(out.gator.pos);
  });

  it('cannot snap a duckling through a log', () => {
    const w0 = withTrail(calm('snap'), 5, { x: 600, y: 500 });
    const tail = w0.ducklings[4]!;
    const log = { kind: 'log' as const, x: tail.x - 14, y: tail.y - 60, w: 8, h: 120 };
    const map = { ...w0.map, obstacles: [log] };
    const gator = { ...w0.gator, pos: { x: tail.x - 40, y: tail.y }, heading: 0, grace: 999 };
    const out = step({ ...w0, map, duck: { ...w0.duck, pos: { x: 600, y: 500 } }, gator }, IDLE, SIM_DT);
    expect(out.ducklings).toHaveLength(5);
    expect(out.events.some((e) => e.type === 'snapped')).toBe(false);
  });

  it('lets a snapped duckling save the duck on that tick: no catch alongside a snap', () => {
    const w0 = calm('snap');
    const duck = { x: 600, y: 500 };
    const tail = { x: 600 - TRAIL.spacing, y: 500 };
    // Snout on the tail and, 22 u further on, close enough to the duck to catch it too.
    const gator = { ...w0.gator, pos: { x: tail.x - 26, y: tail.y + 30 }, heading: -0.6, grace: 999, stun: 0 };
    const w = { ...w0, ducklings: [tail], duck: { ...w0.duck, pos: duck }, gator };
    const out = step(w, IDLE, SIM_DT);
    expect(out.events.some((e) => e.type === 'snapped')).toBe(true);
    expect(out.status).toBe('playing');
  });

  it('keeps ducklings inside the arena', () => {
    const w0 = calm('edge');
    const duck = { x: 20, y: 20 };
    const w = { ...w0, duck: { ...w0.duck, pos: duck, facing: 0 }, ducklings: [], trailHistory: [] };
    const egg = { id: 99, pos: { x: 40, y: 20 }, golden: true };
    const out = grab({ ...w, eggs: [egg] }, egg);
    expect(out.ducklings).toHaveLength(GOLDEN.ducklings);
    for (const d of out.ducklings) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('still catches the duck itself as before', () => {
    const w0 = withTrail(calm('snap'), 2, { x: 600, y: 500 });
    // From the far side of the trail: the jaws reach the duck, not the tail.
    const gator = { ...w0.gator, pos: { x: 640, y: 500 }, heading: Math.PI };
    const out = step({ ...w0, duck: { ...w0.duck, pos: { x: 600, y: 500 } }, gator }, IDLE, SIM_DT);
    expect(out.status).toBe('caught');
    expect(out.ducklings).toHaveLength(2);
  });

  it('spawns a golden egg on the seeded test swamp, at most one at a time', () => {
    let w = calm(GOLDEN_SEED);
    expect(w.eggs.filter((e) => e.golden)).toHaveLength(1);
    expect(createWorld('gold3').eggs.some((e) => e.golden)).toBe(false);
    for (let i = 0; i < 20; i++) w = grab({ ...w, ducklings: [] }, w.eggs.find((e) => !e.golden)!);
    expect(w.eggs.filter((e) => e.golden).length).toBeLessThanOrEqual(1);
  });

  it('turns a golden egg into GOLDEN.ducklings ducklings, capped at TRAIL.max, with a loud splash', () => {
    const w = calm('gold');
    const egg = { ...w.eggs[0]!, golden: true };
    const gw: World = { ...w, eggs: [egg, ...w.eggs.slice(1)] };
    const out = grab(gw, egg);
    expect(out.ducklings).toHaveLength(GOLDEN.ducklings);
    expect(out.goldenEggs).toBe(1);
    expect(out.events).toContainEqual({ type: 'goldenPickup', pos: egg.pos });
    const nearlyFull = grab(withTrail(gw, TRAIL.max - 2), egg);
    expect(nearlyFull.ducklings).toHaveLength(TRAIL.max);

    // Heard from 1.5× the normal hearing radius, where a plain egg would not carry. The gator
    // faces away from the duck so it can only hear, not see.
    const spot = { id: 99, pos: { x: 300, y: 500 } };
    const gator = { ...gw.gator, pos: { x: 300 + GATOR.splashHearRadius * 1.5, y: 500 }, heading: 0 };
    const listening = (golden: boolean) => {
      const e = { ...spot, golden };
      return grab({ ...gw, eggs: [e], gator: { ...gator, grace: 0, mode: 'wander' as const, waitTimer: 5 } }, e);
    };
    expect(listening(true).gator.mode).toBe('search');
    expect(listening(false).gator.mode).not.toBe('search');
  });

  it('keeps new eggs out of the nest', () => {
    let w = calm('clear');
    for (let i = 0; i < 30; i++) {
      w = grab(w, w.eggs[0]!);
      for (const e of w.eggs) expect(dist(e.pos, w.nest)).toBeGreaterThanOrEqual(NEST.eggClearance);
    }
  });
});
