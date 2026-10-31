import { datan, datan2, dcos, dhypot, dsin } from './dmath.js';

const samples = Array.from({ length: 2001 }, (_, i) => -50 + i * 0.05);

describe('dmath', () => {
  it('matches Math.sin/cos closely across a wide range', () => {
    for (const x of samples) {
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-12);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-12);
    }
  });

  it('matches Math.atan2 in every quadrant and on the axes', () => {
    for (const y of [-3, -1, -0.2, 0, 0.2, 1, 3]) {
      for (const x of [-3, -1, -0.2, 0, 0.2, 1, 3]) {
        expect(Math.abs(datan2(y, x) - Math.atan2(y, x))).toBeLessThan(1e-12);
      }
    }
    for (const t of samples) expect(Math.abs(datan(t) - Math.atan(t))).toBeLessThan(1e-12);
  });

  it('handles non-finite input', () => {
    expect(dsin(Infinity)).toBeNaN();
    expect(datan(NaN)).toBeNaN();
  });

  it('computes hypot', () => {
    expect(dhypot(3, 4)).toBe(5);
  });
});
