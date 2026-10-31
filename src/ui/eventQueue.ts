/**
 * Gameplay analytics events waiting to be posted to /api/events. Same shape as the pending-runs
 * queue: pure and storage-injected, so it is testable and survives offline play.
 */
import type { KeyValueStore } from './pendingRuns';

export type EventProps = Readonly<Record<string, string | number | boolean>>;

export interface QueuedEvent {
  readonly id: string;
  /** Page load the event happened in; a batch never mixes sessions. */
  readonly sessionId: string;
  readonly appVersion: string;
  readonly name: string;
  readonly props: EventProps;
  readonly ts: number;
}

export interface EventBatch {
  readonly sessionId: string;
  readonly appVersion: string;
  readonly events: readonly QueuedEvent[];
}

export const MAX_EVENTS = 200;
/** Matches the server's MAX_BATCH. */
export const BATCH_SIZE = 50;
const KEY = 'gator-gotcha:events';

function isQueuedEvent(v: unknown): v is QueuedEvent {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.sessionId === 'string' &&
    typeof e.appVersion === 'string' &&
    typeof e.name === 'string' &&
    typeof e.props === 'object' &&
    e.props !== null &&
    typeof e.ts === 'number'
  );
}

export function createEventQueue(store: KeyValueStore | null) {
  const read = (): QueuedEvent[] => {
    try {
      const raw = store?.getItem(KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isQueuedEvent) : [];
    } catch {
      return [];
    }
  };

  const write = (events: readonly QueuedEvent[]): void => {
    try {
      store?.setItem(KEY, JSON.stringify(events));
    } catch {
      // Storage full or blocked: analytics are best-effort, the game carries on.
    }
  };

  return {
    peekAll: (): readonly QueuedEvent[] => read(),
    count: (): number => read().length,
    enqueue(event: QueuedEvent): void {
      write([...read(), event].slice(-MAX_EVENTS));
    },
    /** The oldest session's events, up to BATCH_SIZE, or null when the queue is empty. */
    nextBatch(): EventBatch | null {
      const all = read();
      const first = all[0];
      if (!first) return null;
      const events = all.filter((e) => e.sessionId === first.sessionId).slice(0, BATCH_SIZE);
      return { sessionId: first.sessionId, appVersion: first.appVersion, events };
    },
    remove(sent: readonly QueuedEvent[]): void {
      const ids = new Set(sent.map((e) => e.id));
      write(read().filter((e) => !ids.has(e.id)));
    },
  };
}

export type EventQueue = ReturnType<typeof createEventQueue>;

/** RFC 4122 v4 uuid from 16 random bytes (crypto.randomUUID needs a secure context; this doesn't). */
export function uuidFromBytes(bytes: Uint8Array): string {
  const b = Uint8Array.from(bytes);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
