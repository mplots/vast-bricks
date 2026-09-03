import { defineConfig } from '@playwright/test';

const baseURL = process.env.VAST_API_BASE_URL ?? 'http://127.0.0.1:6362';
const workers = process.env.ACCEPTANCE_PLAYWRIGHT_WORKERS
  ? Number.parseInt(process.env.ACCEPTANCE_PLAYWRIGHT_WORKERS, 10)
  : undefined;

export default defineConfig({
  timeout: 30_000,
  workers,
  fullyParallel: true,
  reporter: process.env.CI ? [['list'], ['junit', { outputFile: 'test-results/junit.xml' }]] : 'list',
  use: {
    baseURL,
    extraHTTPHeaders: {
      Accept: 'application/json'
    }
  },
  projects: [
    // Tech tests drive the real API endpoints and their providers end to end.
    {
      name: 'tech',
      testDir: './tests/tech',
      testMatch: /.*\.api\.spec\.ts/
    },
    // Logic tests address one component through the test-only /api/test endpoints
    // that vast-acceptance-tests adds on top of the vast-api launcher.
    {
      name: 'logic',
      testDir: './tests/logic',
      testMatch: /.*\.api\.spec\.ts/
    }
  ]
});
