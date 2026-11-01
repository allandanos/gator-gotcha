import { androidIntentUrl, detectInstallEnv, shouldOfferInstall } from './installPolicy';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  iphoneFacebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.40.107;FBBV/123;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/5]',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101 (iPhone15,2; iOS 18_1; en_US; en; scale=3.00; 1179x2556; 123)',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  androidFacebook:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/490.0.0.40.107;]',
  androidMessenger:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/480.0.0.0;]',
  androidWebView:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
};

describe('detectInstallEnv', () => {
  it('treats iOS browsers as share-sheet installs', () => {
    expect(detectInstallEnv(UA.iphoneSafari, 5)).toBe('ios');
    expect(detectInstallEnv(UA.iphoneChrome, 5)).toBe('ios');
  });

  it('recognises an iPad that reports itself as a Mac', () => {
    expect(detectInstallEnv(UA.ipadDesktopMode, 5)).toBe('ios');
    expect(detectInstallEnv(UA.macSafari, 0)).toBe('prompt');
  });

  it('flags in-app browsers on iOS', () => {
    expect(detectInstallEnv(UA.iphoneFacebook, 5)).toBe('ios_in_app');
    expect(detectInstallEnv(UA.iphoneInstagram, 5)).toBe('ios_in_app');
  });

  it('flags in-app browsers and bare webviews on Android', () => {
    expect(detectInstallEnv(UA.androidFacebook, 5)).toBe('android_in_app');
    expect(detectInstallEnv(UA.androidMessenger, 5)).toBe('android_in_app');
    expect(detectInstallEnv(UA.androidWebView, 5)).toBe('android_in_app');
  });

  it('leaves real browsers to the native install prompt', () => {
    expect(detectInstallEnv(UA.androidChrome, 5)).toBe('prompt');
    expect(detectInstallEnv(UA.desktopChrome, 0)).toBe('prompt');
  });
});

describe('androidIntentUrl', () => {
  it('opens the same page in Chrome with a browser fallback', () => {
    const href = 'https://www.gatorgotcha.com/?seed=ab12&utm=x#y';
    expect(androidIntentUrl(href)).toBe(
      'intent://www.gatorgotcha.com/?seed=ab12&utm=x#Intent;scheme=https;package=com.android.chrome;' +
        `S.browser_fallback_url=${encodeURIComponent('https://www.gatorgotcha.com/?seed=ab12&utm=x')};end`,
    );
  });

  it('keeps the port for local hosts', () => {
    expect(androidIntentUrl('http://localhost:5173/')).toBe(
      'intent://localhost:5173/#Intent;scheme=http;package=com.android.chrome;' +
        `S.browser_fallback_url=${encodeURIComponent('http://localhost:5173/')};end`,
    );
  });
});

describe('shouldOfferInstall', () => {
  const NOW = Date.UTC(2026, 10, 1);
  const DAY = 24 * 60 * 60 * 1000;

  it('waits for the second finished run', () => {
    expect(shouldOfferInstall({ runs: 1, dismissedAt: null, now: NOW })).toBe(false);
    expect(shouldOfferInstall({ runs: 2, dismissedAt: null, now: NOW })).toBe(true);
  });

  it('stays quiet for a week after "Not now"', () => {
    expect(shouldOfferInstall({ runs: 9, dismissedAt: NOW - 6 * DAY, now: NOW })).toBe(false);
    expect(shouldOfferInstall({ runs: 9, dismissedAt: NOW - 7 * DAY, now: NOW })).toBe(true);
  });

  it('ignores a dismissal stamped in the future (clock change)', () => {
    expect(shouldOfferInstall({ runs: 9, dismissedAt: NOW + 30 * DAY, now: NOW })).toBe(true);
  });
});
