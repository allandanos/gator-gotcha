/**
 * Pure install decisions: which install path this browser has, and when to offer it. No DOM here,
 * so it can be unit tested; src/ui/install.ts wires it to the page.
 */

/**
 * How this browser can install the game:
 * - `prompt`: the native install dialog, if the browser fires `beforeinstallprompt` (Chromium).
 * - `ios`: Share → Add to Home Screen (Safari, and Chrome/Edge/Firefox on iOS 16.4+).
 * - `ios_in_app` / `android_in_app`: an app's built-in browser (Facebook, Instagram, …), which
 *   can't install at all; the player has to open the page in a real browser first.
 */
export type InstallEnv = 'prompt' | 'ios' | 'ios_in_app' | 'android_in_app';

/** In-app browsers of the apps our links get shared into, plus bare Android webviews (`; wv)`). */
const IN_APP =
  /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|MicroMessenger|musical_ly|BytedanceWebview|Snapchat|; wv\)/;
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_RUNS = 2;

export function detectInstallEnv(ua: string, maxTouchPoints: number): InstallEnv {
  // iPadOS asks for desktop sites by default and reports itself as a Mac with a touch screen.
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && maxTouchPoints > 1);
  const inApp = IN_APP.test(ua);
  if (ios) return inApp ? 'ios_in_app' : 'ios';
  if (inApp && /Android/.test(ua)) return 'android_in_app';
  return 'prompt';
}

/** An Android intent link that reopens this page in Chrome, falling back to the plain URL. */
export function androidIntentUrl(href: string): string {
  const url = new URL(href);
  url.hash = '';
  const scheme = url.protocol.replace(':', '');
  const target = `${url.host}${url.pathname}${url.search}`;
  return (
    `intent://${target}#Intent;scheme=${scheme};package=com.android.chrome;` +
    `S.browser_fallback_url=${encodeURIComponent(url.href)};end`
  );
}

export interface OfferState {
  /** Runs this browser has finished, ever. */
  readonly runs: number;
  /** When the player last chose "Not now" (epoch ms), if ever. */
  readonly dismissedAt: number | null;
  readonly now: number;
}

/** Offer from the second finished run on, then stay quiet for a week after each "Not now". */
export function shouldOfferInstall({ runs, dismissedAt, now }: OfferState): boolean {
  if (runs < MIN_RUNS) return false;
  if (dismissedAt === null || dismissedAt > now) return true;
  return now - dismissedAt >= SNOOZE_MS;
}
