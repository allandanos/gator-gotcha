/**
 * Finished runs waiting to be posted to the leaderboard (offline play, flaky networks).
 * Pure and storage-injected so it can be tested and never pulls in the online bundle.
 */

export interface PendingRun {
  readonly seed: string;
  readonly log: string;
  readonly finishedAt: number;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type SubmitStatus = number | 'network';
export type FlushDecision = 'remove' | 'stop' | 'keep';

export const MAX_PENDING = 25;
const KEY = 'gator-gotcha:pending';
/** Bad request, duplicate, too large, failed replay. */
const FINAL_REJECTIONS = new Set([400, 409, 413, 422]);

function isPendingRun(v: unknown): v is PendingRun {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.seed === 'string' && typeof r.log === 'string' && typeof r.finishedAt === 'number';
}

const sameRun = (a: PendingRun, b: PendingRun) => a.seed === b.seed && a.log === b.log;

/** What to do with a queued run after the server answered with `status`. */
export function flushDecision(status: SubmitStatus): FlushDecision {
  if (status === 'network' || status === 429) return 'stop';
  // Accepted, already posted, or rejected by the replay judge: either way it's done.
  if ((status >= 200 && status < 300) || FINAL_REJECTIONS.has(status)) return 'remove';
  // Expired session, missing endpoint (bad deploy) or server trouble: try again next time.
  return 'keep';
}

export function createPendingRuns(store: KeyValueStore | null) {
  const read = (): PendingRun[] => {
    try {
      const raw = store?.getItem(KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isPendingRun) : [];
    } catch {
      return [];
    }
  };

  const write = (runs: readonly PendingRun[]): void => {
    try {
      store?.setItem(KEY, JSON.stringify(runs));
    } catch {
      // Storage full or blocked: the run is lost, but the game carries on.
    }
  };

  return {
    peekAll: (): readonly PendingRun[] => read(),
    count: (): number => read().length,
    enqueue(run: PendingRun): void {
      const runs = read();
      if (runs.some((r) => sameRun(r, run))) return;
      write([...runs, run].slice(-MAX_PENDING));
    },
    remove(run: PendingRun): void {
      write(read().filter((r) => !sameRun(r, run)));
    },
  };
}

export type PendingRuns = ReturnType<typeof createPendingRuns>;

export function browserStore(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
