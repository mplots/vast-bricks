import { expect, test } from './support/api-test';
import { mockBrickLinkOrders } from './support/bricklink';
import { wireMockMode } from './support/wiremock';

test.describe.configure({ mode: wireMockMode() });

test('lists BrickLink reconciliation orders for the selected month', async ({
  request,
  settings,
}, testInfo) => {
  await mockBrickLinkOrders(settings, request, testInfo, `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456563</ORDERID>
    <ORDERDATE>8/30/2026</ORDERDATE>
    <BUYER>some buyer</BUYER>
    <ORDERSHIPPING>5.51</ORDERSHIPPING>
    <ORDERINSURANCE></ORDERINSURANCE>
    <ORDERADDCHRG1>2.42</ORDERADDCHRG1>
    <ORDERADDCHRG2></ORDERADDCHRG2>
    <ORDERCREDIT></ORDERCREDIT>
    <ORDERCREDITCOUPON></ORDERCREDITCOUPON>
    <ORDERTOTAL>0.43</ORDERTOTAL>
    <ORDERSALESTAX>0.00</ORDERSALESTAX>
    <ORDERVAT>0.00</ORDERVAT>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    <BASEGRANDTOTAL>8.36</BASEGRANDTOTAL>
    <PAYCURRENCYCODE>EUR</PAYCURRENCYCODE>
    <ORDERLOTS>2</ORDERLOTS>
    <ORDERITEMS>4</ORDERITEMS>
    <ORDERSTATUS>Packed</ORDERSTATUS>
    <PAYMENTTYPE>Credit/Debit (Powered by Stripe)</PAYMENTTYPE>
    <ORDERREMARKS></ORDERREMARKS>
    <ORDERTRACKNO></ORDERTRACKNO>
    <LOCATION>Belgium, West-Vlaanderen</LOCATION>
    <VATCHARGES>1.45</VATCHARGES>
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
    <ORDERTOTAL>10.00</ORDERTOTAL>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    <ITEM>
      <ITEMID>3003</ITEMID>
      <PRICE>1.0000</PRICE>
      <QTY>3</QTY>
    </ITEM>
  </ORDER>
</ORDERS>`, `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456563</ORDERID>
    <BUYER>some-buyer-username</BUYER>
  </ORDER>
  <ORDER>
    <ORDERID>32456564</ORDERID>
    <BUYER>another-buyer-username</BUYER>
  </ORDER>
</ORDERS>`);

  const response = await request.get('/api/private/reconciliation/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  await expect(response.json()).resolves.toEqual({
    selectedMonth: '2026-08',
    orders: [
      {
        source: 'BrickLink',
        orderId: '32456563',
        buyer: 'some buyer',
        buyerUsername: 'some-buyer-username',
        subTotal: 0.43,
        itemsSubTotal: 0.43,
      },
      {
        source: 'BrickLink',
        orderId: '32456564',
        buyer: 'another buyer',
        buyerUsername: 'another-buyer-username',
        subTotal: 10,
        itemsSubTotal: 3,
      },
    ],
  });
});

test('returns no reconciliation orders for an empty BrickStore export', async ({
  request,
  settings,
}, testInfo) => {
  await mockBrickLinkOrders(
    settings,
    request,
    testInfo,
    '<?xml version="1.0" encoding="UTF-8"?><ORDERS/>',
    '<?xml version="1.0" encoding="UTF-8"?><ORDERS/>'
  );

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
