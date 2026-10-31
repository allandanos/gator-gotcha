import { GATOR } from '../config';
import type { Rng } from '../core/rng';
import { angleDiff, angleOf, dist, fromAngle, scale, sub, turnToward, type Vec } from '../core/vec';
import { moveCircle } from './collision';
import type { GatorStats } from './difficulty';
import { centerOf, findPath, freeCells, gridClear } from './nav';
import { canSee } from './sight';
import type { GameEvent, GameMap, Gator } from './types';

const WAYPOINT_REACHED = 14;
const SWEEP_TURN_RATE = 1.6;

export function createGator(pos: Vec, heading: number): Gator {
  return {
    pos,
    heading,
    mode: 'wander',
    target: null,
    path: [],
    repathIn: 0,
    waitTimer: GATOR.spawnGrace,
    lastSeen: null,
    grace: GATOR.spawnGrace,
  };
}

export interface GatorContext {
  readonly duckPos: Vec;
  readonly map: GameMap;
  readonly stats: GatorStats;
  readonly rng: Rng;
  readonly dt: number;
  /** Position of an egg pickup this step, which the gator may hear. */
  readonly splash: Vec | null;
}

export interface GatorResult {
  readonly gator: Gator;
  readonly events: readonly GameEvent[];
}

export function snoutOf(g: Pick<Gator, 'pos' | 'heading'>): Vec {
  const o = fromAngle(g.heading, GATOR.snoutOffset);
  return { x: g.pos.x + o.x, y: g.pos.y + o.y };
}

/** Perception: decide the mode for this step and emit spotted/lost events. */
export function perceive(g: Gator, ctx: GatorContext): GatorResult {
  const cone = { origin: g.pos, heading: g.heading, range: ctx.stats.coneRange, angle: ctx.stats.coneAngle };
  const sees = g.grace <= 0 && canSee(cone, ctx.duckPos, ctx.map.obstacles);
  if (sees) {
    const events: GameEvent[] = g.mode === 'chase' ? [] : [{ type: 'spotted' }];
    return { gator: { ...g, mode: 'chase', lastSeen: ctx.duckPos, target: null }, events };
  }
  if (g.mode === 'chase') {
    return {
      gator: { ...g, mode: 'search', target: g.lastSeen, path: [], repathIn: 0, waitTimer: GATOR.searchSweepTime },
      events: [{ type: 'lost' }],
    };
  }
  if (ctx.splash && dist(g.pos, ctx.splash) <= GATOR.splashHearRadius) {
    return {
      gator: { ...g, mode: 'search', target: ctx.splash, path: [], repathIn: 0, waitTimer: GATOR.searchSweepTime },
      events: [],
    };
  }
  return { gator: g, events: [] };
}

/** Advance the path toward `goal`, recomputing on a timer. Returns the next point to steer at. */
function followPath(g: Gator, goal: Vec, ctx: GatorContext): { gator: Gator; aim: Vec | null } {
  let path = g.path;
  let repathIn = g.repathIn - ctx.dt;
  if (repathIn <= 0 || path.length === 0) {
    path = findPath(ctx.map.nav, g.pos, goal);
    repathIn = GATOR.repathInterval;
  }
  while (path.length > 0 && dist(g.pos, path[0] as Vec) < WAYPOINT_REACHED) path = path.slice(1);
  return { gator: { ...g, path, repathIn }, aim: path[0] ?? null };
}

function pickWanderTarget(ctx: GatorContext): Vec {
  const cells = freeCells(ctx.map.nav);
  const cell = ctx.rng.pick(cells);
  return centerOf(ctx.map.nav, cell.c, cell.r);
}

/** Steering: decide where to aim this step for the current mode. */
function plan(g: Gator, ctx: GatorContext): { gator: Gator; aim: Vec | null; speed: number } {
  const patrol = ctx.stats.speed * GATOR.patrolFactor;

  if (g.mode === 'chase') {
    if (gridClear(ctx.map.nav, g.pos, ctx.duckPos)) {
      return { gator: { ...g, path: [] }, aim: ctx.duckPos, speed: ctx.stats.speed };
    }
    const r = followPath(g, ctx.duckPos, ctx);
    return { ...r, aim: r.aim ?? ctx.duckPos, speed: ctx.stats.speed };
  }

  const arrived = !g.target || dist(g.pos, g.target) < GATOR.searchArriveRadius;
  if (!arrived && g.target) {
    const r = followPath(g, g.target, ctx);
    if (r.aim) return { ...r, speed: patrol };
    // Unreachable: treat as arrived.
    return { gator: { ...r.gator, target: null, path: [] }, aim: null, speed: 0 };
  }

  // Arrived (or idle): sweep in search mode, pause in wander mode.
  const waitTimer = g.waitTimer - ctx.dt;
  if (waitTimer > 0) {
    const heading =
      g.mode === 'search' ? g.heading + Math.sin(waitTimer * 2.2) * SWEEP_TURN_RATE * ctx.dt : g.heading;
    return { gator: { ...g, waitTimer, heading, target: null, path: [] }, aim: null, speed: 0 };
  }
  const pause = ctx.rng.range(GATOR.wanderPauseMin, GATOR.wanderPauseMax);
  return {
    gator: { ...g, mode: 'wander', target: pickWanderTarget(ctx), path: [], repathIn: 0, waitTimer: pause },
    aim: null,
    speed: 0,
  };
}

export function updateGator(g0: Gator, ctx: GatorContext): GatorResult {
  const ticking = { ...g0, grace: Math.max(0, g0.grace - ctx.dt) };
  const perceived = perceive(ticking, ctx);
  const planned = plan(perceived.gator, ctx);
  const g = planned.gator;
  if (!planned.aim || planned.speed <= 0) return { gator: g, events: perceived.events };

  const desired = angleOf(sub(planned.aim, g.pos));
  const heading = turnToward(g.heading, desired, GATOR.turnRate * ctx.dt);
  // Slow down while turning hard so it can't strafe; this is what makes juking work.
  const alignment = Math.max(0.2, Math.cos(Math.min(Math.abs(angleDiff(heading, desired)), Math.PI / 2)));
  const step = Math.min(planned.speed * alignment * ctx.dt, dist(g.pos, planned.aim));
  const pos = moveCircle(g.pos, scale(fromAngle(heading), step), GATOR.radius, ctx.map.obstacles);
  return { gator: { ...g, pos, heading }, events: perceived.events };
}
