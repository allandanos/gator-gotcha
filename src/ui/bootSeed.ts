import { dailyDateOf } from '../sim/replay';

/**
 * Seed to open on: a ?seed= link wins, then the swamp played last. A remembered Daily Swamp is
 * only reused on its own day; otherwise null tells the caller to roll a fresh swamp.
 * Both inputs must already be validated with parseSeed().
 */
export function pickBootSeed(urlSeed: string | null, savedSeed: string | null, todaySeed: string): string | null {
  if (urlSeed) return urlSeed;
  if (!savedSeed) return null;
  return dailyDateOf(savedSeed) && savedSeed !== todaySeed ? null : savedSeed;
}
