import { recordBotRun } from '../../src/sim/__fixtures__/recordBot.js';
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

const run = recordBotRun('golden', 3);
const body = { seed: 'golden', log: encodeLog(run.log) };

describe('submitScore', () => {
  it('records the server-replayed score and returns ranks', async () => {
    const { repo, inserted } = fakeRepo();
    const out = await submitScore(repo, 'good', body, NOW);
    expect(out).toEqual({
      ok: true,
      result: { id: 'id-1', score: run.score, eggs: expect.any(Number), ticks: run.log.length, rank: 7, dailyRank: null },
    });
    expect(inserted[0]).toMatchObject({ userId: USER, seed: 'golden', dailyDate: null, score: run.score });
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
    const out = await submitScore(repo, 'good', { seed, log: encodeLog(daily.log) }, NOW);
    expect(out.ok && out.result.dailyRank).toBe(2);
    expect(inserted[0]?.dailyDate).toBe('2026-10-31');
  });

  it('does not count stale daily seeds toward the daily board', async () => {
    const seed = dailySeed(new Date(Date.UTC(2026, 9, 20)));
    const old = recordBotRun(seed, 5);
    const { repo, inserted } = fakeRepo();
    await submitScore(repo, 'good', { seed, log: encodeLog(old.log) }, NOW);
    expect(inserted[0]?.dailyDate).toBeNull();
  });

  it.each([
    ['missing token', null, body, 401],
    ['bad token', 'nope', body, 401],
    ['malformed body', 'good', { seed: 1 }, 400],
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
