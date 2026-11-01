import { formatScore, modePrefix, modeQuery } from './format.js';

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
});
