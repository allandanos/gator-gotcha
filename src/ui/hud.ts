import { DUCK } from '../config';
import { scoreOf } from '../sim/scoring';
import type { GatorMode, World } from '../sim/types';
import { $, formatTime } from './dom';

const STATUS: Record<GatorMode, string> = {
  wander: 'Hidden',
  search: 'Sniffing…',
  chase: 'Spotted!',
};
/** Seconds left at which a countdown turns urgent. */
const COUNTDOWN_WARN = 10;

/** DOM heads-up display. Writes only when values change to avoid layout churn. */
export class Hud {
  private readonly root = $('#hud');
  private readonly score = $('#hud-score');
  private readonly eggs = $('#hud-eggs');
  private readonly time = $('#hud-time');
  private readonly timeChip = $('#hud-time-chip');
  private readonly timeLabel = $('#hud-time-label');
  private readonly stamina = $('#hud-stamina');
  private readonly staminaFill = $('#hud-stamina-fill');
  private readonly status = $('#hud-status');
  private last = {
    score: '',
    eggs: '',
    time: '',
    mode: '',
    stamina: -1,
    exhausted: false,
    warn: false,
  };

  show(visible: boolean): void {
    this.root.hidden = !visible;
  }

  /** Call at run start: timed runs show a countdown instead of elapsed time. */
  reset(w: World): void {
    this.timeLabel.textContent = w.rules.timeLimit === null ? 'Time' : 'Left';
    this.timeChip.classList.remove('chip--warn');
    this.last = { ...this.last, time: '', warn: false };
  }

  update(w: World): void {
    const score = String(scoreOf(w));
    const eggs = String(w.eggsCollected);
    const left = w.rules.timeLimit === null ? null : Math.max(0, w.rules.timeLimit - w.time);
    // Round the countdown up so it reads 0:00 only when the buzzer actually goes.
    const time = left === null ? formatTime(w.time) : formatTime(Math.ceil(left));
    const warn = left !== null && left <= COUNTDOWN_WARN;
    if (warn !== this.last.warn) this.timeChip.classList.toggle('chip--warn', warn);
    const stamina = Math.round((w.duck.stamina / DUCK.staminaMax) * 100) / 100;
    if (score !== this.last.score) this.score.textContent = score;
    if (eggs !== this.last.eggs) this.eggs.textContent = eggs;
    if (time !== this.last.time) this.time.textContent = time;
    if (stamina !== this.last.stamina) {
      this.staminaFill.style.transform = `scaleX(${stamina})`;
      this.stamina.setAttribute('aria-valuenow', String(Math.round(stamina * 100)));
    }
    if (w.duck.exhausted !== this.last.exhausted)
      this.stamina.classList.toggle('is-exhausted', w.duck.exhausted);
    if (w.gator.mode !== this.last.mode) {
      this.status.textContent = STATUS[w.gator.mode];
      this.status.dataset.mode = w.gator.mode;
    }
    this.last = {
      score,
      eggs,
      time,
      mode: w.gator.mode,
      stamina,
      exhausted: w.duck.exhausted,
      warn,
    };
  }
}
