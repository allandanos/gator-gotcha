import { SIM_DT } from '../../config.js';
import { Rng } from '../../core/rng.js';
import { dist, normalize, sub } from '../../core/vec.js';
import { dequantizeInput, quantizeInput } from '../input.js';
import { CLASSIC, type RunRules } from '../rules.js';
import { scoreOf } from '../scoring.js';
import { createWorld, step } from '../world.js';

/**
 * Test fixture: play a scripted egg-hunting bot, recording quantized input exactly like the
 * client does. Returns the log and the score the client would display.
 */
export function recordBotRun(
  seed: string,
  botSeed: number,
  rules: RunRules = CLASSIC,
): { log: number[]; score: number; status: string } {
  const rng = new Rng(botSeed);
  let w = createWorld(seed, rules);
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
  return { log, score: scoreOf(w), status: w.status };
}

/** Test fixture: hold still while unseen, dash straight away from the gator while chased. */
export function recordEvasiveRun(
  seed: string,
  rules: RunRules,
  cap = 60 * 60 * 3,
): { log: number[]; status: string; score: number } {
  let w = createWorld(seed, rules);
  const log: number[] = [];
  while (w.status === 'playing' && log.length < cap) {
    const chased = w.gator.mode === 'chase';
    const b = quantizeInput({
      move: chased ? normalize(sub(w.duck.pos, w.gator.pos)) : { x: 0, y: 0 },
      sprint: chased,
    });
    log.push(b);
    w = step(w, dequantizeInput(b), SIM_DT);
  }
  return { log, status: w.status, score: scoreOf(w) };
}
