import { defineConfig } from '@playwright/test';

const baseURL = process.env.VAST_API_BASE_URL ?? 'http://127.0.0.1:6362';
const workers = process.env.ACCEPTANCE_PLAYWRIGHT_WORKERS
  ? Number.parseInt(process.env.ACCEPTANCE_PLAYWRIGHT_WORKERS, 10)
  : undefined;

export default defineConfig({
  testDir: './tests',
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
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/
    }
  ]
});
