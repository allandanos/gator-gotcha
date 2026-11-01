import { MODE_LABELS, type ModeId } from '../../src/sim/rules.js';
import { SIM_DT } from '../../src/config.js';

export function formatTicks(ticks: number): string {
  const s = Math.floor(ticks * SIM_DT);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Game-link query for a mode; classic links stay as they were. */
export const modeQuery = (mode: ModeId): string => (mode === 'classic' ? '' : `&mode=${mode}`);

/** "Egg Rush" etc.; empty for classic so existing copy is unchanged. */
export const modePrefix = (mode: ModeId): string => (mode === 'classic' ? '' : `${MODE_LABELS[mode]}: `);

export const formatScore = (n: number): string => n.toLocaleString('en-US');
