import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { APIRequestContext } from '@playwright/test';

import { expect, test } from '../support/api-test';
import { archiveBaseDirectory } from '../support/order-archive';
import { archiveDirectory, writeBrickLinkArchive, writeBrickLinkVatInvoice } from '../support/order-import';

/**
 * Getting BrickLink's own VAT invoices into the store's archive.
 *
 * <p>BrickLink serves an invoice only to the signed-in store, so this application cannot fetch one: the browser
 * extension downloads it from the page and posts it back. These are the two halves of that exchange - which orders
 * are still missing one, and taking delivery of it - and what they are read against is the stored orders, because
 * the import has already typed every order it wrote.
 */

/** A moment as BrickLink states one, which is also what the archive names an order's files after. */
const archivedAt = '2026-03-04T15:16:17.000Z';

/** The smallest thing that is still a PDF as far as anything asking is concerned. */
const invoicePdf = Buffer.from('%PDF-1.4\nthe invoice BrickLink issued\n');

type Outstanding = { orders: { orderId: string; orderDate: string }[] };

/** The scenario's own archive base, pointed at by the setting both the import and the archive read. */
async function archive(settings: { set: (key: string, value: string) => Promise<void> }, tenantCode: string) {
  const base = archiveBaseDirectory();
  await settings.set('VAST_ORDER_ARCHIVE_DIR', base);
  return { base, directory: archiveDirectory(base, tenantCode) };
}

/** An order as BrickLink's accounting export states one it collected the VAT on itself: export-taxable. */
function exportTaxable(orderId: number) {
  return {
    orderId,
    archivedAt,
    shippedToCountry: 'US',
    // VAT the marketplace collected, with nothing charged under the store's own registration beside it, is what
    // makes an order export-taxable - and what BrickLink issues its own invoice for.
    accounting: { vat: '3.21', vatCharges: '0.00' },
  };
}

async function runImport(request: APIRequestContext) {
  const started = await request.post('/api/private/jobs/order-import/run');
  expect(started.status(), await started.text()).toBe(202);
  await expect
    .poll(async () => (await statusOf(request)).lastRun?.outcome, { timeout: 30_000 })
    .not.toBe('running');
  expect((await statusOf(request)).lastRun?.outcome).toBe('succeeded');
}

async function statusOf(request: APIRequestContext) {
  const response = await request.get('/api/private/jobs/order-import');
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as { lastRun: { outcome: string } | null };
}

async function outstanding(request: APIRequestContext): Promise<Outstanding['orders']> {
  const response = await request.get('/api/private/vat-invoices/outstanding');
  expect(response.status(), await response.text()).toBe(200);
  return ((await response.json()) as Outstanding).orders;
}

function post(request: APIRequestContext, orderId: number, pdf: Buffer) {
  return request.post(`/api/private/vat-invoices/${orderId}`, {
    headers: { 'Content-Type': 'application/pdf' },
    data: pdf,
  });
}

/** Where the archive files an order's invoice: beside its other files, under the same moment. */
function invoicePath(directory: string, orderId: number) {
  return join(directory, `bricklink-vat-invoice-${orderId}-${archivedAt}.pdf`);
}

test('an export-taxable order with no archived invoice is the one the store still owes', async ({
  request,
  settings,
  authentication,
}) => {
  const { directory } = await archive(settings, authentication.tenant.code);
  writeBrickLinkArchive(directory, exportTaxable(32100301));
  // Sold outside the EU with nothing collected by anybody: BrickLink issues no invoice, so none is missing.
  writeBrickLinkArchive(directory, {
    orderId: 32100302,
    archivedAt,
    shippedToCountry: 'US',
    accounting: { vat: '0.00', salesTax: '0.00', vatCharges: '0.00' },
  });
  // Sold at home under the store's own registration, which invoices it itself.
  writeBrickLinkArchive(directory, {
    orderId: 32100303,
    archivedAt,
    accounting: { vatCharges: '2.10' },
  });
  await runImport(request);

  expect((await outstanding(request)).map((order) => order.orderId)).toEqual(['32100301']);
});

test('an order whose invoice the archive already holds is not asked for again', async ({
  request,
  settings,
  authentication,
}) => {
  const { directory } = await archive(settings, authentication.tenant.code);
  writeBrickLinkArchive(directory, exportTaxable(32100311));
  writeBrickLinkArchive(directory, exportTaxable(32100312));
  writeBrickLinkVatInvoice(directory, 32100311, archivedAt);
  await runImport(request);

  expect((await outstanding(request)).map((order) => order.orderId)).toEqual(['32100312']);
});

test('a posted invoice is filed beside the order it belongs to, and settles what that order owed', async ({
  request,
  settings,
  authentication,
}) => {
  const { directory } = await archive(settings, authentication.tenant.code);
  writeBrickLinkArchive(directory, exportTaxable(32100321));
  await runImport(request);

  const response = await post(request, 32100321, invoicePdf);
  expect(response.status(), await response.text()).toBe(200);
  await expect(response.json()).resolves.toEqual({ orderId: '32100321', stored: true });

  // The document itself, byte for byte: what the archive keeps is the store's own copy of the invoice.
  expect(readFileSync(invoicePath(directory, 32100321))).toEqual(invoicePdf);
  expect(await outstanding(request)).toEqual([]);
});

test('posting the same invoice again keeps the one on disk rather than writing over it', async ({
  request,
  settings,
  authentication,
}) => {
  const { directory } = await archive(settings, authentication.tenant.code);
  writeBrickLinkArchive(directory, exportTaxable(32100331));
  await runImport(request);

  expect((await post(request, 32100331, invoicePdf)).status()).toBe(200);
  const again = await post(request, 32100331, Buffer.from('%PDF-1.4\nposted a second time\n'));

  expect(again.status(), await again.text()).toBe(200);
  await expect(again.json()).resolves.toEqual({ orderId: '32100331', stored: false });
  expect(readFileSync(invoicePath(directory, 32100331))).toEqual(invoicePdf);
});

test('an invoice for an order this store never imported has nowhere to be filed', async ({
  request,
  settings,
  authentication,
}) => {
  await archive(settings, authentication.tenant.code);

  const response = await post(request, 32100341, invoicePdf);

  expect(response.status()).toBe(404);
  await expect(response.json()).resolves.toMatchObject({
    detail: 'This store holds no BrickLink order 32100341.',
  });
});

test('what is not a PDF is refused rather than archived as an invoice', async ({
  request,
  settings,
  authentication,
}) => {
  const { directory } = await archive(settings, authentication.tenant.code);
  writeBrickLinkArchive(directory, exportTaxable(32100351));
  await runImport(request);

  // What BrickLink answers a request it does not take as signed-in: a page, with a 200 on it.
  const response = await post(request, 32100351, Buffer.from('<html><body>Please sign in</body></html>'));

  expect(response.status()).toBe(400);
  expect(existsSync(invoicePath(directory, 32100351))).toBe(false);
  // Still owed, which is what makes the refusal safe: the next run asks for it again.
  expect((await outstanding(request)).map((order) => order.orderId)).toEqual(['32100351']);
});

test('an API key is enough to collect invoices, since the extension has no login of its own', async ({
  request,
  settings,
  authentication,
  baseURL,
  playwright,
}) => {
  const { directory } = await archive(settings, authentication.tenant.code);
  writeBrickLinkArchive(directory, exportTaxable(32100361));
  await runImport(request);

  const generated = await request.post('/api/private/account/api-keys', { data: { name: 'bricklink-extension' } });
  expect(generated.status(), await generated.text()).toBe(200);
  const { token } = (await generated.json()) as { token: string };

  const machine = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Accept: 'application/json', 'X-Api-Key': token },
  });
  try {
    expect((await outstanding(machine)).map((order) => order.orderId)).toEqual(['32100361']);

    const stored = await post(machine, 32100361, invoicePdf);
    expect(stored.status(), await stored.text()).toBe(200);
    // Filed in the store the key names, which is the whole reason the extension needs one.
    expect(readFileSync(invoicePath(directory, 32100361))).toEqual(invoicePdf);
  } finally {
    await machine.dispose();
  }
});
