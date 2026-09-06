import { expect, test } from '../support/api-test';

test('login creates a token that returns the authenticated Vast user profile', async ({
  authentication,
  request,
}) => {
  const response = await request.get('/api/private/account/me');

  expect(response.status(), await response.text()).toBe(200);
  await expect(response.json()).resolves.toEqual({
    user: authentication.user,
    tenant: {
      id: authentication.tenant.id,
      code: authentication.tenant.code,
      name: authentication.tenant.code,
    },
  });
});

test('login reports the tenant the token serves and the tenants the account may serve', async ({
  authentication,
  anonymousRequest,
}) => {
  const response = await anonymousRequest.post('/api/account/login', {
    data: { email: authentication.user.email, password: 'vast-playwright-password' },
  });

  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as {
    tenant: { id: number; code: string };
    tenants: { id: number; code: string }[];
  };

  expect(body.tenant.id).toBe(authentication.tenant.id);
  expect(body.tenants.map((tenant) => tenant.id)).toEqual([authentication.tenant.id]);
});

test('login refuses a tenant the account may not serve', async ({ authentication, otherTenant, anonymousRequest }) => {
  const response = await anonymousRequest.post('/api/account/login', {
    data: {
      email: authentication.user.email,
      password: 'vast-playwright-password',
      tenantCode: otherTenant.tenant.code,
    },
  });

  expect(response.status()).toBe(403);
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
