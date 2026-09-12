import { expect, test } from "../support/api-test";
import {
  brickLinkConfig,
  brickOwlConfig,
  createProviderAccount,
} from "../support/provider-accounts";
import { mockReconciliationOrders } from "../support/reconciliation";
import { WireMockApi, wireMockMode } from "../support/wiremock";

/**
 * Reconciliation collects a store's orders only from the stretch that store's provider account says counts. A
 * BrickLink or BrickOwl login can hold orders that were never this tenant's - sold personally before the store became
 * a business, or by whoever holds the same login now - and those are not this tenant's orders to reconcile.
 */

test.describe.configure({ mode: wireMockMode() });

/** BrickOwl dates an order in epoch seconds. */
const epochSeconds = (date: string) => String(Date.parse(`${date}T00:00:00Z`) / 1000);

/** The date range each BrickLink export was asked for, read back out of the form BrickStore posts. */
async function exportedRanges(wireMock: WireMockApi) {
  const exports = await wireMock.findMethodHostRequests(
    "POST",
    "/orderExcelFinal.asp",
  );
  return exports.map((exported) => {
    const form = new URLSearchParams(exported.body().toString("utf8"));
    const date = (bound: "f" | "t") =>
      [
        form.get(`${bound}YY`),
        form.get(`${bound}MM`)?.padStart(2, "0"),
        form.get(`${bound}DD`)?.padStart(2, "0"),
      ].join("-");
    return { from: date("f"), to: date("t") };
  });
}

test("a BrickOwl order dated outside the store's operating period is not reconciled", async ({
  request,
  settings,
}, testInfo) => {
  await createProviderAccount(request, {
    name: "Shop BrickOwl",
    config: brickOwlConfig({ operatingPeriod: { from: "2026-08-15", to: null } }),
  });

  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    // The details the store serves are the ones inside the operating period, because that is the range the source
    // narrows the month to before it asks for any.
    period: { from: "2026-08-15", to: "2026-08-31" },
    brickOwl: [
      {
        orderId: "test-order-0810",
        orderDate: epochSeconds("2026-08-10"),
        view: { buyer_name: "Test Buyer Alpha", sub_total: "2.70" },
      },
      {
        orderId: "test-order-0820",
        orderDate: epochSeconds("2026-08-20"),
        view: { buyer_name: "Test Buyer Beta", sub_total: "6.00" },
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const reconciled = await response.json();
  // The store listed both, and the one dated five days before the store became this tenant's is somebody else's.
  expect(
    reconciled.orders.map((order: { order: { orderId: string } }) => order.order.orderId),
  ).toEqual(["test-order-0820"]);
});

test("BrickLink is asked for the month only as far as the store's operating period reaches", async ({
  request,
  settings,
}, testInfo) => {
  await createProviderAccount(request, {
    name: "Shop BrickLink",
    config: brickLinkConfig({ operatingPeriod: { from: null, to: "2026-08-15" } }),
  });

  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );
  expect(response.status(), await response.text()).toBe(200);

  // BrickLink filters its own export, so the period is respected by asking for it: both exports - the one naming
  // buyers by real name and the one naming them by username - stop where the store stopped being this tenant's.
  const ranges = await exportedRanges(wireMock);
  expect(ranges.length).toBeGreaterThan(0);
  expect(ranges).toEqual(
    ranges.map(() => ({ from: "2026-08-01", to: "2026-08-15" })),
  );
});

test("a month entirely outside the operating period reconciles nothing and asks the store nothing", async ({
  request,
  settings,
}, testInfo) => {
  await createProviderAccount(request, {
    name: "Shop BrickLink",
    config: brickLinkConfig({ operatingPeriod: { from: "2026-09-01", to: null } }),
  });

  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS>
        <ORDER><ORDERID>32456570</ORDERID><ORDERDATE>8/30/2026</ORDERDATE><BUYER>some buyer</BUYER>
        <ORDERTOTAL>3.00</ORDERTOTAL></ORDER></ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS>
        <ORDER><ORDERID>32456570</ORDERID><BUYER>some-buyer-username</BUYER></ORDER></ORDERS>`,
    },
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  // The store would have served the order; it was never asked, because no day of the month was this tenant's.
  expect((await response.json()).orders).toEqual([]);
  expect(await exportedRanges(wireMock)).toEqual([]);
});
