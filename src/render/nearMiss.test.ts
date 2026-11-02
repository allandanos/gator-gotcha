import { DUCK, GATOR } from '../config';
import type { RunStatus } from '../sim/types';
import { NEAR_MISS_START, nearMisses, type NearMissWorld } from './nearMiss';

/** Gator at the origin facing +x; the snout sits GATOR.snoutOffset ahead. */
const at = (gap: number, status: RunStatus = 'playing'): NearMissWorld => ({
  duck: { pos: { x: GATOR.snoutOffset + gap, y: 0 } },
  gator: { pos: { x: 0, y: 0 }, heading: 0 },
  status,
});
const CLOSE = GATOR.catchRadius + DUCK.radius + 10;
const FAR = GATOR.catchRadius + DUCK.radius + 40;

const run = (worlds: NearMissWorld[]) => {
  let s = NEAR_MISS_START;
  const fired: number[] = [];
  worlds.forEach((w, i) => {
    s = nearMisses(s, w);
    if (s.fired) fired.push(i);
  });
  return { s, fired };
};

describe('nearMisses', () => {
  it('fires once the duck survives 30 ticks after a close pass', () => {
    const { s, fired } = run([at(CLOSE), ...Array.from({ length: 30 }, () => at(FAR))]);
    expect(fired).toEqual([30]);
    expect(s.count).toBe(1);
  });

  it('does not fire when the catch follows', () => {
    const { s, fired } = run([at(CLOSE), at(FAR), at(0, 'caught')]);
    expect(fired).toEqual([]);
    expect(s.count).toBe(0);
  });

  it('counts one near miss per pass, not per tick inside the radius', () => {
    const { s } = run(Array.from({ length: 80 }, () => at(CLOSE)));
    expect(s.count).toBe(1);
  });

  it('re-arms after the duck leaves the radius', () => {
    const pass = [at(CLOSE), ...Array.from({ length: 30 }, () => at(FAR))];
    expect(run([...pass, ...pass]).s.count).toBe(2);
  });

  it('ignores distances outside the margin', () => {
    expect(run(Array.from({ length: 40 }, () => at(FAR))).s.count).toBe(0);
  });
});
