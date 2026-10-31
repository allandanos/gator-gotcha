import { SIM_DT } from '../../src/config.js';

export function formatTicks(ticks: number): string {
  const s = Math.floor(ticks * SIM_DT);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const formatScore = (n: number): string => n.toLocaleString('en-US');
