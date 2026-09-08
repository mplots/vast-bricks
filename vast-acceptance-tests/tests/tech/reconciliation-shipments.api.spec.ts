import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "../support/api-test";
import type { MansPastsShipmentMock } from "../support/manspasts";
import {
  BrickOwlOrderMock,
  mockReconciliationOrders,
} from "../support/reconciliation";
import { WireMockApi, wireMockMode } from "../support/wiremock";

/**
 * What the post office charged to ship an order, collected onto that order.
 *
 * <p>A shipment names its order in the notes the store wrote on it, which is where both marketplaces put it, and
 * names no marketplace at all — so what these scenarios are about is which order a shipment is matched to, and what
 * the shipment source states for one that was never shipped.
 */

test.describe.configure({ mode: wireMockMode() });

const month = "2026-08";

/** An order of the reconciled month, as BrickOwl reports one. */
const brickOwlOrder = (orderId: string, total = "12.00"): BrickOwlOrderMock => ({
  orderId,
  orderDate: "1786406400",
  view: { buyer_name: "Edith Clarke", base_order_total: total },
});

/** A shipment of the register, created after the order it was sent for. */
const shipment = (
  notes: string | undefined,
  totalAmount: number,
): MansPastsShipmentMock => ({
  barcode: `LS9000000${totalAmount}LV`,
  status: "processed",
  recipientName: "Edith Clarke",
  notes,
  postageFee: totalAmount,
  totalAmount,
  createdAt: "02.09.2026 10:00:00",
});

async function shipmentTotals(request: APIRequestContext) {
  const response = await request.get(
    `/api/private/reconciliation/orders?month=${month}`,
  );
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as {
    orders: Array<{
      order: { orderId: string };
      shipment: { totalAmount: number | null };
    }>;
  };
  return Object.fromEntries(
    body.orders.map((order) => [
      order.order.orderId,
      order.shipment.totalAmount,
    ]),
  );
}

test("collects what the post office charged for the order its shipment names", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month,
    brickOwl: [brickOwlOrder("1600001")],
    mansPasts: [shipment("Order #1600001", 5.41)],
  });

  expect(await shipmentTotals(request)).toEqual({ "1600001": 5.41 });
});

test("sums every shipment sent for one order", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month,
    brickOwl: [brickOwlOrder("1600002")],
    // An order shipped in two parcels was shipped twice for one order, and both are postage the store paid for it.
    mansPasts: [shipment("Order #1600002", 5.41), shipment("Order #1600002", 4.18)],
  });

  expect(await shipmentTotals(request)).toEqual({ "1600002": 9.59 });
});

test("leaves an order nothing was shipped for without a shipping cost", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month,
    brickOwl: [brickOwlOrder("1600003")],
    // The register holds a shipment, but for an order this month did not collect.
    mansPasts: [shipment("Order #9900001", 5.41)],
  });

  expect(await shipmentTotals(request)).toEqual({ "1600003": null });
});

test("collects nothing from notes that name two collected orders", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month,
    brickOwl: [brickOwlOrder("1600004"), brickOwlOrder("1600005")],
    // A guessed shipment would read exactly like a matched one, so an ambiguous note matches neither order.
    mansPasts: [shipment("Orders #1600004 and #1600005", 5.41)],
  });

  expect(await shipmentTotals(request)).toEqual({
    "1600004": null,
    "1600005": null,
  });
});

test("collects nothing for a shipment the store noted nothing on", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month,
    brickOwl: [brickOwlOrder("1600006")],
    mansPasts: [shipment(undefined, 5.41)],
  });

  expect(await shipmentTotals(request)).toEqual({ "1600006": null });
});

test("asks the register for its first page and no other", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month,
    brickOwl: [brickOwlOrder("1600007")],
    mansPasts: [shipment("Order #1600007", 5.41)],
  });

  expect(await shipmentTotals(request)).toEqual({ "1600007": 5.41 });
  // The export's first page holds the whole register, so one request is the whole of it and the month decides
  // nothing about which page is asked for.
  expect(await requestedPages(wireMock)).toEqual(["1"]);
});

test("answers a provider that refuses the sign-in as a bad gateway", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month,
    brickOwl: [brickOwlOrder("1600009")],
    mansPastsRefusesLogin: true,
  });

  const response = await request.get(
    `/api/private/reconciliation/orders?month=${month}`,
  );

  // The register is the provider's, and a refused login is its account of the request rather than ours.
  expect(response.status(), await response.text()).toBe(502);
});

/** The pages the register was asked for, in the order the source walked them. */
async function requestedPages(wireMock: WireMockApi) {
  const requests = await wireMock.findMethodHostRequests(
    "POST",
    "/lv/profile/orders/export",
  );
  return requests.map(
    (request) =>
      new URL(request.url ?? "", "http://manspasts.test").searchParams.get(
        "page",
      ) ?? "",
  );
}
