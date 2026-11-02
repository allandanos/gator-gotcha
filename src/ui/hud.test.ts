import { CYCLE } from '../config';
import { CLASSIC, NIGHT_RULES, rulesForMode } from '../sim/rules';
import { carryText, nightCue } from './hud';

const NIGHTFALL = CYCLE.daySec + CYCLE.duskSec;

describe('night cue', () => {
  it('warns in the last seconds of day, then counts down to dawn', () => {
    expect(nightCue(CLASSIC, 10)).toBeNull();
    expect(nightCue(CLASSIC, CYCLE.daySec - 1)).toBeNull();
    expect(nightCue(CLASSIC, NIGHTFALL - 4.2)).toEqual({ label: 'Night', value: 'in 5' });
    expect(nightCue(CLASSIC, NIGHTFALL + 8)).toEqual({ label: 'Dawn', value: '0:22' });
    expect(nightCue(CLASSIC, NIGHTFALL + CYCLE.nightSec + 1)).toBeNull();
  });

  it('stays hidden where there is no cycle', () => {
    expect(nightCue(rulesForMode('ducklings'), NIGHTFALL - 2)).toBeNull();
    expect(nightCue({ ...CLASSIC, ...NIGHT_RULES, dayNight: false }, 3)).toBeNull();
  });
});

describe('carry text', () => {
  it('shows what banking the trail now would pay', () => {
    expect(carryText(0)).toBe('0');
    expect(carryText(4)).toBe('×4 → +560');
  });
});
