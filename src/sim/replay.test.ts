import { CYCLE, SIM_DT } from '../config.js';
import { len } from '../core/vec.js';
import { recordBotRun, recordEvasiveRun } from './__fixtures__/recordBot.js';
import { dequantizeInput, quantizeInput } from './input.js';
import { rulesForMode } from './rules.js';
import { dailyDateOf, dailySeed, decodeLog, encodeLog, replayRun } from './replay.js';

const record = recordBotRun;

describe('input quantization', () => {
  it('round-trips idle, cardinal and sprint input', () => {
    expect(dequantizeInput(quantizeInput({ move: { x: 0, y: 0 }, sprint: false }))).toEqual({
      move: { x: 0, y: 0 },
      sprint: false,
    });
    const right = dequantizeInput(quantizeInput({ move: { x: 1, y: 0 }, sprint: true }));
    expect(right.move.x).toBe(1);
    expect(right.move.y).toBe(0);
    expect(right.sprint).toBe(true);
  });

  it('snaps analog magnitude and direction', () => {
    const half = dequantizeInput(quantizeInput({ move: { x: 0, y: -0.45 }, sprint: false }));
    expect(len(half.move)).toBeCloseTo(0.4);
    expect(half.move.y).toBeLessThan(0);
    const diag = dequantizeInput(
      quantizeInput({ move: { x: -Math.SQRT1_2, y: Math.SQRT1_2 }, sprint: false }),
    );
    expect(diag.move.x).toBeCloseTo(-Math.SQRT1_2);
    expect(diag.move.y).toBeCloseTo(Math.SQRT1_2);
  });

  it('fits in one byte', () => {
    for (let i = 0; i < 200; i++) {
      const a = (i / 200) * Math.PI * 2;
      const b = quantizeInput({ move: { x: Math.cos(a), y: Math.sin(a) }, sprint: i % 2 === 0 });
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(255);
    }
  });
});

describe('log encoding', () => {
  it('round-trips with run-length compression', () => {
    const bytes = [...Array(1000).fill(0x61), 3, 3, 0x80, ...Array(300).fill(0)];
    const enc = encodeLog(bytes);
    expect(enc.length).toBeLessThan(40);
    expect(Array.from(decodeLog(enc))).toEqual(bytes);
  });

  it('rejects malformed, oversized and over-long logs', () => {
    expect(() => decodeLog(btoa('\u0003'))).toThrow();
    expect(() => decodeLog(btoa('\u0000\u0001'))).toThrow();
    expect(() => decodeLog('A'.repeat(70_000))).toThrow();
    expect(() => decodeLog(encodeLog(Array(500).fill(1)), 100)).toThrow();
  });
});

describe('replayRun', () => {
  it('reproduces the locally recorded score', () => {
    const { log, score } = record('golden', 3);
    const out = replayRun('golden', decodeLog(encodeLog(log)));
    expect(out).toEqual({
      ok: true,
      score,
      eggs: expect.any(Number),
      banked: expect.any(Number),
      ticks: log.length,
    });
  });

  it('matches a Classic golden snapshot through a full night (regenerate per RULESET)', () => {
    // Ruleset 1. The evasive bot lasts past nightfall (60 s) and daybreak (90 s) on this swamp.
    const { log } = recordEvasiveRun('dusk4', rulesForMode('classic'));
    expect(log.length).toBeGreaterThan((CYCLE.daySec + CYCLE.duskSec + CYCLE.nightSec) / SIM_DT);
    // The cycle changes this run: without it the gator catches the duck much sooner.
    const noCycle = recordEvasiveRun('dusk4', { ...rulesForMode('classic'), dayNight: false });
    expect(noCycle.log.length).not.toBe(log.length);
    expect(replayRun('dusk4', log)).toMatchInlineSnapshot(`
      {
        "banked": 0,
        "eggs": 0,
        "ok": true,
        "score": 1240,
        "ticks": 7456,
      }
    `);
  });

  it('matches a Duckling Dash golden snapshot (regenerate per RULESET)', () => {
    // Bot 4 banks on this swamp, so the snapshot covers hatching and banking.
    const { log, banked } = record('golden', 4, rulesForMode('ducklings'));
    expect(banked).toBeGreaterThan(0);
    expect(replayRun('golden', log, 'ducklings')).toMatchInlineSnapshot(`
      {
        "banked": 4,
        "eggs": 4,
        "ok": true,
        "score": 780,
        "ticks": 1832,
      }
    `);
  });

  it('gives the same result replaying the same log twice, over 50 seeds per mode', () => {
    let banking = 0;
    for (let i = 0; i < 50; i++) {
      const seed = `det${i}`;
      for (const mode of ['classic', 'ducklings'] as const) {
        const { log, score, banked } = record(seed, i, rulesForMode(mode));
        const a = replayRun(seed, log, mode);
        expect(a).toEqual(replayRun(seed, log, mode));
        expect(a).toMatchObject({ ok: true, score, banked });
        if (banked > 0) banking++;
      }
    }
    expect(banking).toBeGreaterThan(25);
  });

  it('rejects a log replayed on a different seed or with trailing / missing input', () => {
    const { log } = record('golden', 3);
    expect(replayRun('golden', [...log, 0])).toEqual({ ok: false, reason: 'trailing_input' });
    expect(replayRun('golden', log.slice(0, -5))).toEqual({ ok: false, reason: 'not_caught' });
    expect(replayRun('golden', [])).toEqual({ ok: false, reason: 'empty' });
    expect(replayRun('golden', log, 'classic', 10)).toEqual({ ok: false, reason: 'too_long' });
    const other = replayRun('other', log);
    expect(other.ok && other.ticks === log.length).toBe(false);
  });
});

describe('replayRun per mode', () => {
  it('reproduces duckling and rush bot runs under their own mode', () => {
    for (const mode of ['ducklings', 'rush'] as const) {
      const { log, score } = recordBotRun('golden', 3, rulesForMode(mode));
      expect(replayRun('golden', log, mode)).toMatchObject({ ok: true, score, ticks: log.length });
    }
  });

  it('gives a different outcome when a rush log is replayed as classic', () => {
    const { log, score } = recordBotRun('golden', 3, rulesForMode('rush'));
    expect(replayRun('golden', log, 'classic')).not.toEqual(replayRun('golden', log, 'rush'));
    expect(replayRun('golden', log, 'rush')).toMatchObject({ score });
  });

  it('accepts a rush run that survives to the buzzer, with the clutch bonus', () => {
    const rush = rulesForMode('rush');
    // Seed found by search: the evasive bot outlasts the 90 s clock here without grabbing eggs.
    const { log, status, score } = recordEvasiveRun('buzz36', rush);
    expect(status).toBe('timeUp');
    expect(score).toBe(500);
    expect(replayRun('buzz36', log, 'rush')).toEqual({
      ok: true,
      score: 500,
      eggs: 0,
      banked: 0,
      ticks: log.length,
    });
    expect(replayRun('buzz36', [...log, 0], 'rush')).toEqual({
      ok: false,
      reason: 'trailing_input',
    });
  });
});

describe('daily seed', () => {
  it('derives a parseable seed from the UTC date and back', () => {
    const seed = dailySeed(new Date(Date.UTC(2026, 9, 31, 23, 59)));
    expect(seed).toBe('d20261031');
    expect(dailyDateOf(seed)).toBe('2026-10-31');
    expect(dailyDateOf('abc')).toBeNull();
  });
});

describe('InputRecorder', () => {
  it('grows past its initial capacity and resets', async () => {
    const { InputRecorder } = await import('./input.js');
    const r = new InputRecorder();
    for (let i = 0; i < 10_000; i++) r.push(i % 256);
    expect(r.length).toBe(10_000);
    expect(r.bytes()[9_999]).toBe(9_999 % 256);
    r.reset();
    expect(r.bytes()).toHaveLength(0);
  });
});
