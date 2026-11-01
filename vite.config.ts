import { execSync } from 'node:child_process';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const THEME = '#2f9fc4';

/** Build id reported with analytics events: the deployed commit on Vercel, else the local HEAD. */
function appVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) return sha.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  base: '/',
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  // The privacy page is its own entry so its stylesheet is a same-origin file the CSP allows.
  build: { rollupOptions: { input: { main: 'index.html', privacy: 'privacy.html' } } },
  plugins: [
    VitePWA({
      // 'prompt' keeps a downloaded update waiting until src/ui/updates.ts finds a moment that
      // can't interrupt a run. Registration lives in our own bundle, so no inline script.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Gator Gotcha',
        short_name: 'Gator Gotcha',
        description: 'Grab the eggs, dodge the gator, hide behind logs.',
        start_url: '/',
        scope: '/',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        theme_color: THEME,
        background_color: THEME,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        navigateFallback: '/index.html',
        // Share pages and the API are served by functions; the app shell must never stand in for them.
        navigateFallbackDenylist: [/^\/api\//, /^\/s\//, /^\/privacy/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: [
        'src/core/**',
        'src/sim/**',
        'src/ui/pendingRuns.ts',
        'src/ui/eventQueue.ts',
        'src/ui/bootSeed.ts',
        'src/ui/storage.ts',
        'src/ui/installPolicy.ts',
        'api/_lib/**',
      ],
      exclude: ['src/core/loop.ts', '**/*.test.ts', '**/__fixtures__/**', 'api/_lib/repository.ts'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
