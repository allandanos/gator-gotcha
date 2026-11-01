import {
  bumpRunCount,
  loadBest,
  loadMode,
  saveBest,
  saveMode,
  hasStoredSession,
  loadInstallDismissedAt,
  loadNickname,
  loadSeed,
  markUpdatingFrom,
  saveInstallDismissedAt,
  saveNickname,
  saveSeed,
  takeUpdatedFrom,
} from './storage';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
  };
}

const throwing = {
  get localStorage(): Storage {
    throw new Error('SecurityError');
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('nickname cache', () => {
  it('round-trips a valid nickname', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
    saveNickname('Duck Quacker');
    expect(loadNickname()).toBe('Duck Quacker');
  });

  it('ignores invalid names on write and on read', () => {
    vi.stubGlobal('window', {
      localStorage: memoryStorage({ 'gator-gotcha:nickname': '<script>' }),
    });
    expect(loadNickname()).toBeNull();
    saveNickname('x');
    expect(loadNickname()).toBeNull();
  });
});

describe('seed memory', () => {
  it('round-trips a seed, normalised', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
    saveSeed('ABC123');
    expect(loadSeed()).toBe('abc123');
  });

  it('returns null for a corrupt stored seed', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage({ 'gator-gotcha:seed': '../etc' }) });
    expect(loadSeed()).toBeNull();
  });
});

describe('hasStoredSession', () => {
  it('detects a persisted supabase session', () => {
    vi.stubGlobal('window', {
      localStorage: memoryStorage({ 'sb-ecjoimtngyohebssnxrw-auth-token': '{}' }),
    });
    expect(hasStoredSession()).toBe(true);
  });

  it('is false without one', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage({ 'gator-gotcha:best': '10' }) });
    expect(hasStoredSession()).toBe(false);
  });
});

describe('unavailable storage', () => {
  it('never throws', () => {
    vi.stubGlobal('window', throwing);
    expect(() => saveSeed('abc123')).not.toThrow();
    expect(() => saveNickname('Duck1234')).not.toThrow();
    expect(loadSeed()).toBeNull();
    expect(loadNickname()).toBeNull();
    expect(hasStoredSession()).toBe(false);
  });
});

describe('update marker', () => {
  it('is read once after an update reload', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
    markUpdatingFrom('abc1234');
    expect(takeUpdatedFrom()).toBe('abc1234');
    expect(takeUpdatedFrom()).toBeNull();
  });

  it('is null when storage is unavailable', () => {
    vi.stubGlobal('window', throwing);
    markUpdatingFrom('abc1234');
    expect(takeUpdatedFrom()).toBeNull();
  });
});

describe('install offer memory', () => {
  it('counts finished runs', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
    expect(bumpRunCount()).toBe(1);
    expect(bumpRunCount()).toBe(2);
  });

  it('restarts the count from a corrupt value', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage({ 'gator-gotcha:runs': 'lots' }) });
    expect(bumpRunCount()).toBe(1);
  });

  it('round-trips the "Not now" time and rejects garbage', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
    expect(loadInstallDismissedAt()).toBeNull();
    saveInstallDismissedAt(1_790_000_000_000);
    expect(loadInstallDismissedAt()).toBe(1_790_000_000_000);
    vi.stubGlobal('window', {
      localStorage: memoryStorage({ 'gator-gotcha:install-dismissed': '-5' }),
    });
    expect(loadInstallDismissedAt()).toBeNull();
  });

  it('degrades to "first run, never dismissed" without storage', () => {
    vi.stubGlobal('window', throwing);
    expect(bumpRunCount()).toBe(1);
    expect(loadInstallDismissedAt()).toBeNull();
  });
});

describe('per-mode best and last mode', () => {
  it('keeps classic on the original key and other modes apart', () => {
    const storage = memoryStorage({ 'gator-gotcha:best': '1200' });
    vi.stubGlobal('window', { localStorage: storage });
    expect(loadBest('classic')).toBe(1200);
    expect(loadBest('rush')).toBe(0);
    saveBest('rush', 900.7);
    expect(loadBest('rush')).toBe(900);
    expect(loadBest('classic')).toBe(1200);
    expect(storage.getItem('gator-gotcha:best:rush')).toBe('900');
  });

  it('remembers the last ranked mode and ignores junk', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage({ 'gator-gotcha:mode': 'turbo' }) });
    expect(loadMode()).toBe('classic');
    saveMode('night');
    expect(loadMode()).toBe('night');
  });

  it('falls back when storage is blocked', () => {
    vi.stubGlobal('window', throwing);
    expect(loadBest('night')).toBe(0);
    expect(loadMode()).toBe('classic');
    expect(() => saveMode('rush')).not.toThrow();
  });
});
