import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseMode, type ModeId } from '../../src/sim/rules.js';

export type Board = 'all' | 'daily';

export interface NewScore {
  readonly userId: string;
  readonly seed: string;
  readonly mode: ModeId;
  readonly dailyDate: string | null;
  readonly score: number;
  readonly eggs: number;
  readonly ticks: number;
  readonly inputHash: string;
}

export interface SharedScore {
  readonly id: string;
  readonly seed: string;
  readonly mode: ModeId;
  readonly dailyDate: string | null;
  readonly score: number;
  readonly eggs: number;
  readonly ticks: number;
  readonly nickname: string;
}

/** Data access the API needs; the Supabase implementation is swapped for a fake in tests. */
export interface ScoreRepository {
  userIdForToken(token: string): Promise<string | null>;
  countSince(userId: string, sinceIso: string): Promise<number>;
  insert(row: NewScore): Promise<{ id: string } | 'duplicate'>;
  rankFor(board: Board, day: string | null, mode: ModeId, userId: string, score: number): Promise<number>;
  getShared(id: string): Promise<SharedScore | null>;
}

export interface NewEvent {
  readonly sessionId: string;
  readonly userId: string | null;
  readonly name: string;
  readonly props: Readonly<Record<string, string | number | boolean>>;
  readonly platform: string;
  readonly appVersion: string;
  readonly clientTs: string;
}

/** Write-only access to the analytics events table (clients can never read it). */
export interface EventRepository {
  userIdForToken(token: string): Promise<string | null>;
  countSince(sessionId: string, sinceIso: string): Promise<number>;
  insertMany(rows: readonly NewEvent[]): Promise<void>;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

let admin: SupabaseClient | null = null;

/** Service-role client. Server-only: never import this from src/. */
function adminClient(): SupabaseClient {
  admin ??= createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

const UNIQUE_VIOLATION = '23505';

async function userIdForToken(client: SupabaseClient, token: string): Promise<string | null> {
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

export function supabaseRepository(client: SupabaseClient = adminClient()): ScoreRepository {
  return {
    userIdForToken: (token) => userIdForToken(client, token),
    async countSince(userId, sinceIso) {
      const { count, error } = await client
        .from('scores')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', sinceIso);
      if (error) throw new Error(`countSince: ${error.message}`);
      return count ?? 0;
    },
    async insert(row) {
      const { data, error } = await client
        .from('scores')
        .insert({
          user_id: row.userId,
          seed: row.seed,
          mode: row.mode,
          daily_date: row.dailyDate,
          score: row.score,
          eggs: row.eggs,
          ticks: row.ticks,
          input_hash: row.inputHash,
        })
        .select('id')
        .single();
      if (error?.code === UNIQUE_VIOLATION) return 'duplicate';
      if (error || !data) throw new Error(`insert: ${error?.message ?? 'no row'}`);
      return { id: data.id as string };
    },
    async rankFor(board, day, mode, userId, score) {
      const { data, error } = await client.rpc('rank_for', {
        board,
        day,
        mode,
        player: userId,
        value: score,
      });
      if (error) throw new Error(`rankFor: ${error.message}`);
      return Number(data);
    },
    async getShared(id) {
      const { data, error } = await client
        .from('scores')
        .select('id, seed, mode, daily_date, score, eggs, ticks, profiles(nickname)')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(`getShared: ${error.message}`);
      if (!data) return null;
      const profile = data.profiles as unknown as { nickname: string } | null;
      return {
        id: data.id as string,
        seed: data.seed as string,
        mode: parseMode(data.mode) ?? 'classic',
        dailyDate: (data.daily_date as string | null) ?? null,
        score: data.score as number,
        eggs: data.eggs as number,
        ticks: data.ticks as number,
        nickname: profile?.nickname ?? 'A duck',
      };
    },
  };
}

export function supabaseEventRepository(client: SupabaseClient = adminClient()): EventRepository {
  return {
    userIdForToken: (token) => userIdForToken(client, token),
    async countSince(sessionId, sinceIso) {
      const { count, error } = await client
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)
        .gte('created_at', sinceIso);
      if (error) throw new Error(`countSince(events): ${error.message}`);
      return count ?? 0;
    },
    async insertMany(rows) {
      const { error } = await client.from('events').insert(
        rows.map((r) => ({
          session_id: r.sessionId,
          user_id: r.userId,
          name: r.name,
          props: r.props,
          platform: r.platform,
          app_version: r.appVersion,
          client_ts: r.clientTs,
        })),
      );
      if (error) throw new Error(`insertMany(events): ${error.message}`);
    },
  };
}
