import type { Vec } from '../core/vec';
import type { GameEvent } from '../sim/types';
import { HITSTOP_MS, SHAKE_MS, SHAKE_PX, SPOTTED_PULSE_MS } from './feel';

interface Particle {
  readonly pos: Vec;
  readonly vel: Vec;
  readonly life: number;
  readonly maxLife: number;
  readonly color: string;
  readonly size: number;
}

interface Popup {
  readonly pos: Vec;
  readonly text: string;
  readonly life: number;
  readonly color: string;
}

const POPUP_LIFE = 0.9;
const PICKUP_COLORS = ['#ffd84d', '#ffffff', '#ff9a2e'];
const SPLASH_COLORS = ['#ffffff', '#4cc3e0', '#d6f6ff'];

/** Purely cosmetic, frame-rate-driven effects derived from sim events. */
export class Effects {
  particles: readonly Particle[] = [];
  popups: readonly Popup[] = [];
  /** 0..1, decays over SHAKE_MS; squared when applied so it eases out. */
  shake = 0;
  /** 0..1 pop animation for the alert icon, restarted on spotted/lost. */
  alertPop = 0;
  /** 0..1 red edge pulse, restarted on spotted. */
  pulse = 0;
  /** Seconds of frozen frame left after a catch. */
  hitstop = 0;
  /** Set from `prefers-reduced-motion`: no shake. */
  reducedMotion = false;

  /** While true the whole render clock holds still (hitstop). */
  get frozen(): boolean {
    return this.hitstop > 0;
  }

  reset(): void {
    this.particles = [];
    this.popups = [];
    this.shake = 0;
    this.alertPop = 0;
    this.pulse = 0;
    this.hitstop = 0;
  }

  popup(pos: Vec, text: string, color = '#ffd84d'): void {
    this.popups = [...this.popups, { pos, text, life: POPUP_LIFE, color }];
  }

  /** Random camera offset in CSS px for this frame. */
  shakeOffset(): Vec {
    const px = this.shake * this.shake * SHAKE_PX;
    return { x: (Math.random() - 0.5) * 2 * px, y: (Math.random() - 0.5) * 2 * px };
  }

  handle(events: readonly GameEvent[]): void {
    for (const e of events) {
      if (e.type === 'pickup') {
        this.burst(e.pos, 14, PICKUP_COLORS, 160);
        this.popup(e.pos, '+100');
      } else if (e.type === 'caught') {
        this.burst(e.pos, 30, SPLASH_COLORS, 260);
        this.hitstop = HITSTOP_MS / 1000;
        this.shake = this.reducedMotion ? 0 : 1;
      } else if (e.type === 'spotted' || e.type === 'lost') {
        this.alertPop = 1;
        if (e.type === 'spotted') this.pulse = 1;
      }
    }
  }

  update(dt: number): void {
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      return;
    }
    this.particles = this.particles
      .map((p) => ({
        ...p,
        pos: { x: p.pos.x + p.vel.x * dt, y: p.pos.y + p.vel.y * dt },
        vel: { x: p.vel.x * 0.92, y: p.vel.y * 0.92 + 30 * dt },
        life: p.life - dt,
      }))
      .filter((p) => p.life > 0);
    this.popups = this.popups
      .map((p) => ({ ...p, pos: { x: p.pos.x, y: p.pos.y - 40 * dt }, life: p.life - dt }))
      .filter((p) => p.life > 0);
    this.shake = Math.max(0, this.shake - dt / (SHAKE_MS / 1000));
    this.pulse = Math.max(0, this.pulse - dt / (SPOTTED_PULSE_MS / 1000));
    this.alertPop = Math.max(0, this.alertPop - 4 * dt);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.life / p.maxLife + 0.2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = '24px "Lilita One", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    for (const p of this.popups) {
      ctx.globalAlpha = Math.min(1, p.life / (POPUP_LIFE * 0.5));
      ctx.strokeStyle = '#24331c';
      ctx.strokeText(p.text, p.pos.x, p.pos.y - 20);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.pos.x, p.pos.y - 20);
    }
    ctx.globalAlpha = 1;
  }

  /** Red vignette on the screen edges, in CSS px; drawn after the world. */
  drawPulse(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.pulse <= 0) return;
    const r = Math.hypot(w, h) / 2;
    const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.55, w / 2, h / 2, r);
    g.addColorStop(0, 'rgba(255, 60, 50, 0)');
    g.addColorStop(1, `rgba(255, 60, 50, ${0.55 * this.pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private burst(at: Vec, n: number, colors: readonly string[], speed: number): void {
    const fresh: Particle[] = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      const life = 0.4 + Math.random() * 0.4;
      fresh.push({
        pos: at,
        vel: { x: Math.cos(a) * s, y: Math.sin(a) * s },
        life,
        maxLife: life,
        color: colors[i % colors.length] as string,
        size: 3 + Math.random() * 4,
      });
    }
    this.particles = [...this.particles, ...fresh];
  }
}
