import { track } from './analytics';
import { $ } from './dom';

/** Chrome/Edge/Android's deferred install prompt (not yet in lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iOS has no install prompt event, so Safari users get a one-line "Add to Home Screen" hint instead. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|FBAN|FBAV|Instagram/.test(ua);
}

/** Shows an "Install app" button (or an iOS hint) on the title screen when the game isn't installed yet. */
export function setupInstall(): void {
  if (isStandalone()) return;
  const button = $<HTMLButtonElement>('#install-btn');
  const hint = $('#install-hint');
  const sep = $('#install-sep');
  let deferred: BeforeInstallPromptEvent | null = null;

  const show = (el: HTMLElement, visible: boolean) => {
    el.hidden = !visible;
    sep.hidden = button.hidden && hint.hidden;
  };

  if (isIosSafari()) show(hint, true);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    show(button, true);
  });
  window.addEventListener('appinstalled', () => {
    track('install');
    deferred = null;
    show(button, false);
  });
  button.addEventListener('click', async () => {
    if (!deferred) return;
    const prompt = deferred;
    deferred = null;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') show(button, false);
  });
}
