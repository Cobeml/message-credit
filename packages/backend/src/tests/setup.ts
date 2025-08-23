// Test setup file
import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  // Set test environment variables
  process.env.DATABASE_URL = 'file:./test.db';
  process.env.REDIS_URL = 'redis://localhost:6379/1';
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.CLAUDE_API_KEY = 'test-api-key';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
});

afterAll(async () => {
  // Cleanup if needed
});