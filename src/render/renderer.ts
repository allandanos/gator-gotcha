import { ARENA, NEST } from '../config';
import { hashSeed, Rng } from '../core/rng';
import { angleDiff, clamp, dist, lerp, type Vec } from '../core/vec';
import { gatorStats } from '../sim/difficulty';
import { visibleConePolygon } from '../sim/sight';
import type { Gator, GameMap, World } from '../sim/types';
import type { Effects } from './effects';
import { PALETTE as P } from './palette';
import { coneHinted, drawGatorEyes, drawNightFog } from './night';
import {
  drawAlertIcon,
  drawDuck,
  drawDuckling,
  drawEgg,
  drawGator,
  drawGrassDetail,
  drawLog,
  drawNest,
  drawReeds,
} from './sprites';

/** Decorative water ring drawn around the arena. */
const BORDER = 140;
const MAX_BAKE_SCALE = 2.5;
const GRASS_DETAIL_COUNT = 260;
const JAW_RANGE = 140;
/** Share of the half-view the death cam may shift away from the duck. */
const REPLAY_DUCK_MARGIN = 0.6;
/** The nest arrow shows once the trail is this long, even with the nest on screen. */
const ARROW_TRAIL = 5;
const ARROW_INSET = 34;

function lerpVec(a: Vec, b: Vec, t: number): Vec {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function lerpGator(a: Gator, b: Gator, t: number): Gator {
  return { ...b, pos: lerpVec(a.pos, b.pos, t), heading: a.heading + angleDiff(a.heading, b.heading) * t };
}

/** Death cam overrides: frame both animals and show where the duck was spotted. */
export interface ReplayView {
  /** Duck position at the moment the gator spotted it, once playback has passed that moment. */
  readonly spottedAt: Vec | null;
}

/** World-units → CSS px. Sized so the duck stays readable on phones and the view is roomy on desktop. */
export function viewScale(cssW: number, cssH: number): number {
  return Math.max(Math.min(cssW / 1000, cssH / 680), Math.min(cssW, cssH) / 560);
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private bake: HTMLCanvasElement | null = null;
  private bakeKey = '';
  private map: GameMap | null = null;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private scale = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported in this browser.');
    this.ctx = ctx;
    // Mobile browsers settle the viewport after boot, often without a window resize event.
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.resize()).observe(canvas);
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = this.canvas.clientWidth;
    this.cssH = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.scale = viewScale(this.cssW, this.cssH);
  }

  /** Cheap per-frame guard so the backing store can never stay out of sync with the CSS size. */
  private syncSize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.canvas.clientWidth !== this.cssW || this.canvas.clientHeight !== this.cssH || dpr !== this.dpr) {
      this.resize();
    }
  }

  setMap(map: GameMap): void {
    this.map = map;
  }

  private ensureBake(): HTMLCanvasElement {
    if (!this.map) throw new Error('Renderer.setMap must be called before render.');
    const s = Math.min(this.scale * this.dpr, MAX_BAKE_SCALE);
    const key = `${this.map.seed}:${s.toFixed(2)}`;
    if (this.bake && key === this.bakeKey) return this.bake;
    const c = this.bake ?? document.createElement('canvas');
    c.width = Math.ceil((ARENA.width + BORDER * 2) * s);
    c.height = Math.ceil((ARENA.height + BORDER * 2) * s);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported in this browser.');
    ctx.setTransform(s, 0, 0, s, BORDER * s, BORDER * s);
    paintBackground(ctx, this.map);
    this.bake = c;
    this.bakeKey = key;
    return c;
  }

  render(prev: World, cur: World, alpha: number, fx: Effects, t: number, replay: ReplayView | null = null): void {
    this.syncSize();
    const { ctx } = this;
    const bake = this.ensureBake();
    const duck = { ...cur.duck, pos: lerpVec(prev.duck.pos, cur.duck.pos, alpha) };
    const gator = lerpGator(prev.gator, cur.gator, alpha);
    const cam = this.camera(replay ? this.replayFocus(duck.pos, gator.pos) : duck.pos);
    const shake = fx.shakeOffset();

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = P.waterDeep;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    ctx.translate(
      this.cssW / 2 - cam.x * this.scale + shake.x,
      this.cssH / 2 - cam.y * this.scale + shake.y,
    );
    ctx.scale(this.scale, this.scale);
    ctx.drawImage(bake, -BORDER, -BORDER, ARENA.width + BORDER * 2, ARENA.height + BORDER * 2);

    if (cur.rules.ducklings) drawNest(ctx, cur.nest, NEST.radius, t, cur.ducklings.length > 0);
    this.drawCone(gator, cur);
    for (const e of cur.eggs) drawEgg(ctx, e.pos.x, e.pos.y, t, e.id, e.golden);
    this.drawTrail(prev, cur, alpha, duck.pos, t);

    const caught = cur.status === 'caught';
    const near = dist(gator.pos, duck.pos) < JAW_RANGE && gator.mode === 'chase';
    const jaw = caught ? 1 : near ? 0.5 + Math.sin(t * 18) * 0.5 : 0;
    // Y-sort so whoever is lower on screen draws in front.
    if (duck.pos.y < gator.pos.y) {
      drawDuck(ctx, duck, t, caught);
      drawGator(ctx, gator, t, jaw);
    } else {
      drawGator(ctx, gator, t, jaw);
      drawDuck(ctx, duck, t, caught);
    }
    if (cur.rules.night) this.drawNight(gator, duck.pos, cur, t, replay !== null);
    if (gator.mode !== 'wander') {
      drawAlertIcon(ctx, gator.pos.x, gator.pos.y - 46, gator.mode === 'chase' ? '!' : '?', fx.alertPop);
    }
    fx.draw(ctx);
    if (replay?.spottedAt) drawSpottedMarker(ctx, replay.spottedAt);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!replay) {
      fx.drawPulse(ctx, this.cssW, this.cssH);
      this.drawNestArrow(cur, cam, t);
    }
  }

  /** Ducklings, back to front; interpolated when the trail kept its length this step. */
  private drawTrail(prev: World, cur: World, alpha: number, duck: Vec, t: number): void {
    const same = prev.ducklings.length === cur.ducklings.length;
    let leader = duck;
    const pts = cur.ducklings.map((p, i) => (same ? lerpVec(prev.ducklings[i] as Vec, p, alpha) : p));
    const facing = pts.map((p) => {
      const f = Math.atan2(leader.y - p.y, leader.x - p.x);
      leader = p;
      return f;
    });
    for (let i = pts.length - 1; i >= 0; i--) drawDuckling(this.ctx, pts[i] as Vec, facing[i] as number, t, i);
  }

  /** Screen-edge arrow toward the nest: when it is off-screen, or a long trail wants banking. */
  private drawNestArrow(w: World, cam: Vec, t: number): void {
    const n = w.ducklings.length;
    if (!w.rules.ducklings || n === 0 || w.status !== 'playing') return;
    const sx = this.cssW / 2 + (w.nest.x - cam.x) * this.scale;
    const sy = this.cssH / 2 + (w.nest.y - cam.y) * this.scale;
    const onScreen = sx > 0 && sy > 0 && sx < this.cssW && sy < this.cssH;
    if (onScreen && n < ARROW_TRAIL) return;
    const cx = this.cssW / 2;
    const cy = this.cssH / 2;
    const a = Math.atan2(sy - cy, sx - cx);
    // On screen: hover just short of the nest. Off screen: pin to the view's edge.
    const reach = onScreen
      ? Math.max(0, Math.hypot(sx - cx, sy - cy) - NEST.radius * this.scale - 24)
      : Math.min(
          (cx - ARROW_INSET) / Math.max(1e-6, Math.abs(Math.cos(a))),
          (cy - ARROW_INSET) / Math.max(1e-6, Math.abs(Math.sin(a))),
        );
    const bob = Math.sin(t * 6) * 4;
    const { ctx } = this;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * (reach + bob), cy + Math.sin(a) * (reach + bob));
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -13);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 13);
    ctx.closePath();
    ctx.fillStyle = P.duckling;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = P.ink;
    ctx.stroke();
    ctx.restore();
  }

  /** Fog over the swamp; the gator's eyes, and its cone when near, stay readable on top. */
  private drawNight(gator: Gator, duck: Vec, w: World, t: number, fullCone: boolean): void {
    const { ctx } = this;
    drawNightFog(ctx, duck, t);
    if (fullCone || coneHinted(gator, duck)) {
      ctx.save();
      ctx.globalAlpha = fullCone ? 1 : 0.45;
      this.drawCone(gator, w);
      ctx.restore();
    }
    drawGatorEyes(ctx, gator, t);
  }

  private drawCone(gator: Gator, w: World): void {
    // No cone during spawn grace, or while stunned and swallowing (blind).
    if (gator.grace > 0 || gator.stun > 0) return;
    const stats = gatorStats(w.time, w.eggsCollected, w.rules, w.ducklings.length);
    const poly = visibleConePolygon(
      { origin: gator.pos, heading: gator.heading, range: stats.coneRange, angle: stats.coneAngle },
      w.map.obstacles,
    );
    const { ctx } = this;
    ctx.beginPath();
    poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    const [fill, edge] =
      gator.mode === 'chase'
        ? [P.coneChase, P.coneEdgeChase]
        : gator.mode === 'search'
          ? [P.coneSearch, P.coneEdgeSearch]
          : [P.coneCalm, P.coneEdgeCalm];
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = edge;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Midway between duck and gator, but never so far that the duck leaves the view. */
  private replayFocus(duck: Vec, gator: Vec): Vec {
    const maxX = (this.cssW / 2 / this.scale) * REPLAY_DUCK_MARGIN;
    const maxY = (this.cssH / 2 / this.scale) * REPLAY_DUCK_MARGIN;
    return {
      x: duck.x + clamp((gator.x - duck.x) / 2, -maxX, maxX),
      y: duck.y + clamp((gator.y - duck.y) / 2, -maxY, maxY),
    };
  }

  private camera(focus: Vec): Vec {
    const halfW = this.cssW / 2 / this.scale;
    const halfH = this.cssH / 2 / this.scale;
    const axis = (f: number, half: number, size: number) =>
      half * 2 >= size + BORDER * 2 ? size / 2 : clamp(f, half - BORDER, size + BORDER - half);
    return { x: axis(focus.x, halfW, ARENA.width), y: axis(focus.y, halfH, ARENA.height) };
  }
}

/** A pin and label where the duck stood when the gator spotted it. */
function drawSpottedMarker(ctx: CanvasRenderingContext2D, at: Vec): void {
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = P.ink;
  ctx.fillStyle = '#ff5a4e';
  ctx.beginPath();
  ctx.arc(at.x, at.y, 26, 0, Math.PI * 2);
  ctx.setLineDash([8, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '22px "Lilita One", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeText('Spotted here', at.x, at.y - 36);
  ctx.fillText('Spotted here', at.x, at.y - 36);
  ctx.restore();
}

function paintBackground(ctx: CanvasRenderingContext2D, map: GameMap): void {
  const rng = new Rng(hashSeed(map.seed) ^ 0x51ed);
  // Water ring with ripples.
  ctx.fillStyle = P.water;
  ctx.fillRect(-BORDER, -BORDER, ARENA.width + BORDER * 2, ARENA.height + BORDER * 2);
  ctx.strokeStyle = P.waterFoam;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const x = rng.range(-BORDER, ARENA.width + BORDER);
    const y = rng.range(-BORDER, ARENA.height + BORDER);
    const inside = x > -10 && y > -10 && x < ARENA.width + 10 && y < ARENA.height + 10;
    if (inside) continue;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(x, y, rng.range(6, 14), Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Lily pads in the water.
  for (let i = 0; i < 26; i++) {
    const side = rng.int(0, 3);
    const along = rng.next();
    const depth = rng.range(30, BORDER - 30);
    const x = side < 2 ? along * ARENA.width : side === 2 ? -depth : ARENA.width + depth;
    const y = side >= 2 ? along * ARENA.height : side === 0 ? -depth : ARENA.height + depth;
    const r = rng.range(14, 24);
    const a = rng.range(0, Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, a + 0.5, a + Math.PI * 2 - 0.1);
    ctx.closePath();
    ctx.fillStyle = '#5fbf4a';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = P.ink;
    ctx.stroke();
    if (rng.chance(0.3)) {
      ctx.fillStyle = P.flower[0];
      ctx.beginPath();
      ctx.arc(x + 4, y - 3, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Muddy bank + grass island.
  ctx.fillStyle = P.mud;
  ctx.beginPath();
  ctx.roundRect(-14, -14, ARENA.width + 28, ARENA.height + 28, 44);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = P.ink;
  ctx.stroke();
  ctx.fillStyle = P.grass;
  ctx.beginPath();
  ctx.roundRect(0, 0, ARENA.width, ARENA.height, 32);
  ctx.fill();
  for (let i = 0; i < GRASS_DETAIL_COUNT; i++) {
    drawGrassDetail(ctx, rng.range(20, ARENA.width - 20), rng.range(20, ARENA.height - 20), rng);
  }
  for (const o of map.obstacles) {
    if (o.kind === 'log') drawLog(ctx, o);
    else drawReeds(ctx, o, rng);
  }
}
