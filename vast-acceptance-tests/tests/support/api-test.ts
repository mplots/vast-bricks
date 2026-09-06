import { APIRequestContext, expect, test as base, TestInfo } from '@playwright/test';

import {
  deleteVastTenant,
  deleteVastUser,
  upsertSecretSettingOverride,
  upsertSettingOverride,
  vastTestPassword,
  VastTenant,
  VastUser,
} from './vast-db';

export type SettingsOverrides = {
  /** The tenant these overrides belong to. */
  readonly tenantId: number;
  set(settingKey: string, settingValue: string): Promise<void>;
  setSecret(settingKey: string, settingValue: string): Promise<void>;
};

export type Authentication = {
  readonly user: VastUser;
  readonly tenant: VastTenant;
  readonly serviceToken: string;
};

/** A login on a tenant of its own, for asserting that one tenant cannot see another's data. */
export type OtherTenant = {
  readonly tenant: VastTenant;
  readonly request: APIRequestContext;
  set(settingKey: string, settingValue: string): Promise<void>;
};

function tenantCodeFor(testInfo: TestInfo, suffix = ''): string {
  return [
    'playwright',
    testInfo.project.name,
    testInfo.parallelIndex,
    testInfo.workerIndex,
    testInfo.repeatEachIndex,
    testInfo.retry,
    Date.now(),
    Math.random().toString(36).slice(2, 8),
    suffix,
    testInfo.titlePath.join('-'),
  ]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .slice(0, 100);
}

type PlaywrightFixture = { request: { newContext(options: { baseURL?: string; extraHTTPHeaders?: Record<string, string> }): Promise<APIRequestContext> } };

type Registration = { tenant: VastTenant; user: VastUser; serviceToken: string };

/**
 * Registers this scenario's own tenant and a user who may serve it. The tenant is what isolates the scenario, so
 * every test gets one of its own and none of them can see another's rows - which is what lets them run in parallel.
 */
async function register(
  playwright: PlaywrightFixture,
  baseURL: string | undefined,
  testInfo: TestInfo,
  suffix = '',
): Promise<Registration> {
  const anonymous = await playwright.request.newContext({ baseURL });
  try {
    const response = await anonymous.post('/api/test/tenants', {
      data: {
        tenantCode: tenantCodeFor(testInfo, suffix),
        email: `playwright-${suffix}-${testInfo.workerIndex}-${testInfo.parallelIndex}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`,
        password: vastTestPassword,
        name: 'Playwright User',
        role: 'user',
      },
    });
    if (!response.ok()) {
      throw new Error(`Tenant registration failed with HTTP ${response.status()}: ${await response.text()}`);
    }
    return (await response.json()) as Registration;
  } finally {
    await anonymous.dispose();
  }
}

export const test = base.extend<{
  authentication: Authentication;
  settings: SettingsOverrides;
  otherTenant: OtherTenant;
  anonymousRequest: APIRequestContext;
}>({
  authentication: async ({ baseURL, playwright }, use, testInfo) => {
    const { tenant, user, serviceToken } = await register(playwright, baseURL, testInfo);

    try {
      await use({ user, tenant, serviceToken });
    } finally {
      // Deleting the tenant cascades to everything it wrote, whatever tables those turn out to be.
      await deleteVastUser(user.id);
      await deleteVastTenant(tenant.id);
    }
  },

  settings: async ({ authentication }, use) => {
    const tenantId = authentication.tenant.id;

    await use({
      tenantId,
      set: async (settingKey, settingValue) => {
        await upsertSettingOverride(tenantId, settingKey, settingValue);
      },
      setSecret: async (settingKey, settingValue) => {
        await upsertSecretSettingOverride(tenantId, settingKey, settingValue);
      },
    });
  },

  request: async ({ authentication, baseURL, playwright }, use) => {
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

  otherTenant: async ({ baseURL, playwright }, use, testInfo) => {
    const { tenant, user, serviceToken } = await register(playwright, baseURL, testInfo, 'other');

    const request = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        Accept: 'application/json',
        Authorization: `Bearer ${serviceToken}`,
      },
    });

    try {
      await use({
        tenant,
        request,
        set: async (settingKey, settingValue) => {
          await upsertSettingOverride(tenant.id, settingKey, settingValue);
        },
      });
    } finally {
      await request.dispose();
      await deleteVastUser(user.id);
      await deleteVastTenant(tenant.id);
    }
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
