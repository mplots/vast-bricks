import { expect, test as base } from '@playwright/test';

import { upsertSettingOverride } from './vast-db';

const settingsProfileHeader = 'X-Vast-Settings-Profile';

export type SettingsOverrides = {
  readonly profile: string;
  set(settingKey: string, settingValue: string): Promise<void>;
};

export const test = base.extend<{ settings: SettingsOverrides }>({
  settings: async ({}, use, testInfo) => {
    const profile = [
      'playwright',
      testInfo.project.name,
      testInfo.parallelIndex,
      testInfo.workerIndex,
      testInfo.repeatEachIndex,
      testInfo.retry,
      Date.now(),
      testInfo.titlePath.join('-'),
    ].join('-').replace(/[^A-Za-z0-9_-]/g, '-');

    await use({
      profile,
      set: async (settingKey, settingValue) => {
        await upsertSettingOverride(profile, settingKey, settingValue);
      },
    });
  },

  request: async ({ baseURL, playwright, settings }, use) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        Accept: 'application/json',
        [settingsProfileHeader]: settings.profile,
      },
    });

    await use(request);
    await request.dispose();
  },
});

export { expect };
