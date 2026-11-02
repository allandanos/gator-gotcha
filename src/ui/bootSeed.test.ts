import { pickBootSeed } from './bootSeed';

const TODAY = 'd20261031';

describe('pickBootSeed', () => {
  it.each([
    ['a ?seed= link wins over the Daily Swamp', 'abc123', 'abc123'],
    ["no link opens today's Daily Swamp", null, TODAY],
    ['a daily link is honoured even when old', 'd20261030', 'd20261030'],
  ])('%s', (_name, url, expected) => {
    expect(pickBootSeed(url, TODAY)).toBe(expected);
  });
});
