import { ARENA } from '../config';
import { hashSeed, Rng } from '../core/rng';
import { angleDiff, clamp, dist, lerp, type Vec } from '../core/vec';
import { gatorStats } from '../sim/difficulty';
import { visibleConePolygon } from '../sim/sight';
import type { Gator, GameMap, World } from '../sim/types';
import type { Effects } from './effects';
import { PALETTE as P } from './palette';
import { drawAlertIcon, drawDuck, drawEgg, drawGator, drawGrassDetail, drawLog, drawReeds } from './sprites';

/** Decorative water ring drawn around the arena. */
const BORDER = 140;
const MAX_BAKE_SCALE = 2.5;
const GRASS_DETAIL_COUNT = 260;
const JAW_RANGE = 140;
const SHAKE_PX = 14;

function lerpVec(a: Vec, b: Vec, t: number): Vec {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function lerpGator(a: Gator, b: Gator, t: number): Gator {
  return { ...b, pos: lerpVec(a.pos, b.pos, t), heading: a.heading + angleDiff(a.heading, b.heading) * t };
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
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = this.canvas.clientWidth;
    this.cssH = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.scale = viewScale(this.cssW, this.cssH);
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

  render(prev: World, cur: World, alpha: number, fx: Effects, t: number): void {
    const { ctx } = this;
    const bake = this.ensureBake();
    const duck = { ...cur.duck, pos: lerpVec(prev.duck.pos, cur.duck.pos, alpha) };
    const gator = lerpGator(prev.gator, cur.gator, alpha);
    const cam = this.camera(duck.pos);
    const shake = fx.shake * SHAKE_PX;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = P.waterDeep;
    ctx.fillRect(0, 0, this.cssW, this.cssH);
    ctx.translate(
      this.cssW / 2 - cam.x * this.scale + (Math.random() - 0.5) * shake,
      this.cssH / 2 - cam.y * this.scale + (Math.random() - 0.5) * shake,
    );
    ctx.scale(this.scale, this.scale);
    ctx.drawImage(bake, -BORDER, -BORDER, ARENA.width + BORDER * 2, ARENA.height + BORDER * 2);

    this.drawCone(gator, cur);
    for (const e of cur.eggs) drawEgg(ctx, e.pos.x, e.pos.y, t, e.id);

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
    if (gator.mode !== 'wander') {
      drawAlertIcon(ctx, gator.pos.x, gator.pos.y - 46, gator.mode === 'chase' ? '!' : '?', fx.alertPop);
    }
    fx.draw(ctx);
  }

  private drawCone(gator: Gator, w: World): void {
    if (gator.grace > 0) return;
    const stats = gatorStats(w.time, w.eggsCollected);
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

  private camera(focus: Vec): Vec {
    const halfW = this.cssW / 2 / this.scale;
    const halfH = this.cssH / 2 / this.scale;
    const axis = (f: number, half: number, size: number) =>
      half * 2 >= size + BORDER * 2 ? size / 2 : clamp(f, half - BORDER, size + BORDER - half);
    return { x: axis(focus.x, halfW, ARENA.width), y: axis(focus.y, halfH, ARENA.height) };
  }
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
