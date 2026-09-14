import { expect, test } from '../support/api-test';
import { archiveBaseDirectory } from '../support/order-archive';
import { archiveDirectory, writeBrickLinkArchive, writeBrickOwlOrder } from '../support/order-import';
import { mockReconciliationOrders } from '../support/reconciliation';
import { wireMockMode } from '../support/wiremock';

/**
 * The stored copy of an order, held against what the marketplace still says about it.
 *
 * <p>Every other rule on the report holds two different parties against each other. These hold one party against
 * itself across time: the orders table is the marketplace's own account as the store archived it, and the report
 * collects that same account live. The two drifting apart means either the order changed after it was archived or
 * the archive is being read differently, and both are worth a reader seeing.
 */

test.describe.configure({ mode: wireMockMode() });

const orderId = 32456590;
const month = '2026-08';

/** The order as the marketplace still reports it, which is what the report collects live. */
function collectedOrder(options: { buyer: string; items: number; total: string }) {
  return {
    month,
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>${orderId}</ORDERID>
    <ORDERDATE>8/12/2026</ORDERDATE>
    <BUYER>${options.buyer}</BUYER>
    <ORDERITEMS>${options.items}</ORDERITEMS>
    <ORDERLOTS>3</ORDERLOTS>
    <ORDERTOTAL>10.00</ORDERTOTAL>
    <ORDERSHIPPING>2.50</ORDERSHIPPING>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    <BASEGRANDTOTAL>${options.total}</BASEGRANDTOTAL>
    <PAYCURRENCYCODE>EUR</PAYCURRENCYCODE>
    <PAYMENTTYPE>PayPal (Onsite)</PAYMENTTYPE>
    <VATCHARGES>0.00</VATCHARGES>
    <ORDERSALESTAX>0.00</ORDERSALESTAX>
    <ORDERVAT>0.00</ORDERVAT>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`
    }
  };
}

/**
 * The same order as the archive kept it, imported into the orders table by the job.
 *
 * <p>The buyer's name is stated on the API record's shipping address and nowhere else, which is the one place the
 * archive keeps it: the accounting export names a buyer by their account whatever it is asked for.
 */
async function storeOrder(
  request: Parameters<typeof mockReconciliationOrders>[1],
  settings: { set: (key: string, value: string) => Promise<void> },
  tenantCode: string,
  archived: { shippedTo: string; items: number; total: string }
) {
  const base = archiveBaseDirectory();
  await settings.set('VAST_ORDER_ARCHIVE_DIR', base);
  writeBrickLinkArchive(archiveDirectory(base, tenantCode), {
    orderId,
    archivedAt: '2026-08-12T09:00:00.000Z',
    shippedTo: archived.shippedTo,
    buyerName: 'brickfan_marta',
    accounting: {
      orderDate: '8/12/2026',
      buyer: 'brickfan_marta',
      items: archived.items,
      lots: 3,
      subTotal: '10.00',
      shipping: '2.50',
      grandTotal: archived.total,
      paymentType: 'PayPal (Onsite)',
      paymentCurrency: 'EUR'
    }
  });

  expect((await request.post('/api/private/jobs/order-import/run')).status()).toBe(202);
  await expect
    .poll(async () => (await (await request.get('/api/private/jobs/order-import')).json()).lastRun?.outcome, { timeout: 30_000 })
    .toBe('succeeded');
}

async function reconciled(request: Parameters<typeof mockReconciliationOrders>[1]) {
  const response = await request.get(`/api/private/reconciliation/orders?month=${month}`);
  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  return body.orders[0];
}

test('a stored order that agrees with the marketplace reports nothing', async ({ request, settings, authentication }, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, collectedOrder({ buyer: 'Marta Ozola', items: 7, total: '12.50' }));
  await storeOrder(request, settings, authentication.tenant.code, { shippedTo: 'Marta Ozola', items: 7, total: '12.50' });

  const order = await reconciled(request);
  expect(order.stored.present).toBe(true);
  expect(order.stored.buyer).toBe('Marta Ozola');
  expect(order.stored.grandTotal).toBe(12.5);
  // The two accounts of one order say the same thing, which is the whole of what these rules ask.
  expect(order.failures.filter((failure: { code: string }) => failure.code === 'stored-field-mismatch')).toEqual([]);
});

test('a field the stored order disagrees about is reported, naming both accounts of it', async ({
  request,
  settings,
  authentication
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, collectedOrder({ buyer: 'Marta Ozola', items: 7, total: '12.50' }));
  // The order was archived before the buyer corrected the name on their address and before two items were added.
  await storeOrder(request, settings, authentication.tenant.code, { shippedTo: 'M. Ozola', items: 5, total: '12.50' });

  const order = await reconciled(request);
  const mismatches = order.failures.filter((failure: { code: string }) => failure.code === 'stored-field-mismatch');

  // One failure per field that drifted, each citing the pair, so a screen can show both values side by side.
  expect(mismatches).toEqual([
    { code: 'stored-field-mismatch', level: 'warning', fields: ['order.buyer', 'stored.buyer'] },
    { code: 'stored-field-mismatch', level: 'warning', fields: ['order.itemCount', 'stored.itemCount'] }
  ]);
  // The amounts agree, so nothing is said about them.
  expect(mismatches.map((failure: { fields: string[] }) => failure.fields[0])).not.toContain('order.grandTotal');
});

test('an amount written to a different scale is not a disagreement', async ({ request, settings, authentication }, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, collectedOrder({ buyer: 'Marta Ozola', items: 7, total: '12.5' }));
  await storeOrder(request, settings, authentication.tenant.code, { shippedTo: 'Marta Ozola', items: 7, total: '12.50' });

  const order = await reconciled(request);
  // One amount written two ways, which is a scale a provider happened to send rather than a drift.
  expect(order.failures.filter((failure: { code: string }) => failure.code === 'stored-field-mismatch')).toEqual([]);
});

test('an order nothing was stored for is not compared at all', async ({ request, settings }, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, collectedOrder({ buyer: 'Marta Ozola', items: 7, total: '12.50' }));
  // No import has run, so the orders table holds nothing for this order.

  const order = await reconciled(request);
  expect(order.stored.present).toBe(false);
  // An order placed since the last import has not drifted - it has not been imported - so the rules stay quiet and
  // the empty stored columns beside the row are what says so.
  expect(order.failures.filter((failure: { code: string }) => failure.code === 'stored-field-mismatch')).toEqual([]);
});

/**
 * The order date of a BrickOwl order placed late in the evening.
 *
 * <p>This is the drift the rules were first pointed at, and it was theirs to find: BrickOwl states one moment as
 * epoch seconds in its order list and as a London wall clock in the order itself, and the two were being read
 * apart. An order placed after ten at night came out a day later on one side than the other, which is why only
 * some orders disagreed and why they were all placed at the same hour.
 */
const owlOrderId = '1600042';
// 23:25 in London on the tenth, which is 22:25 UTC on the tenth - and was the eleventh in Riga.
const owlPlacedAt = Date.parse('2026-07-10T23:25:19+01:00') / 1000;

test('a BrickOwl order placed late in the evening is dated the same on both sides', async ({
  request,
  settings,
  authentication
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-07',
    brickOwl: [
      {
        orderId: owlOrderId,
        // The list states the moment as epoch seconds, which is the side the live report reads.
        orderDate: String(owlPlacedAt),
        view: {
          buyer_name: 'Ilze Zarina',
          // The order states the same moment as a London wall clock, which is the side the archive kept.
          iso_order_time: '2026-07-10T23:25:19+01:00',
          order_time: String(owlPlacedAt),
          updated_time: String(owlPlacedAt),
          base_order_total: '24.10',
          base_currency: 'EUR'
        }
      }
    ]
  });

  const base = archiveBaseDirectory();
  await settings.set('VAST_ORDER_ARCHIVE_DIR', base);
  writeBrickOwlOrder(archiveDirectory(base, authentication.tenant.code), {
    orderId: owlOrderId,
    archivedAt: '2026-07-10T23:25:19',
    orderTime: '2026-07-10T23:25:19',
    offset: '+01:00',
    buyerName: 'Ilze Zarina',
    baseOrderTotal: '24.10'
  });

  expect((await request.post('/api/private/jobs/order-import/run')).status()).toBe(202);
  await expect
    .poll(async () => (await (await request.get('/api/private/jobs/order-import')).json()).lastRun?.outcome, { timeout: 30_000 })
    .toBe('succeeded');

  const response = await request.get('/api/private/reconciliation/orders?month=2026-07');
  expect(response.status(), await response.text()).toBe(200);
  const order = (await response.json()).orders[0];

  // The same day on both sides, and the day the moment actually falls on in UTC.
  expect(order.order.orderDate).toBe('2026-07-10');
  expect(order.stored.orderDate).toBe('2026-07-10');
  expect(order.failures.filter((failure: { fields: string[] }) => failure.fields.includes('order.orderDate'))).toEqual([]);
});
