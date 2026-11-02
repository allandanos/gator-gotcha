import { EGGS, MODES } from '../config.js';

/** Ranked modes: verified by server replay, one leaderboard each. */
export const MODE_IDS = ['classic', 'rush', 'ducklings'] as const;
export type ModeId = (typeof MODE_IDS)[number];

/** A level's clear condition: whichever is set must be reached. */
export interface Goal {
  readonly eggs?: number;
  /** Ducklings banked at the nest. */
  readonly ducklings?: number;
  readonly surviveSec?: number;
}

/** Everything that varies between modes and levels. A run's rules never change mid-run. */
export interface RunRules {
  readonly mode: ModeId | 'campaign';
  /** Seconds; reaching it ends the run with status `timeUp`. */
  readonly timeLimit: number | null;
  /** Reaching it ends the run with status `cleared`. */
  readonly goal: Goal | null;
  /** Difficulty floor, 0..1. */
  readonly startLevel: number;
  readonly coneRangeFactor: number;
  readonly hearFactor: number;
  readonly eggsOnField: number;
  /** Always night (campaign night levels): lantern fog, with the factors above. */
  readonly night: boolean;
  /** Classic's day/night cycle: night phases use the `MODES.night` factors (see cycle.ts). */
  readonly dayNight: boolean;
  readonly scoring: 'classic' | 'rush';
  /** Duckling Dash greed loop: eggs hatch into a trail that is banked at the nest; golden eggs. */
  readonly ducklings: boolean;
}

export const CLASSIC: RunRules = {
  mode: 'classic',
  timeLimit: null,
  goal: null,
  startLevel: 0,
  coneRangeFactor: 1,
  hearFactor: 1,
  eggsOnField: EGGS.onField,
  night: false,
  dayNight: true,
  scoring: 'classic',
  ducklings: false,
};

export const NIGHT_RULES: Pick<RunRules, 'coneRangeFactor' | 'hearFactor' | 'night'> = {
  coneRangeFactor: MODES.night.coneRangeFactor,
  hearFactor: MODES.night.hearFactor,
  night: true,
};

const RULES: Readonly<Record<ModeId, RunRules>> = {
  classic: CLASSIC,
  rush: {
    ...CLASSIC,
    mode: 'rush',
    timeLimit: MODES.rush.timeLimit,
    eggsOnField: MODES.rush.eggsOnField,
    startLevel: MODES.rush.startLevel,
    scoring: 'rush',
    dayNight: false,
  },
  // Its own greed loop, in daylight throughout (owner decision, phase 2 re-scope).
  ducklings: { ...CLASSIC, mode: 'ducklings', dayNight: false, ducklings: true },
};

export function rulesForMode(mode: ModeId): RunRules {
  return RULES[mode];
}

export function parseMode(value: unknown): ModeId | null {
  return typeof value === 'string' && (MODE_IDS as readonly string[]).includes(value)
    ? (value as ModeId)
    : null;
}

export const MODE_LABELS: Readonly<Record<ModeId, string>> = {
  classic: 'Classic',
  rush: 'Egg Rush',
  ducklings: 'Duckling Dash',
};
