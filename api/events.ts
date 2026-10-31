import { recordEvents } from './_lib/events.js';
import { bearerToken, fail, logError, ok } from './_lib/http.js';
import { supabaseEventRepository } from './_lib/repository.js';

export const config = { maxDuration: 10 };

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: Request): Promise<Response> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) return fail(413, 'Batch too large');
  let body: unknown;
  try {
    // Re-check after reading: a chunked request carries no content-length.
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return fail(413, 'Batch too large');
    body = JSON.parse(text);
  } catch {
    return fail(400, 'Invalid JSON');
  }
  try {
    const outcome = await recordEvents(
      supabaseEventRepository(),
      bearerToken(request),
      body,
      new Date(),
    );
    return outcome.ok ? ok(outcome.result, 202) : fail(outcome.status, outcome.error);
  } catch (err) {
    logError('record_events_failed', { message: err instanceof Error ? err.message : String(err) });
    return fail(500, 'Could not record events right now');
  }
}
