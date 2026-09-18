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
  // The order reports no refund of its own, which is that side saying nothing came back, and the payment
  // contradicts it. An absent amount is a disagreement rather than missing data.
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

test("warns of a BrickOwl order whose reported marketplace fee does not match this store's calculation", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-fee-0001",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "bank",
          sub_total: "5.20",
          base_order_total: "5.20",
          // 2.65% of 5.20 is 0.14; reported here as something else entirely.
          brickowl_fee: "0.50",
        },
      },
    ],
  });
  await importDocument(
    request,
    camt053({
      entries: [
        {
          reference: "2026090200000012-1",
          amount: "5.20",
          direction: "CRDT",
          bookingDate: "2026-09-02",
          counterpartyName: "some buyer",
          remittance: "order owl-fee-0001",
        },
      ],
    }),
  );

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].order.marketplaceFee).toBe(0.5);
  expect(body.orders[0].calculated.marketplaceFee).toBe(0.14);
  expect(body.orders[0].failures).toEqual([
    {
      code: "marketplace-fee-mismatch",
      level: "warning",
      fields: ["order.marketplaceFee", "calculated.marketplaceFee"],
    },
  ]);
});

test("passes a BrickOwl order whose reported marketplace fee matches this store's calculation", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-fee-0002",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "bank",
          sub_total: "10.00",
          base_order_total: "10.00",
          // 2.65% of 10.00, rounded to the cent BrickOwl itself would report.
          brickowl_fee: "0.27",
        },
      },
    ],
  });
  await importDocument(
    request,
    camt053({
      entries: [
        {
          reference: "2026090200000013-1",
          amount: "10.00",
          direction: "CRDT",
          bookingDate: "2026-09-02",
          counterpartyName: "some buyer",
          remittance: "order owl-fee-0002",
        },
      ],
    }),
  );

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].order.marketplaceFee).toBe(0.27);
  expect(body.orders[0].calculated.marketplaceFee).toBe(0.27);
  expect(body.orders[0].failures).toEqual([]);
});

test("does not fail a BrickLink order for a marketplace fee it reports none of", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>90000001</ORDERID>
    <ORDERDATE>8/30/2026</ORDERDATE>
    <BUYER>some buyer</BUYER>
    <ORDERTOTAL>10.00</ORDERTOTAL>
    <BASEGRANDTOTAL>10.00</BASEGRANDTOTAL>
    <PAYMENTTYPE>Bank Transfer</PAYMENTTYPE>
    <ITEM><ITEMID>3001</ITEMID><PRICE>10.0000</PRICE><QTY>1</QTY></ITEM>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
  });
  await importDocument(
    request,
    camt053({
      entries: [
        {
          reference: "2026090200000014-1",
          amount: "10.00",
          direction: "CRDT",
          bookingDate: "2026-09-02",
          counterpartyName: "some buyer",
          remittance: "order 90000001",
        },
      ],
    }),
  );

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  // BrickLink states no per-order fee at all, so there is nothing to check the calculation against.
  expect(body.orders[0].order.marketplaceFee).toBeNull();
  expect(body.orders[0].calculated.marketplaceFee).toBe(0.3);
  expect(body.orders[0].failures).toEqual([]);
});

test("warns of a Stripe-paid order whose fee does not match this store's calculation", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-fee-0003",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
    // 1.5% of 5.20 plus EUR 0.25 is 0.33; Stripe is stubbed as having taken 0.50 instead.
    stripe: [
      { description: "Brick Owl Order owl-fee-0003", amount: 520, stripeFee: 50 },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.feeAmount).toBe(0.5);
  expect(body.orders[0].calculated.paymentFee).toBe(0.33);
  expect(body.orders[0].failures).toEqual([
    {
      code: "payment-fee-mismatch",
      level: "warning",
      fields: ["gateway.feeAmount", "calculated.paymentFee"],
    },
  ]);
});

test("warns of a PayPal-paid order whose fee does not match this store's calculation", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-fee-0004",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "paypal",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
    // 3.4% of 5.20 plus EUR 0.35 is 0.53; PayPal is stubbed as having taken 0.75 instead.
    payPal: [{ invoiceId: "owl-fee-0004", amount: "5.20", feeAmount: "-0.75" }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.feeAmount).toBe(0.75);
  expect(body.orders[0].calculated.paymentFee).toBe(0.53);
  expect(body.orders[0].failures).toEqual([
    {
      code: "payment-fee-mismatch",
      level: "warning",
      fields: ["gateway.feeAmount", "calculated.paymentFee"],
    },
  ]);
});

test("does not fail a bank-transfer order for a payment fee neither provider has a rate for", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-fee-0005",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "bank",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
  });
  await importDocument(
    request,
    camt053({
      entries: [
        {
          reference: "2026090200000015-1",
          amount: "5.20",
          direction: "CRDT",
          bookingDate: "2026-09-02",
          counterpartyName: "some buyer",
          remittance: "order owl-fee-0005",
        },
      ],
    }),
  );

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.feeAmount).toBeNull();
  expect(body.orders[0].calculated.paymentFee).toBeNull();
  expect(body.orders[0].failures).toEqual([]);
});
