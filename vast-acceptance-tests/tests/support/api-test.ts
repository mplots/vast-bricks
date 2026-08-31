import { APIRequestContext, expect, test as base } from '@playwright/test';

import {
  createVastUser,
  deleteVastUser,
  upsertSecretSettingOverride,
  upsertSettingOverride,
  vastTestPassword,
  VastUser,
} from './vast-db';

const settingsProfileHeader = 'X-Vast-Settings-Profile';
const defaultSettingsProfile = process.env.VAST_SETTINGS_DEFAULT_PROFILE ?? 'vast-playwright-default';

export type SettingsOverrides = {
  readonly profile: string;
  set(settingKey: string, settingValue: string): Promise<void>;
  setSecret(settingKey: string, settingValue: string): Promise<void>;
  setDefault(settingKey: string, settingValue: string): Promise<void>;
};

export type Authentication = {
  readonly user: VastUser;
  readonly serviceToken: string;
};

export const test = base.extend<{
  authentication: Authentication;
  settings: SettingsOverrides;
  requestWithoutSettingsProfile: APIRequestContext;
  anonymousRequest: APIRequestContext;
}>({
  authentication: async ({ baseURL, playwright }, use, testInfo) => {
    const email = `playwright-${testInfo.workerIndex}-${testInfo.parallelIndex}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
    const user = await createVastUser(email);
    const loginRequest = await playwright.request.newContext({ baseURL });

    try {
      const loginResponse = await loginRequest.post('/api/account/login', {
        data: { email, password: vastTestPassword },
      });
      if (!loginResponse.ok()) {
        throw new Error(`Test-user login failed with HTTP ${loginResponse.status()}.`);
      }

      const body = await loginResponse.json() as { serviceToken?: string };
      if (!body.serviceToken) {
        throw new Error('Test-user login did not return a service token.');
      }

      await use({ user, serviceToken: body.serviceToken });
    } finally {
      await loginRequest.dispose();
      await deleteVastUser(user.id);
    }
  },

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
      setSecret: async (settingKey, settingValue) => {
        await upsertSecretSettingOverride(profile, settingKey, settingValue);
      },
      setDefault: async (settingKey, settingValue) => {
        await upsertSettingOverride(defaultSettingsProfile, settingKey, settingValue);
      },
    });
  },

  request: async ({ authentication, baseURL, playwright, settings }, use) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        Accept: 'application/json',
        Authorization: `Bearer ${authentication.serviceToken}`,
        [settingsProfileHeader]: settings.profile,
      },
    });

    await use(request);
    await request.dispose();
  },

  requestWithoutSettingsProfile: async ({ authentication, baseURL, playwright }, use) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        Accept: 'application/json',
        Authorization: `Bearer ${authentication.serviceToken}`,
      },
    });

    await use(request);
    await request.dispose();
  },

  anonymousRequest: async ({ baseURL, playwright }, use) => {
    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        Accept: 'application/json',
      },
    });

    await use(request);
    await request.dispose();
  },
});

export { expect };
