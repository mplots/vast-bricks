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
    tenants: [
      {
        id: authentication.tenant.id,
        code: authentication.tenant.code,
        name: authentication.tenant.code,
      },
    ],
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

test('login refuses a tenant the account may not serve, with a message a login form can show', async ({
  authentication,
  otherTenant,
  anonymousRequest,
}) => {
  const response = await anonymousRequest.post('/api/account/login', {
    data: {
      email: authentication.user.email,
      password: 'vast-playwright-password',
      tenantCode: otherTenant.tenant.code,
    },
  });

  expect(response.status()).toBe(403);
  // Spring suppresses the plain-error-body "message" field by default, so the endpoint has to hand the reason back
  // as a ProblemDetail "detail" instead - otherwise a wrong tenant code and any other 403 look identical to a caller.
  await expect(response.json()).resolves.toMatchObject({ detail: 'No tenant available for this account' });
});

test('login with a wrong password reports invalid credentials, not a wrong tenant', async ({ authentication, anonymousRequest }) => {
  const response = await anonymousRequest.post('/api/account/login', {
    data: { email: authentication.user.email, password: 'not-the-password' },
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({ detail: 'Invalid email or password' });
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
