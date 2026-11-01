import { track } from './analytics';
import { $ } from './dom';
import {
  androidIntentUrl,
  detectInstallEnv,
  shouldOfferInstall,
  type InstallEnv,
} from './installPolicy';
import { bumpRunCount, loadInstallDismissedAt, saveInstallDismissedAt } from './storage';

/** Chrome/Edge/Android's deferred install prompt (not yet in lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Where = 'title' | 'over';
type Outcome = 'accepted' | 'dismissed' | 'opened' | 'not_now';

export interface InstallUi {
  /** Call once per finished run, after the game-over screen is shown. */
  onRunFinished(): void;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const outcome = (kind: InstallEnv, where: Where, result: Outcome) =>
  track('install_prompt_outcome', { kind, where, outcome: result });

/**
 * Install surfaces: a fine-print link (or iOS hint) on the title screen, and from the second
 * finished run a card on the game-over screen that matches what this browser can do. Never shown
 * in the installed app.
 */
export function setupInstall(): InstallUi {
  if (isStandalone()) return { onRunFinished: () => undefined };

  const env = detectInstallEnv(navigator.userAgent, navigator.maxTouchPoints);
  const titleBtn = $<HTMLButtonElement>('#install-btn');
  const titleHint = $('#install-hint');
  const titleSep = $('#install-sep');
  const card = $('#install-card');
  const cardBtn = $<HTMLButtonElement>('#install-card-btn');
  const cardOpen = $<HTMLAnchorElement>('#install-card-open');
  const bodies = card.querySelectorAll<HTMLElement>('[data-install-kind]');
  let deferred: BeforeInstallPromptEvent | null = null;
  let shownKind: InstallEnv | null = null;

  const setTitle = (el: HTMLElement, visible: boolean) => {
    el.hidden = !visible;
    titleSep.hidden = titleBtn.hidden && titleHint.hidden;
  };
  const hideCard = () => {
    card.hidden = true;
  };
  /** What the card can offer right now: the native prompt only once the browser has handed it over. */
  const availableKind = (): InstallEnv | null =>
    env !== 'prompt' ? env : deferred ? 'prompt' : null;

  const showCard = (kind: InstallEnv) => {
    bodies.forEach((el) => (el.hidden = el.dataset.installKind !== kind));
    cardBtn.hidden = kind !== 'prompt';
    cardOpen.hidden = kind !== 'android_in_app';
    if (kind === 'android_in_app') cardOpen.href = androidIntentUrl(window.location.href);
    card.hidden = false;
    // One "shown" per page visit is enough to measure reach without an event per game over.
    if (shownKind !== kind) track('install_prompt_shown', { kind, where: 'over' });
    shownKind = kind;
  };

  const runPrompt = async (where: Where) => {
    if (!deferred) return;
    const prompt = deferred;
    deferred = null;
    setTitle(titleBtn, false);
    hideCard();
    await prompt.prompt();
    const { outcome: result } = await prompt.userChoice;
    outcome('prompt', where, result);
    if (result === 'dismissed') saveInstallDismissedAt(Date.now());
  };

  if (env === 'ios') setTitle(titleHint, true);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    setTitle(titleBtn, true);
  });
  window.addEventListener('appinstalled', () => {
    track('install');
    deferred = null;
    setTitle(titleBtn, false);
    hideCard();
  });
  titleBtn.addEventListener('click', () => void runPrompt('title'));
  cardBtn.addEventListener('click', () => void runPrompt('over'));
  cardOpen.addEventListener('click', () => outcome('android_in_app', 'over', 'opened'));
  $('#install-card-dismiss').addEventListener('click', () => {
    saveInstallDismissedAt(Date.now());
    hideCard();
    const kind = availableKind();
    if (kind) outcome(kind, 'over', 'not_now');
  });

  return {
    onRunFinished() {
      const runs = bumpRunCount();
      const kind = availableKind();
      const now = Date.now();
      if (kind && shouldOfferInstall({ runs, dismissedAt: loadInstallDismissedAt(), now }))
        showCard(kind);
      else hideCard();
    },
  };
}
