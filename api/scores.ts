import { bearerToken, fail, logError, ok } from './_lib/http';
import { supabaseRepository } from './_lib/repository';
import { submitScore } from './_lib/submitScore';

export const config = { maxDuration: 30 };

const MAX_BODY_BYTES = 80 * 1024;

export async function POST(request: Request): Promise<Response> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) return fail(413, 'Submission too large');
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'Invalid JSON');
  }
  try {
    const outcome = await submitScore(supabaseRepository(), bearerToken(request), body, new Date());
    return outcome.ok ? ok(outcome.result, 201) : fail(outcome.status, outcome.error);
  } catch (err) {
    logError('submit_score_failed', { message: err instanceof Error ? err.message : String(err) });
    return fail(500, 'Could not save your score right now');
  }
}
