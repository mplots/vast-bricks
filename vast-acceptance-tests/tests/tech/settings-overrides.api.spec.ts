import { expect, test } from '../support/api-test';
import { findSettingOverride } from '../support/vast-db';

test('tenant overrides take effect over both annotation defaults and environment values', async ({
  request,
  settings,
}) => {
  const defaultResponse = await request.get('/api/private/settings/health');
  expect(defaultResponse.ok()).toBe(true);

  await expect(defaultResponse.json()).resolves.toEqual({
    value: 'default-health-value',
    environmentValue: 'managed-health-env-value',
    databaseOnlyValue: '',
    secretValue: '',
  });

  const tenantValues = [
    ['VAST_HEALTH_SETTING_VALUE', 'tenant-health-value'],
    ['VAST_HEALTH_SETTING_ENV_VALUE', 'tenant-env-value'],
    ['VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE', 'tenant-database-only-value'],
  ] as const;

  for (const [settingKey, settingValue] of tenantValues) {
    await settings.set(settingKey, settingValue);
  }

  const overriddenResponse = await request.get('/api/private/settings/health');
  expect(overriddenResponse.ok()).toBe(true);

  // databaseOverride is what lets a tenant override an environment-managed default, not only the annotation's own
  // compile-time one - otherwise it would only ever win against a value nothing bothered to configure.
  await expect(overriddenResponse.json()).resolves.toEqual({
    value: 'tenant-health-value',
    environmentValue: 'tenant-env-value',
    databaseOnlyValue: 'tenant-database-only-value',
    secretValue: '',
  });
});

/**
 * The isolation guardrail. Nothing in the settings feature names a tenant - Hibernate's @TenantId puts it in the
 * SQL - so this is what proves the filter is actually applied rather than assumed.
 */
test('a tenant reads its own overrides and never another tenant\'s', async ({
  request,
  settings,
  otherTenant,
}) => {
  await settings.set('VAST_HEALTH_SETTING_VALUE', 'mine');
  await settings.set('VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE', 'mine-database-only');

  await otherTenant.set('VAST_HEALTH_SETTING_VALUE', 'theirs');
  await otherTenant.set('VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE', 'theirs-database-only');

  await expect((await request.get('/api/private/settings/health')).json()).resolves.toMatchObject({
    value: 'mine',
    databaseOnlyValue: 'mine-database-only',
  });

  await expect((await otherTenant.request.get('/api/private/settings/health')).json()).resolves.toMatchObject({
    value: 'theirs',
    databaseOnlyValue: 'theirs-database-only',
  });
});

test('a setting only the other tenant configured is unset here, not inherited', async ({
  request,
  otherTenant,
}) => {
  await otherTenant.set('VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE', 'theirs-only');

  await expect((await request.get('/api/private/settings/health')).json()).resolves.toMatchObject({
    databaseOnlyValue: '',
  });
});

test('secret overrides are encrypted at rest and decrypted when read', async ({
  request,
  settings,
}) => {
  await settings.setSecret('VAST_HEALTH_SETTING_SECRET_VALUE', 'tenant-secret-value');

  const storedValue = await findSettingOverride(settings.tenantId, 'VAST_HEALTH_SETTING_SECRET_VALUE');
  expect(storedValue).not.toBeNull();
  expect(storedValue).toMatch(/^v1:[^:]+:[^:]+$/);
  expect(storedValue).not.toContain('tenant-secret-value');

  const response = await request.get('/api/private/settings/health');
  expect(response.ok()).toBe(true);

  await expect(response.json()).resolves.toMatchObject({
    secretValue: 'tenant-secret-value',
  });
});
