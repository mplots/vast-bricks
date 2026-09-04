import { expect, test } from '../support/api-test';
import { BrickOwlOrderMock, mockReconciliationOrders } from '../support/reconciliation';
import { wireMockMode } from '../support/wiremock';

test.describe.configure({ mode: wireMockMode() });

test('lists BrickLink reconciliation orders for the selected month', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456563</ORDERID>
    <ORDERDATE>8/30/2026</ORDERDATE>
    <BUYER>some buyer</BUYER>
    <ORDERTOTAL>0.43</ORDERTOTAL>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    <BASEGRANDTOTAL>3.435</BASEGRANDTOTAL>
    <PAYMENTTYPE>Credit/Debit (Powered by Stripe)</PAYMENTTYPE>
    <ITEM>
      <ITEMID>3001</ITEMID>
      <PRICE>0.1000</PRICE>
      <QTY>2</QTY>
    </ITEM>
    <ITEM>
      <ITEMID>3002</ITEMID>
      <PRICE>0.2300</PRICE>
      <QTY>1</QTY>
    </ITEM>
  </ORDER>
  <ORDER>
    <ORDERID>32456564</ORDERID>
    <ORDERDATE>8/31/2026</ORDERDATE>
    <BUYER>another buyer</BUYER>
    <ORDERTOTAL>3.00</ORDERTOTAL>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    <PAYMENTTYPE>Bank Transfer</PAYMENTTYPE>
    <ITEM>
      <ITEMID>3003</ITEMID>
      <PRICE>1.0000</PRICE>
      <QTY>3</QTY>
    </ITEM>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456563</ORDERID>
    <BUYER>some-buyer-username</BUYER>
  </ORDER>
  <ORDER>
    <ORDERID>32456564</ORDERID>
    <BUYER>another-buyer-username</BUYER>
  </ORDER>
</ORDERS>`,
    },
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  await expect(response.json()).resolves.toEqual({
    selectedMonth: '2026-08',
    orders: [
      {
        source: 'BrickLink',
        orderId: '32456564',
        orderDate: '2026-08-31',
        buyer: 'another buyer',
        buyerUsername: 'another-buyer-username',
        paymentMethod: 'Bank Transfer',
        subTotal: 3,
        itemsSubTotal: 3,
        grandTotal: null,
        invoiceSubTotal: null,
        failures: [],
      },
      {
        source: 'BrickLink',
        orderId: '32456563',
        orderDate: '2026-08-30',
        buyer: 'some buyer',
        buyerUsername: 'some-buyer-username',
        paymentMethod: 'Stripe',
        subTotal: 0.43,
        itemsSubTotal: 0.43,
        grandTotal: 3.44,
        invoiceSubTotal: null,
        failures: [],
      },
    ],
  });
});

test('lists BrickOwl reconciliation orders for the selected month', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickOwl: [
      {
        orderId: 'test-order-0810',
        orderDate: '1786320000',
        view: {
          buyer_name: 'Test Buyer Alpha',
          customer_username: 'test_alpha',
          sub_total: '2.70',
          payment_method_type: 'paypal',
          base_order_total: '5.20',
        },
        items: [
          { base_price: '1.20', ordered_quantity: '2' },
          { base_price: '0.30', ordered_quantity: '1' },
        ],
      },
      {
        orderId: 'test-order-0811',
        orderDate: '1786406400',
        view: { buyer_name: 'Test Buyer Beta', customer_username: 'test_beta', sub_total: '6.00' },
        items: [{ base_price: '2.00', ordered_quantity: '3' }],
      },
      {
        orderId: 'test-order-0901',
        orderDate: '1788220800',
        view: { buyer_name: 'Test Buyer Gamma', customer_username: 'test_gamma', sub_total: '9.99' },
        items: [{ base_price: '9.99', ordered_quantity: '1' }],
      },
    ],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  await expect(response.json()).resolves.toEqual({
    selectedMonth: '2026-08',
    orders: [
      {
        source: 'BrickOwl',
        orderId: 'test-order-0811',
        orderDate: '2026-08-11',
        buyer: 'Test Buyer Beta',
        buyerUsername: 'test_beta',
        paymentMethod: null,
        subTotal: 6,
        itemsSubTotal: 6,
        grandTotal: null,
        invoiceSubTotal: null,
        failures: [],
      },
      {
        source: 'BrickOwl',
        orderId: 'test-order-0810',
        orderDate: '2026-08-10',
        buyer: 'Test Buyer Alpha',
        buyerUsername: 'test_alpha',
        paymentMethod: 'PayPal',
        subTotal: 2.7,
        itemsSubTotal: 2.7,
        grandTotal: 5.2,
        invoiceSubTotal: null,
        failures: [],
      },
    ],
  });
});

test('lists BrickOwl reconciliation orders that span several batch requests', async ({
  request,
  settings,
}, testInfo) => {
  const brickOwlOrders: BrickOwlOrderMock[] = Array.from({ length: 60 }, (_, index) => ({
    orderId: `bulk-order-${index + 1}`,
    orderDate: '1786320000',
    view: { buyer_name: `Bulk Buyer ${index + 1}`, customer_username: `bulk_${index + 1}`, sub_total: '1.00' },
    items: [{ base_price: '0.50', ordered_quantity: '2' }],
  }));

  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickOwl: brickOwlOrders,
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders).toHaveLength(60);
  expect(body.orders[0]).toEqual({
    source: 'BrickOwl',
    orderId: 'bulk-order-1',
    orderDate: '2026-08-10',
    buyer: 'Bulk Buyer 1',
    buyerUsername: 'bulk_1',
    paymentMethod: null,
    subTotal: 1,
    itemsSubTotal: 1,
    grandTotal: null,
    invoiceSubTotal: null,
    failures: [],
  });
  expect(body.orders[59].orderId).toBe('bulk-order-60');

  const batchRequests = await wireMock.findMethodHostRequests('POST', '/v1/bulk/batch');
  expect(batchRequests).toHaveLength(4);
});

test('lists the reconciled orders of every provider newest first', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456570</ORDERID>
    <ORDERDATE>8/5/2026</ORDERDATE>
    <BUYER>early buyer</BUYER>
  </ORDER>
  <ORDER>
    <ORDERID>32456575</ORDERID>
    <ORDERDATE>8/25/2026</ORDERDATE>
    <BUYER>late buyer</BUYER>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    brickOwl: [
      {
        orderId: 'owl-order-0815',
        orderDate: '1786752000',
        view: { buyer_name: 'Middle Buyer' },
      },
    ],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  // The providers are collected one after another, so interleaved dates prove the whole list is sorted.
  expect(body.orders.map((order: { orderId: string; orderDate: string }) => [order.orderId, order.orderDate])).toEqual([
    ['32456575', '2026-08-25'],
    ['owl-order-0815', '2026-08-15'],
    ['32456570', '2026-08-05'],
  ]);
});

test('returns no reconciliation orders when no provider reports orders', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo);

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  await expect(response.json()).resolves.toEqual({
    selectedMonth: '2026-08',
    orders: [],
  });
});

test('rejects an invalid reconciliation month', async ({ request }) => {
  const response = await request.get('/api/private/reconciliation/orders?month=August-2026');

  expect(response.status(), await response.text()).toBe(400);
});

test('requires a reconciliation month', async ({ request }) => {
  const response = await request.get('/api/private/reconciliation/orders');

  expect(response.status(), await response.text()).toBe(400);
});
