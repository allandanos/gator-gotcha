import { $ } from './dom';

export type ScreenId = 'title' | 'pause' | 'over' | 'board';

const IDS: Record<ScreenId, string> = {
  title: '#screen-title',
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
}

export function fillGameOver(s: GameOverStats): void {
  $('#over-score').textContent = String(s.score);
  $('#over-eggs').textContent = String(s.eggs);
  $('#over-time').textContent = s.time;
  $('#over-best').textContent = String(s.best);
  $('#over-newbest').hidden = !s.isNewBest;
  $('#over-seed').textContent = s.seed;
}
