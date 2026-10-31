import { NICKNAME_PATTERN } from '../core/nickname';
import { parseSeed } from '../core/rng';

/** localStorage can be unavailable (private mode, blocked storage); every access is guarded. */
const KEYS = {
  best: 'gator-gotcha:best',
  muted: 'gator-gotcha:muted',
  nickname: 'gator-gotcha:nickname',
  seed: 'gator-gotcha:seed',
} as const;
/** supabase-js persists its session under `sb-<project-ref>-auth-token`. */
const SESSION_KEY = /^sb-[a-z0-9]+-auth-token$/;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the game still works, the value just won't persist.
  }
}

export function loadBest(): number {
  const n = Number.parseInt(read(KEYS.best) ?? '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function saveBest(score: number): void {
  write(KEYS.best, String(Math.floor(score)));
}

export function loadMuted(): boolean {
  return read(KEYS.muted) === '1';
}

export function saveMuted(muted: boolean): void {
  write(KEYS.muted, muted ? '1' : '0');
}

/** Last known nickname, cached so the title can greet the player offline and before the online chunk loads. */
export function loadNickname(): string | null {
  const name = read(KEYS.nickname);
  return name && NICKNAME_PATTERN.test(name) ? name : null;
}

export function saveNickname(name: string): void {
  if (NICKNAME_PATTERN.test(name)) write(KEYS.nickname, name);
}

/** The swamp last played, so an installed app (launched without ?seed=) reopens on it. */
export function loadSeed(): string | null {
  return parseSeed(read(KEYS.seed));
}

export function saveSeed(seed: string): void {
  const valid = parseSeed(seed);
  if (valid) write(KEYS.seed, valid);
}

/** Whether this browser already has an online session, checked without loading supabase-js. */
export function hasStoredSession(): boolean {
  try {
    const store = window.localStorage;
    for (let i = 0; i < store.length; i++) {
      if (SESSION_KEY.test(store.key(i) ?? '')) return true;
    }
  } catch {
    // Storage unavailable: treat as no session.
  }
  return false;
}
