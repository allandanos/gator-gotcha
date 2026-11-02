import { formatScore, haulPhrase, haulStat, modePrefix, modeQuery } from './format.js';

describe('format', () => {
  it('formats scores with separators', () => {
    expect(formatScore(12_345)).toBe('12,345');
  });

  it('leaves classic share copy and links unchanged', () => {
    expect(modeQuery('classic')).toBe('');
    expect(modePrefix('classic')).toBe('');
  });

  it('labels and links other modes', () => {
    expect(modeQuery('rush')).toBe('&mode=rush');
    expect(modePrefix('night')).toBe('Night Swamp: ');
  });

  it('describes Season 1 runs by ducklings banked, and Rush or Season 0 runs by eggs', () => {
    const s1 = { mode: 'classic' as const, ruleset: 1, eggs: 14, banked: 12 };
    expect(haulPhrase(s1)).toBe('banked 12 ducklings');
    expect(haulPhrase({ ...s1, banked: 1 })).toBe('banked 1 duckling');
    expect(haulStat(s1)).toEqual(['Banked', '12']);
    expect(haulPhrase({ ...s1, mode: 'rush' })).toBe('14 eggs');
    expect(haulPhrase({ ...s1, ruleset: 0, eggs: 1 })).toBe('1 egg');
    expect(haulStat({ ...s1, ruleset: 0 })).toEqual(['Eggs', '14']);
  });
});
