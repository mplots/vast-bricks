import { expect, test } from '../support/api-test';
import { clearExchanges, providersOf, readExchanges, setRecording } from '../support/debug';
import { mockReconciliationOrders } from '../support/reconciliation';
import { createVastUser, deleteVastUser, vastTestPassword } from '../support/vast-db';
import { wireMockMode } from '../support/wiremock';

test.describe.configure({ mode: wireMockMode() });

const brickOwlOrders = [
  {
    orderId: 'test-order-0811',
    orderDate: '1786406400',
    view: { buyer_name: 'Test Buyer Beta', sub_total: '6.00' },
    items: [{ base_price: '2.00', ordered_quantity: '3' }],
  },
];

const reconcile = (request: Parameters<typeof readExchanges>[0]) =>
  request.get('/api/private/reconciliation/orders?month=2026-08');

test('records nothing until recording is armed', async ({ request, settings }, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, { month: '2026-08', brickOwl: brickOwlOrders });

  expect((await reconcile(request)).status()).toBe(200);

  expect(await readExchanges(request)).toEqual([]);
});

test('records the provider calls of a request made while recording', async ({ request, settings }, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, { month: '2026-08', brickOwl: brickOwlOrders });
  await setRecording(request, true);

  expect((await reconcile(request)).status()).toBe(200);

  const exchanges = await readExchanges(request);
  // Every provider the month touched is recorded, not just the one feature asked about.
  expect(providersOf(exchanges)).toEqual(['BrickLink', 'BrickOwl', 'Manakabata', 'PayPal', 'Stripe']);

  const orderList = exchanges.find((exchange) => exchange.url.includes('/v1/order/list'));
  expect(orderList?.provider).toBe('BrickOwl');
  expect(orderList?.statusCode).toBe(200);
  expect(JSON.parse(orderList?.responseBody ?? '')).toEqual([
    { order_id: 'test-order-0811', order_date: '1786406400' },
  ]);

  // The credentials that crossed the wire are masked before anything is stored.
  const traffic = JSON.stringify(exchanges);
  expect(traffic).not.toContain('test-brickowl-api-key');
  expect(traffic).toContain('key=***');
});

test('does not show one user the traffic of another', async ({ request, settings, baseURL, playwright }, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, { month: '2026-08', brickOwl: brickOwlOrders });
  await setRecording(request, true);
  expect((await reconcile(request)).status()).toBe(200);
  expect(await readExchanges(request)).not.toEqual([]);

  const onlooker = await createVastUser(`debug-onlooker-${testInfo.workerIndex}-${Date.now()}@example.test`);
  try {
    const login = await playwright.request.newContext({ baseURL });
    const loginResponse = await login.post('/api/account/login', {
      data: { email: onlooker.email, password: vastTestPassword },
    });
    const { serviceToken } = (await loginResponse.json()) as { serviceToken: string };
    await login.dispose();

    const onlookerRequest = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${serviceToken}` },
    });
    try {
      // Recording is per user, so the traffic of somebody else's request is not theirs to read.
      expect(await readExchanges(onlookerRequest)).toEqual([]);
    } finally {
      await onlookerRequest.dispose();
    }
  } finally {
    await deleteVastUser(onlooker.id);
  }
});

test('clears the traffic it recorded', async ({ request, settings }, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, { month: '2026-08', brickOwl: brickOwlOrders });
  await setRecording(request, true);
  expect((await reconcile(request)).status()).toBe(200);
  expect(await readExchanges(request)).not.toEqual([]);

  await clearExchanges(request);

  expect(await readExchanges(request)).toEqual([]);
});

test('masks a credential the provider issued mid-operation', async ({ request, settings }, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: '2026-08',
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
      // Credentials no other scenario uses, so BrickLink's session is created here rather than reused from the
      // client's cache and the session request is actually part of what gets recorded.
      clientToken: 'debug-scenario-client-token',
      sessionToken: 'debug-scenario-session-token',
    },
  });
  await setRecording(request, true);

  expect((await reconcile(request)).status()).toBe(200);

  const exchanges = await readExchanges(request);
  const session = exchanges.filter((exchange) => exchange.url.includes('/verify-and-create-session'));
  expect(session).not.toHaveLength(0);

  // The configured token is sent in the session request; the session token comes back in its response, so it is
  // only known after that response was already recorded.
  expect(session[0].requestBody).toContain('***');
  expect(session[0].responseBody).toContain('***');
  const traffic = JSON.stringify(exchanges);
  expect(traffic).not.toContain('debug-scenario-client-token');
  expect(traffic).not.toContain('debug-scenario-session-token');
});
