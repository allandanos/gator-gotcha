import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const THEME = '#2f9fc4';

export default defineConfig({
  base: '/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // External registerSW.js keeps the CSP free of inline scripts.
      injectRegister: 'script',
      includeAssets: ['icons/apple-touch-icon.png', 'privacy.html'],
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
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
      include: ['src/core/**', 'src/sim/**', 'src/ui/pendingRuns.ts', 'api/_lib/**'],
      exclude: ['src/core/loop.ts', '**/*.test.ts', '**/__fixtures__/**', 'api/_lib/repository.ts'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
