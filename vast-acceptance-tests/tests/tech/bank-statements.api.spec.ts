import type { APIRequestContext } from '@playwright/test';

import { expect, test } from '../support/api-test';
import { camt052, camt053, importDocument, testAccountIban } from '../support/bank-statements';

/**
 * The bank is the one party to an order the backend cannot read live, so its entries are stored — and therefore
 * re-imported. What these scenarios are about is that re-importing is the normal way to use this: the same document
 * may be uploaded as often as it is exported, and the mapping a person wrote against an entry must still be there
 * afterwards.
 */

const month = '2026-09';

const paymentEntry = {
  reference: '2026090501987313-1',
  amount: '5.07',
  direction: 'CRDT' as const,
  bookingDate: '2026-09-05',
  counterpartyName: 'Gustavs Simansons',
  counterpartyIban: 'LT623250063970381125',
  remittance: 'Bricklink order.32505571',
  proprietaryCode: 'INB',
};

const postageEntry = {
  reference: '2026090201898337-1',
  amount: '16.01',
  direction: 'DBIT' as const,
  bookingDate: '2026-09-02',
  counterpartyName: 'LATVIJAS PASTS VAS',
  counterpartyIban: 'LV49PARX0000828130015',
  remittance: 'Rekins EXP2047790',
  proprietaryCode: 'IZP',
};

async function entriesOf(request: APIRequestContext, requestedMonth = month) {
  const response = await request.get(`/api/private/bank-statements/entries?month=${requestedMonth}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).entries as any[];
}

test('a camt.052 report imports its entries', async ({ request }) => {
  const response = await importDocument(request, camt052({ entries: [postageEntry, paymentEntry] }));
  expect(response.status(), await response.text()).toBe(200);

  await expect(response.json()).resolves.toMatchObject({
    entriesRead: 2,
    created: 2,
    updated: 0,
    accounts: [{ accountIban: testAccountIban, entriesRead: 2, created: 2, updated: 0 }],
  });

  const entries = await entriesOf(request);
  expect(entries).toHaveLength(2);
  // Booking date ascending, so the postage on the 2nd comes before the payment on the 5th.
  expect(entries[0]).toMatchObject({
    entryReference: postageEntry.reference,
    accountIban: testAccountIban,
    bookingDate: '2026-09-02',
    amount: 16.01,
    currency: 'EUR',
    direction: 'DEBIT',
    status: 'BOOK',
    proprietaryCode: 'IZP',
    domainCode: 'PMNT',
    counterpartyName: 'LATVIJAS PASTS VAS',
    counterpartyIban: 'LV49PARX0000828130015',
    remittanceInformation: 'Rekins EXP2047790',
    mapping: null,
  });
  expect(entries[1]).toMatchObject({
    entryReference: paymentEntry.reference,
    direction: 'CREDIT',
    amount: 5.07,
    remittanceInformation: 'Bricklink order.32505571',
  });
});

test('a camt.053 statement imports the same way', async ({ request }) => {
  const response = await importDocument(request, camt053({ entries: [paymentEntry] }));
  expect(response.status(), await response.text()).toBe(200);

  const entries = await entriesOf(request);
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({ entryReference: paymentEntry.reference, direction: 'CREDIT' });
});

test('re-importing an overlapping range updates rather than duplicates', async ({ request }) => {
  await importDocument(request, camt052({ entries: [postageEntry] }));

  // The next export covers the same day again and one more, which is what a statement pulled a few days later is.
  const again = await importDocument(request, camt052({ entries: [postageEntry, paymentEntry] }));
  expect(again.status(), await again.text()).toBe(200);
  await expect(again.json()).resolves.toMatchObject({ entriesRead: 2, created: 1, updated: 1 });

  const entries = await entriesOf(request);
  expect(entries).toHaveLength(2);
  expect(entries.map((entry) => entry.entryReference).sort()).toEqual(
    [postageEntry.reference, paymentEntry.reference].sort(),
  );
});

test('an import refreshes what the bank restated', async ({ request }) => {
  await importDocument(request, camt052({ entries: [{ ...postageEntry, remittance: 'Provisional' }] }));

  await importDocument(request, camt052({ entries: [{ ...postageEntry, remittance: 'Rekins EXP2047790' }] }));

  const entries = await entriesOf(request);
  expect(entries).toHaveLength(1);
  expect(entries[0].remittanceInformation).toBe('Rekins EXP2047790');
});

test('a mapping written against an entry survives a re-import', async ({ request }) => {
  await importDocument(request, camt052({ entries: [paymentEntry] }));
  const [entry] = await entriesOf(request);

  const saved = await request.put(`/api/private/bank-statements/entries/${entry.id}/mapping`, {
    data: { mapping: '32505571' },
  });
  expect(saved.status(), await saved.text()).toBe(200);
  await expect(saved.json()).resolves.toMatchObject({ id: entry.id, mapping: '32505571' });

  await importDocument(request, camt052({ entries: [paymentEntry, postageEntry] }));

  const entries = await entriesOf(request);
  const remapped = entries.find((candidate) => candidate.id === entry.id);
  expect(remapped.mapping).toBe('32505571');
});

test('an emptied mapping is erased rather than stored blank', async ({ request }) => {
  await importDocument(request, camt052({ entries: [paymentEntry] }));
  const [entry] = await entriesOf(request);

  await request.put(`/api/private/bank-statements/entries/${entry.id}/mapping`, { data: { mapping: '32505571' } });
  const erased = await request.put(`/api/private/bank-statements/entries/${entry.id}/mapping`, {
    data: { mapping: '   ' },
  });

  await expect(erased.json()).resolves.toMatchObject({ mapping: null });
});

test('an entry outside the requested month is not listed', async ({ request }) => {
  await importDocument(request, camt052({ entries: [paymentEntry] }));

  expect(await entriesOf(request, '2026-08')).toHaveLength(0);
  expect(await entriesOf(request, '2026-09')).toHaveLength(1);
});

test('an entry the bank gave no reference keeps its own identity across imports', async ({ request }) => {
  const unreferenced = { ...paymentEntry, reference: undefined };

  await importDocument(request, camt052({ entries: [unreferenced] }));
  const first = await entriesOf(request);
  expect(first).toHaveLength(1);

  await importDocument(request, camt052({ entries: [unreferenced] }));
  const second = await entriesOf(request);
  expect(second).toHaveLength(1);
  expect(second[0].id).toBe(first[0].id);
});

test('a document that is neither camt.052 nor camt.053 is refused', async ({ request }) => {
  const response = await importDocument(request, '<?xml version="1.0"?><ORDERS><ORDER/></ORDERS>');

  expect(response.status()).toBe(400);
  expect(await response.text()).toContain('camt');
});

/**
 * The isolation guardrail every tenant-owned table gets. Nothing in the feature names a tenant — Hibernate's
 * `@TenantId` puts it in the SQL — so this is what proves the filter is actually applied, including on the load by
 * primary key that the mapping update goes through.
 */
test('a tenant never sees or writes another tenant\'s entries', async ({ request, otherTenant, authentication }) => {
  await importDocument(request, camt052({ entries: [paymentEntry] }));
  await importDocument(otherTenant.request, camt052({ entries: [postageEntry] }));

  const mine = await entriesOf(request);
  const theirs = await entriesOf(otherTenant.request);

  expect(mine).toHaveLength(1);
  expect(mine[0].entryReference).toBe(paymentEntry.reference);
  expect(theirs).toHaveLength(1);
  expect(theirs[0].entryReference).toBe(postageEntry.reference);

  // By primary key, which is where a query-level tenant filter leaks and a repository method could forget the tenant.
  const attempt = await otherTenant.request.put(`/api/private/bank-statements/entries/${mine[0].id}/mapping`, {
    data: { mapping: 'theirs' },
  });
  expect(attempt.status()).toBe(404);

  const unchanged = await entriesOf(request);
  expect(unchanged[0].mapping).toBeNull();
  expect(authentication.tenant.id).toBeGreaterThan(0);
});

test('the same entry reference may belong to two tenants at once', async ({ request, otherTenant }) => {
  await importDocument(request, camt052({ entries: [paymentEntry] }));
  const theirs = await importDocument(otherTenant.request, camt052({ entries: [paymentEntry] }));

  // The unique index carries the tenant, so this is a first import for them rather than a collision with mine.
  expect(theirs.status(), await theirs.text()).toBe(200);
  await expect(theirs.json()).resolves.toMatchObject({ created: 1, updated: 0 });
});

test('an unauthenticated caller cannot import', async ({ anonymousRequest }) => {
  const response = await importDocument(anonymousRequest, camt052({ entries: [paymentEntry] }));

  expect(response.status()).toBe(401);
});

test('a month that is not YYYY-MM is refused', async ({ request }) => {
  const response = await request.get('/api/private/bank-statements/entries?month=September');

  expect(response.status()).toBe(400);
});
