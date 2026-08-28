import { expect, test } from '@playwright/test';

import { VastApiClient } from '@vastbricks/vast-api-client';

const ipAddressPattern =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.|$)){4}$|^(?:[a-fA-F0-9]{1,4}:){2,}[a-fA-F0-9:]{1,}$/;

test('tor circuit endpoint returns a changed IP address', async ({ baseURL }) => {
  expect(baseURL).toBeTruthy();

  const client = new VastApiClient({
    baseUrl: baseURL!,
  });

  const response = await client.requestNewTorCircuit();

  expect(response.previousIpAddress).toMatch(ipAddressPattern);
  expect(response.currentIpAddress).toMatch(ipAddressPattern);
  expect(response.changed).toBe(true);
  expect(response.currentIpAddress).not.toBe(response.previousIpAddress);
  expect(response.elapsedMillis).toBeGreaterThanOrEqual(0);
  expect(response.attempts).toBeGreaterThanOrEqual(1);
});
