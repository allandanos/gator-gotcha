import type { AudioEngine } from './audio';

const LOOKAHEAD = 0.12;
const TICK_MS = 25;
const CALM_BPM = 104;
const CHASE_BPM = 152;

/** G – C – G – D, two bars each; MIDI roots. */
const PROGRESSION = [43, 43, 48, 48, 43, 43, 50, 50];
/** Banjo forward-roll over a major triad: offsets in semitones from the chord root, 8 eighth notes per bar. */
const ROLL = [12, 16, 19, 24, 16, 19, 24, 19];

const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12);

/** Procedural bluegrass-ish loop. Intensity 0..1 raises tempo and adds a shaker. */
export class Music {
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private bpm = CALM_BPM;
  private intensity = 0;
  private bus: GainNode | null = null;

  constructor(private readonly engine: AudioEngine) {}

  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  start(): void {
    const { ctx, output } = this.engine;
    if (!ctx || !output || this.timer !== null) return;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.32;
    this.bus.connect(output);
    this.nextTime = ctx.currentTime + 0.05;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const { ctx } = this.engine;
    if (ctx && this.bus) {
      const bus = this.bus;
      bus.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      window.setTimeout(() => bus.disconnect(), 400);
    }
    this.bus = null;
  }

  private schedule(): void {
    const ctx = this.engine.ctx;
    if (!ctx || !this.bus) return;
    const targetBpm = CALM_BPM + (CHASE_BPM - CALM_BPM) * this.intensity;
    this.bpm += (targetBpm - this.bpm) * 0.08;
    const eighth = 60 / this.bpm / 2;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.nextTime, eighth);
      this.nextTime += eighth;
      this.step++;
    }
  }

  private playStep(t: number, eighth: number): void {
    const bar = Math.floor(this.step / 8) % PROGRESSION.length;
    const pos = this.step % 8;
    const root = PROGRESSION[bar] as number;
    this.pluck(midiToHz(root + (ROLL[pos] as number)), t, 0.09, eighth * 1.6);
    if (pos === 0 || pos === 4) {
      // Boom-chick bass: root then fifth.
      this.bass(midiToHz(root - 12 + (pos === 4 ? 7 : 0)), t, eighth * 1.8);
    }
    if (this.intensity > 0.4 && pos % 2 === 1) this.shaker(t, 0.05 * this.intensity);
  }

  private pluck(freq: number, t: number, gain: number, dur: number): void {
    const { ctx } = this.engine;
    if (!ctx || !this.bus) return;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 6, t);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.2, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter).connect(g).connect(this.bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private bass(freq: number, t: number, dur: number): void {
    const { ctx } = this.engine;
    if (!ctx || !this.bus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private shaker(t: number, gain: number): void {
    const { ctx } = this.engine;
    const buf = this.engine.noiseBuffer();
    if (!ctx || !this.bus || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(filter).connect(g).connect(this.bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.06);
  }
}
