import { $ } from './dom';

export type ScreenId = 'title' | 'modes' | 'campaign' | 'level' | 'pause' | 'over' | 'board';

const IDS: Record<ScreenId, string> = {
  title: '#screen-title',
  modes: '#screen-modes',
  campaign: '#screen-campaign',
  level: '#screen-level',
  pause: '#screen-pause',
  over: '#screen-over',
  board: '#screen-board',
};

/** Shows one overlay at a time and moves focus to its primary action. */
export function showScreen(id: ScreenId | null): void {
  for (const [key, sel] of Object.entries(IDS)) {
    const el = $(sel);
    const active = key === id;
    el.hidden = !active;
    if (active) el.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }
}

export interface GameOverStats {
  readonly score: number;
  readonly eggs: number;
  readonly time: string;
  readonly best: number;
  readonly isNewBest: boolean;
  readonly seed: string;
  /** "CHOMP!" for a catch; other endings bring their own headline. */
  readonly heading: string;
  /** Tone of the headline: a catch is red, a good ending is sunny. */
  readonly tone: 'chomp' | 'win';
  /** Optional line under the headline ("+500 clutch bonus"). */
  readonly sub: string;
  /** Mode name shown next to the seed; empty for classic. */
  readonly modeLabel: string;
  readonly unseen: string;
  readonly closest: string;
  readonly eggsPerMin: string;
  readonly spotted: number;
}

export function fillGameOver(s: GameOverStats): void {
  const heading = $('#over-heading');
  heading.textContent = s.heading;
  heading.classList.toggle('heading--chomp', s.tone === 'chomp');
  heading.classList.toggle('heading--win', s.tone === 'win');
  const sub = $('#over-sub');
  sub.textContent = s.sub;
  sub.hidden = !s.sub;
  $('#over-score').textContent = String(s.score);
  $('#over-eggs').textContent = String(s.eggs);
  $('#over-time').textContent = s.time;
  $('#over-best').textContent = String(s.best);
  $('#over-unseen').textContent = s.unseen;
  $('#over-closest').textContent = s.closest;
  $('#over-epm').textContent = s.eggsPerMin;
  $('#over-spotted').textContent = String(s.spotted);
  $('#over-newbest').hidden = !s.isNewBest;
  $('#over-seed').textContent = s.seed;
  const mode = $('#over-mode');
  mode.textContent = s.modeLabel;
  mode.hidden = !s.modeLabel;
}
