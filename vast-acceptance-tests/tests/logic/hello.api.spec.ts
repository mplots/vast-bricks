import { expect, test } from '@playwright/test';

test('test-only endpoint from the acceptance application is reachable', async ({ request }) => {
  const response = await request.get('/api/test/hello');

  expect(await response.json()).toEqual({ message: 'Hello World' });
});
