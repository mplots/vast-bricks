import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { APIRequestContext } from '@playwright/test';

import { expect, test } from '../support/api-test';
import {
  accountingExportXml,
  archiveBaseDirectory,
  brickOwlOrder,
  mockOrderArchive,
  orderDetailHtml,
  vatInvoicePath,
  type ArchivedBrickOwlOrder,
  type ArchivedOrder,
} from '../support/order-archive';
import { WireMockApi, wireMockMode } from '../support/wiremock';

/**
 * The order archive, run as the jobs screen runs it.
 *
 * <p>What these are about is what the archive is for: the store keeps its own copy of what its marketplaces held,
 * one set of files per state an order was in, and running the job again does not fetch what is already on disk.
 */

test.describe.configure({ mode: wireMockMode() });

const job = 'order-archive';

const plainOrder: ArchivedOrder = { orderId: 32100011, dateStatusChanged: '2026-09-05T10:11:12.000Z' };
const vatOrder: ArchivedOrder = {
  orderId: 32100012,
  dateStatusChanged: '2026-09-06T08:09:10.000Z',
  vatCollectedByBrickLink: true,
};

const owlOrder: ArchivedBrickOwlOrder = { orderId: '19200031', updatedTime: '2026-09-07T11:12:13' };

type Run = { outcome: string; tally: Record<string, number>; failure: string | null };

async function runArchive(request: APIRequestContext): Promise<Run> {
  const started = await request.post(`/api/private/jobs/${job}/run`);
  expect(started.status(), await started.text()).toBe(202);

  await expect
    .poll(async () => (await statusOf(request)).lastRun?.outcome, { timeout: 30_000 })
    .not.toBe('running');
  return (await statusOf(request)).lastRun as Run;
}

async function statusOf(request: APIRequestContext) {
  const response = await request.get(`/api/private/jobs/${job}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as { lastRun: Run | null };
}

function archived(base: string, tenantCode: string, order: ArchivedOrder, kind: string, extension: string) {
  return join(base, tenantCode, `bricklink-${kind}-${order.orderId}-${order.dateStatusChanged}.${extension}`);
}

function archivedBrickOwl(base: string, tenantCode: string, order: ArchivedBrickOwlOrder) {
  return join(base, tenantCode, `brickowl-api-${order.orderId}-${order.updatedTime}.json`);
}

/** How many times BrickLink was asked for the order itself, as opposed to for the list it appears in. */
async function detailRequests(wireMock: WireMockApi, order: ArchivedOrder) {
  return (await wireMock.findMethodHostRequests('GET', `/api/store/v1/orders/${order.orderId}`)).length;
}

test('the archive job is registered, on the schedule it declares', async ({ request }) => {
  const response = await request.get('/api/private/jobs');
  expect(response.status(), await response.text()).toBe(200);
  const listed = ((await response.json()) as { jobs: { code: string; cron: string | null }[] }).jobs;

  expect(listed.find((registered) => registered.code === job)?.cron).toBe('0 0 3 * * *');
});

test('an order is archived as BrickLink stated it, under the tenant of the store it belongs to', async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  const base = archiveBaseDirectory();
  await mockOrderArchive(wireMock, settings, { orders: [plainOrder], baseDirectory: base });

  const run = await runArchive(request);
  expect(run.outcome).toBe('succeeded');
  expect(run.tally).toEqual({ archived: 1, unchanged: 0, failed: 0 });

  const code = authentication.tenant.code;
  const apiFile = archived(base, code, plainOrder, 'api', 'json');
  const accountingFile = archived(base, code, plainOrder, 'accounting', 'xml');

  expect(existsSync(apiFile), `${apiFile} should have been written`).toBe(true);
  // Exactly what BrickLink sent, not a model of it written back out.
  expect(JSON.parse(readFileSync(apiFile, 'utf8'))).toMatchObject({
    data: { order_id: plainOrder.orderId, date_status_changed: plainOrder.dateStatusChanged },
  });
  expect(readFileSync(accountingFile, 'utf8')).toBe(accountingExportXml(plainOrder.orderId));
  // The detail page is kept whole, as BrickLink served it, not as the refund this store reads out of it.
  expect(readFileSync(archived(base, code, plainOrder, 'detail', 'html'), 'utf8')).toBe(
    orderDetailHtml(plainOrder.orderId),
  );
  // An archived order is those three files and nothing else.
  expect(existsSync(archived(base, code, plainOrder, 'vat-invoice', 'pdf'))).toBe(false);
});

test('an order BrickLink collected the VAT on is archived without asking for the invoice it issued', async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  const base = archiveBaseDirectory();
  await mockOrderArchive(wireMock, settings, { orders: [vatOrder], baseDirectory: base });

  expect((await runArchive(request)).tally).toEqual({ archived: 1, unchanged: 0, failed: 0 });

  // The VAT invoice is BrickLink's to serve and it would not, so the archive stopped asking. What makes this worth
  // asserting is what an invoice it kept waiting for used to cost: an order was never complete, so every run read it
  // from the API again.
  expect(await wireMock.findMethodHostRequests('GET', vatInvoicePath)).toHaveLength(0);
  expect(existsSync(archived(base, authentication.tenant.code, vatOrder, 'vat-invoice', 'pdf'))).toBe(false);
  expect(existsSync(archived(base, authentication.tenant.code, vatOrder, 'api', 'json'))).toBe(true);
  expect(existsSync(archived(base, authentication.tenant.code, vatOrder, 'accounting', 'xml'))).toBe(true);
  expect(existsSync(archived(base, authentication.tenant.code, vatOrder, 'detail', 'html'))).toBe(true);
});

test('an archived order is not read from the API again, whoever collected its VAT', async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  await mockOrderArchive(wireMock, settings, {
    orders: [plainOrder, vatOrder],
    baseDirectory: archiveBaseDirectory(),
  });

  expect((await runArchive(request)).tally).toEqual({ archived: 2, unchanged: 0, failed: 0 });
  expect(await detailRequests(wireMock, plainOrder)).toBe(1);
  expect(await detailRequests(wireMock, vatOrder)).toBe(1);

  // The list states when each order last changed, so a second run answers from disk without asking for either order.
  expect((await runArchive(request)).tally).toEqual({ archived: 0, unchanged: 2, failed: 0 });
  expect(await detailRequests(wireMock, plainOrder)).toBe(1);
  expect(await detailRequests(wireMock, vatOrder)).toBe(1);
});

test('an order already on disk is left alone when the job runs again', async ({ request, settings }, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  const base = archiveBaseDirectory();
  await mockOrderArchive(wireMock, settings, {
    orders: [plainOrder, vatOrder],
    brickOwlOrders: [owlOrder],
    baseDirectory: base,
  });

  expect((await runArchive(request)).tally).toEqual({ archived: 3, unchanged: 0, failed: 0 });
  expect((await runArchive(request)).tally).toEqual({ archived: 0, unchanged: 3, failed: 0 });
});

test('an order that could not be archived is counted without failing the whole run', async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  const base = archiveBaseDirectory();
  await mockOrderArchive(wireMock, settings, { orders: [plainOrder, vatOrder], baseDirectory: base });
  // BrickLink will not state the second order, which is one order's problem rather than the run's.
  await wireMock.addMethodHostMapping('GET', `/api/store/v1/orders/${vatOrder.orderId}`, {
    priority: 1,
    response: { status: 500, body: 'unavailable' },
  });

  const run = await runArchive(request);
  expect(run.outcome).toBe('succeeded');
  expect(run.tally).toEqual({ archived: 1, unchanged: 0, failed: 1 });
  expect(existsSync(archived(base, authentication.tenant.code, plainOrder, 'api', 'json'))).toBe(true);
});

test('BrickLink refusing the request fails the run rather than reading as a store with no orders', async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  await mockOrderArchive(wireMock, settings, { orders: [plainOrder], baseDirectory: archiveBaseDirectory() });
  // BrickLink answers a refused request with HTTP 200 and the refusal in the envelope, so the status says nothing.
  await wireMock.addMethodHostMapping('GET', '/api/store/v1/orders', {
    priority: 1,
    response: {
      json: { meta: { code: 401, message: 'BAD_OAUTH_REQUEST', description: 'TOKEN_IP_MISMATCHED' } },
    },
  });

  const run = await runArchive(request);
  expect(run.outcome).toBe('failed');
  expect(run.failure).toContain('BAD_OAUTH_REQUEST');
  expect(run.failure).toContain('TOKEN_IP_MISMATCHED');
});

test('a BrickOwl order is archived as BrickOwl stated it', async ({ request, settings, authentication }, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  const base = archiveBaseDirectory();
  await mockOrderArchive(wireMock, settings, { orders: [], brickOwlOrders: [owlOrder], baseDirectory: base });

  const run = await runArchive(request);
  expect(run.outcome).toBe('succeeded');
  expect(run.tally).toEqual({ archived: 1, unchanged: 0, failed: 0 });

  const file = archivedBrickOwl(base, authentication.tenant.code, owlOrder);
  expect(existsSync(file), `${file} should have been written`).toBe(true);
  // Exactly what BrickOwl sent, not a model of it written back out.
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(brickOwlOrder(owlOrder));
});

test('a BrickOwl order the batch would not state is counted without failing the run', async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  const base = archiveBaseDirectory();
  const lost: ArchivedBrickOwlOrder = { orderId: '19200032', updatedTime: '2026-09-07T14:15:16', refused: true };
  await mockOrderArchive(wireMock, settings, { orders: [], brickOwlOrders: [owlOrder, lost], baseDirectory: base });

  const run = await runArchive(request);
  expect(run.outcome).toBe('succeeded');
  // One order BrickOwl has lost is not the batch it was asked for in.
  expect(run.tally).toEqual({ archived: 1, unchanged: 0, failed: 1 });
  expect(existsSync(archivedBrickOwl(base, authentication.tenant.code, owlOrder))).toBe(true);
  expect(existsSync(archivedBrickOwl(base, authentication.tenant.code, lost))).toBe(false);
});

test('BrickLink refusing the request does not stop the BrickOwl orders being archived', async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  const base = archiveBaseDirectory();
  await mockOrderArchive(wireMock, settings, {
    orders: [plainOrder],
    brickOwlOrders: [owlOrder],
    baseDirectory: base,
  });
  await wireMock.addMethodHostMapping('GET', '/api/store/v1/orders', {
    priority: 1,
    response: { json: { meta: { code: 401, message: 'BAD_OAUTH_REQUEST', description: 'TOKEN_IP_MISMATCHED' } } },
  });

  const run = await runArchive(request);
  // The run still fails, because a store that cannot be read must not read as a store with no orders.
  expect(run.outcome).toBe('failed');
  expect(run.failure).toContain('BAD_OAUTH_REQUEST');
  // BrickOwl is a different store's worth of orders, and a BrickLink token nobody has noticed expiring must not
  // quietly stop it being archived.
  expect(existsSync(archivedBrickOwl(base, authentication.tenant.code, owlOrder))).toBe(true);
});

test('an order missing only its detail page has that page fetched, and not the order again', async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  const base = archiveBaseDirectory();
  await mockOrderArchive(wireMock, settings, { orders: [plainOrder], baseDirectory: base });

  // An order archived before the detail page was part of an archive: its other two files are already on disk. This
  // is every order archived until now, so what it costs to catch them up is what this scenario is about.
  mkdirSync(join(base, authentication.tenant.code), { recursive: true });
  writeFileSync(archived(base, authentication.tenant.code, plainOrder, 'api', 'json'), '{"data":{}}');
  writeFileSync(
    archived(base, authentication.tenant.code, plainOrder, 'accounting', 'xml'),
    accountingExportXml(plainOrder.orderId),
  );

  expect((await runArchive(request)).tally).toEqual({ archived: 1, unchanged: 0, failed: 0 });

  const detailFile = archived(base, authentication.tenant.code, plainOrder, 'detail', 'html');
  expect(readFileSync(detailFile, 'utf8')).toBe(orderDetailHtml(plainOrder.orderId));
  // What was already archived is left as it was, and BrickLink is not asked for the order it already holds.
  expect(readFileSync(archived(base, authentication.tenant.code, plainOrder, 'api', 'json'), 'utf8')).toBe('{"data":{}}');
  expect(await detailRequests(wireMock, plainOrder)).toBe(0);
});
