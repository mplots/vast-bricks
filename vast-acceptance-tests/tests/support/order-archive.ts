import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SettingsOverrides } from './api-test';
import type { WireMockApi } from './wiremock';

/**
 * The protocol the order archive's two providers speak, so a scenario states the orders it is about and nothing of
 * how BrickLink is reached. Both halves of BrickLink are involved: the published store API states the order, and the
 * pages a signed-in store sees hold the accounting export and the VAT invoice.
 */

export const brickStoreSessionToken = 'order-archive-session-token';

export type ArchivedOrder = {
  orderId: number;
  dateStatusChanged: string;
  status?: string;
  vatCollectedByBrickLink?: boolean;
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

export async function mockOrderArchive(
  wireMock: WireMockApi,
  settings: SettingsOverrides,
  options: { orders: ArchivedOrder[]; baseDirectory: string },
) {
  await settings.set('VAST_ORDER_ARCHIVE_DIR', options.baseDirectory);

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
