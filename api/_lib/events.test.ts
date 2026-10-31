import {
  MAX_BATCH,
  normalizeBatch,
  parseBatch,
  RATE_LIMIT_EVENTS_PER_MINUTE,
  recordEvents,
} from './events.js';
import type { EventRepository, NewEvent } from './repository.js';

const NOW = new Date(Date.UTC(2026, 10, 1, 12));
const SESSION = '22222222-2222-4222-8222-222222222222';
const USER = '11111111-1111-4111-8111-111111111111';

const ev = (name: string, props: Record<string, unknown> = {}, ts = NOW.getTime()) => ({
  name,
  props,
  ts,
});
const batch = (events: unknown[]) => ({
  sessionId: SESSION,
  appVersion: 'abc1234',
  platform: 'web',
  events,
});

function fakeRepo(overrides: Partial<EventRepository> = {}) {
  const inserted: NewEvent[] = [];
  const repo: EventRepository = {
    userIdForToken: async (t) => (t === 'good' ? USER : null),
    countSince: async () => 0,
    insertMany: async (rows) => void inserted.push(...rows),
    ...overrides,
  };
  return { repo, inserted };
}

describe('parseBatch', () => {
  it('accepts a well-formed batch', () => {
    expect(parseBatch(batch([ev('retry')]))).not.toBeNull();
  });

  it('defaults the platform to web', () => {
    const { platform: _ignored, ...rest } = batch([ev('retry')]);
    expect(parseBatch(rest)?.platform).toBe('web');
  });

  it('rejects an empty or oversize batch', () => {
    expect(parseBatch(batch([]))).toBeNull();
    expect(parseBatch(batch(Array.from({ length: MAX_BATCH + 1 }, () => ev('retry'))))).toBeNull();
  });

  it('rejects a bad session id, app version or platform', () => {
    expect(parseBatch({ ...batch([ev('retry')]), sessionId: 'nope' })).toBeNull();
    expect(parseBatch({ ...batch([ev('retry')]), appVersion: '<script>' })).toBeNull();
    expect(parseBatch({ ...batch([ev('retry')]), platform: 'steam' })).toBeNull();
  });

  it('rejects non-object bodies and events without a timestamp', () => {
    expect(parseBatch(null)).toBeNull();
    expect(parseBatch({})).toBeNull();
    expect(parseBatch(batch([{ name: 'retry' }]))).toBeNull();
  });
});

describe('normalizeBatch', () => {
  const norm = (events: unknown[]) => normalizeBatch(parseBatch(batch(events))!, NOW);

  it('drops unknown events', () => {
    expect(norm([ev('hack_the_planet'), ev('retry')]).events.map((e) => e.name)).toEqual(['retry']);
  });

  it('drops unknown props and props of the wrong type', () => {
    const [e] = norm([
      ev('run_start', { seed: 'abc', daily: 'yes', fromOver: true, evil: 1 }),
    ]).events;
    expect(e?.props).toEqual({ seed: 'abc', fromOver: true });
  });

  it('clamps numbers into range and rounds integers', () => {
    const [e] = norm([ev('run_end', { sec: 99_999, eggs: -4, score: 12.7 })]).events;
    expect(e?.props).toEqual({ sec: 1200, eggs: 0, score: 13 });
  });

  it('truncates long strings', () => {
    const [e] = norm([ev('title_view', { installed: false, referrer: 'x'.repeat(200) })]).events;
    expect(e?.props.referrer).toHaveLength(64);
  });

  it('keeps only known share channels', () => {
    const out = norm([ev('share', { via: 'copy' }), ev('share', { via: 'myspace' })]).events;
    expect(out.map((e) => e.props)).toEqual([{ via: 'copy' }, {}]);
  });

  it('replaces implausible client timestamps with the server time', () => {
    const yearAgo = NOW.getTime() - 365 * 24 * 3600 * 1000;
    const future = NOW.getTime() + 3600 * 1000;
    const recent = NOW.getTime() - 60_000;
    const out = norm([
      ev('retry', {}, yearAgo),
      ev('retry', {}, future),
      ev('retry', {}, recent),
    ]).events;
    expect(out.map((e) => e.clientTs)).toEqual([
      NOW.toISOString(),
      NOW.toISOString(),
      new Date(recent).toISOString(),
    ]);
  });

  it('carries session, version and platform onto every event', () => {
    const out = norm([ev('install')]);
    expect(out).toMatchObject({ sessionId: SESSION, appVersion: 'abc1234', platform: 'web' });
  });
});

describe('recordEvents', () => {
  it('stores normalized events and returns how many were accepted', async () => {
    const { repo, inserted } = fakeRepo();
    const out = await recordEvents(
      repo,
      null,
      batch([ev('retry'), ev('bogus'), ev('install')]),
      NOW,
    );
    expect(out).toEqual({ ok: true, result: { accepted: 2 } });
    expect(inserted).toHaveLength(2);
    expect(inserted[0]).toMatchObject({
      sessionId: SESSION,
      userId: null,
      name: 'retry',
      props: {},
    });
  });

  it('attaches the user id when the bearer token is valid', async () => {
    const { repo, inserted } = fakeRepo();
    await recordEvents(repo, 'good', batch([ev('retry')]), NOW);
    expect(inserted[0]?.userId).toBe(USER);
  });

  it('never rejects because of a bad token', async () => {
    const { repo, inserted } = fakeRepo();
    const out = await recordEvents(repo, 'expired', batch([ev('retry')]), NOW);
    expect(out.ok).toBe(true);
    expect(inserted[0]?.userId).toBeNull();
  });

  it('rejects an invalid body with 400', async () => {
    const { repo } = fakeRepo();
    expect(await recordEvents(repo, null, { events: 'lots' }, NOW)).toEqual({
      ok: false,
      status: 400,
      error: 'Invalid events batch',
    });
  });

  it('accepts a batch of only unknown events without writing', async () => {
    const { repo, inserted } = fakeRepo();
    expect(await recordEvents(repo, null, batch([ev('bogus')]), NOW)).toEqual({
      ok: true,
      result: { accepted: 0 },
    });
    expect(inserted).toHaveLength(0);
  });

  it('rate-limits per session per minute', async () => {
    const since: string[] = [];
    const { repo, inserted } = fakeRepo({
      countSince: async (sessionId, sinceIso) => {
        since.push(`${sessionId}@${sinceIso}`);
        return RATE_LIMIT_EVENTS_PER_MINUTE - 1;
      },
    });
    const out = await recordEvents(repo, null, batch([ev('retry'), ev('retry')]), NOW);
    expect(out).toMatchObject({ ok: false, status: 429 });
    expect(inserted).toHaveLength(0);
    expect(since).toEqual([`${SESSION}@${new Date(NOW.getTime() - 60_000).toISOString()}`]);
  });
});
