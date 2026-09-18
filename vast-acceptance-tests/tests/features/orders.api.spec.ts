import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "../support/api-test";
import { anEcbRateDate, mockEcb, TEST_CURRENCY } from "../support/ecb";
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
  orderDate: string;
  buyer: string | null;
  buyerUsername: string | null;
  country: string | null;
  lotCount: number | null;
  itemCount: number | null;
  paymentMethod: string | null;
  currency: string | null;
  taxType: string | null;
  facilitatorTax: string | null;
  marketplaceFee: string | null;
  calculatedMarketplaceFee: string | null;
  subTotal: string | null;
  shippingCost: string | null;
  grandTotal: string | null;
  refundedAmount: string | null;
  targetInvoice: string | null;
  calculatedPaymentFee: string | null;
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

async function listCountries(
  request: APIRequestContext,
  from: string,
  to: string,
) {
  const response = await request.get(
    `/api/private/orders/countries?from=${from}&to=${to}`,
  );
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as {
    from: string;
    to: string;
    countries: { country: string | null; orders: number }[];
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

/**
 * Stubs one day of ECB rates and syncs it, so a test order's foreign-currency amounts have something to convert by.
 * Answers with that day, both as the ISO date and as BrickLink's own accounting-export format, for a scenario to
 * date its order by.
 *
 * <p>`TEST_CURRENCY` is shared with every other scenario that converts a currency, and the conversion reads the
 * *closest* rate on or before an order rather than an exact one - so a scenario dating its order any later than the
 * rate it just synced would have another scenario's later rate for the same currency outrun its own. Dating the
 * order the same day as the rate is what keeps this scenario's own row the closest one on or before it: the
 * (currency, date) pair is unique by the table's own constraint, so no other scenario can ever hold that exact day.
 */
async function syncCurrencyRate(
  settings: Parameters<typeof mockEcb>[0],
  request: APIRequestContext,
  testInfo: Parameters<typeof mockEcb>[2],
  rate: string,
) {
  const rateDate = anEcbRateDate(testInfo);
  await mockEcb(settings, request, testInfo, rateDate, { [TEST_CURRENCY]: rate });

  expect(
    (await request.post("/api/private/jobs/currency-rate-sync/run?force=true")).status(),
  ).toBe(202);
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/private/jobs/currency-rate-sync")).json())
          .lastRun?.outcome,
      { timeout: 30_000 },
    )
    .toBe("succeeded");

  // BrickLink's own accounting export date format: month/day/year, no leading zeros.
  const [year, month, day] = rateDate.split("-").map(Number);
  return { rateDate, orderDate: `${month}/${day}/${year}` };
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
  expect(brickLink.country).toBe("LV");
  expect(brickLink.lotCount).toBe(7);
  expect(brickLink.itemCount).toBe(42);
  expect(Number(brickLink.subTotal)).toBe(28.9);
  expect(Number(brickLink.shippingCost)).toBe(2.5);
  expect(Number(brickLink.grandTotal)).toBe(31.4);
  expect(brickLink.currency).toBe("EUR");
});

/**
 * The target invoice: the one figure on this screen worked out from more than one of an order's own fields, and the
 * only one stated in a currency the order was not necessarily placed in.
 */

test("the target invoice converts the facilitator tax and the refund out of whatever the buyer paid in", async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const { rateDate, orderDate } = await syncCurrencyRate(settings, request, testInfo, "2.000000");
  const month = rateDate.slice(0, 7);
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

  await importOrders(
    request,
    settings,
    authentication.tenant.code,
    (directory) => {
      writeBrickLinkArchive(directory, {
        orderId: 32100208,
        archivedAt: "2026-04-11T08:00:00.000Z",
        accounting: {
          orderDate,
          paymentCurrency: TEST_CURRENCY,
          // 100.00 in the buyer's currency, at 2 to the euro: 50.00 once converted. Every amount an order states is
          // in whatever the buyer paid in, the grand total included, so this converts exactly as the other two do.
          grandTotal: "100.00",
          // 20.00 in the buyer's currency, at 2 to the euro: 10.00 once converted.
          vat: "20.00",
        },
        // 10.00 in the buyer's currency, at 2 to the euro: 5.00 once converted.
        refunded: "10.00",
      });
    },
  );

  const order = (await listOrders(request, `${month}-01`, `${month}-${String(monthEnd).padStart(2, "0")}`))
    .orders[0]!;
  expect(order.currency).toBe(TEST_CURRENCY);
  // 50.00 - 10.00 - 5.00, all three converted before they were added or subtracted rather than taken off as stated.
  expect(Number(order.targetInvoice)).toBe(35);
});

test("calculates no marketplace fee, but still a payment fee, for an order refunded in full", async ({
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
        orderId: 32100209,
        archivedAt: "2026-04-12T08:00:00.000Z",
        accounting: { orderDate: "4/12/2026", grandTotal: "100.00" },
        // Refunded for the whole of what it came to.
        refunded: "100.00",
      });
    },
  );

  const order = (await listOrders(request, "2026-04-01", "2026-04-30")).orders[0]!;
  expect(Number(order.refundedAmount)).toBe(100);
  expect(order.calculatedMarketplaceFee).toBeNull();
  // PayPal charged for taking the payment whether or not a refund came after it: 3.4% of the 100.00 grand total
  // plus EUR 0.35, its EEA domestic rate.
  expect(Number(order.calculatedPaymentFee)).toBe(3.75);
});

test("a currency the rate table has never held a rate for leaves the target invoice unstated", async ({
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
        orderId: 32100209,
        archivedAt: "2026-04-12T08:00:00.000Z",
        accounting: {
          orderDate: "4/9/2026",
          // A currency code no test and no real order ever states, so this table never holds a rate for it.
          paymentCurrency: "ZZZ",
          vat: "20.00",
          grandTotal: "100.00",
        },
      });
    },
  );

  const order = (await listOrders(request, "2026-04-01", "2026-04-30"))
    .orders[0]!;
  expect(order.targetInvoice).toBeNull();
});

test("every field the reconciliation report states about an order is stated here too, and the country it does not", async ({
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
  // without meeting a column on one that the other does not have - plus the country, which is the one field this
  // screen states that the report does not, because it is a fact of the order rather than of the accounts held
  // against it. `targetInvoice` is the exception the other way: this screen approximates the report's own
  // calculated figure from what it has stored, rather than the report handing it down flat.
  expect(Object.keys(order).sort()).toEqual(
    [
      "archivedAt",
      "buyer",
      "buyerUsername",
      "calculatedMarketplaceFee",
      "calculatedPaymentFee",
      "country",
      "currency",
      "facilitatorTax",
      "grandTotal",
      "id",
      "itemCount",
      "lotCount",
      "marketplaceFee",
      "orderDate",
      "orderId",
      "paymentMethod",
      "refundedAmount",
      "shippingCost",
      "source",
      "subTotal",
      "targetInvoice",
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

/**
 * What a range came to by country, which the dashboard draws as a pie.
 *
 * <p>The same stored orders the listing reads, counted by the API rather than by the screen: a period is a screenful
 * of slices however many orders it holds, and a year of them is not worth sending down to draw a dozen.
 */

test("the orders of a range are counted by the country they went to, largest share first", async ({
  request,
  settings,
  authentication,
}) => {
  await importOrders(
    request,
    settings,
    authentication.tenant.code,
    (directory) => {
      // Two to Latvia, one to Germany, and one the marketplace stated no country for.
      writeBrickLinkArchive(directory, {
        orderId: 32100401,
        archivedAt: "2026-09-02T08:00:00.000Z",
        shippedToCountry: "LV",
        accounting: { orderDate: "9/1/2026" },
      });
      writeBrickOwlOrder(directory, {
        orderId: "19200401",
        archivedAt: "2026-09-03T08:00:00",
        orderTime: "2026-09-02T09:10:11",
        shipCountryCode: "LV",
      });
      writeBrickLinkArchive(directory, {
        orderId: 32100402,
        archivedAt: "2026-09-04T08:00:00.000Z",
        shippedToCountry: "DE",
        accounting: { orderDate: "9/3/2026" },
      });
      writeBrickLinkArchive(directory, {
        orderId: 32100403,
        archivedAt: "2026-09-05T08:00:00.000Z",
        shippedToCountry: "",
        accounting: { orderDate: "9/4/2026" },
      });
    },
  );

  const counted = await listCountries(request, "2026-09-01", "2026-09-30");
  expect(counted.from).toBe("2026-09-01");
  expect(counted.to).toBe("2026-09-30");
  // Largest first, so the slices are drawn in the order a reader asks about them. The orders whose marketplace
  // stated no country are a share of their own rather than orders left out of the total.
  expect(counted.countries).toEqual([
    { country: "LV", orders: 2 },
    { country: null, orders: 1 },
    { country: "DE", orders: 1 },
  ]);
});

test("only the range's orders are counted, and the days at its edges are", async ({
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
        orderId: 32100411,
        archivedAt: "2026-10-02T08:00:00.000Z",
        shippedToCountry: "LV",
        accounting: { orderDate: "10/1/2026" },
      });
      writeBrickLinkArchive(directory, {
        orderId: 32100412,
        archivedAt: "2026-10-31T08:00:00.000Z",
        shippedToCountry: "DE",
        accounting: { orderDate: "10/31/2026" },
      });
      // The day after the range, which is another period's order and no part of this pie.
      writeBrickLinkArchive(directory, {
        orderId: 32100413,
        archivedAt: "2026-11-02T08:00:00.000Z",
        shippedToCountry: "EE",
        accounting: { orderDate: "11/1/2026" },
      });
    },
  );

  const counted = await listCountries(request, "2026-10-01", "2026-10-31");
  expect(counted.countries).toEqual([
    { country: "DE", orders: 1 },
    { country: "LV", orders: 1 },
  ]);
});

test("a store's countries are counted from its own orders alone", async ({
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
        orderId: 32100421,
        archivedAt: "2026-12-02T08:00:00.000Z",
        shippedToCountry: "LV",
        accounting: { orderDate: "12/1/2026" },
      });
    },
  );

  expect(
    (await listCountries(request, "2026-12-01", "2026-12-31")).countries,
  ).toEqual([{ country: "LV", orders: 1 }]);
  expect(
    (await listCountries(otherTenant.request, "2026-12-01", "2026-12-31"))
      .countries,
  ).toEqual([]);
});

test("a range stated the wrong way round is refused for the countries too", async ({
  request,
}) => {
  const response = await request.get(
    "/api/private/orders/countries?from=2026-08-31&to=2026-08-01",
  );
  expect(response.status()).toBe(400);
});
