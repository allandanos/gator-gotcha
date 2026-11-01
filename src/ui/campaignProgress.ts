/**
 * Campaign progress: best stars per level, kept in localStorage (unranked, local only).
 * Pure and storage-injected so it can be tested.
 */
import { CAMPAIGN } from '../config';
import { LEVELS, type Level, type Stars } from '../sim/campaign';
import type { KeyValueStore } from './pendingRuns';

const KEY = 'gator-gotcha:campaign';
export type StarMap = Readonly<Record<number, Stars>>;

function isStars(v: unknown): v is Stars {
  return v === 0 || v === 1 || v === 2 || v === 3;
}

/** Parse stored progress, keeping only known level ids with a valid star count. */
export function parseProgress(raw: string | null): StarMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      ([id, stars]) => LEVELS.some((l) => String(l.id) === id) && isStars(stars),
    );
    return Object.fromEntries(entries.map(([id, stars]) => [Number(id), stars as Stars]));
  } catch {
    return {};
  }
}

export function totalStars(map: StarMap): number {
  return Object.values(map).reduce<number>((sum, s) => sum + s, 0);
}

export function isWorldUnlocked(world: number, map: StarMap): boolean {
  const gate = CAMPAIGN.worlds[world]?.starsToUnlock;
  return gate !== undefined && totalStars(map) >= gate;
}

/** A level opens when its world is unlocked and it's the world's first level or the previous one is cleared. */
export function isLevelUnlocked(level: Level, map: StarMap): boolean {
  if (!isWorldUnlocked(level.world, map)) return false;
  const firstInWorld = level.id === level.world * CAMPAIGN.levelsPerWorld + 1;
  return firstInWorld || (map[level.id - 1] ?? 0) > 0;
}

/** The next level worth playing after `id`: the following unlocked one, if any. */
export function nextLevel(id: number, map: StarMap): Level | null {
  const next = LEVELS.find((l) => l.id === id + 1);
  return next && isLevelUnlocked(next, map) ? next : null;
}

/** Keeps the best star count per level; returns the new map (the old one is untouched). */
export function withResult(map: StarMap, id: number, stars: Stars): StarMap {
  return stars > (map[id] ?? 0) ? { ...map, [id]: stars } : map;
}

export function createCampaignProgress(store: KeyValueStore | null) {
  const read = (): StarMap => {
    try {
      return parseProgress(store?.getItem(KEY) ?? null);
    } catch {
      return {};
    }
  };
  return {
    read,
    /** Record a finished level; returns the progress before and after. */
    record(id: number, stars: Stars): { before: StarMap; after: StarMap } {
      const before = read();
      const after = withResult(before, id, stars);
      if (after !== before) {
        try {
          store?.setItem(KEY, JSON.stringify(after));
        } catch {
          // Storage full or blocked: progress just won't persist.
        }
      }
      return { before, after };
    },
  };
}
