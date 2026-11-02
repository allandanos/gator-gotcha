import type { GameEvent } from '../sim/types';

type HintTrigger = 'spotted' | 'sprintStart' | 'pickup';

/** Bit order is stored in `gator-gotcha:hints-seen`; append only. */
const ORDER: readonly HintTrigger[] = ['spotted', 'sprintStart', 'pickup'];

export const HINT_TEXT: Readonly<Record<HintTrigger, string>> = {
  spotted: 'Break line of sight behind logs and reeds',
  sprintStart: 'Dash drains stamina; it refills when you walk',
  pickup: 'Splashes are loud: the gator hears pickups',
};

export interface DueHints {
  readonly seen: number;
  readonly due: readonly string[];
}

/** First-run tips triggered by this step's events that the player has not seen yet. */
export function dueHints(events: readonly GameEvent[], seen: number): DueHints {
  let mask = seen;
  const due: string[] = [];
  for (const e of events) {
    const bit = ORDER.indexOf(e.type as HintTrigger);
    if (bit < 0 || mask & (1 << bit)) continue;
    mask |= 1 << bit;
    due.push(HINT_TEXT[ORDER[bit] as HintTrigger]);
  }
  return { seen: mask, due };
}
