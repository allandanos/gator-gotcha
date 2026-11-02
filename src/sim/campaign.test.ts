import { CAMPAIGN } from '../config.js';
import { parseSeed } from '../core/rng.js';
import { describeGoal, describeStar, LEVELS, levelById, meets, starsFor } from './campaign.js';
import { createWorld } from './world.js';

const run = (
  over: Partial<{
    status: 'cleared' | 'caught' | 'timeUp';
    time: number;
    eggsCollected: number;
    timesSpotted: number;
  }>,
) => ({
  status: 'cleared' as const,
  time: 20,
  eggsCollected: 3,
  timesSpotted: 0,
  ...over,
});

describe('campaign levels', () => {
  it('has 12 levels in 3 worlds with valid, unique seeds', () => {
    expect(LEVELS).toHaveLength(12);
    expect(LEVELS.map((l) => l.world)).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
    expect(new Set(LEVELS.map((l) => l.seed)).size).toBe(12);
    for (const l of LEVELS) expect(parseSeed(l.seed)).toBe(l.seed);
    expect(CAMPAIGN.worlds.map((w) => w.starsToUnlock)).toEqual([0, 6, 15]);
  });

  it('builds campaign rules from each level, with night factors on night levels', () => {
    const lantern = levelById(5)!;
    expect(lantern.rules).toMatchObject({ mode: 'campaign', night: true, ducklings: false, goal: { eggs: 4 } });
    expect(lantern.rules.coneRangeFactor).toBeLessThan(1);
    const frenzy = levelById(11)!;
    expect(frenzy.rules).toMatchObject({ timeLimit: 105, eggsOnField: 8, night: false, ducklings: true });
    expect(createWorld(frenzy.seed, frenzy.rules).eggs).toHaveLength(8);
    expect(levelById(0)).toBeNull();
    expect(levelById(13)).toBeNull();
  });

  it('mixes egg, survival and banking levels, keeping night and ducklings apart, never cycling', () => {
    const kinds = LEVELS.map((l) => (l.goal.ducklings ? 'bank' : l.goal.eggs ? 'eggs' : 'survive'));
    expect(kinds).toEqual(['eggs', 'eggs', 'survive', 'bank', 'eggs', 'survive', 'eggs', 'eggs', 'bank', 'survive', 'bank', 'eggs']);
    for (const l of LEVELS) {
      expect(l.rules.ducklings).toBe(l.goal.ducklings !== undefined);
      expect(l.rules.night && l.rules.ducklings).toBe(false);
      expect(l.rules.dayNight).toBe(false);
    }
  });

  it('every goal can actually be met: gated by eggs, banking or time, never unset', () => {
    for (const l of LEVELS) {
      const { eggs, ducklings, surviveSec } = l.goal;
      expect(eggs !== undefined || ducklings !== undefined || surviveSec !== undefined).toBe(true);
      // Banking more than a full trail at once is fine: goals count across several trips.
      if (l.goal.ducklings && l.rules.timeLimit) expect(l.rules.timeLimit).toBeGreaterThan(45);
    }
  });
});

describe('stars', () => {
  const first = levelById(1)!; // 3 eggs; ★★ ≤30 s; ★★★ unseen

  it('gives nothing for a failed run', () => {
    expect(starsFor(first, run({ status: 'caught' }))).toBe(0);
    expect(starsFor(first, run({ status: 'timeUp' }))).toBe(0);
  });

  it('gives one star per condition met on top of clearing', () => {
    expect(starsFor(first, run({ time: 50, timesSpotted: 2 }))).toBe(1);
    expect(starsFor(first, run({ time: 25, timesSpotted: 2 }))).toBe(2);
    expect(starsFor(first, run({ time: 50, timesSpotted: 0 }))).toBe(2);
    expect(starsFor(first, run({ time: 25, timesSpotted: 0 }))).toBe(3);
  });

  it('checks each condition kind', () => {
    expect(meets({ parSec: 30 }, run({ time: 30 }))).toBe(true);
    expect(meets({ minEggs: 4 }, run({ eggsCollected: 3 }))).toBe(false);
    expect(meets({ maxSpotted: 1 }, run({ timesSpotted: 1 }))).toBe(true);
  });

  it('describes goals and star conditions for the UI', () => {
    expect(describeGoal({ eggs: 6 })).toBe('Grab 6 eggs');
    expect(describeGoal({ ducklings: 6 })).toBe('Bank 6 ducklings');
    expect(describeGoal({ surviveSec: 45 })).toBe('Survive 45 s');
    expect(describeStar({ parSec: 30 })).toBe('Clear in 30 s');
    expect(describeStar({ minEggs: 3 })).toBe('Grab 3 eggs');
    expect(describeStar({ maxSpotted: 0 })).toBe('Never get spotted');
    expect(describeStar({ maxSpotted: 2 })).toBe('Spotted 2× at most');
  });
});

describe('banking campaign goals', () => {
  it('clears a banking goal once enough ducklings are banked, across trips', async () => {
    const { step } = await import('./world.js');
    const l = levelById(4)!; // Greedy Duck: bank 10
    const w = createWorld(l.seed, l.rules);
    const calm = { ...w, gator: { ...w.gator, pos: { x: 1550, y: 950 }, grace: 999 } };
    const home = { ...calm, duck: { ...calm.duck, pos: calm.nest } };
    const idle = { move: { x: 0, y: 0 }, sprint: false };
    const trail = (n: number) => Array.from({ length: n }, () => home.nest);
    const six = step({ ...home, ducklings: trail(6) }, idle, 1 / 60);
    expect(six.status).toBe('playing');
    const ten = step({ ...six, ducklings: trail(4) }, idle, 1 / 60);
    expect(ten.status).toBe('cleared');
    expect(ten.bankedDucklings).toBe(10);
  });
});
