import type { Vec } from '../core/vec';
import { isTypingTarget } from '../ui/dom';

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight', 'Space']);
const GAME_KEYS = new Set([...UP, ...DOWN, ...LEFT, ...RIGHT, ...SPRINT]);

export class Keyboard {
  private readonly held = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (isTypingTarget(e.target)) return;
      if (GAME_KEYS.has(e.code) && !(e.target instanceof HTMLButtonElement && e.code === 'Space')) e.preventDefault();
      this.held.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.held.delete(e.code));
    target.addEventListener('blur', () => this.held.clear());
  }

  private any(keys: Set<string>): boolean {
    for (const k of keys) if (this.held.has(k)) return true;
    return false;
  }

  get move(): Vec {
    const x = (this.any(RIGHT) ? 1 : 0) - (this.any(LEFT) ? 1 : 0);
    const y = (this.any(DOWN) ? 1 : 0) - (this.any(UP) ? 1 : 0);
    const l = Math.hypot(x, y);
    return l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
  }

  get sprint(): boolean {
    return this.any(SPRINT);
  }
}
