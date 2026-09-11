import { expect, test } from '../support/api-test';
import { findSettingOverride } from '../support/vast-db';

/**
 * The tenant-facing settings screen's own endpoint: every `@VastSetting(databaseOverride = true)` field, listed and
 * writable in one place, regardless of which settings class declares it.
 */

type VastSettingView = {
  settingKey: string;
  group: string;
  label: string;
  secret: boolean;
  configured: boolean;
  value: string | null;
};

async function describeSettings(request: { get: (url: string) => Promise<{ ok(): boolean; json(): Promise<unknown> }> }) {
  const response = await request.get('/api/private/settings/vast');
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { settings: VastSettingView[] }).settings;
}

function byKey(settings: VastSettingView[], settingKey: string): VastSettingView {
  const found = settings.find((setting) => setting.settingKey === settingKey);
  if (!found) {
    throw new Error(`No setting listed for key ${settingKey}`);
  }
  return found;
}

test('every database-overridable health setting is listed, grouped by its settings class', async ({ request }) => {
  const settings = await describeSettings(request);

  const value = byKey(settings, 'VAST_HEALTH_SETTING_VALUE');
  expect(value).toMatchObject({ group: 'HealthSettings', label: 'Value', secret: false, configured: false });

  const secretValue = byKey(settings, 'VAST_HEALTH_SETTING_SECRET_VALUE');
  // A secret's value is never sent to the screen, whether or not one is configured.
  expect(secretValue).toMatchObject({ label: 'Secret Value', secret: true, configured: false, value: null });

  // Not configured by this tenant, so the value shown is the environment's, which is what is actually in effect.
  const environmentValue = byKey(settings, 'VAST_HEALTH_SETTING_ENV_VALUE');
  expect(environmentValue).toMatchObject({ label: 'Environment Value', configured: false, value: 'managed-health-env-value' });
});

test('saving a non-secret setting stores it in plain text and it is read back unchanged', async ({ request, settings }) => {
  const response = await request.put('/api/private/settings/vast', {
    data: { values: { VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE: 'via-vast-settings' } },
  });
  expect(response.ok(), await response.text()).toBe(true);

  const stored = await findSettingOverride(settings.tenantId, 'VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE');
  expect(stored).toBe('via-vast-settings');

  const listed = byKey(await describeSettings(request), 'VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE');
  expect(listed).toMatchObject({ configured: true, value: 'via-vast-settings' });
});

test('saving a secret setting encrypts it at rest and never lists it back, only that it is configured', async ({ request, settings }) => {
  const response = await request.put('/api/private/settings/vast', {
    data: { values: { VAST_HEALTH_SETTING_SECRET_VALUE: 'super-secret' } },
  });
  expect(response.ok(), await response.text()).toBe(true);

  const stored = await findSettingOverride(settings.tenantId, 'VAST_HEALTH_SETTING_SECRET_VALUE');
  expect(stored).toMatch(/^v1:[^:]+:[^:]+$/);
  expect(stored).not.toContain('super-secret');

  const listed = byKey(await describeSettings(request), 'VAST_HEALTH_SETTING_SECRET_VALUE');
  expect(listed).toMatchObject({ configured: true, value: null });

  // The other endpoint reads the same override, proving it decrypts to what was actually sent.
  await expect((await request.get('/api/private/settings/health')).json()).resolves.toMatchObject({ secretValue: 'super-secret' });
});

test('a blank value leaves the setting exactly as it was', async ({ request, settings }) => {
  await settings.set('VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE', 'keep-me');

  const response = await request.put('/api/private/settings/vast', {
    data: { values: { VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE: '' } },
  });
  expect(response.ok(), await response.text()).toBe(true);

  const listed = byKey(await describeSettings(request), 'VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE');
  expect(listed.value).toBe('keep-me');
});

test('a setting backed by an environment variable can still be overridden, and the override wins', async ({ request }) => {
  const response = await request.put('/api/private/settings/vast', {
    data: { values: { VAST_HEALTH_SETTING_ENV_VALUE: 'tenant-prefers-this' } },
  });
  expect(response.ok(), await response.text()).toBe(true);

  const listed = byKey(await describeSettings(request), 'VAST_HEALTH_SETTING_ENV_VALUE');
  expect(listed).toMatchObject({ configured: true, value: 'tenant-prefers-this' });
});

test('resetting a setting clears the override and falls back to the environment value', async ({ request }) => {
  expect((await request.put('/api/private/settings/vast', {
    data: { values: { VAST_HEALTH_SETTING_ENV_VALUE: 'tenant-prefers-this' } },
  })).ok()).toBe(true);

  const response = await request.delete('/api/private/settings/vast/VAST_HEALTH_SETTING_ENV_VALUE');
  expect(response.ok(), await response.text()).toBe(true);

  const listed = byKey(await describeSettings(request), 'VAST_HEALTH_SETTING_ENV_VALUE');
  expect(listed).toMatchObject({ configured: false, value: 'managed-health-env-value' });
});

test('resetting a setting nothing overrode yet is a harmless no-op, but resetting an unknown key is rejected', async ({ request }) => {
  const unconfigured = await request.delete('/api/private/settings/vast/VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE');
  expect(unconfigured.ok(), await unconfigured.text()).toBe(true);

  const unknown = await request.delete('/api/private/settings/vast/NOT_A_REAL_SETTING');
  expect(unknown.status()).toBe(400);
});

test('a key nothing declares is rejected rather than silently written', async ({ request }) => {
  const response = await request.put('/api/private/settings/vast', {
    data: { values: { NOT_A_REAL_SETTING: 'x' } },
  });
  expect(response.status()).toBe(400);
});

test('a non-String setting round-trips by its raw configured text, never by its converted type\'s own toString()', async ({ request }) => {
  // VAST_TOR_DEFAULT_RETRY_STATUSES is a Set<Integer>. Its own converter reads a comma-separated list like
  // "403,429", not the bracketed "[403, 429]" Set.toString() would produce - the screen must show and accept the
  // former, never the latter, or a save would immediately make the setting unreadable.
  const response = await request.put('/api/private/settings/vast', {
    data: { values: { VAST_TOR_DEFAULT_RETRY_STATUSES: '403,429' } },
  });
  expect(response.ok(), await response.text()).toBe(true);

  const updated = byKey(await describeSettings(request), 'VAST_TOR_DEFAULT_RETRY_STATUSES');
  expect(updated.value).toBe('403,429');
});

test("a tenant's overrides are invisible to another tenant", async ({ request, otherTenant }) => {
  const response = await request.put('/api/private/settings/vast', {
    data: { values: { VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE: 'mine' } },
  });
  expect(response.ok(), await response.text()).toBe(true);

  const theirs = byKey(await describeSettings(otherTenant.request), 'VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE');
  expect(theirs).toMatchObject({ configured: false, value: '' });
});
