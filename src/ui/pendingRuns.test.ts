import { createPendingRuns, flushDecision, MAX_PENDING, type KeyValueStore } from './pendingRuns';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const run = (n: number) => ({ seed: `s${n}`, log: `log${n}`, mode: 'classic' as const, finishedAt: 1000 + n });

describe('pending runs queue', () => {
  it('round-trips queued runs in order', () => {
    const q = createPendingRuns(memoryStore());
    q.enqueue(run(1));
    q.enqueue(run(2));
    expect(q.peekAll()).toEqual([run(1), run(2)]);
    expect(q.count()).toBe(2);
  });

  it('drops the oldest run when the cap is reached', () => {
    const q = createPendingRuns(memoryStore());
    for (let i = 0; i < MAX_PENDING + 3; i++) q.enqueue(run(i));
    const all = q.peekAll();
    expect(all).toHaveLength(MAX_PENDING);
    expect(all[0]).toEqual(run(3));
  });

  it('ignores a duplicate of an already queued run', () => {
    const q = createPendingRuns(memoryStore());
    q.enqueue(run(1));
    q.enqueue(run(1));
    expect(q.count()).toBe(1);
  });

  it('removes matching runs without mutating earlier snapshots', () => {
    const q = createPendingRuns(memoryStore());
    q.enqueue(run(1));
    q.enqueue(run(2));
    const before = q.peekAll();
    q.remove(run(1));
    expect(before).toHaveLength(2);
    expect(q.peekAll()).toEqual([run(2)]);
  });

  it('recovers from corrupt or malformed storage', () => {
    expect(createPendingRuns(memoryStore({ 'gator-gotcha:pending': '{nope' })).peekAll()).toEqual([]);
    const mixed = JSON.stringify([run(1), { seed: 5 }, null, { seed: 'x', log: 'y' }]);
    expect(createPendingRuns(memoryStore({ 'gator-gotcha:pending': mixed })).peekAll()).toEqual([run(1)]);
  });

  it('survives storage that throws', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const q = createPendingRuns(broken);
    expect(() => q.enqueue(run(1))).not.toThrow();
    expect(q.peekAll()).toEqual([]);
  });

  it('works without any storage', () => {
    const q = createPendingRuns(null);
    q.enqueue(run(1));
    expect(q.count()).toBe(0);
  });
});

describe('flushDecision', () => {
  it.each([
    [201, 'remove'],
    [200, 'remove'],
    [409, 'remove'],
    [400, 'remove'],
    [413, 'remove'],
    [422, 'remove'],
    [429, 'stop'],
    ['network', 'stop'],
    [401, 'keep'],
    [404, 'keep'],
    [405, 'keep'],
    [500, 'keep'],
    [503, 'keep'],
  ] as const)('status %s → %s', (status, expected) => {
    expect(flushDecision(status)).toBe(expected);
  });
});

describe('pending runs and modes', () => {
  it('reads runs queued before modes existed as classic', () => {
    const store = memoryStore({ 'gator-gotcha:pending': JSON.stringify([run(1)]) });
    expect(createPendingRuns(store).peekAll()).toEqual([{ ...run(1), mode: 'classic' }]);
  });

  it('keeps the same log in two modes as two runs, and drops unknown modes', () => {
    const q = createPendingRuns(memoryStore());
    q.enqueue({ ...run(1), mode: 'rush' });
    q.enqueue({ ...run(1), mode: 'night' });
    expect(q.peekAll().map((r) => r.mode)).toEqual(['rush', 'night']);
    q.remove({ ...run(1), mode: 'rush' });
    expect(q.peekAll().map((r) => r.mode)).toEqual(['night']);
    const bad = memoryStore({ 'gator-gotcha:pending': JSON.stringify([{ ...run(2), mode: 'campaign' }]) });
    expect(createPendingRuns(bad).peekAll()).toEqual([]);
  });
});
