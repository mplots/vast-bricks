import { expect, test } from "../support/api-test";
import { mockReconciliationOrders } from "../support/reconciliation";
import { wireMockMode } from "../support/wiremock";

/**
 * What came back out of an order's PayPal payment, reported beside what it paid. PayPal states a refund as a
 * transaction of its own naming the payment it reverses, rather than as a running total on the payment the way
 * Stripe does, so what the report shows is the month's refunds read against the payment each was taken out of.
 */

test.describe.configure({ mode: wireMockMode() });

test("reports what PayPal refunded out of a payment, as what came back rather than as a deduction", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0820",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Alpha",
          payment_method_type: "paypal",
          status: "Cancelled",
          sub_total: "22.78",
          base_order_total: "33.03",
          refund_total: "33.03",
        },
      },
    ],
    payPal: [
      {
        transactionId: "test-paypal-payment-0820",
        invoiceId: "test-order-0820",
        amount: "33.03",
      },
      // A refund leaves the balance, so PayPal states it negative; the report states what came back to the buyer.
      {
        eventCode: "T1107",
        referenceId: "test-paypal-payment-0820",
        amount: "-33.03",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const [order] = (await response.json()).orders;
  expect(order.gateway).toMatchObject({ paidAmount: 33.03, refundedAmount: 33.03 });
  // Both sides account for the same refund, so the rule holding them against each other has nothing to report.
  expect(order.failures).not.toContainEqual(
    expect.objectContaining({ code: "refunded-amount-mismatch" }),
  );
});

test("sums the refunds PayPal took out of one payment", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0821",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Beta",
          payment_method_type: "paypal",
          sub_total: "18.00",
          base_order_total: "20.00",
          refund_total: "7.50",
        },
      },
    ],
    // An order refunded in parts is refunded twice against the one payment, and what came back is both parts.
    payPal: [
      {
        transactionId: "test-paypal-payment-0821",
        invoiceId: "test-order-0821",
        amount: "20.00",
      },
      {
        eventCode: "T1107",
        referenceId: "test-paypal-payment-0821",
        amount: "-2.50",
      },
      {
        eventCode: "T1107",
        referenceId: "test-paypal-payment-0821",
        amount: "-5.00",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const [order] = (await response.json()).orders;
  expect(order.gateway).toMatchObject({ paidAmount: 20, refundedAmount: 7.5 });
});

test("reports no refund on a PayPal payment no refund names", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0822",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Gamma",
          payment_method_type: "paypal",
          sub_total: "9.00",
          base_order_total: "9.00",
        },
      },
      {
        orderId: "test-order-0823",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Delta",
          payment_method_type: "paypal",
          sub_total: "11.00",
          base_order_total: "11.00",
          refund_total: "11.00",
        },
      },
    ],
    payPal: [
      {
        transactionId: "test-paypal-payment-0822",
        invoiceId: "test-order-0822",
        amount: "9.00",
      },
      {
        transactionId: "test-paypal-payment-0823",
        invoiceId: "test-order-0823",
        amount: "11.00",
      },
      {
        eventCode: "T1107",
        referenceId: "test-paypal-payment-0823",
        amount: "-11.00",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const orders: Record<string, { gateway: { refundedAmount: number | null } }> =
    Object.fromEntries(
      (await response.json()).orders.map(
        (order: { order: { orderId: string } }) => [order.order.orderId, order],
      ),
    );
  // A refund names the one payment it was taken out of, so the unrefunded order beside it stays absent rather than
  // zeroed: nothing came back is a different fact from a refund of nothing.
  expect(orders["test-order-0822"].gateway.refundedAmount).toBeNull();
  expect(orders["test-order-0823"].gateway.refundedAmount).toBe(11);
});
