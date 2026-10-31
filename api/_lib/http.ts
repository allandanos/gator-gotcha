/** Consistent JSON envelope for every API response. */
export type Envelope<T> = { ok: true; data: T; error: null } | { ok: false; data: null; error: string };

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export function ok<T>(data: T, status = 200): Response {
  const body: Envelope<T> = { ok: true, data, error: null };
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function fail(status: number, error: string): Response {
  const body: Envelope<never> = { ok: false, data: null, error };
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function bearerToken(request: Request): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '');
  return m ? (m[1] as string) : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string | null): s is string => !!s && UUID.test(s);

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Structured server log line (picked up by Vercel log drains). */
export function logError(event: string, detail: Record<string, unknown>): void {
  console.error(JSON.stringify({ level: 'error', event, ...detail }));
}
