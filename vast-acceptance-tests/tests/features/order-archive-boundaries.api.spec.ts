import { existsSync, readFileSync } from 'node:fs';

import { expect, test } from '../support/api-test';
import {
  archiveBaseDirectory,
  archivedBrickOwlFile,
  archivedFile,
  mockOrderArchive,
  runArchive,
  type ArchivedBrickOwlOrder,
  type ArchivedOrder,
} from '../support/order-archive';
import { brickLinkConfig, brickOwlConfig, createProviderAccount } from '../support/provider-accounts';
import { WireMockApi, wireMockMode } from '../support/wiremock';

/**
 * The two edges of what the archive is a copy of: which orders are the store's to keep, and what is left of an order
 * a marketplace no longer holds in full.
 *
 * <p>One marketplace login can hold orders that were never this tenant's, and two tenants sharing a login are told
 * apart by the operating period their provider accounts state and by nothing else. Copying another store's orders
 * into this one's directory is the same mistake as reconciling them, with a buyer's name and address to show for it.
 *
 * <p>The other edge is time. BrickLink serves an order's detail page for about six months and then serves its own
 * not-found instead. That is a fact about the order rather than a fault, and an archive that failed on it would stop
 * keeping the two files BrickLink does still answer with.
 */

test.describe.configure({ mode: wireMockMode() });

/** Sold by whoever held the login before this store did. */
const beforeTheStore: ArchivedOrder = {
  orderId: 32100021,
  dateOrdered: '2026-03-30T09:00:00.000Z',
  dateStatusChanged: '2026-04-03T09:00:00.000Z',
};

/** Sold by the store itself, the day the operating period opens. */
const theStores: ArchivedOrder = {
  orderId: 32100022,
  dateOrdered: '2026-04-02T09:00:00.000Z',
  dateStatusChanged: '2026-04-05T09:00:00.000Z',
};

/** The accounting exports the archive asked for, as the form BrickStore posts states them. */
async function exportRequests(wireMock: WireMockApi) {
  const exports = await wireMock.findMethodHostRequests('POST', '/orderExcelFinal.asp');
  return exports.map((exported) => new URLSearchParams(exported.body().toString('utf8')));
}

/** How many times BrickLink was asked for one order's detail page. */
async function detailPageRequests(wireMock: WireMockApi, order: ArchivedOrder) {
  const requests = await wireMock.findMethodHostRequests('GET', '/orderDetail.asp', {
    queryParameters: { ID: { equalTo: String(order.orderId) } },
  });
  return requests.length;
}

test('a BrickLink order placed before the store existed is left to the store it belongs to', async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  const base = archiveBaseDirectory();
  await createProviderAccount(request, {
    name: 'Shop BrickLink',
    config: brickLinkConfig({ operatingPeriod: { from: '2026-04-02', to: null } }),
  });
  await mockOrderArchive(wireMock, settings, { orders: [beforeTheStore, theStores], baseDirectory: base });

  const run = await runArchive(request);
  expect(run.outcome).toBe('succeeded');
  // One order archived, and the other no part of the run at all: it is another store's, not this one's to fail on.
  expect(run.tally).toEqual({ archived: 1, unchanged: 0, failed: 0 });

  const code = authentication.tenant.code;
  expect(existsSync(archivedFile(base, code, theStores, 'api', 'json'))).toBe(true);
  expect(existsSync(archivedFile(base, code, beforeTheStore, 'api', 'json'))).toBe(false);
  expect(existsSync(archivedFile(base, code, beforeTheStore, 'accounting', 'xml'))).toBe(false);
  expect(existsSync(archivedFile(base, code, beforeTheStore, 'detail', 'html'))).toBe(false);
  // Bounded out of the listing, so it costs nothing: the order outside the period is never asked about.
  expect(await detailPageRequests(wireMock, beforeTheStore)).toBe(0);
  expect(await detailPageRequests(wireMock, theStores)).toBe(1);
});

test('a BrickOwl order placed after the store stopped selling is left to whoever sold it', async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  const base = archiveBaseDirectory();
  const sold: ArchivedBrickOwlOrder = { orderId: '19200041', updatedTime: '2026-04-20T10:11:12' };
  const afterwards: ArchivedBrickOwlOrder = {
    orderId: '19200042',
    orderDate: '2026-05-02T10:11:12',
    updatedTime: '2026-05-03T10:11:12',
  };
  await createProviderAccount(request, {
    name: 'Shop BrickOwl',
    config: brickOwlConfig({ operatingPeriod: { from: null, to: '2026-04-30' } }),
  });
  await mockOrderArchive(wireMock, settings, {
    orders: [],
    brickOwlOrders: [sold, afterwards],
    brickOwlOrdersArchived: [sold],
    baseDirectory: base,
  });

  const run = await runArchive(request);
  expect(run.outcome).toBe('succeeded');
  expect(run.tally).toEqual({ archived: 1, unchanged: 0, failed: 0 });

  const code = authentication.tenant.code;
  expect(existsSync(archivedBrickOwlFile(base, code, sold))).toBe(true);
  expect(existsSync(archivedBrickOwlFile(base, code, afterwards))).toBe(false);
});

test('an order whose detail page BrickLink has purged is archived without it, and asked about once', async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  const base = archiveBaseDirectory();
  const purged: ArchivedOrder = {
    orderId: 32100023,
    dateOrdered: '2026-01-10T09:00:00.000Z',
    dateStatusChanged: '2026-01-12T09:00:00.000Z',
    detailPurged: true,
  };
  await mockOrderArchive(wireMock, settings, { orders: [purged], baseDirectory: base });

  const run = await runArchive(request);
  expect(run.outcome).toBe('succeeded');
  // What BrickLink still answers with is still archived: a page it has dropped is not a failure to archive the order.
  expect(run.tally).toEqual({ archived: 1, unchanged: 0, failed: 0 });

  const code = authentication.tenant.code;
  expect(existsSync(archivedFile(base, code, purged, 'api', 'json'))).toBe(true);
  expect(existsSync(archivedFile(base, code, purged, 'accounting', 'xml'))).toBe(true);
  expect(existsSync(archivedFile(base, code, purged, 'detail', 'html'))).toBe(false);
  // The archive keeps the one thing left to keep about the page, which is that there will never be one.
  // Its own kind, so what reads the archive does not take the note for the page it is about.
  expect(readFileSync(archivedFile(base, code, purged, 'purged', 'txt'), 'utf8')).toContain(String(purged.orderId));

  // And the order is complete, so the next night neither re-reads it nor asks BrickLink for the page again.
  expect((await runArchive(request)).tally).toEqual({ archived: 0, unchanged: 1, failed: 0 });
  expect(await detailPageRequests(wireMock, purged)).toBe(1);
});

test("the accounting export is asked for by the buyer's account, not their name", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  await mockOrderArchive(wireMock, settings, { orders: [theStores], baseDirectory: archiveBaseDirectory() });

  expect((await runArchive(request)).outcome).toBe('succeeded');

  // BrickLink states one or the other under a single BUYER element. The account is what the marketplace's own
  // record calls the buyer and what the live collection reads, so it is the one an archived copy must agree with;
  // asking for the name instead put a person where the import expects an account, and kept the buyer's real name
  // in a file that has no use for it.
  const asked = await exportRequests(wireMock);
  expect(asked).toHaveLength(1);
  expect(asked[0]!.get('useRealName')).toBe('n');
  expect(asked[0]!.get('orderID')).toBe(String(theStores.orderId));
});
