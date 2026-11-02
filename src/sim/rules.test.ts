import { EGGS, MODES } from '../config.js';
import { CLASSIC, MODE_IDS, NIGHT_RULES, parseMode, rulesForMode } from './rules.js';

describe('rules', () => {
  it('keeps classic neutral', () => {
    expect(rulesForMode('classic')).toBe(CLASSIC);
    expect(CLASSIC).toMatchObject({
      timeLimit: null,
      goal: null,
      startLevel: 0,
      coneRangeFactor: 1,
      hearFactor: 1,
      night: false,
      dayNight: true,
      ducklings: false,
    });
    expect(CLASSIC.eggsOnField).toBe(EGGS.onField);
  });

  it('gives rush a clock, more eggs and its own scoring', () => {
    const r = rulesForMode('rush');
    expect(r.timeLimit).toBe(MODES.rush.timeLimit);
    expect(r.eggsOnField).toBe(MODES.rush.eggsOnField);
    expect(r.scoring).toBe('rush');
  });

  it('gives Duckling Dash the trail and bank in daylight, and keeps Rush an egg sprint', () => {
    expect(rulesForMode('ducklings')).toMatchObject({ ducklings: true, dayNight: false, night: false, timeLimit: null });
    expect(rulesForMode('rush')).toMatchObject({ ducklings: false, dayNight: false });
  });

  it('keeps night levels shorter-sighted and sharper-eared', () => {
    expect(NIGHT_RULES.night).toBe(true);
    expect(NIGHT_RULES.coneRangeFactor).toBeLessThan(1);
    expect(NIGHT_RULES.hearFactor).toBeGreaterThan(1);
  });

  it('parses only known modes', () => {
    for (const m of MODE_IDS) expect(parseMode(m)).toBe(m);
    expect(parseMode('campaign')).toBeNull();
    expect(parseMode('night')).toBeNull();
    expect(parseMode('RUSH')).toBeNull();
    expect(parseMode(3)).toBeNull();
    expect(parseMode(null)).toBeNull();
  });
});
