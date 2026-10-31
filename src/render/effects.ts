import type { Vec } from '../core/vec';
import type { GameEvent } from '../sim/types';

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
}

const POPUP_LIFE = 0.9;
const SHAKE_DECAY = 3;
const PICKUP_COLORS = ['#ffd84d', '#ffffff', '#ff9a2e'];
const SPLASH_COLORS = ['#ffffff', '#4cc3e0', '#d6f6ff'];

/** Purely cosmetic, frame-rate-driven effects derived from sim events. */
export class Effects {
  particles: readonly Particle[] = [];
  popups: readonly Popup[] = [];
  shake = 0;
  /** 0..1 pop animation for the alert icon, restarted on spotted/lost. */
  alertPop = 0;

  reset(): void {
    this.particles = [];
    this.popups = [];
    this.shake = 0;
    this.alertPop = 0;
  }

  handle(events: readonly GameEvent[]): void {
    for (const e of events) {
      if (e.type === 'pickup') {
        this.burst(e.pos, 14, PICKUP_COLORS, 160);
        this.popups = [...this.popups, { pos: e.pos, text: '+100', life: POPUP_LIFE }];
      } else if (e.type === 'caught') {
        this.burst(e.pos, 30, SPLASH_COLORS, 260);
        this.shake = 1;
      } else if (e.type === 'spotted' || e.type === 'lost') {
        this.alertPop = 1;
      }
    }
  }

  update(dt: number): void {
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
    this.shake = Math.max(0, this.shake - SHAKE_DECAY * dt);
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
      ctx.fillStyle = '#ffd84d';
      ctx.fillText(p.text, p.pos.x, p.pos.y - 20);
    }
    ctx.globalAlpha = 1;
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
