import { EGGS, MODES } from '../config.js';
import { CLASSIC, MODE_IDS, parseMode, rulesForMode } from './rules.js';

describe('rules', () => {
  it('keeps classic neutral', () => {
    expect(rulesForMode('classic')).toBe(CLASSIC);
    expect(CLASSIC).toMatchObject({
      timeLimit: null,
      goal: null,
      startLevel: 0,
      coneRangeFactor: 1,
      hearFactor: 1,
    });
    expect(CLASSIC.eggsOnField).toBe(EGGS.onField);
  });

  it('gives rush a clock, more eggs and its own scoring', () => {
    const r = rulesForMode('rush');
    expect(r.timeLimit).toBe(MODES.rush.timeLimit);
    expect(r.eggsOnField).toBe(MODES.rush.eggsOnField);
    expect(r.scoring).toBe('rush');
  });

  it('makes night shorter-sighted and sharper-eared', () => {
    const r = rulesForMode('night');
    expect(r.night).toBe(true);
    expect(r.coneRangeFactor).toBeLessThan(1);
    expect(r.hearFactor).toBeGreaterThan(1);
    expect(r.scoring).toBe('classic');
  });

  it('parses only known modes', () => {
    for (const m of MODE_IDS) expect(parseMode(m)).toBe(m);
    expect(parseMode('campaign')).toBeNull();
    expect(parseMode('RUSH')).toBeNull();
    expect(parseMode(3)).toBeNull();
    expect(parseMode(null)).toBeNull();
  });
});
