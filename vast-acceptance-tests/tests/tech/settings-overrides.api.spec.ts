import { expect, test } from '../support/api-test';
import { findSettingOverride } from '../support/vast-db';

test('settings profile overrides annotation defaults but not environment values', async ({
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

  const profileValues = [
    ['VAST_HEALTH_SETTING_VALUE', 'profile-health-value'],
    ['VAST_HEALTH_SETTING_ENV_VALUE', 'profile-env-value'],
    ['VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE', 'profile-database-only-value'],
  ] as const;

  for (const [settingKey, settingValue] of profileValues) {
    await settings.set(settingKey, settingValue);
  }

  const overriddenResponse = await request.get('/api/private/settings/health');
  expect(overriddenResponse.ok()).toBe(true);

  await expect(overriddenResponse.json()).resolves.toEqual({
    value: 'profile-health-value',
    environmentValue: 'managed-health-env-value',
    databaseOnlyValue: 'profile-database-only-value',
    secretValue: '',
  });
});

test('default settings profile overrides annotation defaults but not environment values', async ({
  requestWithoutSettingsProfile,
  settings,
}) => {
  const defaultValues = [
    ['VAST_HEALTH_SETTING_VALUE', 'default-profile-health-value'],
    ['VAST_HEALTH_SETTING_ENV_VALUE', 'default-profile-env-value'],
    ['VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE', 'default-profile-database-only-value'],
  ] as const;

  for (const [settingKey, settingValue] of defaultValues) {
    await settings.setDefault(settingKey, settingValue);
  }

  const response = await requestWithoutSettingsProfile.get('/api/private/settings/health');
  expect(response.ok()).toBe(true);

  await expect(response.json()).resolves.toEqual({
    value: 'default-profile-health-value',
    environmentValue: 'managed-health-env-value',
    databaseOnlyValue: 'default-profile-database-only-value',
    secretValue: '',
  });
});

test('secret settings profile overrides are encrypted at rest and decrypted when read', async ({
  request,
  settings,
}) => {
  await settings.setSecret('VAST_HEALTH_SETTING_SECRET_VALUE', 'profile-secret-value');

  const storedValue = await findSettingOverride(settings.profile, 'VAST_HEALTH_SETTING_SECRET_VALUE');
  expect(storedValue).not.toBeNull();
  expect(storedValue).toMatch(/^v1:[^:]+:[^:]+$/);
  expect(storedValue).not.toContain('profile-secret-value');

  const response = await request.get('/api/private/settings/health');
  expect(response.ok()).toBe(true);

  await expect(response.json()).resolves.toMatchObject({
    secretValue: 'profile-secret-value',
  });
});
