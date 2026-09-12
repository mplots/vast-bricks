import { expect, test } from "../support/api-test";
import { mockReconciliationOrders } from "../support/reconciliation";
import { wireMockMode } from "../support/wiremock";

/**
 * What the payment gateway charged for taking an order's payment, reported beside what it paid. It is the store's own
 * cost rather than anything the buyer or the marketplace owes, which is why it is reported apart from the facilitator
 * tax the marketplace takes out of the same payment.
 */

test.describe.configure({ mode: wireMockMode() });

test("reports what Stripe charged for taking a payment, apart from what the marketplace took", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Alpha",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
          billing_country_code: "LV",
          tax_scheme_id: "1",
          tax_rate: "21",
        },
      },
    ],
    // Stripe deducts both from the one payment: its own processing fee, and the application fee the marketplace
    // takes back as tax facilitator.
    stripe: [
      {
        description: "Brick Owl Order test-order-0810",
        amount: 520,
        stripeFee: 33,
        applicationFee: 90,
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const [order] = (await response.json()).orders;
  expect(order.gateway).toMatchObject({
    paidAmount: 5.2,
    feeAmount: 0.33,
    facilitatorTax: 0.9,
  });
});

test("reports what PayPal charged for taking a payment, as what was taken rather than as a deduction", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0811",
        orderDate: "1786406400",
        view: {
          buyer_name: "Test Buyer Beta",
          payment_method_type: "paypal",
          sub_total: "6.00",
          base_order_total: "6.00",
        },
      },
    ],
    // PayPal states its fee as it hits the balance, negative; the report states what it took.
    payPal: [
      { invoiceId: "test-order-0811", amount: "6.00", feeAmount: "-0.51" },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const [order] = (await response.json()).orders;
  expect(order.gateway).toMatchObject({ paidAmount: 6, feeAmount: 0.51 });
});

test("reports no gateway fee for an order no payment was matched to", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0812",
        orderDate: "1786406400",
        view: { buyer_name: "Test Buyer Gamma", sub_total: "9.99" },
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const [order] = (await response.json()).orders;
  // Nothing was taken, so nothing was charged for taking it - never a zero, which would read as a free payment.
  expect(order.gateway).toMatchObject({ paidAmount: null, feeAmount: null });
});

test("the gateway fee is one of the fields the report says it collects", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  // The roster is what a screen builds its columns from, so a field it does not name is a field nothing can show.
  expect((await response.json()).fields).toContainEqual({
    name: "gateway.feeAmount",
    source: "gateway",
  });
});
