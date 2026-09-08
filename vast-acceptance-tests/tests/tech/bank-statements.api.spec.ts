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
  reference: '2026090500000001-1',
  amount: '5.07',
  direction: 'CRDT' as const,
  bookingDate: '2026-09-05',
  counterpartyName: 'Grace Hopper',
  counterpartyIban: 'LT121000011101001000',
  remittance: 'Bricklink order.32100002',
  proprietaryCode: 'INB',
};

const postageEntry = {
  reference: '2026090200000002-1',
  amount: '16.01',
  direction: 'DBIT' as const,
  bookingDate: '2026-09-02',
  counterpartyName: 'TEST POST OFFICE VAS',
  counterpartyIban: 'LV80TEST0000000000002',
  remittance: 'Rekins EXP2000001',
  proprietaryCode: 'IZP',
};

async function pageOf(request: APIRequestContext, period = month) {
  const response = await request.get(`/api/private/bank-statements/entries?period=${period}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as { entries: any[]; summary: any[] };
}

async function entriesOf(request: APIRequestContext, period = month) {
  return (await pageOf(request, period)).entries;
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
    counterpartyName: 'TEST POST OFFICE VAS',
    counterpartyIban: 'LV80TEST0000000000002',
    remittanceInformation: 'Rekins EXP2000001',
    mapping: null,
  });
  expect(entries[1]).toMatchObject({
    entryReference: paymentEntry.reference,
    direction: 'CREDIT',
    amount: 5.07,
    remittanceInformation: 'Bricklink order.32100002',
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

  await importDocument(request, camt052({ entries: [{ ...postageEntry, remittance: 'Rekins EXP2000001' }] }));

  const entries = await entriesOf(request);
  expect(entries).toHaveLength(1);
  expect(entries[0].remittanceInformation).toBe('Rekins EXP2000001');
});

test('a mapping written against an entry survives a re-import', async ({ request }) => {
  await importDocument(request, camt052({ entries: [paymentEntry] }));
  const [entry] = await entriesOf(request);

  const saved = await request.put(`/api/private/bank-statements/entries/${entry.id}/mapping`, {
    data: { mapping: '32100002' },
  });
  expect(saved.status(), await saved.text()).toBe(200);
  await expect(saved.json()).resolves.toMatchObject({ id: entry.id, mapping: '32100002' });

  await importDocument(request, camt052({ entries: [paymentEntry, postageEntry] }));

  const entries = await entriesOf(request);
  const remapped = entries.find((candidate) => candidate.id === entry.id);
  expect(remapped.mapping).toBe('32100002');
});

test('an emptied mapping is erased rather than stored blank', async ({ request }) => {
  await importDocument(request, camt052({ entries: [paymentEntry] }));
  const [entry] = await entriesOf(request);

  await request.put(`/api/private/bank-statements/entries/${entry.id}/mapping`, { data: { mapping: '32100002' } });
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

test('a year lists every month of it at once', async ({ request }) => {
  await importDocument(request, camt052({ entries: [postageEntry, { ...paymentEntry, bookingDate: '2026-03-11' }] }));

  // The March payment falls outside September, so a month view is the proof the year view is not just this month.
  expect(await entriesOf(request, '2026-09')).toHaveLength(1);
  expect(await entriesOf(request, '2026')).toHaveLength(2);
  expect(await entriesOf(request, '2025')).toHaveLength(0);
});

/**
 * The summary is what the screen states under the entries, so it is asserted against the same figures the entries
 * were imported with. The closing balance deliberately reaches back past the period: it is everything the account
 * has moved up to the end of it, not what it moved during it.
 */
test('a period is summarised per currency', async ({ request }) => {
  await importDocument(
    request,
    camt052({
      entries: [
        postageEntry,
        paymentEntry,
        { ...paymentEntry, reference: 'earlier-credit', amount: '4319.70', bookingDate: '2026-08-14' },
      ],
    }),
  );

  const september = await pageOf(request, '2026-09');
  expect(september.summary).toEqual([
    { currency: 'EUR', debitTurnover: 16.01, creditTurnover: 5.07, netMovement: -10.94, closingBalance: 4308.76 },
  ]);

  // The year holds all three entries, so its turnovers are the whole of them and the balance is the same figure.
  const year = await pageOf(request, '2026');
  expect(year.summary).toEqual([
    { currency: 'EUR', debitTurnover: 16.01, creditTurnover: 4324.77, netMovement: 4308.76, closingBalance: 4308.76 },
  ]);
});

test('a period nothing moved in is summarised as nothing rather than as zero', async ({ request }) => {
  await importDocument(request, camt052({ entries: [paymentEntry] }));

  const page = await pageOf(request, '2026-08');
  expect(page.entries).toHaveLength(0);
  expect(page.summary).toEqual([]);
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

/**
 * The summary's balance is the one query in the feature written as JPQL rather than derived from a method name, and
 * it aggregates rather than loading entities, so this is what proves `@TenantId` reaches it too: a balance summed
 * over both tenants' rows would be the leak no other assertion here would notice.
 */
test("a tenant's summary is summed over its own entries alone", async ({ request, otherTenant }) => {
  await importDocument(request, camt052({ entries: [paymentEntry] }));
  await importDocument(otherTenant.request, camt052({ entries: [postageEntry] }));

  expect((await pageOf(request)).summary).toEqual([
    { currency: 'EUR', debitTurnover: 0, creditTurnover: 5.07, netMovement: 5.07, closingBalance: 5.07 },
  ]);
  expect((await pageOf(otherTenant.request)).summary).toEqual([
    { currency: 'EUR', debitTurnover: 16.01, creditTurnover: 0, netMovement: -16.01, closingBalance: -16.01 },
  ]);
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

test('a period that is neither a month nor a year is refused', async ({ request }) => {
  for (const period of ['September', '2026-13', '20261', '']) {
    const response = await request.get(`/api/private/bank-statements/entries?period=${period}`);
    expect(response.status(), `period=${period}`).toBe(400);
  }
});
