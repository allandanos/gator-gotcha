import { createHash } from 'node:crypto';
import { z } from 'zod';
import { RULESET } from '../../src/config.js';
import { parseSeed } from '../../src/core/rng.js';
import { parseMode, type ModeId } from '../../src/sim/rules.js';
import {
  MAX_ENCODED_LOG,
  dailyDateOf,
  dailySeed,
  decodeLog,
  replayRun,
} from '../../src/sim/replay.js';
import type { ScoreRepository } from './repository.js';

export const RATE_LIMIT_PER_MINUTE = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const BodySchema = z.object({
  seed: z.string().max(12),
  log: z.string().min(1).max(MAX_ENCODED_LOG),
  // Absent for older clients and runs queued before modes existed: those are classic. Checked
  // after the ruleset, so a stale client sending a retired mode (night) is told to reload.
  mode: z.string().max(16).default('classic'),
  // Absent for clients built before rulesets: ruleset 0, which the stale-ruleset check rejects.
  ruleset: z.number().int().default(0),
});

export interface SubmitResult {
  readonly id: string;
  readonly mode: ModeId;
  readonly score: number;
  readonly eggs: number;
  /** Ducklings banked during the run. */
  readonly banked: number;
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
  // The server only replays the current rules; 409 tells the client's queue to drop the run.
  if (parsed.data.ruleset !== RULESET) return reject(409, 'Game updated: please reload');
  const mode = parseMode(parsed.data.mode);
  if (!mode) return reject(400, 'Invalid mode');
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

  const replay = replayRun(seed, inputs, mode);
  if (!replay.ok) return reject(422, `Run could not be verified (${replay.reason})`);

  // Only classic runs on today's (or, for runs crossing midnight, yesterday's) daily seed count on the daily board.
  const isCurrentDaily =
    mode === 'classic' &&
    (seed === dailySeed(now) || seed === dailySeed(new Date(now.getTime() - DAY_MS)));
  const dailyDate = isCurrentDaily ? dailyDateOf(seed) : null;

  // Scoped to the ruleset: the same log replays differently under new rules, so it's a new run.
  const inputHash = createHash('sha256')
    .update(`r${RULESET}:${mode}:${seed}:${parsed.data.log}`)
    .digest('hex');
  const inserted = await repo.insert({
    userId,
    seed,
    mode,
    ruleset: RULESET,
    dailyDate,
    score: replay.score,
    eggs: replay.eggs,
    banked: replay.banked,
    ticks: replay.ticks,
    inputHash,
  });
  if (inserted === 'duplicate') return reject(409, 'This run was already submitted');

  const [rank, dailyRank] = await Promise.all([
    repo.rankFor('all', null, mode, userId, replay.score),
    dailyDate
      ? repo.rankFor('daily', dailyDate, mode, userId, replay.score)
      : Promise.resolve(null),
  ]);
  return {
    ok: true,
    result: {
      id: inserted.id,
      mode,
      score: replay.score,
      eggs: replay.eggs,
      banked: replay.banked,
      ticks: replay.ticks,
      rank,
      dailyRank,
    },
  };
}
