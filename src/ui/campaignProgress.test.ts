import { LEVELS } from '../sim/campaign';
import {
  createCampaignProgress,
  isLevelUnlocked,
  isWorldUnlocked,
  nextLevel,
  parseProgress,
  totalStars,
  withResult,
  type StarMap,
} from './campaignProgress';
import type { KeyValueStore } from './pendingRuns';

const level = (id: number) => LEVELS[id - 1]!;

function memoryStore(
  initial: Record<string, string> = {},
): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe('campaign progress', () => {
  it('parses only known levels with valid stars', () => {
    expect(parseProgress(null)).toEqual({});
    expect(parseProgress('not json')).toEqual({});
    expect(parseProgress('[1,2]')).toEqual({});
    expect(parseProgress('{"1":3,"2":7,"99":2,"3":"2","4":0}')).toEqual({ 1: 3, 4: 0 });
  });

  it('opens world 1 level 1 only, then level by level', () => {
    expect(isLevelUnlocked(level(1), {})).toBe(true);
    expect(isLevelUnlocked(level(2), {})).toBe(false);
    expect(isLevelUnlocked(level(2), { 1: 1 })).toBe(true);
    expect(nextLevel(1, { 1: 1 })?.id).toBe(2);
    expect(nextLevel(1, {})).toBeNull();
    expect(nextLevel(12, { 12: 3 })).toBeNull();
  });

  it('gates later worlds on total stars', () => {
    const five: StarMap = { 1: 2, 2: 1, 3: 1, 4: 1 };
    expect(totalStars(five)).toBe(5);
    expect(isWorldUnlocked(1, five)).toBe(false);
    expect(isLevelUnlocked(level(5), five)).toBe(false);
    // Clearing level 4 isn't enough by itself: level 5 needs the world's 6 stars.
    expect(nextLevel(4, five)).toBeNull();
    const six = withResult(five, 1, 3);
    expect(isLevelUnlocked(level(5), six)).toBe(true);
    expect(isWorldUnlocked(2, six)).toBe(false);
    expect(isWorldUnlocked(7, six)).toBe(false);
  });

  it('keeps the best result without mutating the old map', () => {
    const start: StarMap = { 1: 2 };
    expect(withResult(start, 1, 1)).toBe(start);
    const better = withResult(start, 1, 3);
    expect(better).toEqual({ 1: 3 });
    expect(start).toEqual({ 1: 2 });
  });

  it('persists improvements only', () => {
    const store = memoryStore();
    const p = createCampaignProgress(store);
    expect(p.record(1, 2)).toEqual({ before: {}, after: { 1: 2 } });
    p.record(1, 1);
    expect(JSON.parse(store.data['gator-gotcha:campaign']!)).toEqual({ 1: 2 });
    expect(p.read()).toEqual({ 1: 2 });
  });

  it('survives blocked storage', () => {
    const p = createCampaignProgress({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(p.read()).toEqual({});
    expect(p.record(1, 3).after).toEqual({ 1: 3 });
    expect(createCampaignProgress(null).read()).toEqual({});
  });
});
