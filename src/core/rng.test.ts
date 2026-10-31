import { hashSeed, parseSeed, randomSeed, Rng } from './rng';

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect(Array.from({ length: 10 }, () => a.next())).toEqual(Array.from({ length: 10 }, () => b.next()));
  });

  it('stays within ranges', () => {
    const r = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it('resumes from exported state', () => {
    const a = new Rng(7);
    a.next();
    const b = new Rng(a.state);
    expect(b.next()).toBe(a.next());
  });

  it('throws when picking from an empty array', () => {
    expect(() => new Rng(1).pick([])).toThrow();
  });
});

describe('seeds', () => {
  it('hashes deterministically and differently', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
  });

  it('accepts only short alphanumeric seeds', () => {
    expect(parseSeed(' AbC12 ')).toBe('abc12');
    expect(parseSeed('<script>')).toBeNull();
    expect(parseSeed('')).toBeNull();
    expect(parseSeed(null)).toBeNull();
    expect(parseSeed('a'.repeat(13))).toBeNull();
  });

  it('generates parseable random seeds', () => {
    expect(parseSeed(randomSeed())).not.toBeNull();
    expect(randomSeed(() => 0)).toBe('000000');
  });
});
