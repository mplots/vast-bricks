import { expect, test } from './support/api-test';

const ipAddressPattern =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.|$)){4}$|^(?:[a-fA-F0-9]{1,4}:){2,}[a-fA-F0-9:]{1,}$/;

test('tor circuit endpoint returns a changed IP address', async ({ request }) => {
  const response = await request.post('/api/private/tor/circuit');
  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();

  expect(body.previousIpAddress).toMatch(ipAddressPattern);
  expect(body.currentIpAddress).toMatch(ipAddressPattern);
  expect(body.changed).toBe(true);
  expect(body.currentIpAddress).not.toBe(body.previousIpAddress);
  expect(body.elapsedMillis).toBeGreaterThanOrEqual(0);
  expect(body.attempts).toBeGreaterThanOrEqual(1);
});
