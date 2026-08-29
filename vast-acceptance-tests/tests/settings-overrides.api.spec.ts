import { expect, test } from './support/api-test';

test('settings profile can override health setting from the database', async ({ request, settings }) => {
  const defaultResponse = await request.get('/api/private/settings/health');
  expect(defaultResponse.ok()).toBe(true);

  await expect(defaultResponse.json()).resolves.toEqual({value: 'default-health-value'});

  const databaseValue = 'database-health-value';
  await settings.set('VAST_HEALTH_SETTING_VALUE', databaseValue);

  const overriddenResponse = await request.get('/api/private/settings/health');
  expect(overriddenResponse.ok()).toBe(true);

  await expect(overriddenResponse.json()).resolves.toEqual({value: databaseValue});
});
