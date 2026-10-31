/**
 * Deterministic trig. Browser engines may implement Math.sin/cos/atan2/hypot differently in the
 * last bits, which would make server-side replays diverge from the client. These versions use only
 * + − × ÷ and Math.sqrt, all of which IEEE-754 requires to be correctly rounded, so every engine
 * produces bit-identical results.
 */

const PI = Math.PI;
const HALF_PI = PI / 2;
const TWO_PI = PI * 2;
/** tan(π/12): above this, atan is shifted by π/6 to keep the series argument small. */
const TAN_PI_12 = 0.2679491924311227;
const INV_SQRT3 = 0.5773502691896257;

/** sin on [-π/2, π/2] via Taylor series (error < 1e-17). */
function sinCore(x: number): number {
  const x2 = x * x;
  let term = x;
  let sum = x;
  for (let n = 1; n <= 11; n++) {
    term = (-term * x2) / ((2 * n) * (2 * n + 1));
    sum += term;
  }
  return sum;
}

export function dsin(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  // Reduce to [-π, π].
  let r = x - TWO_PI * Math.round(x / TWO_PI);
  // Fold to [-π/2, π/2] using sin(π − r) = sin(r).
  if (r > HALF_PI) r = PI - r;
  else if (r < -HALF_PI) r = -PI - r;
  // Clamp: the series can overshoot ±1 by an ulp near ±π/2.
  return Math.max(-1, Math.min(1, sinCore(r)));
}

export function dcos(x: number): number {
  return dsin(x + HALF_PI);
}

/** atan on [0, tan(π/12)] via Taylor series (error < 1e-18). */
function atanCore(t: number): number {
  const t2 = t * t;
  let pow = t;
  let sum = t;
  for (let n = 1; n <= 15; n++) {
    pow *= -t2;
    sum += pow / (2 * n + 1);
  }
  return sum;
}

export function datan(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < 0) return -datan(-x);
  if (x > 1) return HALF_PI - datan(1 / x);
  if (x > TAN_PI_12) return PI / 6 + atanCore((x - INV_SQRT3) / (1 + x * INV_SQRT3));
  return atanCore(x);
}

export function datan2(y: number, x: number): number {
  if (x > 0) return datan(y / x);
  if (x < 0) return y >= 0 ? datan(y / x) + PI : datan(y / x) - PI;
  if (y > 0) return HALF_PI;
  if (y < 0) return -HALF_PI;
  return 0;
}

export function dhypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}
