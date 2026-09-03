import { expect, test } from '@playwright/test';

import { VastApiClient } from '@vastbricks/vast-api-client';

test('health endpoint reports the API is up', async ({ baseURL }) => {
  expect(baseURL).toBeTruthy();

  const client = new VastApiClient({
    baseUrl: baseURL!,
  });

  await expect(client.getHealth()).resolves.toEqual({ status: 'UP' });
});
