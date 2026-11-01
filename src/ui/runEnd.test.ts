import { END_DELAY, rankedHeadline } from './runEnd';

describe('run end', () => {
  it('keeps the classic chomp', () => {
    expect(rankedHeadline('caught')).toEqual({ heading: 'CHOMP!', tone: 'chomp', sub: '' });
  });

  it('celebrates lasting the rush clock with the bonus', () => {
    const h = rankedHeadline('timeUp');
    expect(h.tone).toBe('win');
    expect(h.sub).toContain('+500');
  });

  it('keeps the original catch delay', () => {
    expect(END_DELAY.caught).toBe(1.1);
    expect(END_DELAY.timeUp).toBeLessThan(END_DELAY.caught);
  });
});
