import { SIM_DT } from '../config.js';
import { rulesForMode, type ModeId } from './rules.js';
import { scoreOf } from './scoring.js';
import { dequantizeInput, type InputByte } from './input.js';
import { createWorld, step } from './world.js';

/** Longest run the server will replay: 20 minutes of sim ticks. */
export const MAX_REPLAY_TICKS = 20 * 60 * 60;
/** Upper bound on an encoded log (base64 chars). */
export const MAX_ENCODED_LOG = 64 * 1024;

export type ReplayOutcome =
  | {
      readonly ok: true;
      readonly score: number;
      readonly eggs: number;
      /** Ducklings banked at the nest (0 in modes without ducklings). */
      readonly banked: number;
      readonly ticks: number;
    }
  | { readonly ok: false; readonly reason: 'empty' | 'too_long' | 'not_caught' | 'trailing_input' };

/** Run-length encode (count ≤ 255, byte) pairs, then base64. */
export function encodeLog(bytes: ArrayLike<InputByte>): string {
  const out: number[] = [];
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i] as number;
    let n = 1;
    while (n < 255 && i + n < bytes.length && bytes[i + n] === b) n++;
    out.push(n, b);
    i += n;
  }
  let bin = '';
  for (const v of out) bin += String.fromCharCode(v);
  return btoa(bin);
}

/** Decode a log; throws on malformed input or when it expands beyond `maxTicks`. */
export function decodeLog(encoded: string, maxTicks = MAX_REPLAY_TICKS): Uint8Array {
  if (encoded.length > MAX_ENCODED_LOG) throw new Error('log too large');
  const bin = atob(encoded);
  if (bin.length % 2 !== 0) throw new Error('malformed log');
  let total = 0;
  for (let i = 0; i < bin.length; i += 2) total += bin.charCodeAt(i);
  if (total > maxTicks) throw new Error('log too long');
  const out = new Uint8Array(total);
  let o = 0;
  for (let i = 0; i < bin.length; i += 2) {
    const n = bin.charCodeAt(i);
    if (n === 0) throw new Error('malformed log');
    out.fill(bin.charCodeAt(i + 1), o, o + n);
    o += n;
  }
  return out;
}

/**
 * Re-run a recorded game under a ranked mode. A valid run ends (caught, or out of time in a
 * timed mode) on exactly the last tick, so logs can't be truncated early or padded afterwards.
 */
export function replayRun(
  seed: string,
  inputs: ArrayLike<InputByte>,
  mode: ModeId = 'classic',
  maxTicks = MAX_REPLAY_TICKS,
): ReplayOutcome {
  if (inputs.length === 0) return { ok: false, reason: 'empty' };
  if (inputs.length > maxTicks) return { ok: false, reason: 'too_long' };
  let world = createWorld(seed, rulesForMode(mode));
  for (let i = 0; i < inputs.length; i++) {
    world = step(world, dequantizeInput(inputs[i] as number), SIM_DT);
    if (world.status !== 'playing') {
      if (i !== inputs.length - 1) return { ok: false, reason: 'trailing_input' };
      return {
        ok: true,
        score: scoreOf(world),
        eggs: world.eggsCollected,
        banked: world.bankedDucklings,
        ticks: inputs.length,
      };
    }
  }
  return { ok: false, reason: 'not_caught' };
}

/** Seed for the shared Daily Swamp, keyed by UTC date: `d20261031`. */
export function dailySeed(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `d${y}${m}${d}`;
}

/** ISO date (YYYY-MM-DD) for a daily seed, or null if the seed isn't a daily one. */
export function dailyDateOf(seed: string): string | null {
  const m = /^d(\d{4})(\d{2})(\d{2})$/.exec(seed);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
