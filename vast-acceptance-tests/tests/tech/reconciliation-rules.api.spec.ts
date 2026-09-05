import { expect, test } from '../support/api-test';
import { mockReconciliationOrders } from '../support/reconciliation';
import { wireMockMode } from '../support/wiremock';

test.describe.configure({ mode: wireMockMode() });

test('fails a Stripe-paid order that was paid another amount than its grand total', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickOwl: [
      {
        orderId: 'owl-order-0810',
        orderDate: '1786320000',
        view: {
          buyer_name: 'some buyer',
          payment_method_type: 'stripe',
          sub_total: '5.20',
          base_order_total: '5.20',
        },
        items: [{ base_price: '5.20', ordered_quantity: '1' }],
      },
    ],
    stripe: [{ description: 'Brick Owl Order owl-order-0810', amount: 500 }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].paidAmount).toBe(5);
  expect(body.orders[0].failures).toEqual([
    { code: 'paid-amount-mismatch', level: 'error', fields: ['paidAmount', 'grandTotal'] },
  ]);
});

test('fails a Stripe-paid order no payment was collected for', async ({ request, settings }, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickOwl: [
      {
        orderId: 'owl-order-0810',
        orderDate: '1786320000',
        view: {
          buyer_name: 'some buyer',
          payment_method_type: 'stripe',
          sub_total: '5.20',
          base_order_total: '5.20',
        },
        items: [{ base_price: '5.20', ordered_quantity: '1' }],
      },
    ],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].paidAmount).toBeNull();
  expect(body.orders[0].failures).toEqual([{ code: 'amount-missing', level: 'error', fields: ['paidAmount'] }]);
});

test('fails an order paid outside the collected providers that no payment was collected for', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickOwl: [
      {
        orderId: 'owl-order-0810',
        orderDate: '1786320000',
        view: {
          buyer_name: 'some buyer',
          // No payments are collected for a bank transfer, so nothing can show this order was ever paid.
          payment_method_type: 'bank_transfer',
          sub_total: '5.20',
          base_order_total: '5.20',
        },
        items: [{ base_price: '5.20', ordered_quantity: '1' }],
      },
    ],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].paidAmount).toBeNull();
  expect(body.orders[0].failures).toEqual([{ code: 'amount-missing', level: 'error', fields: ['paidAmount'] }]);
});
