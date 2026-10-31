import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;

export const isOnlineConfigured = (): boolean => Boolean(URL_ && KEY);

export function supabase(): SupabaseClient {
  if (!URL_ || !KEY) throw new Error('Online features are not configured');
  client ??= createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

/** Current user id without creating an account (null for visitors who never submitted). */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.user.id ?? null;
}

/** The current session's access token, or null; never creates an account. */
export async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}

/** Returns an access token, signing in anonymously on first use. */
export async function ensureSession(): Promise<{ token: string; userId: string }> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  if (data.session) return { token: data.session.access_token, userId: data.session.user.id };
  const { data: signed, error } = await sb.auth.signInAnonymously();
  if (error || !signed.session) throw new Error(error?.message ?? 'Could not start a session');
  return { token: signed.session.access_token, userId: signed.session.user.id };
}
