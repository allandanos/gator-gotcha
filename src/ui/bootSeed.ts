/**
 * Seed to open on: a ?seed= link wins; otherwise today's Daily Swamp, so everyone starts on the
 * same swamp. The URL seed must already be validated with parseSeed().
 */
export function pickBootSeed(urlSeed: string | null, todaySeed: string): string {
  return urlSeed ?? todaySeed;
}
