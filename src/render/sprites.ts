import { DUCK, EGGS, GATOR } from '../config';
import type { Rng } from '../core/rng';
import type { Vec } from '../core/vec';
import type { Duck, Gator, Obstacle } from '../sim/types';
import { PALETTE as P } from './palette';

type Ctx = CanvasRenderingContext2D;

const OUTLINE = 3;

function outlined(ctx: Ctx, fill: string, path: () => void): void {
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = OUTLINE;
  ctx.strokeStyle = P.ink;
  ctx.stroke();
}

function shadow(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = P.shadow;
  ctx.fill();
}

export function drawLog(ctx: Ctx, o: Obstacle): void {
  const horizontal = o.w >= o.h;
  const r = Math.min(o.w, o.h) / 2;
  ctx.save();
  shadow(ctx, o.x + o.w / 2 + 4, o.y + o.h / 2 + 8, o.w / 2 + 4, o.h / 2 + 4);
  outlined(ctx, P.bark, () => ctx.roundRect(o.x, o.y, o.w, o.h, r));
  // Bark grain.
  ctx.strokeStyle = P.barkDark;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const long = horizontal ? o.w : o.h;
  for (let i = 1; i < 3; i++) {
    const off = (Math.min(o.w, o.h) * i) / 3;
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(o.x + r + 6, o.y + off);
      ctx.lineTo(o.x + long * (0.45 + i * 0.12), o.y + off);
    } else {
      ctx.moveTo(o.x + off, o.y + r + 6);
      ctx.lineTo(o.x + off, o.y + long * (0.45 + i * 0.12));
    }
    ctx.stroke();
  }
  // End rings.
  const ex = horizontal ? o.x + o.w - r : o.x + r;
  const ey = horizontal ? o.y + r : o.y + o.h - r;
  outlined(ctx, P.barkRing, () => ctx.ellipse(ex, ey, r * 0.8, r * 0.8, 0, 0, Math.PI * 2));
  ctx.beginPath();
  ctx.arc(ex, ey, r * 0.4, 0, Math.PI * 2);
  ctx.strokeStyle = P.barkDark;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function drawReeds(ctx: Ctx, o: Obstacle, rng: Rng): void {
  ctx.save();
  // Mud base.
  outlined(ctx, P.mud, () => ctx.roundRect(o.x, o.y, o.w, o.h, 22));
  const count = Math.floor((o.w * o.h) / 260);
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = rng.range(o.x + 8, o.x + o.w - 8);
    const y = rng.range(o.y + 8, o.y + o.h - 8);
    const lean = rng.range(-6, 6);
    const h = rng.range(14, 26);
    ctx.strokeStyle = i % 2 ? P.reed : P.reedDark;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.quadraticCurveTo(x + lean / 2, y - h / 2, x + lean, y - h);
    ctx.stroke();
    if (rng.chance(0.3)) {
      ctx.fillStyle = P.cattail;
      ctx.beginPath();
      ctx.ellipse(x + lean, y - h, 3.5, 7, lean / 30, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawGrassDetail(ctx: Ctx, x: number, y: number, rng: Rng): void {
  const kind = rng.next();
  if (kind < 0.55) {
    ctx.strokeStyle = P.grassDark;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 4, y);
      ctx.lineTo(x + i * 6, y - 9 + Math.abs(i) * 2);
      ctx.stroke();
    }
  } else if (kind < 0.8) {
    ctx.fillStyle = rng.pick(P.flower);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd84d';
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = P.grassLight;
    ctx.beginPath();
    ctx.ellipse(x, y, rng.range(18, 40), rng.range(10, 22), rng.range(0, Math.PI), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawEgg(ctx: Ctx, x: number, y: number, t: number, id: number, golden = false): void {
  const bob = Math.sin(t * 4 + id) * 2;
  const r = golden ? EGGS.radius * 1.2 : EGGS.radius;
  if (golden) drawSparkle(ctx, x, y - 3, t);
  shadow(ctx, x, y + r, r * 0.9, r * 0.35);
  ctx.save();
  ctx.translate(x, y + bob - 3);
  ctx.rotate(Math.sin(t * 2 + id) * 0.12);
  outlined(ctx, golden ? P.gold : P.egg, () => ctx.ellipse(0, 0, r * 0.8, r, 0, 0, Math.PI * 2));
  ctx.fillStyle = golden ? P.goldSpeck : P.eggSpeck;
  for (const [sx, sy] of [
    [-3, -4],
    [3, 1],
    [-1, 5],
  ] as const) {
    ctx.beginPath();
    ctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(-3, -5, 2, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Four-point glints orbiting a golden egg. */
function drawSparkle(ctx: Ctx, x: number, y: number, t: number): void {
  ctx.save();
  ctx.fillStyle = '#fffbe0';
  for (let i = 0; i < 3; i++) {
    const a = t * 1.6 + (i * Math.PI * 2) / 3;
    const s = 3 + 2.5 * Math.abs(Math.sin(t * 5 + i * 2));
    ctx.save();
    ctx.translate(x + Math.cos(a) * 22, y + Math.sin(a) * 18);
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const rr = k % 2 ? s * 0.3 : s;
      ctx.lineTo(Math.cos((k * Math.PI) / 4) * rr, Math.sin((k * Math.PI) / 4) * rr);
    }
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** A woven ring on the duck's spawn; it glows while the duck has ducklings to bring home. */
export function drawNest(ctx: Ctx, at: Vec, radius: number, t: number, glowing: boolean): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  if (glowing) {
    const pulse = 0.55 + 0.25 * Math.sin(t * 4);
    const glow = ctx.createRadialGradient(0, 0, radius * 0.4, 0, 0, radius * 1.6);
    glow.addColorStop(0, `rgba(255, 228, 110, ${pulse})`);
    glow.addColorStop(1, 'rgba(255, 228, 110, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = P.ink;
  ctx.fillStyle = P.nest;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  // Weave: short twig strokes around the ring.
  ctx.strokeStyle = P.nestDark;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const a = (i * Math.PI * 2) / 14;
    const r0 = radius * 0.68;
    const r1 = radius * 0.94;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a + 0.3) * r1, Math.sin(a + 0.3) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

/** A small yellow duckling; `index` offsets its bob so the trail ripples. */
export function drawDuckling(ctx: Ctx, at: Vec, facing: number, t: number, index: number): void {
  const r = DUCK.radius * 0.62;
  const bob = Math.sin(t * 12 + index * 0.9) * 1.6;
  shadow(ctx, at.x, at.y + r * 0.8, r * 1.1, r * 0.4);
  ctx.save();
  ctx.translate(at.x, at.y + bob);
  ctx.rotate(facing);
  outlined(ctx, P.duckling, () => ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2));
  outlined(ctx, P.duckling, () => ctx.arc(r * 0.7, 0, r * 0.6, 0, Math.PI * 2));
  ctx.fillStyle = P.bill;
  ctx.beginPath();
  ctx.ellipse(r * 1.3, 0, r * 0.35, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = P.pupil;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(r * 0.85, s * r * 0.28, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawDuck(ctx: Ctx, d: Duck, t: number, caught: boolean): void {
  const r = DUCK.radius;
  const speed = Math.hypot(d.vel.x, d.vel.y);
  const waddle = speed > 10 ? Math.sin(t * (d.sprinting ? 22 : 14)) * 0.18 : 0;
  shadow(ctx, d.pos.x, d.pos.y + r * 0.7, r * 1.1, r * 0.45);
  ctx.save();
  ctx.translate(d.pos.x, d.pos.y);
  if (caught) ctx.scale(1.15, 0.7);
  ctx.rotate(d.facing);
  ctx.rotate(waddle);
  // Feet.
  ctx.fillStyle = P.bill;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-r * 0.5, s * r * 0.55, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Tail tuft.
  outlined(ctx, P.duckShade, () => {
    ctx.moveTo(-r * 0.9, -5);
    ctx.lineTo(-r * 1.45, 0);
    ctx.lineTo(-r * 0.9, 5);
    ctx.closePath();
  });
  // Body.
  outlined(ctx, P.duck, () => ctx.ellipse(0, 0, r * 1.05, r * 0.9, 0, 0, Math.PI * 2));
  // Wings flap with speed.
  const flap = d.sprinting ? Math.sin(t * 30) * 0.5 : 0;
  ctx.fillStyle = P.duckShade;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(-2, s * r * 0.6);
    ctx.rotate(s * (0.25 + flap));
    ctx.beginPath();
    ctx.ellipse(-4, 0, r * 0.55, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Head.
  outlined(ctx, P.duck, () => ctx.arc(r * 0.75, 0, r * 0.62, 0, Math.PI * 2));
  // Bill.
  outlined(ctx, P.bill, () => ctx.ellipse(r * 1.35, 0, r * 0.42, r * 0.26, 0, 0, Math.PI * 2));
  // Eyes.
  for (const s of [-1, 1]) {
    ctx.fillStyle = P.pupil;
    ctx.beginPath();
    ctx.arc(r * 0.9, s * r * 0.3, caught ? 1.5 : 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawGator(ctx: Ctx, g: Gator, t: number, jawOpen: number): void {
  const r = GATOR.radius;
  shadow(ctx, g.pos.x, g.pos.y + 8, r * 2, r * 0.8);
  ctx.save();
  ctx.translate(g.pos.x, g.pos.y);
  ctx.rotate(g.heading);
  const wiggle = Math.sin(t * (g.mode === 'chase' ? 14 : 6)) * 0.35;

  // Tail (three tapering segments that wiggle).
  ctx.save();
  ctx.translate(-r * 1.1, 0);
  ctx.rotate(wiggle * 0.6);
  outlined(ctx, P.gator, () => {
    ctx.moveTo(0, -r * 0.55);
    ctx.quadraticCurveTo(-r * 1.4, -r * 0.2 + wiggle * 6, -r * 2.4, wiggle * 10);
    ctx.quadraticCurveTo(-r * 1.4, r * 0.2 + wiggle * 6, 0, r * 0.55);
    ctx.closePath();
  });
  ctx.restore();

  // Legs.
  for (const [lx, s] of [
    [r * 0.55, -1],
    [r * 0.55, 1],
    [-r * 0.65, -1],
    [-r * 0.65, 1],
  ] as const) {
    const step = Math.sin(t * 12 + lx) * 4;
    outlined(ctx, P.gatorDark, () => ctx.ellipse(lx + step * s, s * r * 0.85, 7, 5, s * 0.5, 0, Math.PI * 2));
  }

  // Body.
  outlined(ctx, P.gator, () => ctx.ellipse(0, 0, r * 1.35, r * 0.75, 0, 0, Math.PI * 2));
  // Back ridges.
  ctx.fillStyle = P.gatorDark;
  for (let i = -2; i <= 2; i++) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(i * 8, s * 6, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Head + jaws. Upper jaw rotates open when lunging.
  const open = jawOpen * 0.5;
  ctx.save();
  ctx.translate(r * 1.1, 0);
  for (const s of [1, -1]) {
    ctx.save();
    ctx.rotate(s * open);
    outlined(ctx, s === 1 ? P.gatorBelly : P.gator, () => {
      ctx.moveTo(0, 0);
      ctx.lineTo(0, s * r * 0.55);
      ctx.quadraticCurveTo(r * 1.4, s * r * 0.45, r * 1.5, 0);
      ctx.closePath();
    });
    // Teeth.
    ctx.fillStyle = '#ffffff';
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(r * 0.35 * i, s * 1);
      ctx.lineTo(r * 0.35 * i + 3, s * 6);
      ctx.lineTo(r * 0.35 * i + 6, s * 1);
      ctx.fill();
    }
    ctx.restore();
  }
  // Nostrils.
  ctx.fillStyle = P.gatorDark;
  ctx.beginPath();
  ctx.arc(r * 1.3, -3, 1.8, 0, Math.PI * 2);
  ctx.arc(r * 1.3, 3, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Big googly eyes on top of the head.
  const look = g.mode === 'search' ? Math.sin(t * 5) * 2.5 : 0;
  for (const s of [-1, 1]) {
    outlined(ctx, P.eye, () => ctx.arc(r * 0.95, s * r * 0.42, 7, 0, Math.PI * 2));
    ctx.fillStyle = P.pupil;
    ctx.beginPath();
    ctx.arc(r * 0.95 + 2.5, s * r * 0.42 + look, g.mode === 'chase' ? 2.2 : 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** "!" or "?" speech bubble above the gator. */
export function drawAlertIcon(ctx: Ctx, x: number, y: number, glyph: '!' | '?', pop: number): void {
  ctx.save();
  ctx.translate(x, y);
  const s = 1 + Math.max(0, pop) * 0.6;
  ctx.scale(s, s);
  outlined(ctx, glyph === '!' ? '#ff5a4e' : '#ffb340', () => ctx.arc(0, 0, 13, 0, Math.PI * 2));
  ctx.fillStyle = '#ffffff';
  ctx.font = '22px "Lilita One", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 0, 1.5);
  ctx.restore();
}
