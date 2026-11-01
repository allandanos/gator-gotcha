import { MODES } from '../config';
import type { RunStatus } from '../sim/types';

export interface EndHeadline {
  readonly heading: string;
  readonly tone: 'chomp' | 'win';
  readonly sub: string;
}

/** Seconds the ending plays before the card: the chomp needs longer than a buzzer. */
export const END_DELAY: Readonly<Record<Exclude<RunStatus, 'playing'>, number>> = {
  caught: 1.1,
  timeUp: 0.7,
  cleared: 0.7,
};

/** Headline for a finished ranked run. */
export function rankedHeadline(status: RunStatus): EndHeadline {
  if (status === 'timeUp') {
    return {
      heading: 'Time!',
      tone: 'win',
      sub: `+${MODES.rush.clutchBonus} clutch bonus for lasting the clock`,
    };
  }
  return { heading: 'CHOMP!', tone: 'chomp', sub: '' };
}
