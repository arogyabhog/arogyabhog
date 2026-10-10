import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Serial by default: this sandbox has 2 vCPU / 1.9 GB RAM (ADR-019).
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['**/*.test.ts'],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
