import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SettingsOverrides } from './api-test';
import type { WireMockApi } from './wiremock';

/**
 * The protocol the order archive's providers speak, so a scenario states the orders it is about and nothing of how
 * either marketplace is reached. Both halves of BrickLink are involved: the published store API states the order, and
 * the pages a signed-in store sees hold the accounting export and the VAT invoice. BrickOwl states an order through
 * its batch endpoint and nothing else, which is why an archived BrickOwl order is one file rather than three.
 *
 * <p>BrickOwl is configured whether or not a scenario has orders there, because a store that holds no BrickOwl key
 * at all is a different scenario from a store whose BrickOwl has nothing to archive.
 */

export const brickStoreSessionToken = 'order-archive-session-token';

export type ArchivedOrder = {
  orderId: number;
  dateStatusChanged: string;
  status?: string;
  vatCollectedByBrickLink?: boolean;
};

/**
 * A BrickOwl order to archive. `updatedTime` is stated to BrickOwl's API with an offset and read back without one,
 * so it is also the moment the archived file is named after.
 */
export type ArchivedBrickOwlOrder = {
  orderId: string;
  updatedTime: string;
  status?: string;
  /** BrickOwl answering the batch entry for this order with a refusal rather than with the order. */
  refused?: boolean;
};

/** A minimal but real PDF, because the client refuses a VAT invoice that is not one. */
export const vatInvoicePdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8');

export function accountingExportXml(orderId: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?><ORDERS><ORDER><ORDERID>${orderId}</ORDERID></ORDER></ORDERS>`;
}

/** A directory of this scenario's own, since the archive is written to the filesystem the service runs on. */
export function archiveBaseDirectory(): string {
  return mkdtempSync(join(tmpdir(), 'vast-order-archive-'));
}

function order(archived: ArchivedOrder) {
  return {
    order_id: archived.orderId,
    date_status_changed: archived.dateStatusChanged,
    status: archived.status ?? 'COMPLETED',
    vat_collected_by_bl: archived.vatCollectedByBrickLink ?? false,
  };
}

/** What BrickOwl's order/view answers with, which is also what the archive writes. */
export function brickOwlOrder(archived: ArchivedBrickOwlOrder) {
  return {
    order_id: archived.orderId,
    updated_time: `${archived.updatedTime}+00:00`,
    order_time: `${archived.updatedTime}+00:00`,
    status: archived.status ?? 'Shipped',
    base_currency: 'EUR',
    base_order_total: '12.34',
  };
}

export async function mockOrderArchive(
  wireMock: WireMockApi,
  settings: SettingsOverrides,
  options: { orders: ArchivedOrder[]; brickOwlOrders?: ArchivedBrickOwlOrder[]; baseDirectory: string },
) {
  await settings.set('VAST_ORDER_ARCHIVE_DIR', options.baseDirectory);
  await mockBrickOwl(wireMock, settings, options.brickOwlOrders ?? []);

  await settings.set('VAST_BRICKLINK_BASE_URL', `${wireMock.baseUrl}/api/store/v1/`);
  await settings.setSecret('VAST_BRICKLINK_CONSUMER_KEY', 'test-bricklink-consumer-key');
  await settings.setSecret('VAST_BRICKLINK_CONSUMER_SECRET', 'test-bricklink-consumer-secret');
  await settings.setSecret('VAST_BRICKLINK_TOKEN_VALUE', 'test-bricklink-token');
  await settings.setSecret('VAST_BRICKLINK_TOKEN_SECRET', 'test-bricklink-token-secret');

  await wireMock.addMethodHostMapping('GET', '/api/store/v1/orders', {
    // The store API is signed, so a request reaching it without an OAuth header is not this client's.
    request: { headers: { Authorization: { contains: 'OAuth ' } } },
    response: { json: { meta: { code: 200, message: 'OK' }, data: options.orders.map(order) } },
  });

  for (const archived of options.orders) {
    await wireMock.addMethodHostMapping('GET', `/api/store/v1/orders/${archived.orderId}`, {
      request: { headers: { Authorization: { contains: 'OAuth ' } } },
      response: { json: { meta: { code: 200, message: 'OK' }, data: order(archived) } },
    });
  }

  await settings.set('VAST_BRICKSTORE_BASE_URL', wireMock.baseUrl);
  await settings.set('VAST_BRICKSTORE_SESSION_BASE_URL', wireMock.baseUrl);
  await settings.set('VAST_BRICKSTORE_TOR_ENABLED', 'false');
  await settings.setSecret('VAST_BRICKSTORE_TOKEN', 'order-archive-client-token');
  await wireMock.addMethodHostMapping('POST', '/api/v1/actions/verify-and-create-session', {
    response: { json: { sessionToken: brickStoreSessionToken } },
  });
  for (const archived of options.orders) {
    await wireMock.addMethodHostMapping('POST', '/orderExcelFinal.asp', {
      request: { bodyPatterns: [{ contains: `orderID=${archived.orderId}` }] },
      response: {
        headers: { 'Content-Type': 'text/xml; Charset=UTF-8' },
        body: accountingExportXml(archived.orderId),
      },
    });
  }
  await wireMock.addMethodHostMapping('GET', '/_file/orders/vat_invoice.file', {
    response: {
      headers: { 'Content-Type': 'application/pdf' },
      base64Body: vatInvoicePdf.toString('base64'),
    },
  });
}

async function mockBrickOwl(wireMock: WireMockApi, settings: SettingsOverrides, orders: ArchivedBrickOwlOrder[]) {
  await settings.set('VAST_BRICKOWL_BASE_URL', wireMock.baseUrl);
  await settings.setSecret('VAST_BRICKOWL_API_KEY', 'order-archive-brickowl-api-key');

  await wireMock.addMethodHostMapping('GET', '/v1/order/list', {
    // BrickOwl's list states the date in seconds since the epoch, and says nothing about when the order last changed.
    response: {
      json: orders.map((archived) => ({
        order_id: archived.orderId,
        order_date: String(Date.parse(`${archived.updatedTime}+00:00`) / 1000),
      })),
    },
  });
  if (orders.length === 0) {
    return;
  }

  // The archive asks for every listed order in one batch, in the order they were listed, and BrickOwl answers each
  // request under the number it went out as.
  await wireMock.addMethodHostMapping('POST', '/v1/bulk/batch', {
    request: { bodyPatterns: [{ contains: encodeURIComponent('order/view') }] },
    response: {
      json: orders.map((archived, index) =>
        archived.refused
          ? { req_num: index + 1, code: 404, body: [] }
          : { req_num: index + 1, code: 200, body: brickOwlOrder(archived) },
      ),
    },
  });
}
