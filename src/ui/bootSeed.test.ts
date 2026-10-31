import { pickBootSeed } from './bootSeed';

const TODAY = 'd20261031';

describe('pickBootSeed', () => {
  it.each([
    ['a ?seed= link wins over the saved swamp', 'abc123', 'zzz999', 'abc123'],
    ['the saved swamp is reopened when there is no link', null, 'zzz999', 'zzz999'],
    ['nothing saved rolls a fresh swamp', null, null, null],
    ["today's Daily Swamp is reopened", null, TODAY, TODAY],
    ["an old Daily Swamp rolls a fresh swamp", null, 'd20261030', null],
    ['a daily link is honoured even when old', 'd20261030', null, 'd20261030'],
  ])('%s', (_name, url, saved, expected) => {
    expect(pickBootSeed(url, saved, TODAY)).toBe(expected);
  });
});
