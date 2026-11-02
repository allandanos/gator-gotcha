import { SIM_DT } from '../../config.js';
import { Rng } from '../../core/rng.js';
import { dist, normalize, sub } from '../../core/vec.js';
import { dequantizeInput, quantizeInput } from '../input.js';
import { findPath } from '../nav.js';
import { CLASSIC, type RunRules } from '../rules.js';
import { scoreOf } from '../scoring.js';
import { createWorld, step } from '../world.js';

/** The bot heads home to bank once it carries this many ducklings. */
const BOT_BANK_AT = 2;

/**
 * Test fixture: play a scripted egg-hunting bot, recording quantized input exactly like the
 * client does. With ducklings in tow it walks them home to the nest. Returns the log, the
 * score the client would display, and how many ducklings it banked.
 */
export function recordBotRun(
  seed: string,
  botSeed: number,
  rules: RunRules = CLASSIC,
): { log: number[]; score: number; status: string; banked: number } {
  const rng = new Rng(botSeed);
  let w = createWorld(seed, rules);
  const log: number[] = [];
  while (w.status === 'playing' && log.length < 60 * 60 * 5) {
    const duck = w.duck.pos;
    const egg = w.eggs.reduce((a, b) => (dist(a.pos, duck) < dist(b.pos, duck) ? a : b));
    const goal = w.ducklings.length >= BOT_BANK_AT ? w.nest : egg.pos;
    // Steer along the nav grid so obstacles between the bot and home don't trap it.
    const next = findPath(w.map.nav, duck, goal)[0] ?? goal;
    const dir = normalize(sub(next, duck));
    const move = { x: dir.x + rng.range(-0.6, 0.6), y: dir.y + rng.range(-0.6, 0.6) };
    const b = quantizeInput({ move, sprint: w.gator.mode === 'chase' });
    log.push(b);
    w = step(w, dequantizeInput(b), SIM_DT);
  }
  return { log, score: scoreOf(w), status: w.status, banked: w.bankedDucklings };
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
