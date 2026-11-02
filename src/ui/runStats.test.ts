import { DUCK, GATOR, SIM_DT } from '../config';
import type { GatorMode, RunStatus } from '../sim/types';
import {
  addTick,
  closestDucks,
  EMPTY_RUN_STATS,
  eggsPerMinute,
  type RunStatsWorld,
} from './runStats';

const world = (
  gap: number,
  mode: GatorMode = 'wander',
  extra: Partial<Pick<RunStatsWorld, 'time' | 'eggsCollected' | 'timesSpotted'>> = {},
  status: RunStatus = 'playing',
): RunStatsWorld => ({
  duck: { pos: { x: GATOR.snoutOffset + GATOR.catchRadius + DUCK.radius + gap, y: 0 } },
  gator: { pos: { x: 0, y: 0 }, heading: 0, mode },
  time: 0,
  eggsCollected: 0,
  timesSpotted: 0,
  status,
  ...extra,
});

describe('run stats', () => {
  it('adds unseen time only while the gator is not chasing', () => {
    let s = EMPTY_RUN_STATS;
    s = addTick(s, world(100, 'wander'), SIM_DT);
    s = addTick(s, world(100, 'search'), SIM_DT);
    s = addTick(s, world(100, 'chase'), SIM_DT);
    expect(s.unseenSec).toBeCloseTo(2 * SIM_DT);
  });

  it('keeps the closest gap while playing and ignores the catch itself', () => {
    let s = addTick(EMPTY_RUN_STATS, world(40), SIM_DT);
    s = addTick(s, world(16), SIM_DT);
    s = addTick(s, world(60), SIM_DT);
    s = addTick(s, world(-30, 'chase', {}, 'caught'), SIM_DT);
    expect(s.closest).toBeCloseTo(16);
    expect(closestDucks(s)).toBeCloseTo(0.5);
  });

  it('has no closest call until a tick is seen', () => {
    expect(closestDucks(EMPTY_RUN_STATS)).toBeNull();
  });

  it('copies the spotted count, eggs and time from the world', () => {
    const s = addTick(
      EMPTY_RUN_STATS,
      world(50, 'chase', { time: 90, eggsCollected: 6, timesSpotted: 3 }),
      SIM_DT,
    );
    expect(s.spotted).toBe(3);
    expect(eggsPerMinute(s)).toBeCloseTo(4);
  });

  it('reports zero eggs per minute for an instant run', () => {
    expect(eggsPerMinute(EMPTY_RUN_STATS)).toBe(0);
  });
});
