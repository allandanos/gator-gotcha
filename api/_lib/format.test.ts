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
    expect(modePrefix('ducklings')).toBe('Duckling Dash: ');
  });

  it('describes Duckling Dash runs by ducklings banked, and other modes by eggs', () => {
    const dash = { mode: 'ducklings' as const, eggs: 14, banked: 12 };
    expect(haulPhrase(dash)).toBe('banked 12 ducklings');
    expect(haulPhrase({ ...dash, banked: 1 })).toBe('banked 1 duckling');
    expect(haulStat(dash)).toEqual(['Banked', '12']);
    expect(haulPhrase({ ...dash, mode: 'rush' })).toBe('14 eggs');
    expect(haulPhrase({ ...dash, mode: 'classic', eggs: 1 })).toBe('1 egg');
    expect(haulStat({ ...dash, mode: 'classic' })).toEqual(['Eggs', '14']);
  });
});
