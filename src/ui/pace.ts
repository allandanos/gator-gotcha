import { PACE_CHECKPOINT_S, PACE_MAX_CHECKPOINTS } from '../render/feel';

/** Append the score at each 10 s checkpoint the run passes. */
export function recordPace(
  timeline: readonly number[],
  time: number,
  score: number,
): readonly number[] {
  if (timeline.length >= PACE_MAX_CHECKPOINTS) return timeline;
  return time >= (timeline.length + 1) * PACE_CHECKPOINT_S ? [...timeline, score] : timeline;
}

/** When the best run first reached `score`, interpolating between checkpoints; Infinity if never. */
function bestTimeFor(best: readonly number[], score: number): number {
  let prevT = 0;
  let prevS = 0;
  for (let i = 0; i < best.length; i++) {
    const s = best[i] as number;
    const t = (i + 1) * PACE_CHECKPOINT_S;
    if (s >= score)
      return s === prevS ? prevT : prevT + ((score - prevS) / (s - prevS)) * (t - prevT);
    prevT = t;
    prevS = s;
  }
  return Infinity;
}

/**
 * Seconds ahead (+) or behind (−) the best run's pace; Infinity once the best score is beaten; null
 * to hide (no timeline, no score yet, or in the best run's last unrecorded seconds).
 */
export function paceSeconds(
  best: readonly number[],
  bestScore: number,
  time: number,
  score: number,
): number | null {
  if (best.length === 0 || score <= 0) return null;
  if (score > bestScore) return Infinity;
  const t = bestTimeFor(best, score);
  return t === Infinity ? null : t - time;
}

export interface PaceLabel {
  readonly icon: string;
  readonly text: string;
  readonly tone: 'ahead' | 'behind' | 'even';
}

/** Words plus an icon, so the readout never relies on colour alone. */
export function formatPace(sec: number): PaceLabel {
  if (sec === Infinity) return { icon: '▲', text: 'Past your best', tone: 'ahead' };
  const n = Math.round(Math.abs(sec));
  if (n === 0) return { icon: '●', text: 'On pace', tone: 'even' };
  return sec > 0
    ? { icon: '▲', text: `+${n}s ahead`, tone: 'ahead' }
    : { icon: '▼', text: `−${n}s behind`, tone: 'behind' };
}
