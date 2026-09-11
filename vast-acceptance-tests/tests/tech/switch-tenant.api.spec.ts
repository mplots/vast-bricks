import { expect, test } from '../support/api-test';
import { deleteVastTenant } from '../support/vast-db';

/**
 * Moving an already-authenticated session to another of the account's tenants, without asking for the password
 * again - the credential already proved who they are, and which tenant it serves is a choice on top of that.
 */

async function addTenantMembership(request: { post: (url: string, options: { data: unknown }) => Promise<{ json(): Promise<unknown> }> },
  userId: number,
  tenantCode: string) {
  const response = await request.post(`/api/test/tenants/${userId}/memberships`, {
    data: { tenantCode, tenantName: tenantCode },
  });
  return (await response.json()) as { tenant: { id: number; code: string; name: string } };
}

/** Short and independent of the caller's own (already near the 100-char column limit) tenant code. */
function secondTenantCode(suffix: string): string {
  return `switch-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test('a second tenant on the same account is listed alongside the first', async ({ authentication, anonymousRequest, request }) => {
  const added = await addTenantMembership(anonymousRequest, authentication.user.id, secondTenantCode('listed'));

  try {
    const response = await request.get('/api/private/account/me');
    expect(response.status(), await response.text()).toBe(200);
    const body = (await response.json()) as { tenants: { id: number }[] };

    expect(body.tenants.map((tenant) => tenant.id).sort()).toEqual([authentication.tenant.id, added.tenant.id].sort());
  } finally {
    await deleteVastTenant(added.tenant.id);
  }
});

test('switching moves the session to the other tenant without a password', async ({ authentication, anonymousRequest, request }) => {
  const added = await addTenantMembership(anonymousRequest, authentication.user.id, secondTenantCode('moves'));

  try {
    const response = await request.post('/api/private/account/switch-tenant', {
      data: { tenantCode: added.tenant.code },
    });
    expect(response.status(), await response.text()).toBe(200);
    const body = (await response.json()) as { serviceToken: string; tenant: { id: number; code: string } };

    expect(body.tenant.id).toBe(added.tenant.id);
    expect(body.serviceToken).not.toBe(authentication.serviceToken);

    // The new token actually serves the tenant it claims to: a request made with it reads that tenant's own data,
    // not the tenant the original login token was scoped to.
    const switched = await anonymousRequest.get('/api/private/account/me', {
      headers: { Authorization: `Bearer ${body.serviceToken}` },
    });
    await expect(switched.json()).resolves.toMatchObject({ tenant: { id: added.tenant.id } });
  } finally {
    await deleteVastTenant(added.tenant.id);
  }
});

test('switching to a tenant the account does not belong to is refused', async ({ request, otherTenant }) => {
  const response = await request.post('/api/private/account/switch-tenant', {
    data: { tenantCode: otherTenant.tenant.code },
  });

  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toMatchObject({ detail: 'No tenant available for this account' });
});

test('switch-tenant requires an authenticated session', async ({ anonymousRequest }) => {
  const response = await anonymousRequest.post('/api/private/account/switch-tenant', {
    data: { tenantCode: 'anything' },
  });

  expect(response.status()).toBe(401);
});
