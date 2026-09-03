import { expect, test } from '../support/api-test';

test('login creates a token that returns the authenticated Vast user profile', async ({
  authentication,
  request,
}) => {
  const response = await request.get('/api/private/account/me');

  expect(response.status(), await response.text()).toBe(200);
  await expect(response.json()).resolves.toEqual({
    user: authentication.user,
  });
});

test('private endpoints reject missing and invalid tokens', async ({ anonymousRequest }) => {
  const missingToken = await anonymousRequest.get('/api/private/account/me');
  expect(missingToken.status()).toBe(401);

  const invalidToken = await anonymousRequest.get('/api/private/account/me', {
    headers: {
      Authorization: 'Bearer invalid-token',
    },
  });
  expect(invalidToken.status()).toBe(401);
});
