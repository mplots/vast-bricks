import { expect, test } from './support/api-test';
import {
  createdClientUuid,
  createdInvoiceNumber,
  createdInvoiceUuid,
  invoiceNumeratorUuid,
  mockInvoiceGeneration,
  teamBankAccountUuid
} from './support/invoices';
import { wireMockMode } from './support/wiremock';

test.describe.configure({ mode: wireMockMode() });

const endpoint = '/api/private/accounting/invoices';

test('generates an invoice for a BrickLink order and creates its accounting client', async ({
  request,
  settings
}, testInfo) => {
  const wireMock = await mockInvoiceGeneration(settings, request, testInfo, {
    brickLink: {
      orderId: '32466549',
      orderDate: '8/30/2026',
      buyer: 'Ada Lovelace',
      buyerUsername: 'ada-l',
      subTotal: '12.34'
    }
  });

  const response = await request.post(endpoint, { data: { orderId: '32466549', source: 'BrickLink' } });

  expect(response.status(), await response.text()).toBe(200);
  await expect(response.json()).resolves.toEqual({
    invoiceUuid: createdInvoiceUuid,
    invoiceNumber: createdInvoiceNumber,
    clientUuid: createdClientUuid,
    referenceId: 'bricklink:customer:ada-l',
    name: 'Ada Lovelace'
  });

  const createdClients = await wireMock.findMethodHostRequests('POST', '/clients');
  expect(createdClients).toHaveLength(1);
  // The generated client request always writes every field, so the unset ones are sent as nulls.
  expect(JSON.parse(createdClients[0].text())).toEqual({
    type: 'person',
    name: 'Ada Lovelace',
    reference_id: 'bricklink:customer:ada-l',
    is_self_employed: false,
    is_vat_special: false,
    is_sync_enabled: false,
    reg_no: null,
    vat_no: null,
    address: null,
    country: null,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    contact_phone_country: null,
    contact_e_address: null
  });

  const createdInvoices = await wireMock.findMethodHostRequests('POST', '/invoices');
  expect(createdInvoices).toHaveLength(1);
  expect(JSON.parse(createdInvoices[0].text())).toEqual({
    invoice_category: 'product',
    invoice_type: 'bill_of_landing',
    recipient_selection_mode: 'existing',
    recipient: { uuid: createdClientUuid },
    payer_is_recipient: true,
    invoiced_at: '2026-08-30',
    invoice_locale: 'en',
    currency: 'EUR',
    invoice_note: 'bricklink:32466549',
    show_code: true,
    show_discount: true,
    is_public_link: true,
    invoice_numerator_selection_mode: 'existing',
    invoice_numerator: { uuid: invoiceNumeratorUuid },
    team_bank_account_selection_mode: 'existing',
    team_bank_account: { uuid: teamBankAccountUuid },
    products: [
      {
        name: 'LEGO parts',
        measurement: 'pieces',
        quantity: 1,
        price: 12.34,
        discount_type: 'flat',
        category: null,
        code: null,
        discount: 0,
        tax: 21
      }
    ]
  });
});

test('generates an invoice for a BrickOwl order', async ({ request, settings }, testInfo) => {
  const wireMock = await mockInvoiceGeneration(settings, request, testInfo, {
    brickOwl: {
      orderId: '10574321',
      view: {
        customer_user_id: '9911',
        customer_username: 'grace-h',
        buyer_name: 'Grace From BrickOwl',
        billing_first_name: 'Grace',
        billing_last_name: 'Hopper',
        iso_order_time: '2026-08-31T10:15:30+03:00',
        sub_total: '7.50'
      }
    }
  });

  // The accounting screen sends the BrickOwl source spelled with a space.
  const response = await request.post(endpoint, { data: { orderId: '10574321', source: 'Brick Owl' } });

  expect(response.status(), await response.text()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    clientUuid: createdClientUuid,
    referenceId: 'brickowl:customer:9911',
    name: 'Grace Hopper'
  });

  const createdInvoices = await wireMock.findMethodHostRequests('POST', '/invoices');
  expect(createdInvoices).toHaveLength(1);
  expect(JSON.parse(createdInvoices[0].text())).toMatchObject({
    invoice_note: 'brickowl:10574321',
    invoiced_at: '2026-08-31',
    products: [{ name: 'LEGO parts', quantity: 1, price: 7.5, tax: 21 }]
  });
});

test('updates the accounting client that already carries the order reference', async ({
  request,
  settings
}, testInfo) => {
  const existingClientUuid = '2b3c4d5e-6f70-4812-93a4-b5c6d7e8f905';
  const wireMock = await mockInvoiceGeneration(settings, request, testInfo, {
    brickLink: { orderId: '32466550', buyer: 'Ada Lovelace', buyerUsername: 'ada-l' },
    existingClients: [
      [{ uuid: '1a2b3c4d-5e6f-4708-89a0-b1c2d3e4f506', referenceId: 'bricklink:customer:someone-else' }],
      [{ uuid: existingClientUuid, referenceId: 'bricklink:customer:ada-l', name: 'Ada L' }]
    ]
  });

  const response = await request.post(endpoint, { data: { orderId: '32466550', source: 'BrickLink' } });

  expect(response.status(), await response.text()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ clientUuid: existingClientUuid });

  const updatedClients = await wireMock.findMethodHostRequests('PUT', `/clients/${existingClientUuid}`);
  expect(updatedClients).toHaveLength(1);
  expect(JSON.parse(updatedClients[0].text())).toMatchObject({
    name: 'Ada Lovelace',
    reference_id: 'bricklink:customer:ada-l'
  });
  expect(await wireMock.findMethodHostRequests('POST', '/clients')).toHaveLength(0);
});

test('rejects a request that does not identify one order', async ({ request, settings }, testInfo) => {
  await mockInvoiceGeneration(settings, request, testInfo, {
    brickLink: { orderId: '32466549' }
  });

  const missingOrderId = await request.post(endpoint, { data: { orderId: '  ', source: 'BrickLink' } });
  expect(missingOrderId.status(), await missingOrderId.text()).toBe(400);

  const missingSource = await request.post(endpoint, { data: { orderId: '32466549' } });
  expect(missingSource.status(), await missingSource.text()).toBe(400);

  const unknownSource = await request.post(endpoint, { data: { orderId: '32466549', source: 'LEGO Store' } });
  expect(unknownSource.status(), await unknownSource.text()).toBe(400);

  const nonNumericOrderId = await request.post(endpoint, { data: { orderId: 'BL-1', source: 'BrickLink' } });
  expect(nonNumericOrderId.status(), await nonNumericOrderId.text()).toBe(400);

  const unknownOrder = await request.post(endpoint, { data: { orderId: '99999999', source: 'BrickLink' } });
  expect(unknownOrder.status(), await unknownOrder.text()).toBe(400);
});

test('rejects an order that reports no sub-total to invoice', async ({ request, settings }, testInfo) => {
  const wireMock = await mockInvoiceGeneration(settings, request, testInfo, {
    brickLink: { orderId: '32466554', buyerUsername: 'ada-l', subTotal: null }
  });

  const response = await request.post(endpoint, { data: { orderId: '32466554', source: 'BrickLink' } });

  expect(response.status(), await response.text()).toBe(400);
  expect(await wireMock.findMethodHostRequests('POST', '/invoices')).toHaveLength(0);
});

test('reports a rejected Manakabata invoice as a bad gateway', async ({ request, settings }, testInfo) => {
  await mockInvoiceGeneration(settings, request, testInfo, {
    brickLink: { orderId: '32466551', buyerUsername: 'ada-l' },
    invoiceResponse: { status: 422, body: '{"message":"The invoice type is invalid."}' }
  });

  const response = await request.post(endpoint, { data: { orderId: '32466551', source: 'BrickLink' } });

  expect(response.status(), await response.text()).toBe(502);
  expect(await response.text()).toContain('The invoice type is invalid.');
});

test('reports a failing marketplace as a bad gateway', async ({ request, settings }, testInfo) => {
  await mockInvoiceGeneration(settings, request, testInfo, {
    brickLink: { orderId: '32466552' },
    brickLinkOrderExportStatus: 503
  });

  const response = await request.post(endpoint, { data: { orderId: '32466552', source: 'BrickLink' } });

  expect(response.status(), await response.text()).toBe(502);
});

test('invoice generation rejects missing and invalid tokens', async ({ anonymousRequest }) => {
  const missingToken = await anonymousRequest.post(endpoint, {
    data: { orderId: '32466549', source: 'BrickLink' }
  });
  expect(missingToken.status()).toBe(401);

  const invalidToken = await anonymousRequest.post(endpoint, {
    data: { orderId: '32466549', source: 'BrickLink' },
    headers: { Authorization: 'Bearer invalid-token' }
  });
  expect(invalidToken.status()).toBe(401);
});
