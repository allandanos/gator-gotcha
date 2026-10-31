import type { Vec } from '../core/vec';

const STICK_RADIUS = 56;

/** Floating virtual joystick (left side of the screen) plus a sprint button. */
export class TouchControls {
  private pointerId: number | null = null;
  private origin: Vec = { x: 0, y: 0 };
  private vector: Vec = { x: 0, y: 0 };
  private sprintHeld = false;

  constructor(
    private readonly surface: HTMLElement,
    private readonly base: HTMLElement,
    private readonly knob: HTMLElement,
    sprintButton: HTMLElement,
  ) {
    surface.addEventListener('pointerdown', this.onDown);
    surface.addEventListener('pointermove', this.onMove);
    surface.addEventListener('pointerup', this.onUp);
    surface.addEventListener('pointercancel', this.onUp);
    const setSprint = (v: boolean) => (e: PointerEvent) => {
      e.preventDefault();
      this.sprintHeld = v;
      sprintButton.classList.toggle('is-held', v);
    };
    sprintButton.addEventListener('pointerdown', setSprint(true));
    sprintButton.addEventListener('pointerup', setSprint(false));
    sprintButton.addEventListener('pointercancel', setSprint(false));
    sprintButton.addEventListener('pointerleave', setSprint(false));
  }

  get move(): Vec {
    return this.vector;
  }

  get sprint(): boolean {
    return this.sprintHeld;
  }

  reset(): void {
    this.pointerId = null;
    this.vector = { x: 0, y: 0 };
    this.sprintHeld = false;
    this.base.classList.remove('is-active');
  }

  private readonly onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || this.pointerId !== null) return;
    document.body.classList.add('has-touch');
    this.pointerId = e.pointerId;
    this.surface.setPointerCapture(e.pointerId);
    this.origin = { x: e.clientX, y: e.clientY };
    this.base.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    this.base.classList.add('is-active');
    this.update(e);
  };

  private readonly onMove = (e: PointerEvent) => {
    if (e.pointerId === this.pointerId) this.update(e);
  };

  private readonly onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.reset();
  };

  private update(e: PointerEvent): void {
    const dx = e.clientX - this.origin.x;
    const dy = e.clientY - this.origin.y;
    const l = Math.hypot(dx, dy);
    const k = l > STICK_RADIUS ? STICK_RADIUS / l : 1;
    this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    this.vector = l > 6 ? { x: (dx * k) / STICK_RADIUS, y: (dy * k) / STICK_RADIUS } : { x: 0, y: 0 };
  }
}
