import {
  BATCH_SIZE,
  createEventQueue,
  MAX_EVENTS,
  uuidFromBytes,
  type QueuedEvent,
} from './eventQueue';
import type { KeyValueStore } from './pendingRuns';
import { flushDecision } from './pendingRuns';

function memoryStore(
  initial: Record<string, string> = {},
): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const ev = (n: number, sessionId = 'sess-a'): QueuedEvent => ({
  id: `e${n}`,
  sessionId,
  appVersion: 'v1',
  name: 'retry',
  props: {},
  ts: 1000 + n,
});

describe('event queue', () => {
  it('round-trips events in order', () => {
    const q = createEventQueue(memoryStore());
    q.enqueue(ev(1));
    q.enqueue(ev(2));
    expect(q.peekAll()).toEqual([ev(1), ev(2)]);
    expect(q.count()).toBe(2);
  });

  it('drops the oldest events when the cap is reached', () => {
    const q = createEventQueue(memoryStore());
    for (let i = 0; i < MAX_EVENTS + 5; i++) q.enqueue(ev(i));
    const all = q.peekAll();
    expect(all).toHaveLength(MAX_EVENTS);
    expect(all[0]).toEqual(ev(5));
  });

  it('batches the oldest session first, at most BATCH_SIZE events', () => {
    const q = createEventQueue(memoryStore());
    q.enqueue(ev(0, 'old'));
    for (let i = 1; i <= BATCH_SIZE + 10; i++) q.enqueue(ev(i, i % 2 ? 'new' : 'old'));
    const batch = q.nextBatch();
    expect(batch?.sessionId).toBe('old');
    expect(batch?.appVersion).toBe('v1');
    expect(batch?.events.every((e) => e.sessionId === 'old')).toBe(true);
    expect(batch?.events[0]).toEqual(ev(0, 'old'));

    const big = createEventQueue(memoryStore());
    for (let i = 0; i < BATCH_SIZE + 10; i++) big.enqueue(ev(i));
    expect(big.nextBatch()?.events).toHaveLength(BATCH_SIZE);
  });

  it('returns no batch when empty', () => {
    expect(createEventQueue(memoryStore()).nextBatch()).toBeNull();
  });

  it('removes exactly the sent events, keeping ones queued meanwhile', () => {
    const q = createEventQueue(memoryStore());
    q.enqueue(ev(1));
    q.enqueue(ev(2));
    const batch = q.nextBatch()!;
    q.enqueue(ev(3));
    q.remove(batch.events);
    expect(q.peekAll()).toEqual([ev(3)]);
  });

  it('survives corrupt or missing storage', () => {
    expect(createEventQueue(memoryStore({ 'gator-gotcha:events': '{oops' })).peekAll()).toEqual([]);
    expect(createEventQueue(memoryStore({ 'gator-gotcha:events': '{"a":1}' })).peekAll()).toEqual(
      [],
    );
    const q = createEventQueue(null);
    q.enqueue(ev(1));
    expect(q.count()).toBe(0);
  });

  it('ignores malformed entries in storage', () => {
    const store = memoryStore({ 'gator-gotcha:events': JSON.stringify([ev(1), { id: 2 }, null]) });
    expect(createEventQueue(store).peekAll()).toEqual([ev(1)]);
  });

  it('keeps going when storage throws on write', () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    expect(() => createEventQueue(store).enqueue(ev(1))).not.toThrow();
  });
});

describe('event flush policy (shared with pending runs)', () => {
  it('drops a batch on 2xx and on final rejections', () => {
    for (const s of [202, 400, 409, 413, 422]) expect(flushDecision(s)).toBe('remove');
  });

  it('keeps a batch on 404 and 5xx', () => {
    for (const s of [404, 500, 503]) expect(flushDecision(s)).toBe('keep');
  });

  it('stops flushing when offline or rate-limited', () => {
    expect(flushDecision('network')).toBe('stop');
    expect(flushDecision(429)).toBe('stop');
  });
});

describe('uuidFromBytes', () => {
  it('formats 16 random bytes as an RFC 4122 v4 uuid', () => {
    const id = uuidFromBytes(new Uint8Array(16).fill(0xff));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidFromBytes(new Uint8Array(16))).toBe('00000000-0000-4000-8000-000000000000');
  });
});
