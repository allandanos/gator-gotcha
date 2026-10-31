import { registerSW } from 'virtual:pwa-register';

/** How often a long-running (installed, backgrounded) app asks the server for a newer build. */
const UPDATE_CHECK_MS = 30 * 60 * 1000;

export interface UpdatePolicy {
  /** Safe to reload right now, in front of the player (e.g. on the title screen). */
  canApplyNow(): boolean;
  /** Safe to reload while the app is in the background (no run in progress). */
  canApplyWhileHidden(): boolean;
}

/**
 * Keeps an installed copy current: checks for a new service worker periodically and whenever the
 * app comes back to the foreground, lets the browser download it, then reloads into it at the
 * first moment that can't interrupt a run. Players can also apply it from the "Update" button.
 */
export function setupUpdates(policy: UpdatePolicy): { maybeApply(): void } {
  const notes = document.querySelectorAll<HTMLElement>('[data-update-note]');
  let ready = false;
  let applying = false;

  const apply = () => {
    if (applying) return;
    applying = true;
    // A page opened before any service worker existed is never "taken over", so the plugin's
    // reload-on-controllerchange won't fire; the new build is already active, so just reload.
    if (!navigator.serviceWorker.controller) window.location.reload();
    else void updateSW(true);
  };
  const maybeApply = () => {
    if (!ready) return;
    if (policy.canApplyNow() || (document.hidden && policy.canApplyWhileHidden())) apply();
  };

  const updateSW = registerSW({
    onNeedRefresh() {
      ready = true;
      notes.forEach((el) => (el.hidden = false));
      maybeApply();
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (!navigator.onLine || reg.installing) return;
        reg.update().catch((err: unknown) => console.warn('Update check failed', err));
      };
      window.setInterval(check, UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
      window.addEventListener('online', check);
    },
    onRegisterError(err: unknown) {
      console.warn('Service worker registration failed', err);
    },
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) maybeApply();
  });
  document.querySelectorAll('[data-update-btn]').forEach((btn) => btn.addEventListener('click', apply));
  return { maybeApply };
}
