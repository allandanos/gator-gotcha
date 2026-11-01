import { MODE_IDS, MODE_LABELS, type ModeId } from '../sim/rules';
import { $ } from './dom';
import { loadBest } from './storage';

/** The mode picker screen. Picking a ranked mode starts a run in it straight away. */
export class ModesUi {
  private readonly cards = [
    ...document.querySelectorAll<HTMLButtonElement>('#screen-modes [data-mode]'),
  ];

  constructor(onPick: (mode: ModeId) => void, onBack: () => void) {
    for (const card of this.cards) {
      const mode = MODE_IDS.find((m) => m === card.dataset.mode);
      if (mode) card.addEventListener('click', () => onPick(mode));
    }
    $('#modes-back-btn').addEventListener('click', onBack);
  }

  /** Refresh bests and put focus on the current mode's card. */
  prepare(current: ModeId): void {
    for (const card of this.cards) {
      const mode = MODE_IDS.find((m) => m === card.dataset.mode);
      if (!mode) continue;
      card.toggleAttribute('data-autofocus', mode === current);
      card.setAttribute('aria-current', String(mode === current));
      const best = card.querySelector('[data-mode-best]');
      if (best) best.textContent = loadBest(mode).toLocaleString();
    }
  }
}

/** Title-screen tag on the Play button: hidden for classic, the mode name otherwise. */
export function showPlayMode(mode: ModeId): void {
  const tag = $('#play-mode');
  tag.textContent = MODE_LABELS[mode];
  tag.hidden = mode === 'classic';
}
