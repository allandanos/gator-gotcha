import type { Vec } from '../core/vec.js';
import type { RunRules } from './rules.js';

export type ObstacleKind = 'log' | 'reeds';

/** Axis-aligned rectangle obstacle; blocks movement and sight. */
export interface Obstacle {
  readonly kind: ObstacleKind;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  /** 1 = blocked, row-major. */
  readonly blocked: Uint8Array;
}

export interface GameMap {
  readonly seed: string;
  readonly obstacles: readonly Obstacle[];
  readonly nav: NavGrid;
  readonly duckSpawn: Vec;
  readonly gatorSpawn: Vec;
}

export interface Duck {
  readonly pos: Vec;
  readonly vel: Vec;
  readonly facing: number;
  readonly stamina: number;
  readonly exhausted: boolean;
  readonly sinceSprint: number;
  readonly sprinting: boolean;
}

export type GatorMode = 'wander' | 'chase' | 'search';

export interface Gator {
  readonly pos: Vec;
  readonly heading: number;
  readonly mode: GatorMode;
  /** Point the gator is heading for in search/wander mode. */
  readonly target: Vec | null;
  readonly path: readonly Vec[];
  readonly repathIn: number;
  /** Seconds left sweeping at the search point, or pausing in wander. */
  readonly waitTimer: number;
  readonly lastSeen: Vec | null;
  readonly grace: number;
  /** Seconds left frozen after snapping a duckling: no moving, no seeing, no snapping. */
  readonly stun: number;
}

export interface Egg {
  readonly id: number;
  readonly pos: Vec;
  /** Worth `GOLDEN.ducklings` ducklings, and its splash carries further. */
  readonly golden: boolean;
}

export type GameEvent =
  | { readonly type: 'pickup'; readonly pos: Vec }
  /** `count` is the trail length after hatching. */
  | { readonly type: 'hatch'; readonly pos: Vec; readonly count: number }
  | { readonly type: 'snapped'; readonly pos: Vec }
  | { readonly type: 'banked'; readonly pos: Vec; readonly count: number; readonly value: number }
  | { readonly type: 'goldenPickup'; readonly pos: Vec }
  /** Classic's cycle turned over this tick. */
  | { readonly type: 'nightfall' }
  | { readonly type: 'daybreak' }
  | { readonly type: 'spotted' }
  | { readonly type: 'lost' }
  | { readonly type: 'sprintStart' }
  | { readonly type: 'caught'; readonly pos: Vec }
  | { readonly type: 'timeUp' }
  | { readonly type: 'cleared' };

/** `playing` until the run ends: caught by the gator, out of time, or the level goal reached. */
export type RunStatus = 'playing' | 'caught' | 'timeUp' | 'cleared';

export interface InputState {
  /** Desired move direction, length 0..1. */
  readonly move: Vec;
  readonly sprint: boolean;
}

export interface World {
  readonly map: GameMap;
  readonly rules: RunRules;
  readonly rngState: number;
  readonly time: number;
  readonly eggsCollected: number;
  /** Ducklings trailing the duck, nearest first. */
  readonly ducklings: readonly Vec[];
  /** The duck's recent positions, newest first, capped at `TRAIL.max × TRAIL.lag + 1`. */
  readonly trailHistory: readonly Vec[];
  /** Score value banked at the nest so far. */
  readonly banked: number;
  /** Ducklings banked so far (what share cards and campaign goals count). */
  readonly bankedDucklings: number;
  readonly nest: Vec;
  /** Golden eggs collected. */
  readonly goldenEggs: number;
  /** Times the gator went from not-chasing to chasing. */
  readonly timesSpotted: number;
  readonly nextEggId: number;
  readonly duck: Duck;
  readonly gator: Gator;
  readonly eggs: readonly Egg[];
  readonly status: RunStatus;
  /** Events emitted during the most recent step only. */
  readonly events: readonly GameEvent[];
}
