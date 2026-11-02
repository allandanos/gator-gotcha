import { GATOR, MODES } from '../config';
import { dcos, dsin } from '../core/dmath';
import { dist, type Vec } from '../core/vec';
import type { Gator } from '../sim/types';

type Ctx = CanvasRenderingContext2D;

const DARK = 'rgba(10, 18, 40, 0.92)';
const DUSK = 'rgba(10, 18, 40, 0.55)';
const EYE_GLOW = '#ffe35a';
/** Big enough to cover the arena, its water border and any letterboxing. */
const FOG_EXTENT = 4000;
/** The gator's cone shows faintly once it's this close (× lantern radius). */
const CONE_HINT_RANGE = 1.3;
/** Eye spots in the sprite's frame (× gator radius): forward from the body, then left/right. */
const EYE_FORWARD = 2.05;
const EYE_SIDE = 0.42;

/** Darkness everywhere but a soft lantern pool around the duck. Draw in world space. */
export function drawNightFog(ctx: Ctx, duck: Vec, t: number, alpha = 1): void {
  const r = MODES.night.lanternRadius * (1 + Math.sin(t * 3) * 0.02);
  const fog = ctx.createRadialGradient(duck.x, duck.y, r * 0.45, duck.x, duck.y, r);
  fog.addColorStop(0, 'rgba(10, 18, 40, 0)');
  fog.addColorStop(0.6, DUSK);
  fog.addColorStop(1, DARK);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fog;
  ctx.fillRect(-FOG_EXTENT, -FOG_EXTENT, FOG_EXTENT * 3, FOG_EXTENT * 3);
  ctx.restore();
}

/** Whether the gator is close enough to the lantern for its cone to be hinted. */
export function coneHinted(gator: Gator, duck: Vec): boolean {
  return dist(gator.pos, duck) < MODES.night.lanternRadius * CONE_HINT_RANGE;
}

/** Two glowing eyes above the fog, so the player always has something to read. */
export function drawGatorEyes(ctx: Ctx, gator: Gator, t: number): void {
  const fx = dcos(gator.heading);
  const fy = dsin(gator.heading);
  const forward = GATOR.radius * EYE_FORWARD;
  const side = GATOR.radius * EYE_SIDE;
  const blink = Math.sin(t * 0.9) > 0.97 ? 0.25 : 1;
  ctx.save();
  ctx.fillStyle = EYE_GLOW;
  ctx.shadowColor = EYE_GLOW;
  ctx.shadowBlur = 14;
  for (const s of [-1, 1]) {
    const x = gator.pos.x + fx * forward - fy * side * s;
    const y = gator.pos.y + fy * forward + fx * side * s;
    ctx.beginPath();
    ctx.ellipse(x, y, 4.5, 4.5 * blink, gator.heading, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
