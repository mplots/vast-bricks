import { expect, test } from '../support/api-test';

/**
 * Proves the isolation every tenant-owned table relies on. Nothing in the settings feature names a tenant, so what
 * is being asserted is that Hibernate puts it in the SQL - including when the caller already holds the row's id.
 */

async function createRow(request: { post: Function }, key: string, value: string): Promise<number> {
  const response = await request.post(`/api/test/tenant-isolation?key=${key}&value=${value}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).id as number;
}

test('a tenant cannot read another tenant\'s row by its primary key', async ({ request, otherTenant }) => {
  const id = await createRow(request, 'VAST_HEALTH_SETTING_VALUE', 'mine');

  const mine = await (await request.get(`/api/test/tenant-isolation/${id}`)).json();
  expect(mine.found).toBe(true);
  expect(mine.value).toBe('mine');

  const theirs = await (await otherTenant.request.get(`/api/test/tenant-isolation/${id}`)).json();
  expect(theirs.found).toBe(false);
});

test('a tenant cannot update another tenant\'s row by its primary key', async ({ request, otherTenant }) => {
  const id = await createRow(request, 'VAST_HEALTH_SETTING_VALUE', 'mine');

  const attempt = await (await otherTenant.request.put(`/api/test/tenant-isolation/${id}?value=theirs`)).json();
  expect(attempt.updated).toBe(false);

  const mine = await (await request.get(`/api/test/tenant-isolation/${id}`)).json();
  expect(mine.value).toBe('mine');
});

test('a write is stamped with the writing tenant without being told', async ({ request, authentication }) => {
  const response = await request.post('/api/test/tenant-isolation?key=VAST_HEALTH_SETTING_VALUE&value=mine');
  const created = await response.json();

  expect(created.tenantId).toBe(authentication.tenant.id);
});

test('counting sees only the counting tenant\'s rows', async ({ request, otherTenant }) => {
  await createRow(request, 'VAST_HEALTH_SETTING_VALUE', 'mine');
  await createRow(request, 'VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE', 'mine-too');
  await createRow(otherTenant.request, 'VAST_HEALTH_SETTING_VALUE', 'theirs');

  const mine = await (await request.get('/api/test/tenant-isolation/count')).json();
  const theirs = await (await otherTenant.request.get('/api/test/tenant-isolation/count')).json();

  expect(mine.count).toBe(2);
  expect(theirs.count).toBe(1);
});
