import { CYCLE, MODES } from '../config.js';
import { fogAlpha, isNightAt, secondsToDawn, secondsToNight, senseFactors } from './cycle.js';
import { CLASSIC, NIGHT_RULES, rulesForMode } from './rules.js';

const PERIOD = CYCLE.daySec + CYCLE.nightSec;
const LEVEL_NIGHT = { ...CLASSIC, ...NIGHT_RULES, dayNight: false };

describe('day/night cycle', () => {
  it('starts in day and turns to night after daySec, then back each period', () => {
    expect(isNightAt(CLASSIC, 0)).toBe(false);
    expect(isNightAt(CLASSIC, CYCLE.daySec - 0.01)).toBe(false);
    expect(isNightAt(CLASSIC, CYCLE.daySec)).toBe(true);
    expect(isNightAt(CLASSIC, PERIOD - 0.01)).toBe(true);
    expect(isNightAt(CLASSIC, PERIOD)).toBe(false);
    expect(isNightAt(CLASSIC, PERIOD * 3 + CYCLE.daySec + 1)).toBe(true);
  });

  it('is always night on night levels and never in the non-cycling modes', () => {
    expect(isNightAt(LEVEL_NIGHT, 0)).toBe(true);
    for (const t of [0, CYCLE.daySec + 1, PERIOD * 5 + CYCLE.daySec + 1]) {
      expect(isNightAt(rulesForMode('ducklings'), t)).toBe(false);
      expect(isNightAt(rulesForMode('rush'), t)).toBe(false);
    }
  });

  it('uses night senses only during the night phase', () => {
    expect(senseFactors(CLASSIC, 1)).toEqual({ cone: 1, hear: 1 });
    expect(senseFactors(CLASSIC, CYCLE.daySec + 1)).toEqual({
      cone: MODES.night.coneRangeFactor,
      hear: MODES.night.hearFactor,
    });
    expect(senseFactors(LEVEL_NIGHT, 1)).toEqual({
      cone: NIGHT_RULES.coneRangeFactor,
      hear: NIGHT_RULES.hearFactor,
    });
  });

  it('fades the fog in at dusk and out at dawn, but not at the very start', () => {
    expect(fogAlpha(CLASSIC, 0)).toBe(0);
    expect(fogAlpha(CLASSIC, CYCLE.daySec - CYCLE.duskSec)).toBe(0);
    expect(fogAlpha(CLASSIC, CYCLE.daySec - CYCLE.duskSec / 2)).toBeCloseTo(0.5);
    expect(fogAlpha(CLASSIC, CYCLE.daySec + 1)).toBe(1);
    expect(fogAlpha(CLASSIC, PERIOD + CYCLE.duskSec / 2)).toBeCloseTo(0.5);
    expect(fogAlpha(CLASSIC, PERIOD + CYCLE.duskSec)).toBe(0);
    expect(fogAlpha(LEVEL_NIGHT, 3)).toBe(1);
    expect(fogAlpha(rulesForMode('ducklings'), CYCLE.daySec + 1)).toBe(0);
  });

  it('counts down to nightfall in day only', () => {
    expect(secondsToNight(CLASSIC, 10)).toBeCloseTo(CYCLE.daySec - 10);
    expect(secondsToNight(CLASSIC, CYCLE.daySec + 1)).toBeNull();
    expect(secondsToNight(rulesForMode('ducklings'), 10)).toBeNull();
    expect(secondsToNight(LEVEL_NIGHT, 10)).toBeNull();
    expect(secondsToDawn(CLASSIC, CYCLE.daySec + 5)).toBeCloseTo(CYCLE.nightSec - 5);
    expect(secondsToDawn(CLASSIC, 10)).toBeNull();
    expect(secondsToDawn(LEVEL_NIGHT, 10)).toBeNull();
  });
});
