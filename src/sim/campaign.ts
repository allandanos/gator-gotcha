import { CAMPAIGN } from '../config.js';
import { CLASSIC, NIGHT_RULES, type Goal, type RunRules } from './rules.js';
import type { World } from './types.js';

/** An extra-star condition, checked against a cleared run. */
export type StarCondition =
  { readonly parSec: number } | { readonly minEggs: number } | { readonly maxSpotted: number };

export interface Level {
  /** 1-based level number. */
  readonly id: number;
  /** 0-based world index. */
  readonly world: number;
  readonly name: string;
  readonly seed: string;
  readonly goal: Goal;
  readonly rules: RunRules;
  readonly star2: StarCondition;
  readonly star3: StarCondition;
}

export type Stars = 0 | 1 | 2 | 3;

interface LevelSpec {
  readonly name: string;
  readonly goal: Goal;
  readonly star2: StarCondition;
  readonly star3: StarCondition;
  readonly night?: boolean;
  readonly startLevel?: number;
  readonly timeLimit?: number;
  readonly eggsOnField?: number;
}

function toLevel(spec: LevelSpec, index: number): Level {
  const rules: RunRules = {
    ...CLASSIC,
    ...(spec.night ? NIGHT_RULES : {}),
    mode: 'campaign',
    goal: spec.goal,
    timeLimit: spec.timeLimit ?? null,
    startLevel: spec.startLevel ?? 0,
    eggsOnField: spec.eggsOnField ?? CLASSIC.eggsOnField,
  };
  return {
    id: index + 1,
    world: Math.floor(index / CAMPAIGN.levelsPerWorld),
    name: spec.name,
    seed: `lv${String(index + 1).padStart(2, '0')}`,
    goal: spec.goal,
    rules,
    star2: spec.star2,
    star3: spec.star3,
  };
}

export const LEVELS: readonly Level[] = (CAMPAIGN.levels as readonly LevelSpec[]).map(toLevel);

export function levelById(id: number): Level | null {
  return LEVELS.find((l) => l.id === id) ?? null;
}

type RunResult = Pick<World, 'status' | 'time' | 'eggsCollected' | 'timesSpotted'>;

export function meets(cond: StarCondition, run: RunResult): boolean {
  if ('parSec' in cond) return run.time <= cond.parSec;
  if ('minEggs' in cond) return run.eggsCollected >= cond.minEggs;
  return run.timesSpotted <= cond.maxSpotted;
}

/** ★ for clearing, then one more for each extra condition met. A failed run earns nothing. */
export function starsFor(level: Level, run: RunResult): Stars {
  if (run.status !== 'cleared') return 0;
  return (1 + Number(meets(level.star2, run)) + Number(meets(level.star3, run))) as Stars;
}

/** Short goal text for the HUD and level tiles. */
export function describeGoal(goal: Goal): string {
  const parts = [
    goal.eggs !== undefined ? `Grab ${goal.eggs} eggs` : '',
    goal.surviveSec !== undefined ? `Survive ${goal.surviveSec} s` : '',
  ].filter(Boolean);
  return parts.join(' and ');
}

export function describeStar(cond: StarCondition): string {
  if ('parSec' in cond) return `Clear in ${cond.parSec} s`;
  if ('minEggs' in cond) return `Grab ${cond.minEggs} eggs`;
  return cond.maxSpotted === 0 ? 'Never get spotted' : `Spotted ${cond.maxSpotted}× at most`;
}
