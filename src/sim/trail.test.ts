import { TRAIL } from '../config.js';
import { dist, type Vec } from '../core/vec.js';
import { followTrail, hatchDucklings, HISTORY_LENGTH, pushHistory } from './trail.js';

const at = (x: number, y = 500): Vec => ({ x, y });

/** Walk the duck along +x at `speed` u/tick for `ticks`, trail in tow. */
function walk(
  start: { ducklings: readonly Vec[]; history: Vec[]; x: number },
  ticks: number,
  speed: number,
) {
  let { ducklings, history, x } = start as { ducklings: readonly Vec[]; history: Vec[]; x: number };
  for (let i = 0; i < ticks; i++) {
    x += speed;
    history = pushHistory(history, at(x));
    ducklings = followTrail(ducklings, history, at(x), 0);
  }
  return { ducklings, history, x };
}

describe('trail history', () => {
  it('keeps the newest position first and caps the length', () => {
    let h: Vec[] = [];
    for (let i = 0; i < HISTORY_LENGTH + 10; i++) h = pushHistory(h, at(i));
    expect(h).toHaveLength(HISTORY_LENGTH);
    expect(HISTORY_LENGTH).toBe(TRAIL.max * TRAIL.lag + 1);
    expect(h[0]).toEqual(at(HISTORY_LENGTH + 9));
  });

  it('does not mutate the previous history', () => {
    const h = [at(1)];
    pushHistory(h, at(2));
    expect(h).toEqual([at(1)]);
  });
});

describe('hatching', () => {
  it('lines new ducklings up behind the tail, away from where the duck faces', () => {
    const out = hatchDucklings([], 3, at(100), 0);
    expect(out).toHaveLength(3);
    expect(out[0]!.x).toBeCloseTo(100 - TRAIL.spacing);
    expect(out[2]!.x).toBeCloseTo(100 - 3 * TRAIL.spacing);
    const more = hatchDucklings(out, 1, at(100), 0);
    expect(more.slice(0, 3)).toEqual(out);
    expect(more[3]!.x).toBeCloseTo(100 - 4 * TRAIL.spacing);
  });

  it('never grows past TRAIL.max', () => {
    expect(hatchDucklings([], TRAIL.max + 5, at(100), 0)).toHaveLength(TRAIL.max);
    const full = hatchDucklings([], TRAIL.max, at(100), 0);
    expect(hatchDucklings(full, 1, at(100), 0)).toBe(full);
  });
});

describe('following', () => {
  it('keeps every duckling exactly one spacing from the one ahead while walking and sprinting', () => {
    for (const speed of [3, 5]) {
      const start = { ducklings: hatchDucklings([], 6, at(100), 0), history: [at(100)], x: 100 };
      const { ducklings, x } = walk(start, 240, speed);
      expect(dist(ducklings[0]!, at(x))).toBeCloseTo(TRAIL.spacing);
      for (let i = 1; i < ducklings.length; i++) {
        expect(dist(ducklings[i]!, ducklings[i - 1]!)).toBeCloseTo(TRAIL.spacing);
      }
      // After a long straight walk the trail is a straight line behind the duck.
      for (const d of ducklings) expect(d.y).toBeCloseTo(500);
      expect(ducklings.every((d, i) => i === 0 || d.x < ducklings[i - 1]!.x)).toBe(true);
    }
  });

  it('stays put while the duck stands still instead of piling onto it', () => {
    const moved = walk(
      { ducklings: hatchDucklings([], 4, at(100), 0), history: [at(100)], x: 100 },
      60,
      3,
    );
    const still = walk(moved, 120, 0);
    still.ducklings.forEach((d, i) => {
      expect(d.x).toBeCloseTo(moved.ducklings[i]!.x, 6);
      expect(d.y).toBeCloseTo(moved.ducklings[i]!.y, 6);
    });
  });

  it('follows the duck’s path around a corner rather than cutting straight across', () => {
    const s = walk(
      { ducklings: hatchDucklings([], 3, at(100), 0), history: [at(100)], x: 100 },
      60,
      5,
    );
    let { ducklings, history } = s;
    const corner = at(s.x);
    // Turn 90° and sprint down +y for a few ticks.
    for (let i = 1; i <= 8; i++) {
      const duck = { x: corner.x, y: 500 + i * 5 };
      history = pushHistory(history, duck);
      ducklings = followTrail(ducklings, history, duck, Math.PI / 2);
    }
    // The last duckling is still on the old horizontal leg, short of the corner.
    expect(ducklings[2]!.y).toBeLessThan(503);
    expect(ducklings[2]!.x).toBeLessThan(corner.x);
  });

  it('is a pure function of its inputs', () => {
    const d = hatchDucklings([], 5, at(300), 1);
    const h = [at(310), at(305), at(300)];
    expect(followTrail(d, h, at(310), 1)).toEqual(followTrail(d, h, at(310), 1));
    expect(followTrail([], h, at(310), 1)).toEqual([]);
  });
});
