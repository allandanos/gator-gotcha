/** Deterministic PRNG (mulberry32). State is a plain uint32 so it can live in immutable world state. */
export class Rng {
  constructor(private s: number) {
    this.s = s >>> 0;
  }

  get state(): number {
    return this.s;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick on empty array');
    return items[Math.floor(this.next() * items.length)] as T;
  }
}

const SEED_PATTERN = /^[a-z0-9]{1,12}$/;

/** FNV-1a hash of a seed string to uint32. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Validate a user-supplied seed (URL param). Returns a normalized seed or null. */
export function parseSeed(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  return SEED_PATTERN.test(s) ? s : null;
}

export function randomSeed(random: () => number = Math.random): string {
  return Math.floor(random() * 36 ** 6)
    .toString(36)
    .padStart(6, '0');
}
