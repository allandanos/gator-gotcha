/**
 * First-party gameplay analytics: events are queued in localStorage and posted to /api/events in
 * batches. Best-effort by design: nothing here may break or slow down the game.
 */
import { createEventQueue, uuidFromBytes, type EventBatch, type EventProps } from './eventQueue';
import { browserStore, flushDecision, type SubmitStatus } from './pendingRuns';

export type EventName =
  'title_view' | 'run_start' | 'run_end' | 'retry' | 'share' | 'install' | 'update_applied';
type TokenProvider = () => Promise<string | null>;

const ENDPOINT = '/api/events';
/** The queue holds 200 events and a batch carries 50, so four requests drain it. */
const MAX_BATCHES_PER_FLUSH = 4;

export const APP_VERSION = __APP_VERSION__;

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return uuidFromBytes(bytes);
}

const SESSION_ID = randomId();
const queue = createEventQueue(browserStore());
let tokenProvider: TokenProvider = async () => null;
let flushing = false;

/** Lets the online layer attach the player's id, without making analytics load supabase-js. */
export function setTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

export function track(name: EventName, props: EventProps = {}): void {
  queue.enqueue({
    id: randomId(),
    sessionId: SESSION_ID,
    appVersion: APP_VERSION,
    name,
    props,
    ts: Date.now(),
  });
}

async function send(batch: EventBatch): Promise<SubmitStatus> {
  try {
    const token = await tokenProvider().catch(() => null);
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      // keepalive lets the request finish when the page is being hidden or closed.
      keepalive: true,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        sessionId: batch.sessionId,
        appVersion: batch.appVersion,
        platform: 'web',
        events: batch.events.map(({ name, props, ts }) => ({ name, props, ts })),
      }),
    });
    return response.status;
  } catch {
    return 'network';
  }
}

/** Post queued events. 2xx and final rejections drop a batch; 404/5xx keep it; offline and 429 stop. */
export async function flushEvents(): Promise<void> {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    for (let i = 0; i < MAX_BATCHES_PER_FLUSH; i++) {
      const batch = queue.nextBatch();
      if (!batch) return;
      if (flushDecision(await send(batch)) !== 'remove') return;
      queue.remove(batch.events);
    }
  } finally {
    flushing = false;
  }
}

/** Flush when connectivity returns and when the page is hidden (tab switch, app backgrounded, close). */
export function setupAnalyticsFlush(): void {
  window.addEventListener('online', () => void flushEvents());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void flushEvents();
  });
}
