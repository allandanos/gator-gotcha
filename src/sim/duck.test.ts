import { DUCK, SIM_DT } from '../config';
import { len } from '../core/vec';
import { createDuck, updateDuck } from './duck';
import type { Duck, InputState } from './types';

const run = (d: Duck, input: InputState, seconds: number): Duck => {
  let s = d;
  for (let t = 0; t < seconds; t += SIM_DT) s = updateDuck(s, input, [], SIM_DT);
  return s;
};
const start = () => createDuck({ x: 800, y: 500 });

describe('duck', () => {
  it('normalizes diagonal speed to walk speed', () => {
    const d = run(start(), { move: { x: 1, y: 1 }, sprint: false }, 0.5);
    expect(len(d.vel)).toBeCloseTo(DUCK.walkSpeed, 0);
  });

  it('sprints faster and drains stamina', () => {
    const d = run(start(), { move: { x: 1, y: 0 }, sprint: true }, 0.5);
    expect(len(d.vel)).toBeCloseTo(DUCK.sprintSpeed, 0);
    expect(d.stamina).toBeLessThan(DUCK.staminaMax);
    expect(d.sprinting).toBe(true);
  });

  it('does not drain stamina when sprinting in place', () => {
    const d = run(start(), { move: { x: 0, y: 0 }, sprint: true }, 1);
    expect(d.stamina).toBe(DUCK.staminaMax);
  });

  it('locks sprint when exhausted until partially recovered', () => {
    const tired = run(start(), { move: { x: 1, y: 0 }, sprint: true }, 3);
    expect(tired.stamina).toBe(0);
    expect(tired.exhausted).toBe(true);
    const still = run(tired, { move: { x: 1, y: 0 }, sprint: true }, 0.5);
    expect(still.sprinting).toBe(false);
    const rested = run(tired, { move: { x: 0, y: 0 }, sprint: false }, 2.5);
    expect(rested.exhausted).toBe(false);
  });

  it('waits before regenerating', () => {
    const used = run(start(), { move: { x: 1, y: 0 }, sprint: true }, 1);
    const brief = run(used, { move: { x: 0, y: 0 }, sprint: false }, DUCK.regenDelay / 2);
    expect(brief.stamina).toBeCloseTo(used.stamina);
  });
});
