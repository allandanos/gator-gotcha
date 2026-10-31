/** localStorage can be unavailable (private mode, blocked storage); every access is guarded. */
const KEYS = { best: 'gator-gotcha:best', muted: 'gator-gotcha:muted' } as const;

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
