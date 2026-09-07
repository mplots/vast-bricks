import { expect, test } from "../support/api-test";
import { camt053, importDocument } from "../support/bank-statements";
import { mockReconciliationOrders } from "../support/reconciliation";
import { wireMockMode } from "../support/wiremock";

test.describe.configure({ mode: wireMockMode() });

test("fails a Stripe-paid order that was paid another amount than its grand total", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
    stripe: [{ description: "Brick Owl Order owl-order-0810", amount: 500 }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBe(5);
  expect(body.orders[0].failures).toEqual([
    {
      code: "paid-amount-mismatch",
      level: "error",
      fields: ["gateway.paidAmount", "order.grandTotal"],
    },
  ]);
});

test("fails a Stripe-paid order no payment was collected for", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBeNull();
  expect(body.orders[0].failures).toEqual([
    { code: "amount-missing", level: "error", fields: ["gateway.paidAmount"] },
  ]);
});

test("fails an order paid outside the collected providers that no payment was collected for", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          // No payments are collected for a bank transfer, so nothing can show this order was ever paid.
          payment_method_type: "bank_transfer",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBeNull();
  expect(body.orders[0].failures).toEqual([
    { code: "amount-missing", level: "error", fields: ["gateway.paidAmount"] },
  ]);
});

test("fails an order the payment shows a different facilitator tax taken than the marketplace reported", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "6.29",
          tax_scheme_id: "au-gst",
          tax_rate: "10",
          tax_amount: "1.09",
        },
      },
    ],
    stripe: [
      {
        description: "Brick Owl Order owl-order-0810",
        amount: 629,
        applicationFee: 95,
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].order.facilitatorTax).toBe(1.09);
  expect(body.orders[0].gateway.facilitatorTax).toBe(0.95);
  expect(body.orders[0].failures).toEqual([
    {
      code: "facilitator-tax-mismatch",
      level: "error",
      fields: ["order.facilitatorTax", "gateway.facilitatorTax"],
    },
  ]);
});

test("fails an order the marketplace reported facilitator tax for that the payment took none in", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "6.29",
          tax_scheme_id: "au-gst",
          tax_rate: "10",
          tax_amount: "1.09",
        },
      },
    ],
    // The payment states no application fee at all, so it says the marketplace took nothing.
    stripe: [{ description: "Brick Owl Order owl-order-0810", amount: 629 }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.facilitatorTax).toBeNull();
  expect(body.orders[0].failures).toEqual([
    {
      code: "facilitator-tax-mismatch",
      level: "error",
      fields: ["order.facilitatorTax", "gateway.facilitatorTax"],
    },
  ]);
});

test("fails an order the payment shows a refund on that the marketplace reports none for", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
    stripe: [
      {
        description: "Brick Owl Order owl-order-0810",
        amount: 520,
        amountRefunded: 200,
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  // Nothing collects the marketplace's side of a refund yet, so every refunded order is reported as a disagreement.
  // That is the point of the rule for now: it is the standing list of refunds no marketplace mapping accounts for.
  expect(body.orders[0].order.refundedAmount).toBeNull();
  expect(body.orders[0].gateway.refundedAmount).toBe(2);
  expect(body.orders[0].failures).toEqual([
    {
      code: "refunded-amount-mismatch",
      level: "error",
      fields: ["order.refundedAmount", "gateway.refundedAmount"],
    },
  ]);
});

test("passes an order neither the payment nor the marketplace reports a refund on", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
    stripe: [{ description: "Brick Owl Order owl-order-0810", amount: 520 }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  // Neither side reporting a refund is the two agreeing, which is what keeps the ordinary order silent.
  expect(body.orders[0].failures).toEqual([]);
});

test("does not fail a refunded order no payment was matched to for the refund it cannot compare", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
    stripe: [{ description: "Brick Owl Order some-other-order", amount: 520 }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  // The missing payment is reported once, by the rule that requires one, and not again as a refund disagreement.
  expect(body.orders[0].failures).toEqual([
    { code: "amount-missing", level: "error", fields: ["gateway.paidAmount"] },
  ]);
});

test("fails a bank-transfer order the bank shows was paid less than its grand total", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "7500001",
        orderDate: "1786320000",
        view: {
          buyer_name: "Grace Hopper",
          payment_method_type: "bank",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
  });
  // The buyer transferred too little and was never asked for the rest, so the two accounts of the order disagree.
  await importDocument(
    request,
    camt053({
      entries: [
        {
          reference: "2026090200000011-1",
          amount: "5.00",
          direction: "CRDT",
          bookingDate: "2026-09-02",
          counterpartyName: "Grace Hopper",
          remittance: "order 7500001",
        },
      ],
    }),
  );

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBe(5);
  expect(body.orders[0].failures).toEqual([
    {
      code: "paid-amount-mismatch",
      level: "error",
      fields: ["gateway.paidAmount", "order.grandTotal"],
    },
  ]);
});
