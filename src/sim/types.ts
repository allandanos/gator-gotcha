import type { Vec } from '../core/vec';

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
}

export interface Egg {
  readonly id: number;
  readonly pos: Vec;
}

export type GameEvent =
  | { readonly type: 'pickup'; readonly pos: Vec }
  | { readonly type: 'spotted' }
  | { readonly type: 'lost' }
  | { readonly type: 'sprintStart' }
  | { readonly type: 'caught'; readonly pos: Vec };

export interface InputState {
  /** Desired move direction, length 0..1. */
  readonly move: Vec;
  readonly sprint: boolean;
}

export interface World {
  readonly map: GameMap;
  readonly rngState: number;
  readonly time: number;
  readonly eggsCollected: number;
  readonly nextEggId: number;
  readonly duck: Duck;
  readonly gator: Gator;
  readonly eggs: readonly Egg[];
  readonly status: 'playing' | 'caught';
  /** Events emitted during the most recent step only. */
  readonly events: readonly GameEvent[];
}
