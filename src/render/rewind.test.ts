import type { GatorMode } from '../sim/types';
import { deathcamDuration, deathcamFrame, pushFrame, spottedIndex } from './rewind';

const modes = (...m: GatorMode[]) => m.map((mode) => ({ gator: { mode } }));

describe('pushFrame', () => {
  it('appends until full, then drops the oldest', () => {
    const a = pushFrame(pushFrame([], 1, 2), 2, 2);
    expect(a).toEqual([1, 2]);
    expect(pushFrame(a, 3, 2)).toEqual([2, 3]);
  });

  it('never mutates the previous buffer', () => {
    const a = [1, 2];
    pushFrame(a, 3, 2);
    expect(a).toEqual([1, 2]);
  });
});

describe('spottedIndex', () => {
  it('finds the most recent switch into chase', () => {
    expect(spottedIndex(modes('wander', 'chase', 'search', 'search', 'chase', 'chase'))).toBe(4);
  });

  it('is null when the chase began before the buffer or never happened', () => {
    expect(spottedIndex(modes('chase', 'chase'))).toBeNull();
    expect(spottedIndex(modes('wander', 'search'))).toBeNull();
    expect(spottedIndex([])).toBeNull();
  });
});

describe('deathcam playback', () => {
  it('lasts the buffer length slowed by the playback speed', () => {
    expect(deathcamDuration(180, false)).toBeCloseTo(5);
    expect(deathcamDuration(180, true)).toBe(3);
  });

  it('walks the buffer at 0.6x with an interpolation alpha', () => {
    expect(deathcamFrame(180, 0, false, null)).toEqual({ index: 0, alpha: 0 });
    const f = deathcamFrame(180, 1, false, null);
    expect(f.index).toBe(36);
    expect(f.alpha).toBeCloseTo(0, 5);
    expect(deathcamFrame(180, 99, false, null)).toEqual({ index: 179, alpha: 0 });
  });

  it('holds one still frame under reduced motion: the spot, else the catch', () => {
    expect(deathcamFrame(180, 1.5, true, 40)).toEqual({ index: 40, alpha: 0 });
    expect(deathcamFrame(180, 1.5, true, null)).toEqual({ index: 179, alpha: 0 });
  });
});
