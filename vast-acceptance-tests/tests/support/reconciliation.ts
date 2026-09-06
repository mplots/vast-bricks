import type { APIRequestContext, TestInfo } from '@playwright/test';

import type { SettingsOverrides } from './api-test';
import type { WireMockValueMatcher } from './wiremock';
import { WireMockApi } from './wiremock';

const stripeSecretKey = 'test-stripe-secret-key';
const stripeAccountId = 'acct_test-stripe-account';
const payPalClientId = 'test-paypal-client-id';
const payPalClientSecret = 'test-paypal-client-secret';
const payPalBasicAuth = Buffer.from(`${payPalClientId}:${payPalClientSecret}`).toString('base64');
const payPalAccessToken = 'test-paypal-access-token';

const emptyOrdersXml = '<?xml version="1.0" encoding="UTF-8"?><ORDERS/>';
const brickOwlMaxBatchRequests = 50;

/** Days the payment window reaches past the month at each end, as `PaymentWindow` pads it. */
const paymentWindowPadDays = 7;

/**
 * The period the payment providers are asked for when a month is reconciled: the month, padded so a payment captured
 * after the order's month is still collected. Tests assert the window the API actually asked for against this.
 */
export function paymentWindow(month: string) {
  const [year, monthOfYear] = month.split('-').map(Number);
  const from = new Date(Date.UTC(year, monthOfYear - 1, 1 - paymentWindowPadDays, 0, 0, 0));
  const to = new Date(Date.UTC(year, monthOfYear, paymentWindowPadDays, 23, 59, 59));
  return {
    from,
    to,
    fromEpochSeconds: from.getTime() / 1000,
    toEpochSeconds: to.getTime() / 1000,
    fromIso: isoInstant(from),
    toIso: isoInstant(to)
  };
}

/** An instant as Java writes one: no fractional seconds, which is what the PayPal client sends. */
function isoInstant(instant: Date): string {
  return instant.toISOString().replace('.000Z', 'Z');
}

export type BrickLinkOrdersMock = {
  fullNameOrdersXml: string;
  usernameOrdersXml: string;
  /**
   * Credentials this scenario alone uses. The client caches its session keyed by the configured token, so a scenario
   * that needs the session request to be made rather than reused has to ask under a token no other scenario used.
   */
  clientToken?: string;
  sessionToken?: string;
};

export type BrickOwlOrderMock = {
  orderId: string;
  orderDate: string;
  view?: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
};

export type StripeTransactionMock = {
  /** Payment description, which is what an order is matched on: `Brick Owl Order 1630980`,
   *  `Payment for BrickLink from some-username`. */
  description: string;
  /** Amount in minor units, as Stripe reports it. */
  amount: number;
  /** Balance transaction type; only `charge` and `payment` pay for an order. */
  type?: string;
  /** Application fee the marketplace deducted, in minor units. This is what it took as tax facilitator. */
  applicationFee?: number;
  /** Payment intent of the charge behind the transaction, which is what a payment link addresses. */
  paymentIntent?: string | null;
};

export type PayPalTransactionMock = {
  /** Payer name PayPal reports, which is what a BrickLink order is matched on. */
  payerName?: string;
  /** Shipping recipient PayPal reports; a second spelling of the buyer, matched just as well. */
  shippingName?: string;
  /** What the marketplace labelled the payment with. BrickOwl puts its bare order number here. */
  invoiceId?: string;
  /** Amount PayPal took, in the currency below. */
  amount: string;
  /** Transaction event code; only `T0006`, a payment received, pays for an order. */
  eventCode?: string;
  /** When PayPal took it, as an ISO instant. Its day is the one an amount-and-day match uses. */
  initiatedAt?: string;
  /** Transaction id PayPal gives this transaction, which a partner fee names to say what it was taken from. */
  transactionId?: string;
  /** Transaction this one was raised against; a partner fee names the payment the marketplace took it out of. */
  referenceId?: string;
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
  /** Stripe balance transactions of the month, as one page. */
  stripe?: StripeTransactionMock[];
  /** Stripe balance transactions split into the pages Stripe returns them in, for paging scenarios. */
  stripePages?: StripeTransactionMock[][];
  /** PayPal transactions of the month, as one page. */
  payPal?: PayPalTransactionMock[];
  /** PayPal transactions split into the pages PayPal returns them in, for paging scenarios. */
  payPalPages?: PayPalTransactionMock[][];
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
  await mockStripe(wireMock, settings, providers.stripePages ?? [providers.stripe ?? []]);
  await mockPayPal(wireMock, settings, providers.payPalPages ?? [providers.payPal ?? []], providers.month);

  return wireMock;
}

async function mockBrickLink(wireMock: WireMockApi, settings: SettingsOverrides, orders?: BrickLinkOrdersMock) {
  await settings.set('VAST_BRICKSTORE_BASE_URL', wireMock.baseUrl);
  await settings.set('VAST_BRICKSTORE_SESSION_BASE_URL', wireMock.baseUrl);
  await settings.setSecret('VAST_BRICKSTORE_TOKEN', orders?.clientToken ?? 'bricklink-client-token');
  await wireMock.addMethodHostMapping('POST', '/api/v1/actions/verify-and-create-session', {
    response: { json: { sessionToken: orders?.sessionToken ?? 'bricklink-session-token' } }
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

async function mockStripe(wireMock: WireMockApi, settings: SettingsOverrides, pages: StripeTransactionMock[][]) {
  await settings.set('VAST_STRIPE_BASE_URL', wireMock.baseUrl);
  await settings.set('VAST_STRIPE_ACCOUNT_ID', stripeAccountId);
  await settings.setSecret('VAST_STRIPE_SECRET_KEY', stripeSecretKey);

  let transactionNumber = 0;
  let startingAfter: WireMockValueMatcher = { absent: true };
  for (const [pageIndex, page] of pages.entries()) {
    const transactions = page.map((transaction) => {
      const number = ++transactionNumber;
      return { ...transaction, id: `txn_${number}`, charge: `test-charge-${number}` };
    });
    await wireMock.addMethodHostMapping('GET', '/v1/balance_transactions', {
      // The key is asserted so a client that sends none misses the stub instead of passing unauthenticated.
      request: {
        headers: { Authorization: { equalTo: `Bearer ${stripeSecretKey}` } },
        queryParameters: { starting_after: startingAfter }
      },
      response: {
        json: {
          object: 'list',
          url: '/v1/balance_transactions',
          has_more: pageIndex < pages.length - 1,
          data: transactions.map((transaction) => stripeBalanceTransaction(transaction))
        }
      }
    });
    if (transactions.length > 0) {
      startingAfter = { equalTo: transactions[transactions.length - 1].id };
    }
  }
}

function stripeBalanceTransaction(transaction: StripeTransactionMock & { id: string; charge: string }) {
  const type = transaction.type ?? 'charge';
  const paymentIntent = transaction.paymentIntent === undefined ? `pi_${transaction.charge}` : transaction.paymentIntent;
  return {
    id: transaction.id,
    object: 'balance_transaction',
    // The client asks for the charge to be expanded, so it arrives as the object rather than as its id.
    source: { id: `ch_${transaction.charge}`, object: 'charge', payment_intent: paymentIntent },
    type,
    reporting_category: type,
    status: 'available',
    currency: 'eur',
    amount: transaction.amount,
    fee: transaction.applicationFee ?? 0,
    fee_details:
      transaction.applicationFee === undefined
        ? []
        : [
            {
              amount: transaction.applicationFee,
              application: 'ca_test-marketplace-connect-application',
              currency: 'eur',
              description: 'BrickLink Payment Connector application fee',
              type: 'application_fee'
            }
          ],
    net: transaction.amount - (transaction.applicationFee ?? 0),
    description: transaction.description
  };
}

async function mockPayPal(
  wireMock: WireMockApi,
  settings: SettingsOverrides,
  pages: PayPalTransactionMock[][],
  month?: string
) {
  await settings.set('VAST_PAYPAL_BASE_URL', wireMock.baseUrl);
  await settings.setSecret('VAST_PAYPAL_CLIENT_ID', payPalClientId);
  await settings.setSecret('VAST_PAYPAL_CLIENT_SECRET', payPalClientSecret);

  // Client credentials are asserted so a client that sends none misses the stub instead of passing unauthenticated.
  await wireMock.addMethodHostMapping('POST', '/v1/oauth2/token', {
    request: { headers: { Authorization: { equalTo: `Basic ${payPalBasicAuth}` } } },
    response: { json: { access_token: payPalAccessToken, token_type: 'Bearer', expires_in: 32400 } }
  });

  // PayPal searches a limited range in one request, so the client asks for a padded month a segment at a time. The
  // scenario's transactions answer the segment the window opens with; a later segment reports none rather than the
  // same transactions again, which would read as a second payment of every order.
  await wireMock.addMethodHostMapping('GET', '/v1/reporting/transactions', {
    priority: 10,
    request: { headers: { Authorization: { equalTo: `Bearer ${payPalAccessToken}` } } },
    response: {
      json: {
        transaction_details: [],
        account_number: 'test-paypal-account',
        page: 1,
        total_items: 0,
        total_pages: 1
      }
    }
  });

  const firstSegment: WireMockValueMatcher | undefined =
    month === undefined ? undefined : { equalTo: paymentWindow(month).fromIso };

  let transactionNumber = 0;
  for (const [pageIndex, page] of pages.entries()) {
    await wireMock.addMethodHostMapping('GET', '/v1/reporting/transactions', {
      request: {
        headers: { Authorization: { equalTo: `Bearer ${payPalAccessToken}` } },
        queryParameters: {
          page: { equalTo: String(pageIndex + 1) },
          ...(firstSegment === undefined ? {} : { start_date: firstSegment })
        }
      },
      response: {
        json: {
          transaction_details: page.map((transaction) => payPalTransaction(transaction, ++transactionNumber)),
          account_number: 'test-paypal-account',
          page: pageIndex + 1,
          total_items: page.length,
          total_pages: pages.length
        }
      }
    });
  }
}

function payPalTransaction(transaction: PayPalTransactionMock, transactionNumber: number) {
  const [givenName, ...surname] = (transaction.payerName ?? '').split(' ');
  return {
    transaction_info: {
      transaction_id: transaction.transactionId ?? `test-paypal-transaction-${transactionNumber}`,
      ...(transaction.referenceId === undefined ? {} : { paypal_reference_id: transaction.referenceId }),
      transaction_event_code: transaction.eventCode ?? 'T0006',
      transaction_initiation_date: transaction.initiatedAt ?? '2026-08-30T05:24:15Z',
      transaction_amount: { currency_code: 'EUR', value: transaction.amount },
      fee_amount: { currency_code: 'EUR', value: '-0.96' },
      transaction_status: 'S',
      invoice_id: transaction.invoiceId ?? null
    },
    payer_info: transaction.payerName
      ? { payer_name: { given_name: givenName, surname: surname.join(' '), alternate_full_name: transaction.payerName } }
      : {},
    shipping_info: transaction.shippingName ? { name: transaction.shippingName } : {},
    cart_info: {}
  };
}
