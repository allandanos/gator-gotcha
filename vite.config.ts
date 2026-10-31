import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/sim/**', 'api/_lib/**'],
      exclude: ['src/core/loop.ts', '**/*.test.ts', '**/__fixtures__/**', 'api/_lib/repository.ts'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
