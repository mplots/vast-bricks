import { expect, test } from '../support/api-test';
import { mockReconciliationOrders } from '../support/reconciliation';
import { wireMockMode } from '../support/wiremock';

test.describe.configure({ mode: wireMockMode() });

const brickLinkOrderXml = (
  orderId: string,
  orderTotal: string,
  items: Array<[string, string]>,
  orderDate = '8/30/2026'
) => `
  <ORDER>
    <ORDERID>${orderId}</ORDERID>
    <ORDERDATE>${orderDate}</ORDERDATE>
    <BUYER>some buyer</BUYER>
    <ORDERTOTAL>${orderTotal}</ORDERTOTAL>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    ${items.map(([price, quantity]) => `<ITEM><PRICE>${price}</PRICE><QTY>${quantity}</QTY></ITEM>`).join('\n    ')}
  </ORDER>`;

const brickLinkOrdersXml = (...orders: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><ORDERS>${orders.join('')}</ORDERS>`;

const emptyOrdersXml = brickLinkOrdersXml();

test('fails an order whose sub-total does not match its items sub-total', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(
        brickLinkOrderXml('32456563', '5.00', [['2.5000', '2']]),
        brickLinkOrderXml('32456564', '10.00', [['1.0000', '3']])
      ),
      usernameOrdersXml: emptyOrdersXml,
    },
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders.map((order: { orderId: string }) => order.orderId)).toEqual(['32456563', '32456564']);
  expect(body.orders[0].failures).toEqual([]);
  expect(body.orders[1].failures).toEqual([
    { code: 'sub-total-mismatch', level: 'info', fields: ['subTotal', 'itemsSubTotal'] },
  ]);
});

test('fails an order that is missing an amount the rule needs', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(brickLinkOrderXml('32456565', '5.00', [])),
      usernameOrdersXml: emptyOrdersXml,
    },
    brickOwl: [
      {
        orderId: 'test-order-0810',
        orderDate: '1786320000',
        view: { buyer_name: 'Test Buyer Alpha', customer_username: 'test_alpha' },
        items: [{ base_price: '1.20', ordered_quantity: '2' }],
      },
    ],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].failures).toEqual([{ code: 'amount-missing', level: 'info', fields: ['itemsSubTotal'] }]);
  expect(body.orders[1].failures).toEqual([{ code: 'amount-missing', level: 'info', fields: ['subTotal'] }]);
});

test('reconciles amounts that differ only below the cent', async ({ request, settings }, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(
        brickLinkOrderXml('32456566', '0.43', [
          ['0.1013', '2'],
          ['0.2299', '1'],
        ])
      ),
      usernameOrdersXml: emptyOrdersXml,
    },
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].itemsSubTotal).toBe(0.43);
  expect(body.orders[0].failures).toEqual([]);
});

test('reconciles an order whose accounting invoice sub-total matches its amounts', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-09',
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(brickLinkOrderXml('32466549', '5.00', [['2.5000', '2']], '9/1/2026')),
      usernameOrdersXml: emptyOrdersXml,
    },
    manakabata: [{ invoiceNote: 'bricklink:32466549', subtotal: '5.00' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-09');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].invoiceSubTotal).toBe(5);
  expect(body.orders[0].failures).toEqual([]);
});

test('fails an order whose accounting invoice sub-total does not match its amounts', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-09',
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(brickLinkOrderXml('32466550', '5.00', [['2.5000', '2']], '9/1/2026')),
      usernameOrdersXml: emptyOrdersXml,
    },
    manakabata: [{ invoiceNote: 'bricklink:32466550', subtotal: '4.00' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-09');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].invoiceSubTotal).toBe(4);
  expect(body.orders[0].failures).toEqual([
    { code: 'invoice-sub-total-mismatch', level: 'info', fields: ['invoiceSubTotal', 'subTotal'] },
    { code: 'invoice-items-sub-total-mismatch', level: 'info', fields: ['invoiceSubTotal', 'itemsSubTotal'] },
  ]);
});

test('fails an order that has no accounting invoice', async ({ request, settings }, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-09',
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(brickLinkOrderXml('32466551', '5.00', [['2.5000', '2']], '9/1/2026')),
      usernameOrdersXml: emptyOrdersXml,
    },
    manakabata: [{ invoiceNote: 'bricklink:99999999', subtotal: '5.00' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-09');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].invoiceSubTotal).toBeNull();
  expect(body.orders[0].failures).toEqual([{ code: 'amount-missing', level: 'info', fields: ['invoiceSubTotal'] }]);
});

test('does not require an accounting invoice for an order placed before invoicing started', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(brickLinkOrderXml('32466552', '5.00', [['2.5000', '2']], '8/31/2026')),
      usernameOrdersXml: emptyOrdersXml,
    },
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].invoiceSubTotal).toBeNull();
  expect(body.orders[0].failures).toEqual([]);
});

test('reconciles an order invoiced under the legacy invoice note format', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-09',
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(brickLinkOrderXml('32466553', '5.00', [['2.5000', '2']], '9/1/2026')),
      usernameOrdersXml: emptyOrdersXml,
    },
    manakabata: [{ invoiceNote: 'BrickLink order 32466553', subtotal: '5.00' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-09');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].invoiceSubTotal).toBe(5);
  expect(body.orders[0].failures).toEqual([]);
});

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

test('does not judge the paid amount of an order paid outside the collected providers', async ({
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
          // No payments are collected for a bank transfer, so there is nothing to hold this order against.
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
  expect(body.orders[0].failures).toEqual([]);
});
