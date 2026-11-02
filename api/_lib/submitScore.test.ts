import { recordBotRun } from '../../src/sim/__fixtures__/recordBot.js';
import { RULESET } from '../../src/config.js';
import { rulesForMode } from '../../src/sim/rules.js';
import { dailySeed, encodeLog } from '../../src/sim/replay.js';
import type { NewScore, ScoreRepository } from './repository.js';
import { RATE_LIMIT_PER_MINUTE, submitScore } from './submitScore.js';

const NOW = new Date(Date.UTC(2026, 9, 31, 12));
const USER = '11111111-1111-4111-8111-111111111111';

function fakeRepo(overrides: Partial<ScoreRepository> = {}) {
  const inserted: NewScore[] = [];
  const repo: ScoreRepository = {
    userIdForToken: async (t) => (t === 'good' ? USER : null),
    countSince: async () => 0,
    insert: async (row) => {
      if (inserted.some((r) => r.inputHash === row.inputHash)) return 'duplicate';
      inserted.push(row);
      return { id: `id-${inserted.length}` };
    },
    rankFor: async (board) => (board === 'all' ? 7 : 2),
    getShared: async () => null,
    ...overrides,
  };
  return { repo, inserted };
}

// Bot 4 banks on this swamp, so `banked` is non-zero end to end.
const run = recordBotRun('golden', 4);
const body = { ruleset: RULESET, seed: 'golden', log: encodeLog(run.log) };

describe('submitScore', () => {
  it('records the server-replayed score and returns ranks', async () => {
    const { repo, inserted } = fakeRepo();
    const out = await submitScore(repo, 'good', body, NOW);
    expect(out).toEqual({
      ok: true,
      result: { id: 'id-1', mode: 'classic', score: run.score, eggs: expect.any(Number), banked: run.banked, ticks: run.log.length, rank: 7, dailyRank: null },
    });
    expect(inserted[0]).toMatchObject({ userId: USER, seed: 'golden', dailyDate: null, score: run.score, banked: run.banked });
  });

  it('ignores any client-claimed score fields', async () => {
    const { repo, inserted } = fakeRepo();
    await submitScore(repo, 'good', { ...body, score: 999_999 }, NOW);
    expect(inserted[0]?.score).toBe(run.score);
  });

  it('puts runs on today’s daily seed onto the daily board', async () => {
    const seed = dailySeed(NOW);
    const daily = recordBotRun(seed, 5);
    const { repo, inserted } = fakeRepo();
    const out = await submitScore(repo, 'good', { ruleset: RULESET, seed, log: encodeLog(daily.log) }, NOW);
    expect(out.ok && out.result.dailyRank).toBe(2);
    expect(inserted[0]?.dailyDate).toBe('2026-10-31');
  });

  it('does not count stale daily seeds toward the daily board', async () => {
    const seed = dailySeed(new Date(Date.UTC(2026, 9, 20)));
    const old = recordBotRun(seed, 5);
    const { repo, inserted } = fakeRepo();
    await submitScore(repo, 'good', { ruleset: RULESET, seed, log: encodeLog(old.log) }, NOW);
    expect(inserted[0]?.dailyDate).toBeNull();
  });

  it('treats a submission without a mode as classic', async () => {
    const { repo, inserted } = fakeRepo();
    await submitScore(repo, 'good', body, NOW);
    expect(inserted[0]?.mode).toBe('classic');
  });

  it('replays and stores ranked modes on their own board', async () => {
    const rush = recordBotRun('golden', 3, rulesForMode('rush'));
    const ranks: string[] = [];
    const { repo, inserted } = fakeRepo({
      rankFor: async (board, _day, mode) => (ranks.push(`${board}:${mode}`), 4),
    });
    const out = await submitScore(repo, 'good', { ruleset: RULESET, seed: 'golden', log: encodeLog(rush.log), mode: 'rush' }, NOW);
    expect(out).toMatchObject({ ok: true, result: { score: rush.score, mode: 'rush', rank: 4, dailyRank: null } });
    expect(inserted[0]).toMatchObject({ mode: 'rush', score: rush.score });
    expect(ranks).toEqual(['all:rush']);
  });

  it('keeps the daily board classic-only', async () => {
    const seed = dailySeed(NOW);
    const dash = recordBotRun(seed, 5, rulesForMode('ducklings'));
    const { repo, inserted } = fakeRepo();
    const out = await submitScore(repo, 'good', { ruleset: RULESET, seed, log: encodeLog(dash.log), mode: 'ducklings' }, NOW);
    expect(out.ok && out.result.dailyRank).toBeNull();
    expect(inserted[0]).toMatchObject({ mode: 'ducklings', dailyDate: null, banked: dash.banked });
  });

  it('does not treat the same log in another mode as a duplicate', async () => {
    const dash = recordBotRun('golden', 3, rulesForMode('ducklings'));
    const { repo, inserted } = fakeRepo();
    const log = encodeLog(dash.log);
    const a = await submitScore(repo, 'good', { ruleset: RULESET, seed: 'golden', log, mode: 'ducklings' }, NOW);
    const b = await submitScore(repo, 'good', { ruleset: RULESET, seed: 'golden', log, mode: 'classic' }, NOW);
    expect(a.ok).toBe(true);
    // Classic replays the same log to its own (possibly identical) result; either way it's a new row.
    expect(b.ok || (b as { status: number }).status === 422).toBe(true);
    expect(new Set(inserted.map((r) => r.inputHash)).size).toBe(inserted.length);
  });

  it('scopes the duplicate hash to the ruleset, so a new ruleset never collides with an old run', async () => {
    const { createHash } = await import('node:crypto');
    const { repo, inserted } = fakeRepo();
    await submitScore(repo, 'good', body, NOW);
    const hash = createHash('sha256').update(`r${RULESET}:classic:golden:${body.log}`).digest('hex');
    expect(inserted[0]?.inputHash).toBe(hash);
  });

  it('stores the ruleset with the run', async () => {
    const { repo, inserted } = fakeRepo();
    await submitScore(repo, 'good', body, NOW);
    expect(inserted[0]?.ruleset).toBe(RULESET);
  });

  it.each([
    ['a stale ruleset', { ...body, ruleset: RULESET - 1 }],
    ['a future ruleset', { ...body, ruleset: RULESET + 1 }],
    ['no ruleset (clients from before rulesets)', { seed: body.seed, log: body.log }],
    ['a stale client still offering Night Swamp', { seed: body.seed, log: body.log, mode: 'night' }],
  ])('answers 409 "please reload" for %s, before replaying anything', async (_name, payload) => {
    const { repo, inserted } = fakeRepo();
    const out = await submitScore(repo, 'good', payload, NOW);
    expect(out).toEqual({ ok: false, status: 409, error: 'Game updated: please reload' });
    expect(inserted).toHaveLength(0);
  });

  it.each([
    ['unknown mode', 'good', { ...body, mode: 'campaign' }, 400],
    ['retired mode on the current ruleset', 'good', { ...body, mode: 'night' }, 400],
    ['non-string mode', 'good', { ...body, mode: 2 }, 400],
    ['non-integer ruleset', 'good', { ...body, ruleset: 1.5 }, 400],
    ['missing token', null, body, 401],
    ['bad token', 'nope', body, 401],
    ['malformed body', 'good', { ruleset: RULESET, seed: 1 }, 400],
    ['invalid seed', 'good', { ...body, seed: 'BAD SEED!' }, 400],
    ['garbage log', 'good', { ...body, log: '!!notbase64' }, 400],
    ['log for another seed', 'good', { ...body, seed: 'other' }, 422],
    ['truncated log', 'good', { ...body, log: encodeLog(run.log.slice(0, -10)) }, 422],
    ['padded log', 'good', { ...body, log: encodeLog([...run.log, 0, 0]) }, 422],
  ] as const)('rejects %s', async (_name, token, payload, status) => {
    const { repo, inserted } = fakeRepo();
    const out = await submitScore(repo, token, payload, NOW);
    expect(out).toMatchObject({ ok: false, status });
    expect(inserted).toHaveLength(0);
  });

  it('rate limits rapid submissions', async () => {
    const { repo } = fakeRepo({ countSince: async () => RATE_LIMIT_PER_MINUTE });
    expect(await submitScore(repo, 'good', body, NOW)).toMatchObject({ ok: false, status: 429 });
  });

  it('rejects resubmitting the same run', async () => {
    const { repo } = fakeRepo();
    await submitScore(repo, 'good', body, NOW);
    expect(await submitScore(repo, 'good', body, NOW)).toMatchObject({ ok: false, status: 409 });
  });
});
