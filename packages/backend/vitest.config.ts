import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    env: {
      DATABASE_URL: 'file:./test.db',
      REDIS_URL: 'redis://localhost:6379/1',
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      CLAUDE_API_KEY: 'test-api-key',
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
