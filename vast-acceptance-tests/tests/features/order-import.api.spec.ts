import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "../support/api-test";
import { archiveBaseDirectory } from "../support/order-archive";
import {
  archiveDirectory,
  writeBrickLinkAccounting,
  writeBrickLinkArchive,
  writeBrickLinkDetail,
  writeBrickLinkOrder,
  writeBrickOwlOrder,
  type ImportedOrder,
} from "../support/order-import";

/**
 * The order import, run as the jobs screen runs it.
 *
 * <p>What these are about is what the import is for: the archive is a directory of files, one per state an order was
 * ever in, and the database is to hold each order once, as it last stood. So the job takes the latest file of each
 * order and upserts it, and a run that finds nothing newer than what it already holds writes nothing.
 */

const job = "order-import";

type Run = {
  outcome: string;
  tally: Record<string, number>;
  failure: string | null;
};

async function runImport(request: APIRequestContext): Promise<Run> {
  const started = await request.post(`/api/private/jobs/${job}/run`);
  expect(started.status(), await started.text()).toBe(202);

  await expect
    .poll(async () => (await statusOf(request)).lastRun?.outcome, {
      timeout: 30_000,
    })
    .not.toBe("running");
  return (await statusOf(request)).lastRun as Run;
}

async function statusOf(request: APIRequestContext) {
  const response = await request.get(`/api/private/jobs/${job}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as { lastRun: Run | null };
}

async function importedOrders(
  request: APIRequestContext,
): Promise<ImportedOrder[]> {
  const response = await request.get("/api/test/orders");
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as ImportedOrder[];
}

/** The scenario's own archive base, pointed at by the setting the import reads the directory from. */
async function archive(
  settings: { set: (key: string, value: string) => Promise<void> },
  tenantCode: string,
) {
  const base = archiveBaseDirectory();
  await settings.set("VAST_ORDER_ARCHIVE_DIR", base);
  return archiveDirectory(base, tenantCode);
}

test("the import job is registered, following the archive rather than a clock of its own", async ({
  request,
}) => {
  const response = await request.get("/api/private/jobs");
  expect(response.status(), await response.text()).toBe(200);
  const listed = (
    (await response.json()) as {
      jobs: { code: string; cron: string | null; after: string | null }[];
    }
  ).jobs;
  const registered = listed.find((job) => job.code === "order-import");

  // Its input is the archive job's output, so an hour of its own would be a second statement of when that input is
  // ready - and the two would drift the first night the archive ran long.
  expect(registered?.cron).toBeNull();
  expect(registered?.after).toBe("order-archive");
});

test("a BrickLink order is imported as BrickLink stated it", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  writeBrickLinkArchive(directory, {
    orderId: 32100101,
    archivedAt: "2026-03-04T15:16:17.000Z",
    dateOrdered: "2026-03-01T10:20:30.000Z",
    buyerName: "brickfan_marta",
    uniqueCount: 7,
    totalCount: 42,
    grandTotal: "31.40",
    currency: "EUR",
    refunded: "1.50",
    accounting: {
      orderDate: "3/1/2026",
      buyer: "brickfan_marta",
      lots: 7,
      items: 42,
      subTotal: "28.90",
      shipping: "2.50",
      vat: "3.20",
      grandTotal: "31.40",
      paymentType: "Credit/Debit (Powered by Stripe)",
      paymentCurrency: "EUR",
    },
  });

  const run = await runImport(request);
  expect(run.outcome).toBe("succeeded");
  expect(run.tally).toEqual({
    imported: 1,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });

  const orders = await importedOrders(request);
  expect(orders).toHaveLength(1);
  const order = orders[0]!;
  expect(order.source).toBe("BRICKLINK");
  expect(order.orderId).toBe("32100101");
  // The accounting export states a day and no time of day, and it is the export the import reads.
  expect(new Date(order.orderDate).toISOString()).toBe(
    "2026-03-01T00:00:00.000Z",
  );
  expect(order.lotCount).toBe(7);
  expect(order.itemCount).toBe(42);
  // Both names of the buyer, each off the file that actually states it: BrickLink names a buyer by their account
  // in the export, and states the person only on the address the order is shipped to.
  expect(order.buyer).toBe("Marta Ozola");
  expect(order.buyerUsername).toBe("brickfan_marta");
  // Unified across the marketplaces' wordings, so an order paid the same way reads the same on both screens.
  expect(order.paymentMethod).toBe("Stripe");
  expect(order.currency).toBe("EUR");
  expect(Number(order.subTotal)).toBe(28.9);
  expect(Number(order.shippingCost)).toBe(2.5);
  // The marketplace charged VAT on an order the store charged none on, which is what makes it facilitator-taxed
  // and what the facilitator tax is.
  expect(order.taxType).toBe("export-taxable");
  expect(Number(order.facilitatorTax)).toBe(3.2);
  expect(Number(order.grandTotal)).toBe(31.4);
  // Stated by neither of the other two files: the detail page is the only place BrickLink names a refund.
  expect(Number(order.refundedAmount)).toBe(1.5);
  // The link the screen hangs on the order id, so the order is one click from the row.
  expect(order.orderUrl).toContain("bricklink.com");
  expect(order.orderUrl).toContain(String(32100101));
  // The moment the imported files are the archive of, which is what a later run compares against.
  expect(new Date(order.archivedAt).toISOString()).toBe(
    "2026-03-04T15:16:17.000Z",
  );
});

test("a BrickOwl order is imported as BrickOwl stated it", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  writeBrickOwlOrder(directory, {
    orderId: "19200101",
    archivedAt: "2026-03-05T11:12:13",
    orderTime: "2026-03-02T07:08:09",
    buyerName: "Juris Berzins",
    customerUsername: "owlfan_juris",
    totalLots: 5,
    totalQuantity: 19,
    subTotal: "10.00",
    shipping: "2.34",
    refundTotal: "0.00",
    paymentMethodType: "paypal",
    baseOrderTotal: "12.34",
    baseCurrency: "EUR",
  });

  expect((await runImport(request)).tally).toEqual({
    imported: 1,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });

  const order = (await importedOrders(request))[0]!;
  expect(order.source).toBe("BRICKOWL");
  expect(order.orderId).toBe("19200101");
  expect(new Date(order.orderDate).toISOString()).toBe(
    "2026-03-02T07:08:09.000Z",
  );
  expect(order.lotCount).toBe(5);
  expect(order.itemCount).toBe(19);
  expect(order.buyer).toBe("Juris Berzins");
  expect(order.buyerUsername).toBe("owlfan_juris");
  expect(order.paymentMethod).toBe("PayPal");
  expect(order.currency).toBe("EUR");
  expect(Number(order.subTotal)).toBe(10);
  expect(Number(order.shippingCost)).toBe(2.34);
  expect(Number(order.grandTotal)).toBe(12.34);
  // BrickOwl writes 0.00 on an order nothing came back on, which is the marketplace reporting no refund rather
  // than a refund of nothing - exactly as the reconciliation report reads it.
  expect(order.refundedAmount).toBeNull();
  expect(order.orderUrl).toContain("brickowl.com");
});

test("both marketplaces are imported, and an order is told from another by its source", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  // The same order id on both marketplaces, which is the collision the source is in the key for.
  writeBrickLinkArchive(directory, {
    orderId: 55500001,
    archivedAt: "2026-03-06T10:00:00.000Z",
  });
  writeBrickOwlOrder(directory, {
    orderId: "55500001",
    archivedAt: "2026-03-06T10:00:00",
  });

  expect((await runImport(request)).tally).toEqual({
    imported: 2,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });

  const orders = await importedOrders(request);
  expect(orders.map((order) => order.source).sort()).toEqual([
    "BRICKLINK",
    "BRICKOWL",
  ]);
  expect(new Set(orders.map((order) => order.orderId))).toEqual(
    new Set(["55500001"]),
  );
});

test("an order archived several times over is stored once, as it last stood", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  // The same order in three states, all on disk at once, which is what a store's archive actually looks like.
  writeBrickLinkArchive(directory, {
    orderId: 32100102,
    archivedAt: "2026-03-01T08:00:00.000Z",
    accounting: { items: 10 },
  });
  writeBrickLinkArchive(directory, {
    orderId: 32100102,
    archivedAt: "2026-03-09T08:00:00.000Z",
    accounting: { items: 30 },
  });
  writeBrickLinkArchive(directory, {
    orderId: 32100102,
    archivedAt: "2026-03-05T08:00:00.000Z",
    accounting: { items: 20 },
  });

  expect((await runImport(request)).tally).toEqual({
    imported: 1,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });

  const orders = await importedOrders(request);
  expect(orders).toHaveLength(1);
  // The latest state by the moment it was archived, not the last file the directory happened to list.
  expect(orders[0]!.itemCount).toBe(30);
  expect(new Date(orders[0]!.archivedAt).toISOString()).toBe(
    "2026-03-09T08:00:00.000Z",
  );
});

test("a newer archived state updates the order already stored", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  writeBrickLinkArchive(directory, {
    orderId: 32100103,
    archivedAt: "2026-03-10T08:00:00.000Z",
    accounting: { items: 10, grandTotal: "10.00" },
  });

  expect((await runImport(request)).tally).toEqual({
    imported: 1,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });
  expect((await importedOrders(request))[0]!.itemCount).toBe(10);

  // The order changed and was archived again, the way the nightly archive run leaves it.
  writeBrickLinkArchive(directory, {
    orderId: 32100103,
    archivedAt: "2026-03-11T08:00:00.000Z",
    accounting: { items: 25, grandTotal: "24.50" },
  });

  expect((await runImport(request)).tally).toEqual({
    imported: 0,
    updated: 1,
    unchanged: 0,
    failed: 0,
  });

  const orders = await importedOrders(request);
  // Updated rather than inserted beside itself: an order is one row however many states of it are on disk.
  expect(orders).toHaveLength(1);
  expect(orders[0]!.itemCount).toBe(25);
  expect(Number(orders[0]!.grandTotal)).toBe(24.5);
  expect(new Date(orders[0]!.archivedAt).toISOString()).toBe(
    "2026-03-11T08:00:00.000Z",
  );
});

test("a run that finds nothing newer leaves the orders alone", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  writeBrickLinkArchive(directory, {
    orderId: 32100104,
    archivedAt: "2026-03-12T08:00:00.000Z",
  });
  writeBrickOwlOrder(directory, {
    orderId: "19200104",
    archivedAt: "2026-03-12T09:00:00",
  });

  expect((await runImport(request)).tally).toEqual({
    imported: 2,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });
  // The common nightly run, on a store whose orders have not changed: nothing is written at all.
  expect((await runImport(request)).tally).toEqual({
    imported: 0,
    updated: 0,
    unchanged: 2,
    failed: 0,
  });
});

test("a store that has never archived imports nothing, and that is not a failure", async ({
  request,
  settings,
}) => {
  // The setting points at a base directory that exists, but this store has no directory under it yet.
  await settings.set("VAST_ORDER_ARCHIVE_DIR", archiveBaseDirectory());

  const run = await runImport(request);
  expect(run.outcome).toBe("succeeded");
  expect(run.tally).toEqual({
    imported: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });
  expect(await importedOrders(request)).toHaveLength(0);
});

test("a file that is not a marketplace record of an order is not imported", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  writeBrickLinkArchive(directory, {
    orderId: 32100105,
    archivedAt: "2026-03-13T08:00:00.000Z",
  });
  // A file of a kind the import knows nothing about, which the archive may gain at any time: it is passed over
  // rather than counted as an order that could not be imported.
  const { writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  writeFileSync(
    join(directory, "bricklink-invoice-32100105-2026-03-13T08:00:00.000Z.pdf"),
    "not read",
  );

  expect((await runImport(request)).tally).toEqual({
    imported: 1,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });
  expect(await importedOrders(request)).toHaveLength(1);
});

test("the accounting export is preferred over BrickLink's own record of the order", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  // The two disagree about every field, which nothing real would - but it is the only way to say which was read.
  writeBrickLinkOrder(directory, {
    orderId: 32100106,
    archivedAt: "2026-03-14T08:00:00.000Z",
    dateOrdered: "2026-03-02T10:20:30.000Z",
    buyerName: "brickfan_marta",
    uniqueCount: 1,
    totalCount: 2,
    grandTotal: "3.00",
    currency: "USD",
  });
  writeBrickLinkAccounting(directory, {
    orderId: 32100106,
    archivedAt: "2026-03-14T08:00:00.000Z",
    orderDate: "3/1/2026",
    buyer: "brickfan_marta",
    lots: 7,
    items: 42,
    subTotal: "28.90",
    shipping: "2.50",
    grandTotal: "31.40",
    paymentCurrency: "EUR",
    paymentType: "PayPal (Onsite)",
  });

  expect((await runImport(request)).tally).toEqual({
    imported: 1,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });

  const order = (await importedOrders(request))[0]!;
  expect(new Date(order.orderDate).toISOString()).toBe(
    "2026-03-01T00:00:00.000Z",
  );
  expect(order.lotCount).toBe(7);
  expect(order.itemCount).toBe(42);
  expect(Number(order.subTotal)).toBe(28.9);
  expect(Number(order.shippingCost)).toBe(2.5);
  expect(Number(order.grandTotal)).toBe(31.4);
  expect(order.paymentMethod).toBe("PayPal");
  expect(order.currency).toBe("EUR");
  // The buyer is not a preference between the two files but a fact split across them: the export states the
  // account and only the API record states the person, so each is read from the file that has it.
  expect(order.buyerUsername).toBe("brickfan_marta");
  expect(order.buyer).toBe("Marta Ozola");
});

test("a field the accounting export leaves blank falls back to BrickLink's own record", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  writeBrickLinkOrder(directory, {
    orderId: 32100107,
    archivedAt: "2026-03-15T08:00:00.000Z",
    buyerName: "brickfan_marta",
    shippedTo: "Marta Ozola",
  });
  // An export stating no payment method and no buyer account, which is the case the API record answers for: it
  // states the same account under a name of its own.
  writeBrickLinkAccounting(directory, {
    orderId: 32100107,
    archivedAt: "2026-03-15T08:00:00.000Z",
    buyer: "",
    items: 42,
    paymentType: "",
  });

  expect((await runImport(request)).tally).toEqual({
    imported: 1,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });

  const order = (await importedOrders(request))[0]!;
  // The export named no account, so the API record's own is used instead - and the person it names is unaffected,
  // that half of the buyer never having come from the export at all.
  expect(order.buyerUsername).toBe("brickfan_marta");
  expect(order.buyer).toBe("Marta Ozola");
  // The API record's own payment method, the export having stated none.
  expect(order.paymentMethod).toBe("PayPal");
  // And the rest still comes from the export, a blank field being one field rather than the file.
  expect(order.itemCount).toBe(42);
});

test("an order archived without an accounting export is read from BrickLink's own record", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  // The export is BrickStore's to serve and it sometimes will not, so an order can be archived without one.
  writeBrickLinkOrder(directory, {
    orderId: 32100108,
    archivedAt: "2026-03-16T08:00:00.000Z",
    dateOrdered: "2026-03-02T10:20:30.000Z",
    buyerName: "brickfan_marta",
    uniqueCount: 3,
    totalCount: 9,
    grandTotal: "8.20",
  });

  expect((await runImport(request)).tally).toEqual({
    imported: 1,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });

  const order = (await importedOrders(request))[0]!;
  expect(new Date(order.orderDate).toISOString()).toBe(
    "2026-03-02T10:20:30.000Z",
  );
  expect(order.buyerUsername).toBe("brickfan_marta");
  expect(order.lotCount).toBe(3);
  expect(order.itemCount).toBe(9);
  expect(Number(order.grandTotal)).toBe(8.2);
  // Only the export states enough to type an order for tax or to say what the marketplace collected on it, so an
  // order archived without one carries neither rather than a guess from the fields that are left.
  expect(order.taxType).toBeNull();
  expect(order.facilitatorTax).toBeNull();
});

test("the export of an order's latest state is read, not an earlier state's", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  // The order was archived in full once, and again later without its export - what an order changing on a night
  // BrickStore would not answer leaves behind. The later state is the order, so it is read from what it has.
  writeBrickLinkArchive(directory, {
    orderId: 32100109,
    archivedAt: "2026-03-17T08:00:00.000Z",
    accounting: { items: 10 },
  });
  writeBrickLinkOrder(directory, {
    orderId: 32100109,
    archivedAt: "2026-03-18T08:00:00.000Z",
    totalCount: 25,
  });

  expect((await runImport(request)).tally).toEqual({
    imported: 1,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });

  const order = (await importedOrders(request))[0]!;
  // The newer state's own count, not the older export's, which would be the order as it used to be.
  expect(order.itemCount).toBe(25);
  expect(new Date(order.archivedAt).toISOString()).toBe(
    "2026-03-18T08:00:00.000Z",
  );
});

test("a refund is read from the order detail page, which is the only file that states one", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  writeBrickLinkArchive(directory, {
    orderId: 32100110,
    archivedAt: "2026-03-19T08:00:00.000Z",
  });
  // Archived beside the order with nothing on it, then again once part of it had been given back.
  expect((await runImport(request)).tally).toEqual({
    imported: 1,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });
  expect((await importedOrders(request))[0]!.refundedAmount).toBeNull();

  writeBrickLinkArchive(directory, {
    orderId: 32100110,
    archivedAt: "2026-03-20T08:00:00.000Z",
    refunded: "4.25",
  });

  expect((await runImport(request)).tally).toEqual({
    imported: 0,
    updated: 1,
    unchanged: 0,
    failed: 0,
  });
  expect(Number((await importedOrders(request))[0]!.refundedAmount)).toBe(4.25);
});

test("an order archived without a detail page states no refund rather than failing", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  // The detail page is BrickLink's to serve and it sometimes will not, which is one file missing rather than an
  // order that cannot be imported.
  writeBrickLinkOrder(directory, {
    orderId: 32100111,
    archivedAt: "2026-03-21T08:00:00.000Z",
  });
  writeBrickLinkAccounting(directory, {
    orderId: 32100111,
    archivedAt: "2026-03-21T08:00:00.000Z",
    items: 12,
  });

  expect((await runImport(request)).tally).toEqual({
    imported: 1,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });

  const order = (await importedOrders(request))[0]!;
  expect(order.refundedAmount).toBeNull();
  expect(order.itemCount).toBe(12);
});

test("a BrickOwl time stated with an offset is stored as the moment it names", async ({
  request,
  settings,
  authentication,
}) => {
  const directory = await archive(settings, authentication.tenant.code);
  // BrickOwl states its ISO times in London rather than UTC, so the offset is what says which moment the digits
  // before it are. An hour of it used to be thrown away, which put every summer order an hour out.
  writeBrickOwlOrder(directory, {
    orderId: "19200301",
    archivedAt: "2026-07-10T23:25:19",
    orderTime: "2026-07-10T23:25:19",
    offset: "+01:00",
  });

  expect((await runImport(request)).tally).toEqual({
    imported: 1,
    updated: 0,
    unchanged: 0,
    failed: 0,
  });

  const order = (await importedOrders(request))[0]!;
  // 23:25 in London is 22:25 in UTC, and the day it was placed on is the day either way.
  expect(new Date(order.orderDate).toISOString()).toBe("2026-07-10T22:25:19.000Z");
});
