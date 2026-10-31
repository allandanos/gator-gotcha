import { renderSharePage } from '../share.js';
import { bearerToken, escapeHtml, isUuid } from './http.js';
import { formatTicks } from './format.js';

describe('http helpers', () => {
  it('extracts bearer tokens', () => {
    expect(bearerToken(new Request('http://x', { headers: { authorization: 'Bearer abc.def' } }))).toBe('abc.def');
    expect(bearerToken(new Request('http://x'))).toBeNull();
  });

  it('validates uuids', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isUuid("1' or 1=1")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });

  it('escapes html', () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe('&#60;a href=&#34;x&#34;&#62;&#39;&#38;');
  });

  it('formats ticks as m:ss', () => {
    expect(formatTicks(60 * 75)).toBe('1:15');
  });
});

describe('share page', () => {
  it('escapes the nickname and links back to the same seed', () => {
    const html = renderSharePage('https://g.example', {
      id: '11111111-1111-4111-8111-111111111111',
      seed: 'abc123',
      dailyDate: null,
      score: 2340,
      eggs: 12,
      ticks: 3600,
      nickname: '<script>x',
    });
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&#60;script&#62;x scored 2,340');
    expect(html).toContain('og:image" content="https://g.example/api/og?id=11111111');
    expect(html).toContain('/?seed=abc123&#38;challenge=');
  });

  it('does not meta-refresh, so crawlers stay on the tagged page', () => {
    const html = renderSharePage('https://g.example', {
      id: '11111111-1111-4111-8111-111111111111',
      seed: 'abc123',
      dailyDate: '2026-10-31',
      score: 10,
      eggs: 1,
      ticks: 60,
      nickname: 'Duck',
    });
    expect(html).not.toMatch(/http-equiv/i);
    expect(html).toContain('<script src="/share-redirect.js" defer></script>');
    expect(html).toContain('data-target="https://g.example/?seed=abc123');
    expect(html).toContain('Daily Swamp 2026-10-31: 1 egg in 0:01');
  });
});
