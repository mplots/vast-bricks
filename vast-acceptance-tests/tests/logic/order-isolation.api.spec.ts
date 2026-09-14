import { expect, test } from '../support/api-test';

/**
 * The isolation the {@code orders} table relies on, asserted the way every tenant-owned table's is.
 *
 * <p>Nothing in the order feature names a tenant, so what is being shown is that Hibernate puts it in the SQL from
 * the entity's {@code @TenantId} - including when the caller already holds the row's primary key, which is the path
 * a derived query would not cover on its own.
 */

async function createOrder(request: { post: Function }, orderId: string, source = 'BRICKLINK') {
  const response = await request.post(`/api/test/orders?source=${source}&orderId=${orderId}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as { id: number; tenantId: number };
}

test('a tenant cannot read another tenant\'s order by its primary key', async ({ request, otherTenant }) => {
  const { id } = await createOrder(request, '77700001');

  const mine = await (await request.get(`/api/test/orders/${id}`)).json();
  expect(mine.found).toBe(true);
  expect(mine.orderId).toBe('77700001');

  const theirs = await (await otherTenant.request.get(`/api/test/orders/${id}`)).json();
  expect(theirs.found).toBe(false);
});

test('a tenant cannot update another tenant\'s order by its primary key', async ({ request, otherTenant }) => {
  const { id } = await createOrder(request, '77700002');
  await request.put(`/api/test/orders/${id}?buyerName=brickfan_marta`);

  const attempt = await (await otherTenant.request.put(`/api/test/orders/${id}?buyerName=owlfan_juris`)).json();
  expect(attempt.updated).toBe(false);

  const mine = await (await request.get(`/api/test/orders/${id}`)).json();
  expect(mine.buyer).toBe('brickfan_marta');
});

test('an order is stamped with the writing tenant without being told', async ({ request, authentication }) => {
  const created = await createOrder(request, '77700003');

  expect(created.tenantId).toBe(authentication.tenant.id);
});

test('counting orders sees only the counting tenant\'s rows', async ({ request, otherTenant }) => {
  await createOrder(request, '77700004');
  await createOrder(request, '77700005');
  await createOrder(otherTenant.request, '77700004');

  const mine = await (await request.get('/api/test/orders/count')).json();
  const theirs = await (await otherTenant.request.get('/api/test/orders/count')).json();

  expect(mine.count).toBe(2);
  expect(theirs.count).toBe(1);
});

test('two tenants can hold the same marketplace order id', async ({ request, otherTenant }) => {
  // The unique constraint carries the tenant, so one store's order id never collides with another's - which is the
  // one thing @TenantId does not catch on its own.
  const mine = await createOrder(request, '77700006');
  const theirs = await createOrder(otherTenant.request, '77700006');

  expect(theirs.id).not.toBe(mine.id);
});
