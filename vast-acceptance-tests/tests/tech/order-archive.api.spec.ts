import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { APIRequestContext } from '@playwright/test';

import { expect, test } from '../support/api-test';
import {
  accountingExportXml,
  archiveBaseDirectory,
  mockOrderArchive,
  vatInvoicePdf,
  type ArchivedOrder,
} from '../support/order-archive';
import { WireMockApi, wireMockMode } from '../support/wiremock';

/**
 * The BrickLink order archive, run as the jobs screen runs it.
 *
 * <p>What these are about is what the archive is for: the store keeps its own copy of what BrickLink held, one set
 * of files per state an order was in, and running the job again does not fetch what is already on disk.
 */

test.describe.configure({ mode: wireMockMode() });

const job = 'bricklink-order-archive';

const plainOrder: ArchivedOrder = { orderId: 32100011, dateStatusChanged: '2026-09-05T10:11:12.000Z' };
const vatOrder: ArchivedOrder = {
  orderId: 32100012,
  dateStatusChanged: '2026-09-06T08:09:10.000Z',
  vatCollectedByBrickLink: true,
};

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
  return join(base, tenantCode, `${kind}-${order.orderId}-${order.dateStatusChanged}.${extension}`);
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
  // No VAT collected by BrickLink means no invoice was issued, so none is asked for.
  expect(existsSync(archived(base, code, plainOrder, 'vat-invoice', 'pdf'))).toBe(false);
});

test('an order BrickLink collected the VAT on is archived with the invoice it issued', async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  const base = archiveBaseDirectory();
  await mockOrderArchive(wireMock, settings, { orders: [vatOrder], baseDirectory: base });

  expect((await runArchive(request)).tally).toEqual({ archived: 1, unchanged: 0, failed: 0 });

  const invoice = archived(base, authentication.tenant.code, vatOrder, 'vat-invoice', 'pdf');
  expect(existsSync(invoice), `${invoice} should have been written`).toBe(true);
  expect(readFileSync(invoice)).toEqual(vatInvoicePdf);
});

test('an order already on disk is left alone when the job runs again', async ({ request, settings }, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  const base = archiveBaseDirectory();
  await mockOrderArchive(wireMock, settings, { orders: [plainOrder, vatOrder], baseDirectory: base });

  expect((await runArchive(request)).tally).toEqual({ archived: 2, unchanged: 0, failed: 0 });
  expect((await runArchive(request)).tally).toEqual({ archived: 0, unchanged: 2, failed: 0 });
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
