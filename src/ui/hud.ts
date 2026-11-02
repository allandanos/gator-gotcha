import { DUCK } from '../config';
import { secondsToDawn, secondsToNight } from '../sim/cycle';
import { bankValue, scoreOf } from '../sim/scoring';
import type { GatorMode, World } from '../sim/types';
import { HINT_MS } from '../render/feel';
import { $, formatTime } from './dom';
import { formatPace } from './pace';

const STATUS: Record<GatorMode, string> = {
  wander: 'Hidden',
  search: 'Sniffing…',
  chase: 'Spotted!',
};
/** Seconds left at which a countdown turns urgent. */
const COUNTDOWN_WARN = 10;

/** Seconds of day left at which Classic warns that night is coming. */
const NIGHT_WARN = 5;

/**
 * Classic's day/night cue: "Night in 5" at dusk, then "Dawn 0:22" until the night ends.
 * Null hides the chip (daytime, or rules without a cycle).
 */
export function nightCue(rules: World['rules'], time: number): { label: string; value: string } | null {
  const toNight = secondsToNight(rules, time);
  if (toNight !== null) return toNight <= NIGHT_WARN ? { label: 'Night', value: `in ${Math.ceil(toNight)}` } : null;
  const toDawn = secondsToDawn(rules, time);
  return toDawn === null ? null : { label: 'Dawn', value: formatTime(Math.ceil(toDawn)) };
}

/** "×4 → +560": what banking the trail right now would pay. */
export function carryText(n: number): string {
  return n === 0 ? '0' : `×${n} → +${bankValue(n).toLocaleString('en-US')}`;
}

/** DOM heads-up display. Writes only when values change to avoid layout churn. */
export class Hud {
  private readonly root = $('#hud');
  private readonly score = $('#hud-score');
  private readonly eggs = $('#hud-eggs');
  private readonly eggsChip = $('#hud-eggs-chip');
  private readonly carryChip = $('#hud-carry-chip');
  private readonly carry = $('#hud-carry');
  private readonly bankedChip = $('#hud-banked-chip');
  private readonly banked = $('#hud-banked');
  private readonly nightChip = $('#hud-night-chip');
  private readonly nightLabel = $('#hud-night-label');
  private readonly night = $('#hud-night');
  private readonly time = $('#hud-time');
  private readonly timeChip = $('#hud-time-chip');
  private readonly timeLabel = $('#hud-time-label');
  private readonly scoreChip = $('#hud-score-chip');
  private readonly goalChip = $('#hud-goal-chip');
  private readonly goalLabel = $('#hud-goal-label');
  private readonly goal = $('#hud-goal');
  private readonly stamina = $('#hud-stamina');
  private readonly staminaFill = $('#hud-stamina-fill');
  private readonly status = $('#hud-status');
  private readonly paceChip = $('#hud-pace');
  private readonly paceIcon = $('#hud-pace-icon');
  private readonly paceText = $('#hud-pace-text');
  private readonly hintEl = $('#hint');
  private hints: readonly string[] = [];
  private hintTimer = 0;
  private last = {
    score: '',
    eggs: '',
    carry: '',
    banked: '',
    night: '',
    time: '',
    mode: '',
    stamina: -1,
    exhausted: false,
    warn: false,
    goal: '',
    pace: '',
  };

  show(visible: boolean): void {
    this.root.hidden = !visible;
  }

  /** Call at run start: timed runs show a countdown instead of elapsed time. */
  reset(w: World): void {
    this.timeLabel.textContent = w.rules.timeLimit === null ? 'Time' : 'Left';
    this.timeChip.classList.remove('chip--warn');
    // Campaign levels chase a goal, not a score.
    const goal = w.rules.goal;
    this.scoreChip.hidden = goal !== null;
    this.goalChip.hidden = goal === null;
    this.goalLabel.textContent =
      goal?.ducklings !== undefined ? 'Bank' : goal?.eggs !== undefined ? 'Goal' : 'Survive';
    // Duckling rules show the trail and the bank; other modes count eggs.
    const dash = w.rules.ducklings;
    this.eggsChip.hidden = dash;
    this.carryChip.hidden = !dash;
    this.bankedChip.hidden = !dash || goal !== null;
    this.last = { ...this.last, time: '', warn: false, goal: '', pace: '', carry: '', banked: '', night: '' };
    this.nightChip.hidden = true;
    this.paceChip.hidden = true;
    this.clearHints();
  }

  /** Drop any showing or queued tip (run over, or a new run starting). */
  clearHints(): void {
    window.clearTimeout(this.hintTimer);
    this.hints = [];
    this.hintTimer = 0;
    this.hintEl.hidden = true;
  }

  /** Queue first-run tips; each shows for HINT_MS and never pauses the run. */
  hint(texts: readonly string[]): void {
    this.hints = [...this.hints, ...texts];
    if (!this.hintTimer) this.nextHint();
  }

  private nextHint(): void {
    const [text, ...rest] = this.hints;
    this.hints = rest;
    this.hintEl.hidden = text === undefined;
    this.hintTimer = 0;
    if (text === undefined) return;
    this.hintEl.textContent = text;
    this.hintTimer = window.setTimeout(() => this.nextHint(), HINT_MS);
  }

  /** Seconds ahead (+) or behind (−) the best run, or null to hide the readout. */
  private updatePace(pace: number | null): void {
    const label = pace === null ? null : formatPace(pace);
    const key = label ? `${label.tone}:${label.text}` : '';
    if (key === this.last.pace) return;
    this.paceChip.hidden = !label;
    if (label) {
      this.paceChip.dataset.tone = label.tone;
      this.paceIcon.textContent = label.icon;
      this.paceText.textContent = label.text;
    }
    this.last = { ...this.last, pace: key };
  }

  private goalText(w: World): string {
    const goal = w.rules.goal;
    if (!goal) return '';
    if (goal.ducklings !== undefined) {
      return `${Math.min(w.bankedDucklings, goal.ducklings)}/${goal.ducklings}`;
    }
    if (goal.eggs !== undefined) return `${Math.min(w.eggsCollected, goal.eggs)}/${goal.eggs}`;
    return formatTime(Math.ceil(Math.max(0, (goal.surviveSec ?? 0) - w.time)));
  }

  update(w: World, pace: number | null = null): void {
    this.updatePace(pace);
    const score = String(scoreOf(w));
    const eggs = String(w.eggsCollected);
    const left = w.rules.timeLimit === null ? null : Math.max(0, w.rules.timeLimit - w.time);
    // Round the countdown up so it reads 0:00 only when the buzzer actually goes.
    const time = left === null ? formatTime(w.time) : formatTime(Math.ceil(left));
    const warn = left !== null && left <= COUNTDOWN_WARN;
    if (warn !== this.last.warn) this.timeChip.classList.toggle('chip--warn', warn);
    const goal = this.goalText(w);
    if (goal !== this.last.goal) this.goal.textContent = goal;
    const stamina = Math.round((w.duck.stamina / DUCK.staminaMax) * 100) / 100;
    if (score !== this.last.score) this.score.textContent = score;
    if (eggs !== this.last.eggs) this.eggs.textContent = eggs;
    const carry = carryText(w.ducklings.length);
    if (carry !== this.last.carry) {
      this.carry.textContent = carry;
      this.carryChip.dataset.full = String(w.ducklings.length > 0);
    }
    const banked = String(w.bankedDucklings);
    if (banked !== this.last.banked) this.banked.textContent = banked;
    if (time !== this.last.time) this.time.textContent = time;
    const cue = nightCue(w.rules, w.time);
    const night = cue ? `${cue.label}:${cue.value}` : '';
    if (night !== this.last.night) {
      this.nightChip.hidden = !cue;
      if (cue) {
        this.nightLabel.textContent = cue.label;
        this.night.textContent = cue.value;
      }
    }
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
      ...this.last,
      score,
      eggs,
      carry,
      banked,
      night,
      time,
      mode: w.gator.mode,
      stamina,
      exhausted: w.duck.exhausted,
      warn,
      goal,
    };
  }
}
