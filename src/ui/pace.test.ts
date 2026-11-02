import { formatPace, paceSeconds, recordPace } from './pace';

describe('recordPace', () => {
  it('adds a checkpoint each time the run passes another 10 s', () => {
    let t: readonly number[] = [];
    t = recordPace(t, 9.9, 90);
    expect(t).toEqual([]);
    t = recordPace(t, 10, 100);
    t = recordPace(t, 10.5, 105);
    t = recordPace(t, 20, 400);
    expect(t).toEqual([100, 400]);
  });

  it('stops at 120 checkpoints', () => {
    const full = Array.from({ length: 120 }, (_, i) => i);
    expect(recordPace(full, 2000, 5)).toBe(full);
  });
});

describe('paceSeconds', () => {
  const best = [100, 400, 500];

  it('is null without a best timeline or before any score', () => {
    expect(paceSeconds([], 900, 12, 120)).toBeNull();
    expect(paceSeconds(best, 900, 3, 0)).toBeNull();
  });

  it('is positive when the score arrives earlier than the best run reached it', () => {
    // Best reached 250 halfway between 10 s (100) and 20 s (400): at 15 s.
    expect(paceSeconds(best, 900, 12, 250)).toBeCloseTo(3);
  });

  it('is negative when behind', () => {
    expect(paceSeconds(best, 900, 18, 50)).toBeCloseTo(-13);
  });

  it('is Infinity only once the best score is beaten', () => {
    expect(paceSeconds(best, 900, 31, 901)).toBe(Infinity);
  });

  it("hides in the best run's last seconds after its final checkpoint", () => {
    expect(paceSeconds(best, 900, 31, 700)).toBeNull();
  });
});

describe('formatPace', () => {
  it('pairs a direction icon with the words', () => {
    expect(formatPace(12.4)).toEqual({ icon: '▲', text: '+12s ahead', tone: 'ahead' });
    expect(formatPace(-8)).toEqual({ icon: '▼', text: '−8s behind', tone: 'behind' });
    expect(formatPace(0.2)).toEqual({ icon: '●', text: 'On pace', tone: 'even' });
    expect(formatPace(Infinity)).toEqual({ icon: '▲', text: 'Past your best', tone: 'ahead' });
  });
});
