import type { GameEvent } from '../sim/types';
import type { AudioEngine } from './audio';

function tone(
  engine: AudioEngine,
  type: OscillatorType,
  from: number,
  to: number,
  start: number,
  dur: number,
  gain: number,
): void {
  const { ctx, output } = engine;
  if (!ctx || !output) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(output);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function noiseBurst(engine: AudioEngine, start: number, dur: number, gain: number, freq: number, q = 1): void {
  const { ctx, output } = engine;
  const buf = engine.noiseBuffer();
  if (!ctx || !output || !buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, start);
  filter.frequency.exponentialRampToValueAtTime(freq * 2.5, start + dur);
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(g).connect(output);
  src.start(start);
  src.stop(start + dur + 0.02);
}

export function playEvents(engine: AudioEngine, events: readonly GameEvent[]): void {
  const ctx = engine.ctx;
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const e of events) {
    switch (e.type) {
      case 'pickup':
        tone(engine, 'triangle', 880, 1320, now, 0.09, 0.25);
        tone(engine, 'triangle', 1320, 1760, now + 0.07, 0.12, 0.22);
        break;
      case 'spotted':
        tone(engine, 'square', 440, 660, now, 0.08, 0.12);
        tone(engine, 'square', 660, 880, now + 0.08, 0.14, 0.12);
        break;
      case 'lost':
        tone(engine, 'triangle', 520, 360, now, 0.25, 0.12);
        break;
      case 'sprintStart':
        noiseBurst(engine, now, 0.18, 0.18, 900, 0.8);
        break;
      case 'hatch': {
        // A peep that climbs a semitone per duckling in tow.
        const f = 1100 * Math.pow(2, Math.min(e.count, 12) / 12);
        tone(engine, 'sine', f, f * 1.25, now + 0.1, 0.07, 0.16);
        break;
      }
      case 'goldenPickup':
        for (const [i, f] of [1320, 1660, 1980, 2640].entries()) {
          tone(engine, 'triangle', f, f * 1.01, now + i * 0.05, 0.18, 0.14);
        }
        noiseBurst(engine, now, 0.4, 0.22, 500, 0.7);
        break;
      case 'snapped':
        noiseBurst(engine, now, 0.12, 0.45, 260, 0.9);
        tone(engine, 'square', 180, 70, now, 0.14, 0.2);
        break;
      case 'banked': {
        // A major chord; each extra duckling stacks another voice up the arpeggio.
        const voices = Math.min(3 + Math.floor(e.count / 3), 7);
        const steps = [0, 4, 7, 12, 16, 19, 24];
        for (let i = 0; i < voices; i++) {
          const f = 392 * Math.pow(2, (steps[i] as number) / 12);
          tone(engine, 'triangle', f, f, now + i * 0.04, 0.5 + e.count * 0.03, 0.12);
        }
        break;
      }
      case 'nightfall':
        // A low falling hum as the light goes.
        tone(engine, 'sine', 220, 110, now, 1.2, 0.14);
        tone(engine, 'triangle', 330, 165, now + 0.15, 1.0, 0.07);
        break;
      case 'daybreak':
        tone(engine, 'sine', 660, 990, now, 0.25, 0.1);
        tone(engine, 'sine', 990, 1320, now + 0.2, 0.3, 0.08);
        break;
      case 'caught':
        tone(engine, 'sawtooth', 220, 55, now, 0.35, 0.3);
        noiseBurst(engine, now, 0.25, 0.4, 300, 0.6);
        tone(engine, 'square', 130, 60, now + 0.12, 0.3, 0.15);
        break;
    }
  }
}

/** "Close shave!": a quick rising whistle. */
export function playNearMiss(engine: AudioEngine): void {
  const ctx = engine.ctx;
  if (!ctx) return;
  tone(engine, 'sine', 600, 1500, ctx.currentTime, 0.16, 0.18);
  tone(engine, 'triangle', 1500, 1900, ctx.currentTime + 0.12, 0.1, 0.12);
}
