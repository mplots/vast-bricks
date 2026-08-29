import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from './support/api-test';
import { WireMockApi, wireMockMode } from './support/wiremock';

test.describe.configure({ mode: wireMockMode() });

test('brickstore order endpoint returns an order fetched from BrickStore XML export', async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();

  await settings.set('VAST_BRICKSTORE_BASE_URL', wireMock.baseUrl);
  await settings.set('VAST_BRICKSTORE_TOKEN', 'playwright-client-token');

  await wireMock.addMethodHostMapping('POST', '/api/v1/actions/verify-and-create-session', {
    request: {
      bodyPatterns: [
        { contains: '"clientId":"ca629c09-4d8c-45dc-8a6f-bfb2b058f720"' },
        { contains: '"clientToken":"playwright-client-token"' },
      ],
    },
    response: {
      json: {
        sessionToken: 'playwright-session-token',
      },
    },
  });
  await wireMock.addMethodHostMapping('POST', '/orderExcelFinal.asp', {
    request: {
      headers: {
        'x-bl-tpa-client-id': {
          equalTo: 'ca629c09-4d8c-45dc-8a6f-bfb2b058f720',
        },
        'x-bl-session-token': {
          equalTo: 'playwright-session-token',
        },
      },
      bodyPatterns: [
        { contains: 'orderID=32439439' },
        { contains: 'locCountryID=LV' },
      ],
    },
    response: {
      headers: {
        'Content-Type': 'application/xml',
      },
      body: readFileSync(resolve('tests/fixtures/brickstore-order.xml'), 'utf8'),
    },
  });

  const response = await request.get('/api/private/brickstore/orders/32439439', {
    params: {
      fromDate: '2026-02-28',
      toDate: '2026-08-29',
    },
  });

  expect(response.status(), await response.text()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    orderId: 32439439,
    orderDate: '2026-08-28',
    orderStatusChanged: '2026-08-29',
    buyer: 'Leon Blum',
    shipping: 6.15,
    additionalCharge1: 1,
    total: 6.83,
    baseCurrencyCode: 'EUR',
    baseGrandTotal: 13.98,
    paymentCurrencyCode: 'EUR',
    totalLots: 2,
    totalItems: 36,
    status: 'Shipped',
    paymentType: 'PayPal (Onsite)',
    location: 'Germany, Schleswig-Holstein',
    vatCharges: 2.43,
    items: [
      {
        orderItemId: 491191590,
        color: '11',
        price: 0.1974,
        quantity: 34,
        itemType: 'P',
        itemId: '87079',
        remarks: 'BM_J07',
        weight: 0.9,
        lotId: 545112310,
      },
      {
        orderItemId: 491191591,
        color: '11',
        price: 0.0578,
        quantity: 2,
        itemType: 'P',
        itemId: '3660',
        remarks: 'CM_A032',
        weight: 1.25,
        lotId: 556756387,
      },
    ],
  });

  const orderExportRequests = await wireMock.findMethodHostRequests('POST', '/orderExcelFinal.asp');
  expect(orderExportRequests).toHaveLength(1);
  const form = orderExportRequests[0].form();
  expect(form.get('action')).toBe('save');
  expect(form.get('orderType')).toBe('received');
  expect(form.get('viewType')).toBe('X');
  expect(form.get('getOrders')).toBe('date');
  expect(form.get('fMM')).toBe('2');
  expect(form.get('fDD')).toBe('28');
  expect(form.get('fYY')).toBe('2026');
  expect(form.get('tMM')).toBe('8');
  expect(form.get('tDD')).toBe('29');
  expect(form.get('tYY')).toBe('2026');
  expect(form.get('getStatusSel')).toBe('I');
  expect(form.get('getFiled')).toBe('Y');
  expect(form.get('getDetail')).toBe('y');
  expect(form.get('useRealName')).toBe('y');
  expect(form.get('orderID')).toBe('32439439');
  expect(form.get('getDateFormat')).toBe('0');
  expect(form.get('locType')).toBe('Y');
  expect(form.get('locCountryID')).toBe('LV');
});
