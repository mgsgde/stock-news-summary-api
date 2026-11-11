import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/*.integration.test.ts', 'node_modules/**', 'dist/**'],
    setupFiles: ['src/__tests__/setup.ts'],
    testTimeout: 15000,
  },
});
