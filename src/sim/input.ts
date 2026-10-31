import { datan2 } from '../core/dmath';
import { fromAngle, len } from '../core/vec';
import type { InputState } from './types';

/**
 * One byte per sim tick: bits 0–4 direction (32 steps), bits 5–6 magnitude level (0 = idle),
 * bit 7 sprint. The sim only ever sees dequantized input, so a recorded log replays exactly.
 */
const DIRECTIONS = 32;
const STEP = (Math.PI * 2) / DIRECTIONS;
const MAGNITUDES = [0, 0.4, 0.7, 1] as const;
const DEAD_ZONE = 0.1;

export type InputByte = number;

function magnitudeLevel(l: number): number {
  if (l < DEAD_ZONE) return 0;
  if (l > 0.85) return 3;
  if (l > 0.55) return 2;
  return 1;
}

export function quantizeInput(input: InputState): InputByte {
  const level = magnitudeLevel(len(input.move));
  const dir = level === 0 ? 0 : (((Math.round(datan2(input.move.y, input.move.x) / STEP) % DIRECTIONS) + DIRECTIONS) % DIRECTIONS);
  return dir | (level << 5) | (input.sprint ? 0x80 : 0);
}

export function dequantizeInput(b: InputByte): InputState {
  const level = (b >> 5) & 0b11;
  const move = level === 0 ? { x: 0, y: 0 } : fromAngle((b & 0b11111) * STEP, MAGNITUDES[level] as number);
  return { move, sprint: (b & 0x80) !== 0 };
}

const INITIAL_CAPACITY = 60 * 60 * 2;

/** Growable per-tick input log for a run. */
export class InputRecorder {
  private buf = new Uint8Array(INITIAL_CAPACITY);
  private n = 0;

  get length(): number {
    return this.n;
  }

  reset(): void {
    this.n = 0;
  }

  push(b: InputByte): void {
    if (this.n === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.n++] = b;
  }

  bytes(): Uint8Array {
    return this.buf.subarray(0, this.n);
  }
}
