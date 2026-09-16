import { expect, test } from "../support/api-test";
import { mockReconciliationOrders } from "../support/reconciliation";
import { wireMockMode } from "../support/wiremock";

/**
 * Whether the store synchronization ever saw an order.
 *
 * <p>BrickSync is what takes the stock an order sold off the store's other marketplace, and it keeps a file per
 * order to show it did. An order it has no file for was never taken off the other one, which is how the same brick
 * comes to be sold twice — and because BrickSync synchronizes orders as they arrive, orders go missing in runs
 * rather than singly: the ordinary cause is that BrickSync was not running, which is a thing for a person to go and
 * check.
 */

test.describe.configure({ mode: wireMockMode() });

const month = "2026-08";

function brickLinkOrder(orderId: number) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>${orderId}</ORDERID>
    <ORDERDATE>8/12/2026</ORDERDATE>
    <BUYER>Marta Ozola</BUYER>
    <ORDERITEMS>7</ORDERITEMS>
    <ORDERLOTS>3</ORDERLOTS>
    <ORDERTOTAL>10.00</ORDERTOTAL>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    <BASEGRANDTOTAL>12.50</BASEGRANDTOTAL>
    <PAYCURRENCYCODE>EUR</PAYCURRENCYCODE>
    <PAYMENTTYPE>PayPal (Onsite)</PAYMENTTYPE>
    <VATCHARGES>2.17</VATCHARGES>
    <ORDERSALESTAX>0.00</ORDERSALESTAX>
    <ORDERVAT>0.00</ORDERVAT>
  </ORDER>
</ORDERS>`;
}

async function reconciled(
  request: Parameters<typeof mockReconciliationOrders>[1],
) {
  const response = await request.get(
    `/api/private/reconciliation/orders?month=${month}`,
  );
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).orders;
}

const storeSyncMissing = (order: { failures: { code: string }[] }) =>
  order.failures.filter(
    (failure: { code: string }) => failure.code === "store-sync-order-missing",
  );

test("reports nothing for an order BrickSync synchronized", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month,
    brickLink: {
      fullNameOrdersXml: brickLinkOrder(32456801),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
  });

  const [order] = await reconciled(request);
  expect(order.storeSync.order).toBe(true);
  expect(storeSyncMissing(order)).toEqual([]);
});

test("fails a BrickLink order BrickSync holds no record of", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month,
    brickLink: {
      fullNameOrdersXml: brickLinkOrder(32456802),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    brickSyncMissing: ["32456802"],
  });

  const [order] = await reconciled(request);
  expect(order.storeSync.order).toBeNull();
  // At `error`: stock that was never taken off the other marketplace is stock that can be sold twice.
  expect(storeSyncMissing(order)).toEqual([
    {
      code: "store-sync-order-missing",
      level: "error",
      fields: ["storeSync.order"],
    },
  ]);
});

test("fails a BrickOwl order BrickSync holds no record of, and nothing beside it", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month,
    brickOwl: [
      {
        orderId: "test-order-0820",
        orderDate: "1786320000",
        view: { buyer_name: "Test Buyer Alpha", base_order_total: "5.20" },
      },
      {
        orderId: "test-order-0821",
        orderDate: "1786320000",
        view: { buyer_name: "Test Buyer Beta", base_order_total: "6.00" },
      },
    ],
    brickSyncMissing: ["test-order-0821"],
  });

  // BrickSync synchronizes both marketplaces, so the rule reads a BrickOwl order exactly as it reads a BrickLink
  // one — and the order beside it that was synchronized stays quiet, which is what says the two are read apart.
  const orders = await reconciled(request);
  const byId = Object.fromEntries(
    orders.map((order: { order: { orderId: string } }) => [
      order.order.orderId,
      order,
    ]),
  );
  expect(byId["test-order-0820"].storeSync.order).toBe(true);
  expect(storeSyncMissing(byId["test-order-0820"])).toEqual([]);
  expect(byId["test-order-0821"].storeSync.order).toBeNull();
  expect(storeSyncMissing(byId["test-order-0821"])).toEqual([
    {
      code: "store-sync-order-missing",
      level: "error",
      fields: ["storeSync.order"],
    },
  ]);
});
