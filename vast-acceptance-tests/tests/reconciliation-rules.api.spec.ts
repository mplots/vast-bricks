import { expect, test } from './support/api-test';
import { mockReconciliationOrders } from './support/reconciliation';
import { wireMockMode } from './support/wiremock';

test.describe.configure({ mode: wireMockMode() });

const brickLinkOrderXml = (orderId: string, orderTotal: string, items: Array<[string, string]>) => `
  <ORDER>
    <ORDERID>${orderId}</ORDERID>
    <ORDERDATE>8/30/2026</ORDERDATE>
    <BUYER>some buyer</BUYER>
    <ORDERTOTAL>${orderTotal}</ORDERTOTAL>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    ${items.map(([price, quantity]) => `<ITEM><PRICE>${price}</PRICE><QTY>${quantity}</QTY></ITEM>`).join('\n    ')}
  </ORDER>`;

const brickLinkOrdersXml = (...orders: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><ORDERS>${orders.join('')}</ORDERS>`;

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
      usernameOrdersXml: '<?xml version="1.0" encoding="UTF-8"?><ORDERS/>',
    },
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders.map((order: { orderId: string }) => order.orderId)).toEqual(['32456563', '32456564']);
  expect(body.orders[0].failures).toEqual([]);
  expect(body.orders[1].failures).toEqual([
    {
      rule: 'subTotalMatchesItemsSubTotal',
      message: 'Order sub-total 10.00 does not match the items sub-total 3.00.',
    },
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
      usernameOrdersXml: '<?xml version="1.0" encoding="UTF-8"?><ORDERS/>',
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
  expect(body.orders[0].failures).toEqual([
    { rule: 'subTotalMatchesItemsSubTotal', message: 'Items sub-total is missing.' },
  ]);
  expect(body.orders[1].failures).toEqual([
    { rule: 'subTotalMatchesItemsSubTotal', message: 'Order sub-total is missing.' },
  ]);
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
      usernameOrdersXml: '<?xml version="1.0" encoding="UTF-8"?><ORDERS/>',
    },
  });

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].itemsSubTotal).toBe(0.43);
  expect(body.orders[0].failures).toEqual([]);
});
