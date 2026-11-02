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
