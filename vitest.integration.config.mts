import { defineConfig } from 'vitest/config';

// Integration tests call the real Yahoo and OpenAI APIs. They are not part of `npm test`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['dotenv/config', 'src/__tests__/setup.ts'],
    testTimeout: 180000,
  },
});
