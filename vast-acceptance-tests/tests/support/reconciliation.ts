import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { APIRequestContext, TestInfo } from "@playwright/test";

import type { SettingsOverrides } from "./api-test";
import type { WireMockValueMatcher } from "./wiremock";
import { WireMockApi } from "./wiremock";
import { orderDetailPage } from "./bricklink-order-detail";
import {
  stubMansPasts,
  stubMansPastsRefusedLogin,
  type MansPastsShipmentMock,
} from "./manspasts";
import { mockStripeSettings, stubStripeBalanceTransactions } from "./stripe";
import { mockPayPalSettings, stubPayPalTransactions } from "./paypal";

const emptyOrdersXml = '<?xml version="1.0" encoding="UTF-8"?><ORDERS/>';
const brickOwlMaxBatchRequests = 50;

/** Days the payment window reaches before the month, as `PaymentWindow` pads it. */
const paymentWindowPadDays = 7;

/** The last instant a ledger is ever read to: the end of today, as `PaymentWindow` closes its window. */
export function endOfToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
    ),
  );
}

/**
 * The period the payment providers are asked for when a month is reconciled: it opens seven days before the month, so
 * a payment captured after the order it paid is still collected, and it closes at the end of today, because a refund
 * is dated when it was given and can follow its order by months. A month whose padded end has not arrived yet is read
 * to that end instead. Tests assert the window the API actually asked for against this.
 */
export function paymentWindow(month: string) {
  const [year, monthOfYear] = month.split("-").map(Number);
  const from = new Date(
    Date.UTC(year, monthOfYear - 1, 1 - paymentWindowPadDays, 0, 0, 0),
  );
  const paddedTo = new Date(
    Date.UTC(year, monthOfYear, paymentWindowPadDays, 23, 59, 59),
  );
  const today = endOfToday();
  const to = paddedTo > today ? paddedTo : today;
  return {
    from,
    to,
    fromEpochSeconds: from.getTime() / 1000,
    toEpochSeconds: to.getTime() / 1000,
    fromIso: isoInstant(from),
    toIso: isoInstant(to),
  };
}

/** An instant as Java writes one: no fractional seconds, which is what the PayPal client sends. */
function isoInstant(instant: Date): string {
  return instant.toISOString().replace(".000Z", "Z");
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
  /**
   * The refund each order's detail page states, by order id: what BrickLink writes in its "Total refunded" cell,
   * spelled as BrickLink spells it (`EUR&nbsp;12.34`). An order named here has a refund; every other page states
   * none, so an order fetched by mistake reads as unrefunded rather than as a failed request.
   */
  refunds?: Record<string, string>;
};

export type BrickOwlOrderMock = {
  orderId: string;
  orderDate: string;
  view?: Record<string, unknown>;
};

export type StripeTransactionMock = {
  /** Payment description, which is what an order is matched on: `Brick Owl Order 1600001`,
   *  `Payment for BrickLink from some-username`. */
  description: string;
  /** Amount in minor units, as Stripe reports it. */
  amount: number;
  /** Balance transaction type; only `charge` and `payment` pay for an order. */
  type?: string;
  /** Application fee the marketplace deducted, in minor units. This is what it took as tax facilitator. */
  applicationFee?: number;
  /** Stripe's own processing fee, in minor units. This is what taking the payment cost the store. */
  stripeFee?: number;
  /** Payment intent of the charge behind the transaction, which is what a payment link addresses. */
  paymentIntent?: string | null;
  /**
   * What the charge behind the transaction has been refunded to date, in minor units and positive, as Stripe keeps
   * it on the charge itself rather than per refund. This is what a refunded order is read from.
   */
  amountRefunded?: number;
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
  /** What PayPal charged for taking the payment, as PayPal states it: a deduction, so negative. */
  feeAmount?: string;
};

/** One accounting invoice Manakabata holds. It names its order in the note the `invoice` feature writes. */
export type ManakabataInvoiceMock = {
  /** Source/order key, e.g. `bricklink:32466549`; legacy `BrickLink order 32466549` is also accepted. */
  invoiceNote: string;
  subtotal: string;
  /** VAT the invoice charges. Defaults to none charged, as an export is invoiced. */
  tax?: string;
  /** What the invoice comes to with VAT. Defaults to the sub-total plus the tax. */
  total?: string;
};

export type ReconciliationProviders = {
  /** Reconciled month, as sent to the API. BrickOwl only serves order details for orders within it. */
  month?: string;
  /** Inclusive order dates for range-based reconciliation scenarios. */
  period?: { from: string; to: string };
  brickLink?: BrickLinkOrdersMock;
  brickOwl?: BrickOwlOrderMock[];
  /** Stripe balance transactions of the month, as one page. */
  stripe?: StripeTransactionMock[];
  /** Stripe balance transactions split into the pages Stripe returns them in, for paging scenarios. */
  stripePages?: StripeTransactionMock[][];
  /** PayPal transactions of the month, as one page. */
  payPal?: PayPalTransactionMock[];
  /** PayPal transactions split into the pages PayPal returns them in, for paging scenarios. */
  payPalPages?: PayPalTransactionMock[][];
  /**
   * The Mans Pasts register, which the export states on its first page whole. A shipment names its order in the
   * notes the store wrote on it.
   */
  mansPasts?: MansPastsShipmentMock[];
  /** Mocks Mans Pasts refusing the sign-in, for the scenario about a provider that would not answer. */
  mansPastsRefusesLogin?: boolean;
  /** Accounting invoices Manakabata holds. Defaults to none, so no order is invoiced. */
  manakabata?: ManakabataInvoiceMock[];
  /**
   * Order ids BrickSync holds no record of. Every other order the scenario states is recorded, that being the
   * ordinary case: BrickSync synchronizes an order as it arrives, so a store whose orders are not all there is a
   * store whose BrickSync was down, which is what the rule about it is for.
   */
  brickSyncMissing?: string[];
};

/**
 * Mocks every reconciliation order provider for one scenario. Providers left out respond with no orders, so a scenario
 * only states the provider data it reasons about.
 */
export async function mockReconciliationOrders(
  settings: SettingsOverrides,
  request: APIRequestContext,
  testInfo: TestInfo,
  providers: ReconciliationProviders = {},
) {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();

  await mockBrickLink(wireMock, settings, providers.brickLink);
  await mockBrickOwl(
    wireMock,
    settings,
    providers.brickOwl ?? [],
    providers.month,
    providers.period,
  );
  await mockStripe(
    wireMock,
    settings,
    providers.stripePages ?? [providers.stripe ?? []],
  );
  await mockPayPal(
    wireMock,
    settings,
    providers.payPalPages ?? [providers.payPal ?? []],
    providers.month,
  );
  if (providers.mansPastsRefusesLogin) {
    await stubMansPastsRefusedLogin(wireMock, settings);
  } else {
    await stubMansPasts(wireMock, settings, [providers.mansPasts ?? []]);
  }
  await mockManakabata(wireMock, settings, providers.manakabata ?? []);
  await mockBrickSync(settings, providers);

  return wireMock;
}

/**
 * BrickSync's own record of the orders it synchronized, as files in a directory of this scenario's own.
 *
 * <p>A directory per scenario because the setting is read live off the filesystem the service runs on, and the
 * default is the developer's own BrickSync orders. Every order the scenario stated is recorded unless it named the
 * order as missing, so a scenario that is not about the synchronization does not have to say anything about it.
 */
async function mockBrickSync(
  settings: SettingsOverrides,
  providers: ReconciliationProviders,
) {
  const directory = mkdtempSync(join(tmpdir(), "vast-bricksync-orders-"));
  await settings.set("VAST_BRICKSYNC_ORDERS_DIR", directory);

  const missing = new Set(providers.brickSyncMissing ?? []);
  const recorded = [
    ...brickLinkOrderIds(providers.brickLink).map(
      (orderId) => `bricklink-${orderId}`,
    ),
    ...(providers.brickOwl ?? []).map((order) => `brickowl-${order.orderId}`),
  ];
  for (const key of recorded) {
    if (!missing.has(key.slice(key.indexOf("-") + 1))) {
      // Nothing reads what is in the file, only that it is there, so a marker of BrickSync's own is enough.
      writeFileSync(join(directory, `${key}.bsx`), "<BrickStoreXML/>\n");
    }
  }
}

/** The orders a BrickLink scenario stubbed, read back out of the export it stated them as. */
function brickLinkOrderIds(orders?: BrickLinkOrdersMock): string[] {
  const stated = `${orders?.fullNameOrdersXml ?? ""}${orders?.usernameOrdersXml ?? ""}`;
  const found = [...stated.matchAll(/<ORDERID>\s*([^<\s]+)\s*<\/ORDERID>/g)].map(
    (match) => match[1],
  );
  return [...new Set(found)];
}

async function mockManakabata(
  wireMock: WireMockApi,
  settings: SettingsOverrides,
  invoices: ManakabataInvoiceMock[],
) {
  await settings.set("VAST_MANAKABATA_BASE_URL", wireMock.baseUrl);
  await settings.setSecret(
    "VAST_MANAKABATA_API_TOKEN",
    "test-manakabata-api-token",
  );
  await wireMock.addMethodHostMapping("GET", "/invoices", {
    response: {
      json: {
        data: invoices.map((invoice, index) => {
          const tax = invoice.tax ?? "0.00";
          return {
            uuid: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
            invoice_number: `${index + 1}/0001EC`,
            invoice_note: invoice.invoiceNote,
            currency: "EUR",
            subtotal: invoice.subtotal,
            tax,
            total:
              invoice.total ??
              (Number(invoice.subtotal) + Number(tax)).toFixed(2),
            products: [],
          };
        }),
        links: { first: null, last: null, prev: null, next: null },
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: invoices.length,
          total: invoices.length,
        },
      },
    },
  });
}

async function mockBrickLink(
  wireMock: WireMockApi,
  settings: SettingsOverrides,
  orders?: BrickLinkOrdersMock,
) {
  await settings.set("VAST_BRICKSTORE_BASE_URL", wireMock.baseUrl);
  await settings.set("VAST_BRICKSTORE_SESSION_BASE_URL", wireMock.baseUrl);
  await settings.setSecret(
    "VAST_BRICKSTORE_TOKEN",
    orders?.clientToken ?? "bricklink-client-token",
  );
  await wireMock.addMethodHostMapping(
    "POST",
    "/api/v1/actions/verify-and-create-session",
    {
      response: {
        json: {
          sessionToken: orders?.sessionToken ?? "bricklink-session-token",
        },
      },
    },
  );
  await addBrickLinkOrdersMapping(
    wireMock,
    "useRealName=y",
    orders?.fullNameOrdersXml ?? emptyOrdersXml,
  );
  await addBrickLinkOrdersMapping(
    wireMock,
    "useRealName=n",
    orders?.usernameOrdersXml ?? emptyOrdersXml,
  );
  await addBrickLinkOrderDetailMappings(wireMock, orders?.refunds ?? {});
}

/**
 * The order detail page of each cancelled order, which is where BrickLink states a refund. The catch-all answers with
 * a page stating no refund, so a scenario asserting which orders were asked about sees the request it is counting
 * rather than a request that failed.
 */
async function addBrickLinkOrderDetailMappings(
  wireMock: WireMockApi,
  refunds: Record<string, string>,
) {
  await wireMock.addMethodHostMapping("GET", "/orderDetail.asp", {
    priority: 10,
    response: {
      headers: { "Content-Type": "text/html" },
      body: orderDetailPage("unrefunded"),
    },
  });
  for (const [orderId, totalRefunded] of Object.entries(refunds)) {
    await wireMock.addMethodHostMapping("GET", "/orderDetail.asp", {
      request: { queryParameters: { ID: { equalTo: orderId } } },
      response: {
        headers: { "Content-Type": "text/html" },
        body: orderDetailPage(orderId, { totalRefunded }),
      },
    });
  }
}

async function addBrickLinkOrdersMapping(
  wireMock: WireMockApi,
  bodyPattern: string,
  ordersXml: string,
) {
  await wireMock.addMethodHostMapping("POST", "/orderExcelFinal.asp", {
    request: { bodyPatterns: [{ contains: bodyPattern }] },
    response: {
      headers: { "Content-Type": "application/xml" },
      body: ordersXml,
    },
  });
}

async function mockBrickOwl(
  wireMock: WireMockApi,
  settings: SettingsOverrides,
  orders: BrickOwlOrderMock[],
  month?: string,
  period?: { from: string; to: string },
) {
  await settings.set("VAST_BRICKOWL_BASE_URL", wireMock.baseUrl);
  await settings.setSecret("VAST_BRICKOWL_API_KEY", "test-brickowl-api-key");
  await wireMock.addMethodHostMapping("GET", "/v1/order/list", {
    response: {
      json: orders.map((order) => ({
        order_id: order.orderId,
        order_date: order.orderDate,
      })),
    },
  });

  const requestedOrders = orders.filter((order) => {
    if (period) {
      const date = new Date(Number(order.orderDate) * 1000)
        .toISOString()
        .slice(0, 10);
      return date >= period.from && date <= period.to;
    }
    return month === undefined || orderMonth(order.orderDate) === month;
  });
  for (const batch of brickOwlBatches(requestedOrders)) {
    await addBrickOwlBatchMapping(wireMock, batch, "order/view", (order) => ({
      order_id: order.orderId,
      ...order.view,
    }));
  }
}

async function addBrickOwlBatchMapping(
  wireMock: WireMockApi,
  batch: BrickOwlOrderMock[],
  endpoint: string,
  body: (order: BrickOwlOrderMock) => unknown,
) {
  await wireMock.addMethodHostMapping("POST", "/v1/bulk/batch", {
    request: {
      bodyPatterns: [
        { contains: encodeURIComponent(endpoint) },
        {
          contains: encodeURIComponent(
            `"order_id":"${batch[batch.length - 1].orderId}"`,
          ),
        },
      ],
    },
    response: {
      json: batch.map((order, index) => ({
        req_num: index + 1,
        code: 200,
        body: body(order),
      })),
    },
  });
}

function orderMonth(orderDate: string): string {
  const date = new Date(Number(orderDate) * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function brickOwlBatches(orders: BrickOwlOrderMock[]): BrickOwlOrderMock[][] {
  const batches: BrickOwlOrderMock[][] = [];
  for (
    let start = 0;
    start < orders.length;
    start += brickOwlMaxBatchRequests
  ) {
    batches.push(orders.slice(start, start + brickOwlMaxBatchRequests));
  }
  return batches;
}

async function mockStripe(
  wireMock: WireMockApi,
  settings: SettingsOverrides,
  pages: StripeTransactionMock[][],
) {
  await mockStripeSettings(settings, wireMock);

  // Numbered across the pages so every transaction and its charge is unique, whichever page it was returned on.
  let transactionNumber = 0;
  await stubStripeBalanceTransactions(
    wireMock,
    pages.map((page) =>
      page.map((transaction) => {
        const number = ++transactionNumber;
        return stripeBalanceTransaction({
          ...transaction,
          id: `txn_${number}`,
          charge: `test-charge-${number}`,
        });
      }),
    ),
  );
}

function stripeBalanceTransaction(
  transaction: StripeTransactionMock & { id: string; charge: string },
) {
  const type = transaction.type ?? "charge";
  const paymentIntent =
    transaction.paymentIntent === undefined
      ? `pi_${transaction.charge}`
      : transaction.paymentIntent;
  return {
    id: transaction.id,
    object: "balance_transaction",
    // The client asks for the charge to be expanded, so it arrives as the object rather than as its id.
    source: {
      id: `ch_${transaction.charge}`,
      object: "charge",
      payment_intent: paymentIntent,
      amount_refunded: transaction.amountRefunded ?? 0,
      refunded: (transaction.amountRefunded ?? 0) > 0,
    },
    type,
    reporting_category: type,
    status: "available",
    currency: "eur",
    amount: transaction.amount,
    fee: (transaction.applicationFee ?? 0) + (transaction.stripeFee ?? 0),
    // Stripe lists every deduction here, its own and the marketplace's, and tells them apart by type alone.
    fee_details: [
      ...(transaction.applicationFee === undefined
        ? []
        : [
            {
              amount: transaction.applicationFee,
              application: "ca_test-marketplace-connect-application",
              currency: "eur",
              description: "BrickLink Payment Connector application fee",
              type: "application_fee",
            },
          ]),
      ...(transaction.stripeFee === undefined
        ? []
        : [
            {
              amount: transaction.stripeFee,
              currency: "eur",
              description: "Stripe processing fees",
              type: "stripe_fee",
            },
          ]),
    ],
    net:
      transaction.amount -
      (transaction.applicationFee ?? 0) -
      (transaction.stripeFee ?? 0),
    description: transaction.description,
  };
}

async function mockPayPal(
  wireMock: WireMockApi,
  settings: SettingsOverrides,
  pages: PayPalTransactionMock[][],
  month?: string,
) {
  await mockPayPalSettings(settings, wireMock);

  // The window a reconciled month is searched in opens at the padded month, so a scenario that names its month pins
  // its transactions to that first segment and asserts the window the API actually asked for.
  const firstSegment: WireMockValueMatcher | undefined =
    month === undefined ? undefined : { equalTo: paymentWindow(month).fromIso };

  let transactionNumber = 0;
  await stubPayPalTransactions(
    wireMock,
    pages.map((page) =>
      page.map((transaction) =>
        payPalTransaction(transaction, ++transactionNumber),
      ),
    ),
    firstSegment,
  );
}

function payPalTransaction(
  transaction: PayPalTransactionMock,
  transactionNumber: number,
) {
  const [givenName, ...surname] = (transaction.payerName ?? "").split(" ");
  return {
    transaction_info: {
      transaction_id:
        transaction.transactionId ??
        `test-paypal-transaction-${transactionNumber}`,
      ...(transaction.referenceId === undefined
        ? {}
        : { paypal_reference_id: transaction.referenceId }),
      transaction_event_code: transaction.eventCode ?? "T0006",
      transaction_initiation_date:
        transaction.initiatedAt ?? "2026-08-30T05:24:15Z",
      transaction_amount: { currency_code: "EUR", value: transaction.amount },
      fee_amount: {
        currency_code: "EUR",
        value: transaction.feeAmount ?? "-0.96",
      },
      transaction_status: "S",
      invoice_id: transaction.invoiceId ?? null,
    },
    payer_info: transaction.payerName
      ? {
          payer_name: {
            given_name: givenName,
            surname: surname.join(" "),
            alternate_full_name: transaction.payerName,
          },
        }
      : {},
    shipping_info: transaction.shippingName
      ? { name: transaction.shippingName }
      : {},
    cart_info: {},
  };
}
