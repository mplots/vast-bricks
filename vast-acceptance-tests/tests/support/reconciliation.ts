import type { APIRequestContext, TestInfo } from '@playwright/test';

import type { SettingsOverrides } from './api-test';
import { WireMockApi } from './wiremock';

const emptyOrdersXml = '<?xml version="1.0" encoding="UTF-8"?><ORDERS/>';
const brickOwlMaxBatchRequests = 50;

export type BrickLinkOrdersMock = {
  fullNameOrdersXml: string;
  usernameOrdersXml: string;
};

export type BrickOwlOrderMock = {
  orderId: string;
  orderDate: string;
  view?: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
};

export type ManakabataInvoiceMock = {
  /** Source/order key, e.g. `bricklink:32466549`; legacy `BrickLink order 32466549` is also accepted. */
  invoiceNote: string;
  subtotal: string;
};

export type ReconciliationProviders = {
  /** Reconciled month, as sent to the API. BrickOwl only serves order details for orders within it. */
  month?: string;
  brickLink?: BrickLinkOrdersMock;
  brickOwl?: BrickOwlOrderMock[];
  manakabata?: ManakabataInvoiceMock[];
};

/**
 * Mocks every reconciliation order provider for one scenario. Providers left out respond with no orders, so a scenario
 * only states the provider data it reasons about.
 */
export async function mockReconciliationOrders(
  settings: SettingsOverrides,
  request: APIRequestContext,
  testInfo: TestInfo,
  providers: ReconciliationProviders = {}
) {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();

  await mockBrickLink(wireMock, settings, providers.brickLink);
  await mockBrickOwl(wireMock, settings, providers.brickOwl ?? [], providers.month);
  await mockManakabata(wireMock, settings, providers.manakabata ?? []);

  return wireMock;
}

async function mockBrickLink(wireMock: WireMockApi, settings: SettingsOverrides, orders?: BrickLinkOrdersMock) {
  await settings.set('VAST_BRICKSTORE_BASE_URL', wireMock.baseUrl);
  await settings.set('VAST_BRICKSTORE_SESSION_BASE_URL', wireMock.baseUrl);
  await settings.setSecret('VAST_BRICKSTORE_TOKEN', 'bricklink-client-token');
  await wireMock.addMethodHostMapping('POST', '/api/v1/actions/verify-and-create-session', {
    response: { json: { sessionToken: 'bricklink-session-token' } }
  });
  await addBrickLinkOrdersMapping(wireMock, 'useRealName=y', orders?.fullNameOrdersXml ?? emptyOrdersXml);
  await addBrickLinkOrdersMapping(wireMock, 'useRealName=n', orders?.usernameOrdersXml ?? emptyOrdersXml);
}

async function addBrickLinkOrdersMapping(wireMock: WireMockApi, bodyPattern: string, ordersXml: string) {
  await wireMock.addMethodHostMapping('POST', '/orderExcelFinal.asp', {
    request: { bodyPatterns: [{ contains: bodyPattern }] },
    response: {
      headers: { 'Content-Type': 'application/xml' },
      body: ordersXml
    }
  });
}

async function mockBrickOwl(
  wireMock: WireMockApi,
  settings: SettingsOverrides,
  orders: BrickOwlOrderMock[],
  month?: string
) {
  await settings.set('VAST_BRICKOWL_BASE_URL', wireMock.baseUrl);
  await settings.setSecret('VAST_BRICKOWL_API_KEY', 'test-brickowl-api-key');
  await wireMock.addMethodHostMapping('GET', '/v1/order/list', {
    response: {
      json: orders.map((order) => ({ order_id: order.orderId, order_date: order.orderDate }))
    }
  });

  const requestedOrders = orders.filter((order) => month === undefined || orderMonth(order.orderDate) === month);
  for (const batch of brickOwlBatches(requestedOrders)) {
    await addBrickOwlBatchMapping(wireMock, batch, 'order/view', (order) => ({ order_id: order.orderId, ...order.view }));
    await addBrickOwlBatchMapping(wireMock, batch, 'order/items', (order) => order.items ?? []);
  }
}

async function addBrickOwlBatchMapping(
  wireMock: WireMockApi,
  batch: BrickOwlOrderMock[],
  endpoint: string,
  body: (order: BrickOwlOrderMock) => unknown
) {
  await wireMock.addMethodHostMapping('POST', '/v1/bulk/batch', {
    request: {
      bodyPatterns: [
        { contains: encodeURIComponent(endpoint) },
        { contains: encodeURIComponent(`"order_id":"${batch[batch.length - 1].orderId}"`) }
      ]
    },
    response: {
      json: batch.map((order, index) => ({ req_num: index + 1, code: 200, body: body(order) }))
    }
  });
}

function orderMonth(orderDate: string): string {
  const date = new Date(Number(orderDate) * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function brickOwlBatches(orders: BrickOwlOrderMock[]): BrickOwlOrderMock[][] {
  const batches: BrickOwlOrderMock[][] = [];
  for (let start = 0; start < orders.length; start += brickOwlMaxBatchRequests) {
    batches.push(orders.slice(start, start + brickOwlMaxBatchRequests));
  }
  return batches;
}

async function mockManakabata(wireMock: WireMockApi, settings: SettingsOverrides, invoices: ManakabataInvoiceMock[]) {
  await settings.set('VAST_MANAKABATA_BASE_URL', wireMock.baseUrl);
  await settings.setSecret('VAST_MANAKABATA_API_TOKEN', 'test-manakabata-api-token');
  await wireMock.addMethodHostMapping('GET', '/invoices', {
    response: {
      json: {
        data: invoices.map((invoice, index) => ({
          uuid: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
          invoice_number: `${index + 1}/0001EC`,
          invoice_note: invoice.invoiceNote,
          currency: 'EUR',
          subtotal: invoice.subtotal,
          tax: '0.00',
          total: invoice.subtotal,
          products: []
        })),
        links: { first: null, last: null, prev: null, next: null },
        meta: { current_page: 1, last_page: 1, per_page: invoices.length, total: invoices.length }
      }
    }
  });
}
