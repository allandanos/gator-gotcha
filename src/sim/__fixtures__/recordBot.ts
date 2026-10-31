import { SIM_DT } from '../../config.js';
import { Rng } from '../../core/rng.js';
import { dist, normalize, sub } from '../../core/vec.js';
import { dequantizeInput, quantizeInput } from '../input.js';
import { computeScore } from '../scoring.js';
import { createWorld, step } from '../world.js';

/**
 * Test fixture: play a scripted egg-hunting bot, recording quantized input exactly like the
 * client does. Returns the log and the score the client would display.
 */
export function recordBotRun(seed: string, botSeed: number): { log: number[]; score: number } {
  const rng = new Rng(botSeed);
  let w = createWorld(seed);
  const log: number[] = [];
  while (w.status === 'playing' && log.length < 60 * 60 * 5) {
    const duck = w.duck.pos;
    const egg = w.eggs.reduce((a, b) => (dist(a.pos, duck) < dist(b.pos, duck) ? a : b));
    const toEgg = normalize(sub(egg.pos, duck));
    const move = { x: toEgg.x + rng.range(-0.6, 0.6), y: toEgg.y + rng.range(-0.6, 0.6) };
    const b = quantizeInput({ move, sprint: w.gator.mode === 'chase' });
    log.push(b);
    w = step(w, dequantizeInput(b), SIM_DT);
  }
  return { log, score: computeScore(w.eggsCollected, w.time) };
}
