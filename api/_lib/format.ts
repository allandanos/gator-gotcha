import { MODE_LABELS, type ModeId } from '../../src/sim/rules.js';
import { SIM_DT } from '../../src/config.js';
import type { SharedScore } from './repository.js';

export function formatTicks(ticks: number): string {
  const s = Math.floor(ticks * SIM_DT);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Game-link query for a mode; classic links stay as they were. */
export const modeQuery = (mode: ModeId): string => (mode === 'classic' ? '' : `&mode=${mode}`);

/** "Egg Rush" etc.; empty for classic so existing copy is unchanged. */
export const modePrefix = (mode: ModeId): string => (mode === 'classic' ? '' : `${MODE_LABELS[mode]}: `);

export const formatScore = (n: number): string => n.toLocaleString('en-US');

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

type Haul = Pick<SharedScore, 'mode' | 'eggs' | 'banked'>;

/** Whether the run was scored on banked ducklings (Duckling Dash). */
export const scoresBanked = (s: Pick<SharedScore, 'mode'>): boolean => s.mode === 'ducklings';

/** Share copy for what the run collected: "banked 12 ducklings", or "5 eggs". */
export const haulPhrase = (s: Haul): string =>
  scoresBanked(s) ? `banked ${plural(s.banked, 'duckling')}` : plural(s.eggs, 'egg');

/** OG card stat: label and value. */
export const haulStat = (s: Haul): readonly [string, string] =>
  scoresBanked(s) ? ['Banked', String(s.banked)] : ['Eggs', String(s.eggs)];
