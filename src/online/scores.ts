import { currentUserId, ensureSession, supabase } from './client';

export type Board = 'all' | 'daily';

export interface SubmitResult {
  readonly id: string;
  readonly score: number;
  readonly eggs: number;
  readonly ticks: number;
  readonly rank: number;
  readonly dailyRank: number | null;
}

export interface BoardRow {
  readonly rank: number;
  readonly userId: string;
  readonly nickname: string;
  readonly avatarUrl: string | null;
  readonly score: number;
  readonly eggs: number;
  readonly ticks: number;
  readonly scoreId: string;
}

export interface Challenge {
  readonly id: string;
  readonly seed: string;
  readonly score: number;
  readonly nickname: string;
}

interface Envelope<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

/** A failed submission, carrying the HTTP status (or 'network' when the server was never reached). */
export class SubmitError extends Error {
  constructor(
    message: string,
    readonly status: number | 'network',
  ) {
    super(message);
    this.name = 'SubmitError';
  }
}

/** Submit a finished run for server-side replay verification. */
export async function submitRun(seed: string, log: string): Promise<SubmitResult> {
  let res: Response;
  try {
    const { token } = await ensureSession();
    res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ seed, log }),
    });
  } catch (err) {
    // fetch (or the anonymous sign-in) never reached a server.
    throw new SubmitError(err instanceof Error ? err.message : 'Network error', 'network');
  }
  let body: Envelope<SubmitResult> | null = null;
  try {
    body = (await res.json()) as Envelope<SubmitResult>;
  } catch {
    // Non-JSON (e.g. offline proxy page) falls through to the generic error.
  }
  if (!res.ok || !body?.ok || !body.data) {
    throw new SubmitError(body?.error ?? `Server error (${res.status})`, res.ok ? 500 : res.status);
  }
  return body.data;
}

export async function fetchBoard(board: Board, day: string | null, limit = 50): Promise<BoardRow[]> {
  const { data, error } = await supabase().rpc('leaderboard', { board, day, lim: limit });
  if (error) throw new Error(error.message);
  return (data as Array<Record<string, unknown>>).map((r) => ({
    rank: Number(r.rank),
    userId: r.user_id as string,
    nickname: r.nickname as string,
    avatarUrl: (r.avatar_url as string | null) ?? null,
    score: r.score as number,
    eggs: r.eggs as number,
    ticks: r.ticks as number,
    scoreId: r.score_id as string,
  }));
}

export async function fetchChallenge(id: string): Promise<Challenge | null> {
  const { data, error } = await supabase()
    .from('scores')
    .select('id, seed, score, profiles(nickname)')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  const profile = data.profiles as unknown as { nickname: string } | null;
  return { id: data.id, seed: data.seed, score: data.score, nickname: profile?.nickname ?? 'A duck' };
}

export async function getMyNickname(): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const { data } = await supabase().from('profiles').select('nickname').eq('id', userId).maybeSingle();
  return (data?.nickname as string | undefined) ?? null;
}

export const NICKNAME_PATTERN = /^[A-Za-z0-9_ ]{3,16}$/;

export async function setNickname(nickname: string): Promise<void> {
  const trimmed = nickname.trim();
  if (!NICKNAME_PATTERN.test(trimmed)) throw new Error('Use 3–16 letters, numbers, spaces or _');
  const { userId } = await ensureSession();
  const { error } = await supabase().from('profiles').update({ nickname: trimmed }).eq('id', userId);
  if (error) throw new Error(error.code === '23514' ? 'That name isn’t allowed' : 'Could not save name');
}

export { currentUserId };
