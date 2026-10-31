import { createHash } from 'node:crypto';
import { z } from 'zod';
import { parseSeed } from '../../src/core/rng.js';
import { MAX_ENCODED_LOG, dailyDateOf, dailySeed, decodeLog, replayRun } from '../../src/sim/replay.js';
import type { ScoreRepository } from './repository.js';

export const RATE_LIMIT_PER_MINUTE = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const BodySchema = z.object({
  seed: z.string().max(12),
  log: z.string().min(1).max(MAX_ENCODED_LOG),
});

export interface SubmitResult {
  readonly id: string;
  readonly score: number;
  readonly eggs: number;
  readonly ticks: number;
  readonly rank: number;
  readonly dailyRank: number | null;
}

export type SubmitOutcome =
  | { readonly ok: true; readonly result: SubmitResult }
  | { readonly ok: false; readonly status: number; readonly error: string };

const reject = (status: number, error: string): SubmitOutcome => ({ ok: false, status, error });

/**
 * Validate and record a run. The score is never taken from the client: the run is replayed
 * from its seed + input log and the replay's result is what gets stored.
 */
export async function submitScore(
  repo: ScoreRepository,
  token: string | null,
  body: unknown,
  now: Date,
): Promise<SubmitOutcome> {
  if (!token) return reject(401, 'Sign-in required');
  const userId = await repo.userIdForToken(token);
  if (!userId) return reject(401, 'Session expired, please reload');

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return reject(400, 'Invalid submission');
  const seed = parseSeed(parsed.data.seed);
  if (!seed) return reject(400, 'Invalid seed');

  let inputs: Uint8Array;
  try {
    inputs = decodeLog(parsed.data.log);
  } catch {
    return reject(400, 'Invalid input log');
  }

  const since = new Date(now.getTime() - 60_000).toISOString();
  if ((await repo.countSince(userId, since)) >= RATE_LIMIT_PER_MINUTE) {
    return reject(429, 'Too many submissions, slow down');
  }

  const replay = replayRun(seed, inputs);
  if (!replay.ok) return reject(422, `Run could not be verified (${replay.reason})`);

  // Only today's (or, for runs crossing midnight, yesterday's) daily seed counts on the daily board.
  const isCurrentDaily = seed === dailySeed(now) || seed === dailySeed(new Date(now.getTime() - DAY_MS));
  const dailyDate = isCurrentDaily ? dailyDateOf(seed) : null;

  const inputHash = createHash('sha256').update(`${seed}:${parsed.data.log}`).digest('hex');
  const inserted = await repo.insert({
    userId,
    seed,
    dailyDate,
    score: replay.score,
    eggs: replay.eggs,
    ticks: replay.ticks,
    inputHash,
  });
  if (inserted === 'duplicate') return reject(409, 'This run was already submitted');

  const [rank, dailyRank] = await Promise.all([
    repo.rankFor('all', null, userId, replay.score),
    dailyDate ? repo.rankFor('daily', dailyDate, userId, replay.score) : Promise.resolve(null),
  ]);
  return {
    ok: true,
    result: { id: inserted.id, score: replay.score, eggs: replay.eggs, ticks: replay.ticks, rank, dailyRank },
  };
}
