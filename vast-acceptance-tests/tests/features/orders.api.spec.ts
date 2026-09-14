import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "../support/api-test";
import { archiveBaseDirectory } from "../support/order-archive";
import {
  archiveDirectory,
  writeBrickLinkArchive,
  writeBrickOwlOrder,
} from "../support/order-import";

/**
 * The orders screen's own endpoint: the store's orders as the import last left them, for a range of days.
 *
 * <p>It reads and nothing else. The rows are written by the import job out of the archive, so what these are about
 * is the range, the order they come back in, and that one store never reads another's.
 */

type ListedOrder = {
  id: number;
  source: string;
  orderId: string;
  orderUrl: string | null;
  orderDate: string;
  buyer: string | null;
  buyerUsername: string | null;
  lotCount: number | null;
  itemCount: number | null;
  paymentMethod: string | null;
  currency: string | null;
  taxType: string | null;
  facilitatorTax: string | null;
  subTotal: string | null;
  shippingCost: string | null;
  grandTotal: string | null;
  refundedAmount: string | null;
  archivedAt: string;
};

async function listOrders(
  request: APIRequestContext,
  from: string,
  to: string,
) {
  const response = await request.get(
    `/api/private/orders?from=${from}&to=${to}`,
  );
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as {
    from: string;
    to: string;
    orders: ListedOrder[];
  };
}

/** Puts orders in the database the way the store does: archived files, imported by the job. */
async function importOrders(
  request: APIRequestContext,
  settings: { set: (key: string, value: string) => Promise<void> },
  tenantCode: string,
  write: (directory: string) => void,
) {
  const base = archiveBaseDirectory();
  await settings.set("VAST_ORDER_ARCHIVE_DIR", base);
  write(archiveDirectory(base, tenantCode));

  expect(
    (await request.post("/api/private/jobs/order-import/run")).status(),
  ).toBe(202);
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/private/jobs/order-import")).json())
          .lastRun?.outcome,
      {
        timeout: 30_000,
      },
    )
    .toBe("succeeded");
}

test("the orders of a range are listed, newest first", async ({
  request,
  settings,
  authentication,
}) => {
  await importOrders(
    request,
    settings,
    authentication.tenant.code,
    (directory) => {
      writeBrickLinkArchive(directory, {
        orderId: 32100201,
        archivedAt: "2026-04-02T08:00:00.000Z",
        accounting: {
          orderDate: "4/1/2026",
          buyer: "Marta Ozola",
          lots: 7,
          items: 42,
          subTotal: "28.90",
          shipping: "2.50",
          grandTotal: "31.40",
        },
      });
      writeBrickOwlOrder(directory, {
        orderId: "19200201",
        archivedAt: "2026-04-04T08:00:00",
        orderTime: "2026-04-03T09:10:11",
        buyerName: "Juris Berzins",
        customerUsername: "owlfan_juris",
      });
    },
  );

  const listed = await listOrders(request, "2026-04-01", "2026-04-30");
  expect(listed.from).toBe("2026-04-01");
  expect(listed.to).toBe("2026-04-30");
  // Newest first: an orders screen is opened at what just came in, not at what a store sold two years ago.
  expect(listed.orders.map((order) => order.orderId)).toEqual([
    "19200201",
    "32100201",
  ]);

  const [owl, brickLink] = listed.orders as [ListedOrder, ListedOrder];
  expect(owl.source).toBe("BRICKOWL");
  expect(owl.buyer).toBe("Juris Berzins");
  expect(owl.buyerUsername).toBe("owlfan_juris");
  expect(brickLink.source).toBe("BRICKLINK");
  expect(brickLink.buyer).toBe("Marta Ozola");
  expect(brickLink.lotCount).toBe(7);
  expect(brickLink.itemCount).toBe(42);
  expect(Number(brickLink.subTotal)).toBe(28.9);
  expect(Number(brickLink.shippingCost)).toBe(2.5);
  expect(Number(brickLink.grandTotal)).toBe(31.4);
  expect(brickLink.currency).toBe("EUR");
  expect(brickLink.orderUrl).toContain("bricklink.com");
});

test("every field the reconciliation report states about an order is stated here too", async ({
  request,
  settings,
  authentication,
}) => {
  await importOrders(
    request,
    settings,
    authentication.tenant.code,
    (directory) => {
      writeBrickLinkArchive(directory, {
        orderId: 32100207,
        archivedAt: "2026-04-10T08:00:00.000Z",
        accounting: { orderDate: "4/8/2026" },
      });
    },
  );

  const order = (await listOrders(request, "2026-04-01", "2026-04-30"))
    .orders[0]!;
  // The whole of what the report states about an order itself, so a reader can move between the two screens
  // without meeting a column on one that the other does not have.
  expect(Object.keys(order).sort()).toEqual(
    [
      "archivedAt",
      "buyer",
      "buyerUsername",
      "currency",
      "facilitatorTax",
      "grandTotal",
      "id",
      "itemCount",
      "lotCount",
      "orderDate",
      "orderId",
      "orderUrl",
      "paymentMethod",
      "refundedAmount",
      "shippingCost",
      "source",
      "subTotal",
      "taxType",
    ].sort(),
  );
});

test("an order outside the range is not listed, and the days at its edges are", async ({
  request,
  settings,
  authentication,
}) => {
  await importOrders(
    request,
    settings,
    authentication.tenant.code,
    (directory) => {
      writeBrickLinkArchive(directory, {
        orderId: 32100202,
        archivedAt: "2026-05-02T08:00:00.000Z",
        accounting: { orderDate: "4/30/2026" },
      });
      writeBrickLinkArchive(directory, {
        orderId: 32100203,
        archivedAt: "2026-05-02T08:00:00.000Z",
        accounting: { orderDate: "5/1/2026" },
      });
      writeBrickLinkArchive(directory, {
        orderId: 32100204,
        archivedAt: "2026-05-02T08:00:00.000Z",
        accounting: { orderDate: "5/31/2026" },
      });
      writeBrickLinkArchive(directory, {
        orderId: 32100205,
        archivedAt: "2026-05-02T08:00:00.000Z",
        accounting: { orderDate: "6/1/2026" },
      });
    },
  );

  // Both ends are included: a month asked for is the whole of it.
  const listed = await listOrders(request, "2026-05-01", "2026-05-31");
  expect(listed.orders.map((order) => order.orderId).sort()).toEqual([
    "32100203",
    "32100204",
  ]);
});

test("an order placed in the last moment of a day is in the day it was placed", async ({
  request,
  settings,
  authentication,
}) => {
  await importOrders(
    request,
    settings,
    authentication.tenant.code,
    (directory) => {
      // BrickOwl states a time of day, so the last second of a month is a real case rather than a contrived one.
      writeBrickOwlOrder(directory, {
        orderId: "19200202",
        archivedAt: "2026-06-01T08:00:00",
        orderTime: "2026-06-30T23:59:59",
      });
    },
  );

  expect(
    (await listOrders(request, "2026-06-01", "2026-06-30")).orders,
  ).toHaveLength(1);
});

test("a store reads only its own orders", async ({
  request,
  settings,
  authentication,
  otherTenant,
}) => {
  await importOrders(
    request,
    settings,
    authentication.tenant.code,
    (directory) => {
      writeBrickLinkArchive(directory, {
        orderId: 32100206,
        archivedAt: "2026-07-02T08:00:00.000Z",
        accounting: { orderDate: "7/1/2026" },
      });
    },
  );

  expect(
    (await listOrders(request, "2026-07-01", "2026-07-31")).orders,
  ).toHaveLength(1);
  // The other store archived nothing and imported nothing, so it has nothing to read - including of this one's.
  expect(
    (await listOrders(otherTenant.request, "2026-07-01", "2026-07-31")).orders,
  ).toHaveLength(0);
});

test("a range stated the wrong way round is refused", async ({ request }) => {
  const response = await request.get(
    "/api/private/orders?from=2026-08-31&to=2026-08-01",
  );
  expect(response.status()).toBe(400);
});
