import { expect, test } from '../support/api-test';
import { BrickOwlOrderMock, mockReconciliationOrders } from '../support/reconciliation';
import { wireMockMode } from '../support/wiremock';

test.describe.configure({ mode: wireMockMode() });

const brickLinkPayPalOrdersXml = (orders: Array<{ orderId: string; buyer: string; total: string }>) =>
  `<?xml version="1.0" encoding="UTF-8"?><ORDERS>${orders
    .map(
      (order) => `
  <ORDER>
    <ORDERID>${order.orderId}</ORDERID>
    <ORDERDATE>8/30/2026</ORDERDATE>
    <BUYER>${order.buyer}</BUYER>
    <ORDERTOTAL>${order.total}</ORDERTOTAL>
    <BASEGRANDTOTAL>${order.total}</BASEGRANDTOTAL>
    <PAYMENTTYPE>PayPal (Onsite)</PAYMENTTYPE>
    <ITEM><ITEMID>3001</ITEMID><PRICE>${order.total}</PRICE><QTY>1</QTY></ITEM>
  </ORDER>`
    )
    .join('')}</ORDERS>`;

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
    <LOCATION>Latvia, Riga</LOCATION>
    <VATCHARGES>0.07</VATCHARGES>
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
        taxType: null,
        facilitatorTax: null,
        subTotal: 3,
        itemsSubTotal: 3,
        grandTotal: null,
        invoiceSubTotal: null,
        paidAmount: null,
        failures: [{ code: 'amount-missing', level: 'error', fields: ['paidAmount'] }],
      },
      {
        source: 'BrickLink',
        orderId: '32456563',
        orderDate: '2026-08-30',
        buyer: 'some buyer',
        buyerUsername: 'some-buyer-username',
        paymentMethod: 'Stripe',
        taxType: 'domestic',
        facilitatorTax: null,
        subTotal: 0.43,
        itemsSubTotal: 0.43,
        grandTotal: 3.44,
        invoiceSubTotal: null,
        paidAmount: null,
        // Paid through Stripe, but no Stripe payment names this order.
        failures: [{ code: 'amount-missing', level: 'error', fields: ['paidAmount'] }],
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
          billing_country_code: 'LV',
          tax_scheme_id: '1',
          tax_rate: '21',
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
        taxType: null,
        facilitatorTax: null,
        subTotal: 6,
        itemsSubTotal: 6,
        grandTotal: null,
        invoiceSubTotal: null,
        paidAmount: null,
        failures: [{ code: 'amount-missing', level: 'error', fields: ['paidAmount'] }],
      },
      {
        source: 'BrickOwl',
        orderId: 'test-order-0810',
        orderDate: '2026-08-10',
        buyer: 'Test Buyer Alpha',
        buyerUsername: 'test_alpha',
        paymentMethod: 'PayPal',
        taxType: 'domestic',
        facilitatorTax: null,
        subTotal: 2.7,
        itemsSubTotal: 2.7,
        grandTotal: 5.2,
        invoiceSubTotal: null,
        paidAmount: null,
        // Paid through PayPal, but no PayPal payment names this order.
        failures: [{ code: 'amount-missing', level: 'error', fields: ['paidAmount'] }],
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
    taxType: null,
    facilitatorTax: null,
    subTotal: 1,
    itemsSubTotal: 1,
    grandTotal: null,
    invoiceSubTotal: null,
    paidAmount: null,
    failures: [{ code: 'amount-missing', level: 'error', fields: ['paidAmount'] }],
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

test('reports what Stripe was paid for a BrickOwl order named in the payment description', async ({
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
          payment_method_type: 'stripe',
          sub_total: '5.20',
          base_order_total: '5.20',
        },
        items: [{ base_price: '5.20', ordered_quantity: '1' }],
      },
    ],
    stripe: [{ description: 'Brick Owl Order test-order-0810', amount: 520 }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].paidAmount).toBe(5.2);
  expect(body.orders[0].failures).toEqual([]);
});

test('reports what Stripe was paid for a BrickLink order by the buyer username in the payment description', async ({
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
    <ORDERTOTAL>3.44</ORDERTOTAL>
    <BASEGRANDTOTAL>3.44</BASEGRANDTOTAL>
    <PAYMENTTYPE>Credit/Debit (Powered by Stripe)</PAYMENTTYPE>
    <ITEM>
      <ITEMID>3001</ITEMID>
      <PRICE>3.4400</PRICE>
      <QTY>1</QTY>
    </ITEM>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456563</ORDERID>
    <BUYER>some-buyer-username</BUYER>
  </ORDER>
</ORDERS>`,
    },
    stripe: [{ description: 'Payment for BrickLink from some-buyer-username', amount: 344, type: 'payment' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].paidAmount).toBe(3.44);
  expect(body.orders[0].failures).toEqual([]);
});

test('tells one buyer\'s BrickLink orders apart by what the Stripe payment took', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: '32456563', buyer: 'some buyer', total: '38.80' },
        { orderId: '32456564', buyer: 'some buyer', total: '3.44' },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER><ORDERID>32456563</ORDERID><BUYER>some-buyer-username</BUYER></ORDER>
  <ORDER><ORDERID>32456564</ORDERID><BUYER>some-buyer-username</BUYER></ORDER>
</ORDERS>`,
    },
    stripe: [{ description: 'Payment for BrickLink from some-buyer-username', amount: 344, type: 'payment' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  const paid = Object.fromEntries(
    body.orders.map((order: { orderId: string; paidAmount: number | null }) => [order.orderId, order.paidAmount])
  );
  expect(paid).toEqual({ '32456563': null, '32456564': 3.44 });
});

test('reports no paid amount when several BrickLink orders share the buyer the payment names', async ({
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
  </ORDER>
  <ORDER>
    <ORDERID>32456564</ORDERID>
    <ORDERDATE>8/31/2026</ORDERDATE>
    <BUYER>some buyer</BUYER>
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
    <BUYER>some-buyer-username</BUYER>
  </ORDER>
</ORDERS>`,
    },
    stripe: [{ description: 'Payment for BrickLink from some-buyer-username', amount: 344, type: 'payment' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders.map((order: { paidAmount: number | null }) => order.paidAmount)).toEqual([null, null]);
});

test('reports no paid amount from Stripe fee and refund transactions that name an order', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickOwl: [
      {
        orderId: 'test-order-0810',
        orderDate: '1786320000',
        view: { buyer_name: 'Test Buyer Alpha', base_order_total: '5.20' },
      },
    ],
    stripe: [
      { description: 'Brick Owl Order test-order-0810', amount: -30, type: 'stripe_fee' },
      { description: 'REFUND FOR CHARGE (Brick Owl Order test-order-0810)', amount: -520, type: 'refund' },
    ],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].paidAmount).toBeNull();
});

test('reports no paid amount when no Stripe payment names the order', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickOwl: [
      {
        orderId: 'test-order-0810',
        orderDate: '1786320000',
        view: { buyer_name: 'Test Buyer Alpha', base_order_total: '5.20' },
      },
    ],
    stripe: [{ description: 'Brick Owl Order some-other-order', amount: 520 }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].paidAmount).toBeNull();
});

test('collects Stripe payments that span several pages', async ({ request, settings }, testInfo) => {
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickOwl: [
      { orderId: 'owl-order-1', orderDate: '1786320000', view: { buyer_name: 'First Buyer' } },
      { orderId: 'owl-order-2', orderDate: '1786320000', view: { buyer_name: 'Second Buyer' } },
    ],
    stripePages: [
      [{ description: 'Brick Owl Order owl-order-1', amount: 100 }],
      [{ description: 'Brick Owl Order owl-order-2', amount: 250 }],
    ],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  const paidByOrder = Object.fromEntries(
    body.orders.map((order: { orderId: string; paidAmount: number | null }) => [order.orderId, order.paidAmount])
  );
  expect(paidByOrder).toEqual({ 'owl-order-1': 1, 'owl-order-2': 2.5 });

  const balanceTransactionRequests = await wireMock.findMethodHostRequests('GET', '/v1/balance_transactions');
  expect(balanceTransactionRequests).toHaveLength(2);
});

test('reports a bad gateway when Stripe fails', async ({ request, settings }, testInfo) => {
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, { month: '2026-08' });
  await wireMock.addMethodHostMapping('GET', '/v1/balance_transactions', {
    response: { status: 500, json: { error: { message: 'Stripe is unavailable' } } },
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(502);
});

test('reports what PayPal was paid for a BrickOwl order it labelled with the order number', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickOwl: [
      {
        orderId: '7578233',
        orderDate: '1786320000',
        view: {
          buyer_name: 'Jonathan Pithioud',
          payment_method_type: 'paypal',
          sub_total: '7.69',
          base_order_total: '7.69',
        },
        items: [{ base_price: '7.69', ordered_quantity: '1' }],
      },
    ],
    payPal: [{ invoiceId: '7578233', payerName: 'Jonathan Pithioud', amount: '7.69' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].paidAmount).toBe(7.69);
  expect(body.orders[0].failures).toEqual([]);
});

test('reports what PayPal was paid for a BrickLink order by the buyer the payment names', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: '32456563', buyer: 'Riku Watanabe', total: '11.39' },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    // The payment spells the buyer with different casing and spacing than the order does.
    payPal: [{ payerName: 'riku  WATANABE', amount: '11.39' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].paidAmount).toBe(11.39);
  expect(body.orders[0].failures).toEqual([]);
});

test('reports what PayPal was paid for a BrickLink order by the shipping name when the payer is named otherwise', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: '32456563', buyer: 'Andris Konuss', total: '5.89' },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    payPal: [{ payerName: 'Someone Else', shippingName: 'Andris Konuss', amount: '5.89' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].paidAmount).toBe(5.89);
});

test('falls back to the amount and day when no name matches a BrickLink order', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: '32456563', buyer: 'Tom Copin', total: '23.06' },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    // 'Tom Com' is how PayPal spells this buyer; it matches no order, so the amount and the day decide.
    payPal: [{ payerName: 'Tom Com', amount: '23.06', initiatedAt: '2026-08-30T05:24:15Z' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].paidAmount).toBe(23.06);
});

test('reports no paid amount when the amount and day match several BrickLink orders', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: '32456563', buyer: 'First Buyer', total: '23.06' },
        { orderId: '32456564', buyer: 'Second Buyer', total: '23.06' },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    payPal: [{ payerName: 'Nobody Known', amount: '23.06', initiatedAt: '2026-08-30T05:24:15Z' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders.map((order: { paidAmount: number | null }) => order.paidAmount)).toEqual([null, null]);
});

test('tells one buyer\'s BrickLink orders apart by what the payment took', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: '32456563', buyer: 'Maksims Brezgins', total: '38.80' },
        { orderId: '32456564', buyer: 'Maksims Brezgins', total: '5.06' },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    // The buyer is known and ordered twice, so what the payment took says which of the two it settled.
    payPal: [{ payerName: 'Maksims Brezgins', amount: '38.80', initiatedAt: '2026-08-30T05:24:15Z' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  const paid = Object.fromEntries(
    body.orders.map((order: { orderId: string; paidAmount: number | null }) => [order.orderId, order.paidAmount])
  );
  expect(paid).toEqual({ '32456563': 38.8, '32456564': null });
});

test('reports no paid amount when one buyer\'s BrickLink orders came to the same amount', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: '32456563', buyer: 'Maksims Brezgins', total: '38.80' },
        { orderId: '32456564', buyer: 'Maksims Brezgins', total: '38.80' },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    // Neither the name nor the amount tells these two apart, and a guessed payment reads like a reconciled one.
    payPal: [{ payerName: 'Maksims Brezgins', amount: '38.80', initiatedAt: '2026-08-30T05:24:15Z' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders.map((order: { paidAmount: number | null }) => order.paidAmount)).toEqual([null, null]);
});

test('reports no paid amount from a PayPal fee, refund or withdrawal that names the buyer', async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: '32456563', buyer: 'Eden Lister', total: '11.78' },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    payPal: [
      { payerName: 'Eden Lister', amount: '11.78', eventCode: 'T0113' },
      { payerName: 'Eden Lister', amount: '11.78', eventCode: 'T0007' },
      { payerName: 'Eden Lister', amount: '11.78', eventCode: 'T0200' },
    ],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].paidAmount).toBeNull();
});

test('does not attach a PayPal payment to an order settled another way', async ({
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
    <BUYER>Bank Payer</BUYER>
    <ORDERTOTAL>7.00</ORDERTOTAL>
    <BASEGRANDTOTAL>7.00</BASEGRANDTOTAL>
    <PAYMENTTYPE>Bank Transfer</PAYMENTTYPE>
    <ITEM><ITEMID>3001</ITEMID><PRICE>7.0000</PRICE><QTY>1</QTY></ITEM>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    payPal: [{ payerName: 'Bank Payer', amount: '7.00' }],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].paidAmount).toBeNull();
  expect(body.orders[0].failures).toEqual([{ code: 'amount-missing', level: 'error', fields: ['paidAmount'] }]);
});

test('collects PayPal payments that span several pages', async ({ request, settings }, testInfo) => {
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickOwl: [
      {
        orderId: '7578233',
        orderDate: '1786320000',
        view: { buyer_name: 'First Buyer', payment_method_type: 'paypal' },
      },
      {
        orderId: '5120724',
        orderDate: '1786320000',
        view: { buyer_name: 'Second Buyer', payment_method_type: 'paypal' },
      },
    ],
    payPalPages: [
      [{ invoiceId: '7578233', amount: '7.69' }],
      [{ invoiceId: '5120724', amount: '7.71' }],
    ],
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  const paidByOrder = Object.fromEntries(
    body.orders.map((order: { orderId: string; paidAmount: number | null }) => [order.orderId, order.paidAmount])
  );
  expect(paidByOrder).toEqual({ '7578233': 7.69, '5120724': 7.71 });

  const transactionRequests = await wireMock.findMethodHostRequests('GET', '/v1/reporting/transactions');
  expect(transactionRequests).toHaveLength(2);
});

test('reports a bad gateway when PayPal fails', async ({ request, settings }, testInfo) => {
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, { month: '2026-08' });
  await wireMock.addMethodHostMapping('GET', '/v1/reporting/transactions', {
    response: { status: 500, json: { message: 'PayPal is unavailable' } },
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(502);
});

test('rejects an invalid reconciliation month', async ({ request }) => {
  const response = await request.get('/api/private/reconciliation/orders?month=August-2026');

  expect(response.status(), await response.text()).toBe(400);
});

test('requires a reconciliation month', async ({ request }) => {
  const response = await request.get('/api/private/reconciliation/orders');

  expect(response.status(), await response.text()).toBe(400);
});

test('sums item prices to the cent the order is reported in', async ({ request, settings }, testInfo) => {
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
});

test('collects the accounting invoice sub-total onto the order it notes', async ({
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
});

test('collects an accounting invoice noted in the legacy format', async ({ request, settings }, testInfo) => {
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
});
