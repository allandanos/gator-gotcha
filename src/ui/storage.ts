import { NICKNAME_PATTERN } from '../core/nickname';
import { parseMode, type ModeId } from '../sim/rules';

/** localStorage can be unavailable (private mode, blocked storage); every access is guarded. */
const KEYS = {
  best: 'gator-gotcha:best',
  muted: 'gator-gotcha:muted',
  nickname: 'gator-gotcha:nickname',
  updatedFrom: 'gator-gotcha:updated-from',
  runs: 'gator-gotcha:runs',
  installDismissed: 'gator-gotcha:install-dismissed',
  mode: 'gator-gotcha:mode',
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

/** Classic keeps the original key so existing bests carry over. */
const bestKey = (mode: ModeId): string => (mode === 'classic' ? KEYS.best : `${KEYS.best}:${mode}`);

export function loadBest(mode: ModeId): number {
  const n = Number.parseInt(read(bestKey(mode)) ?? '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function saveBest(mode: ModeId, score: number): void {
  write(bestKey(mode), String(Math.floor(score)));
}

/** The ranked mode "Play" starts; classic until the player picks another. */
export function loadMode(): ModeId {
  return parseMode(read(KEYS.mode)) ?? 'classic';
}

export function saveMode(mode: ModeId): void {
  write(KEYS.mode, mode);
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

function readPositiveInt(key: string): number | null {
  const n = Number(read(key));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Count one more finished run and return the new total (drives when to offer an install). */
export function bumpRunCount(): number {
  const runs = (readPositiveInt(KEYS.runs) ?? 0) + 1;
  write(KEYS.runs, String(runs));
  return runs;
}

/** When the player last chose "Not now" on the install card (epoch ms), if ever. */
export function loadInstallDismissedAt(): number | null {
  return readPositiveInt(KEYS.installDismissed);
}

export function saveInstallDismissedAt(at: number): void {
  write(KEYS.installDismissed, String(Math.floor(at)));
}

/** Remember the running build just before reloading into an update. */
export function markUpdatingFrom(version: string): void {
  write(KEYS.updatedFrom, version);
}

/** The build an update reload came from (read once), so the new build can report the update. */
export function takeUpdatedFrom(): string | null {
  const from = read(KEYS.updatedFrom);
  if (from === null) return null;
  try {
    window.localStorage.removeItem(KEYS.updatedFrom);
  } catch {
    // Storage unavailable: nothing was stored either.
  }
  return from;
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
