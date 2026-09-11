import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // e2e/*.spec.ts belongs to playwright, which vitest cannot run.
    exclude: [...defaultExclude, 'e2e/**'],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      provider: 'v8',
    },
    snapshotFormat: {
      maxOutputLength: Number.MAX_SAFE_INTEGER,
    },
  },
});
