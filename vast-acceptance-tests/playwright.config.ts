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
    // Feature tests cover one feature's own public surface: its CRUD and the assertions that say it works.
    {
      name: 'features',
      testDir: './tests/features',
      testMatch: /.*\.api\.spec\.ts/
    },
    // Tech tests cover the technical machinery underneath: authentication, Tor, transport and content negotiation.
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
