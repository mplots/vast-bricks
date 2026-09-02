import type { APIRequestContext, TestInfo } from '@playwright/test';

import type { SettingsOverrides } from './api-test';
import { WireMockApi } from './wiremock';

export const invoiceNumeratorUuid = '3f2cfc2a-0e35-4c07-9a37-2a6a0f6d1f01';
export const teamBankAccountUuid = '5c7e8a1b-6d24-4b8f-8f3a-9d1c4e2b7a02';
export const createdClientUuid = '7a1b9c3d-2e45-4f6a-8b7c-0d1e2f3a4b03';
export const createdInvoiceUuid = '9d8c7b6a-5e43-42f1-90ab-1c2d3e4f5a04';
export const createdInvoiceNumber = '17/0001EC';

/** One order in the BrickStore export. The export names the buyer by real name or by username, never both. */
export type BrickLinkOrderMock = {
  orderId: string;
  /** BrickStore export date format, for example `8/30/2026`. */
  orderDate?: string;
  buyer?: string;
  buyerUsername?: string;
  /** Order sub-total, or `null` for an export that reports none. */
  subTotal?: string | null;
};

export type BrickOwlOrderMock = {
  orderId: string;
  view: Record<string, unknown>;
};

export type ManakabataClientMock = {
  uuid: string;
  referenceId: string;
  name?: string;
};

/** One page of the Manakabata client list, in the order the pages are returned. */
export type ManakabataClientPageMock = ManakabataClientMock[];

export type InvoiceGenerationProviders = {
  brickLink?: BrickLinkOrderMock;
  brickOwl?: BrickOwlOrderMock;
  /** Clients Manakabata already holds. Defaults to a single empty page, so a client is created. */
  existingClients?: ManakabataClientPageMock[];
  /** Response of `POST /invoices`. Defaults to a created invoice. */
  invoiceResponse?: { status: number; body: string };
  /** Response of the BrickStore order export. Defaults to the mocked order. */
  brickLinkOrderExportStatus?: number;
};

/**
 * Mocks every provider one invoice generation talks to. Providers left out respond with no order, so a scenario only
 * states the provider data it reasons about.
 */
export async function mockInvoiceGeneration(
  settings: SettingsOverrides,
  request: APIRequestContext,
  testInfo: TestInfo,
  providers: InvoiceGenerationProviders = {}
) {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();

  await mockBrickLink(wireMock, settings, providers);
  await mockBrickOwl(wireMock, settings, providers.brickOwl);
  await mockManakabata(wireMock, settings, providers);

  return wireMock;
}

async function mockBrickLink(
  wireMock: WireMockApi,
  settings: SettingsOverrides,
  providers: InvoiceGenerationProviders
) {
  await settings.set('VAST_BRICKSTORE_BASE_URL', wireMock.baseUrl);
  await settings.set('VAST_BRICKSTORE_SESSION_BASE_URL', wireMock.baseUrl);
  await settings.setSecret('VAST_BRICKSTORE_TOKEN', 'bricklink-client-token');
  await wireMock.addMethodHostMapping('POST', '/api/v1/actions/verify-and-create-session', {
    response: { json: { sessionToken: 'bricklink-session-token' } }
  });

  const order = providers.brickLink;
  const status = providers.brickLinkOrderExportStatus;
  await addBrickLinkOrderExportMapping(
    wireMock,
    'useRealName=y',
    status,
    order === undefined ? ordersXml() : ordersXml(orderXml(order, order.buyer ?? 'Some Buyer'))
  );
  await addBrickLinkOrderExportMapping(
    wireMock,
    'useRealName=n',
    status,
    order === undefined ? ordersXml() : ordersXml(orderXml(order, order.buyerUsername ?? 'some-buyer'))
  );
}

async function addBrickLinkOrderExportMapping(
  wireMock: WireMockApi,
  bodyPattern: string,
  status: number | undefined,
  ordersXmlBody: string
) {
  await wireMock.addMethodHostMapping('POST', '/orderExcelFinal.asp', {
    request: { bodyPatterns: [{ contains: bodyPattern }] },
    response:
      status === undefined
        ? { headers: { 'Content-Type': 'application/xml' }, body: ordersXmlBody }
        : { status, body: 'BrickStore is unavailable' }
  });
}

const orderXml = (order: BrickLinkOrderMock, buyer: string) => {
  const subTotal = order.subTotal === undefined ? '5.00' : order.subTotal;
  return `
  <ORDER>
    <ORDERID>${order.orderId}</ORDERID>
    <ORDERDATE>${order.orderDate ?? '8/30/2026'}</ORDERDATE>
    <BUYER>${buyer}</BUYER>
    ${subTotal === null ? '' : `<ORDERTOTAL>${subTotal}</ORDERTOTAL>`}
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
  </ORDER>`;
};

const ordersXml = (...orders: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><ORDERS>${orders.join('')}</ORDERS>`;

async function mockBrickOwl(wireMock: WireMockApi, settings: SettingsOverrides, order?: BrickOwlOrderMock) {
  await settings.set('VAST_BRICKOWL_BASE_URL', wireMock.baseUrl);
  await settings.setSecret('VAST_BRICKOWL_API_KEY', 'test-brickowl-api-key');
  await wireMock.addMethodHostMapping('POST', '/v1/bulk/batch', {
    response: {
      json:
        order === undefined
          ? [{ req_num: 1, code: 404, body: [] }]
          : [{ req_num: 1, code: 200, body: { order_id: order.orderId, ...order.view } }]
    }
  });
}

async function mockManakabata(
  wireMock: WireMockApi,
  settings: SettingsOverrides,
  providers: InvoiceGenerationProviders
) {
  await settings.set('VAST_MANAKABATA_BASE_URL', wireMock.baseUrl);
  await settings.setSecret('VAST_MANAKABATA_API_TOKEN', 'test-manakabata-api-token');
  await settings.set('VAST_MANAKABATA_INVOICE_NUMERATOR_UUID', invoiceNumeratorUuid);
  await settings.set('VAST_MANAKABATA_TEAM_BANK_ACCOUNT_UUID', teamBankAccountUuid);

  const pages = providers.existingClients ?? [[]];
  for (const [index, clients] of pages.entries()) {
    await wireMock.addMethodHostMapping('GET', '/clients', {
      request: { queryParameters: { page: { equalTo: String(index + 1) } } },
      response: {
        json: {
          data: clients.map((client) => clientJson(client)),
          links: { first: null, last: null, prev: null, next: null },
          meta: { current_page: index + 1, last_page: pages.length, per_page: 1000, total: clients.length }
        }
      }
    });
  }

  await wireMock.addMethodHostMapping('POST', '/clients', {
    response: { json: { data: clientJson({ uuid: createdClientUuid, referenceId: 'created' }) } }
  });
  for (const client of pages.flat()) {
    await wireMock.addMethodHostMapping('PUT', `/clients/${client.uuid}`, {
      response: { json: { data: clientJson(client) } }
    });
  }

  await wireMock.addMethodHostMapping('POST', '/invoices', {
    response: providers.invoiceResponse ?? {
      json: {
        data: {
          uuid: createdInvoiceUuid,
          invoice_number: createdInvoiceNumber,
          invoice_category: 'product',
          invoice_type: 'bill_of_landing',
          currency: 'EUR',
          products: []
        }
      }
    }
  });
}

const clientJson = (client: ManakabataClientMock) => ({
  uuid: client.uuid,
  reference_id: client.referenceId,
  name: client.name ?? 'Some Buyer',
  type: 'person',
  is_self_employed: false,
  is_vat_special: false,
  is_sync_enabled: false
});
