import { expect, test } from './support/api-test';

test('settings profile uses database only after environment and annotation defaults are missing', async ({
  request,
  settings,
}) => {
  const defaultResponse = await request.get('/api/private/settings/health');
  expect(defaultResponse.ok()).toBe(true);

  await expect(defaultResponse.json()).resolves.toEqual({
    value: 'default-health-value',
    environmentValue: 'managed-health-env-value',
    databaseOnlyValue: '',
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
    value: 'default-health-value',
    environmentValue: 'managed-health-env-value',
    databaseOnlyValue: 'profile-database-only-value',
  });
});

test('default settings profile is used only after environment and annotation defaults are missing', async ({
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
    value: 'default-health-value',
    environmentValue: 'managed-health-env-value',
    databaseOnlyValue: 'default-profile-database-only-value',
  });
});
