import { EGGS, SIM_DT } from '../config.js';
import { Rng } from '../core/rng.js';
import type { InputState, World } from './types.js';
import { createWorld, step } from './world.js';

const scripted = (seed: number) => {
  const rng = new Rng(seed);
  const inputs: InputState[] = [];
  for (let i = 0; i < 600; i++) {
    inputs.push({ move: { x: rng.range(-1, 1), y: rng.range(-1, 1) }, sprint: rng.chance(0.3) });
  }
  return inputs;
};

const play = (w: World, inputs: InputState[]): World => inputs.reduce((s, i) => step(s, i, SIM_DT), w);

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
    const near: World = { ...w, duck: { ...w.duck, pos: { x: w.gator.pos.x + 30, y: w.gator.pos.y } } };
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
