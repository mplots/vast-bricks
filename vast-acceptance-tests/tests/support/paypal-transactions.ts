import type { APIRequestContext, TestInfo } from "@playwright/test";

import type { SettingsOverrides } from "./api-test";
import {
  mockPayPalSettings,
  stubPayPalBalances,
  stubPayPalTransactions,
} from "./paypal";
import { WireMockApi } from "./wiremock";

/**
 * The transactions a PayPal transaction scenario states, so a scenario names the ledger facts it is about and
 * nothing of PayPal's own protocol. PayPal's paging, its token exchange and the settings that point the client at
 * WireMock are `support/paypal`, shared with the reconciliation fixtures.
 */
export type PayPalLedgerTransactionMock = {
  /** PayPal's id for the transaction. Left out to have one made up from its place in the list. */
  id?: string;
  /** Amount as PayPal states one: a decimal string, negative for money leaving the balance. */
  amount: string;
  /** What PayPal deducted, as PayPal states it: normally negative. Left out for a transaction it deducted none from. */
  fee?: string;
  currency?: string;
  /** PayPal's event code: `T0006` a payment received, `T0113` a partner fee, `T0400` a withdrawal to the bank. */
  eventCode?: string;
  /** PayPal's status letter: `S` settled, `P` pending, `V` reversed, `D` denied. */
  status?: string;
  /** What PayPal carried as the transaction's subject. */
  subject?: string;
  /** What the marketplace labelled the payment with. */
  invoiceId?: string;
  /** The transaction this one was raised against, such as the payment a partner commission came out of. */
  referenceId?: string;
  /** What PayPal breaks the gross down into. A field left out is one the transaction had none of. */
  salesTax?: string;
  shipping?: string;
  handling?: string;
  insurance?: string;
  payerName?: string;
  payerEmail?: string;
  shippingName?: string;
  /** When PayPal dated it, as an ISO instant. */
  initiatedAt?: string;
};

/** The from and to a period is searched as: the whole period in UTC, both ends included and unpadded. */
export function ledgerWindow(period: string) {
  const [year, month] = period.split("-").map(Number);
  const from = month
    ? Date.UTC(year, month - 1, 1, 0, 0, 0)
    : Date.UTC(year, 0, 1, 0, 0, 0);
  const to = month
    ? Date.UTC(year, month, 0, 23, 59, 59)
    : Date.UTC(year, 11, 31, 23, 59, 59);
  return { fromIso: isoInstant(from), toIso: isoInstant(to) };
}

/** An instant as Java writes one: no fractional seconds, which is what the PayPal client sends. */
const isoInstant = (epochMillis: number) =>
  new Date(epochMillis).toISOString().replace(".000Z", "Z");

/**
 * Mocks PayPal for one scenario: the settings that reach WireMock, and the pages the ledger is returned in.
 *
 * <p>A scenario that names the period it is reading pins its transactions to the first segment PayPal is searched
 * in, so a longer period's later segments report none rather than the same transactions over again.
 */
export async function mockPayPalLedger(
  settings: SettingsOverrides,
  request: APIRequestContext,
  testInfo: TestInfo,
  pages: PayPalLedgerTransactionMock[][],
  period?: string,
  held?: [string, string][],
) {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  await mockPayPalSettings(settings, wireMock);
  if (held) await stubPayPalBalances(wireMock, held);

  let transactionNumber = 0;
  await stubPayPalTransactions(
    wireMock,
    pages.map((page) =>
      page.map((transaction) =>
        payPalTransaction(transaction, ++transactionNumber),
      ),
    ),
    period === undefined
      ? undefined
      : { equalTo: ledgerWindow(period).fromIso },
  );

  return wireMock;
}

function payPalTransaction(
  transaction: PayPalLedgerTransactionMock,
  transactionNumber: number,
) {
  const currency = transaction.currency ?? "EUR";
  const [givenName, ...surname] = (transaction.payerName ?? "").split(" ");
  return {
    transaction_info: {
      transaction_id:
        transaction.id ?? `test-paypal-transaction-${transactionNumber}`,
      ...(transaction.referenceId === undefined
        ? {}
        : { paypal_reference_id: transaction.referenceId }),
      transaction_event_code: transaction.eventCode ?? "T0006",
      transaction_initiation_date:
        transaction.initiatedAt ?? "2026-08-15T12:00:00Z",
      transaction_amount: {
        currency_code: currency,
        value: transaction.amount,
      },
      ...(transaction.fee === undefined
        ? {}
        : { fee_amount: { currency_code: currency, value: transaction.fee } }),
      ...breakdown(transaction, currency),
      transaction_status: transaction.status ?? "S",
      transaction_subject: transaction.subject ?? null,
      invoice_id: transaction.invoiceId ?? null,
    },
    payer_info:
      transaction.payerName || transaction.payerEmail
        ? {
            ...(transaction.payerEmail === undefined
              ? {}
              : { email_address: transaction.payerEmail }),
            ...(transaction.payerName === undefined
              ? {}
              : {
                  payer_name: {
                    given_name: givenName,
                    surname: surname.join(" "),
                    alternate_full_name: transaction.payerName,
                  },
                }),
          }
        : {},
    shipping_info: transaction.shippingName
      ? { name: transaction.shippingName }
      : {},
    cart_info: {},
  };
}

/** What PayPal states the gross was made up of, stated only where the scenario named it. */
function breakdown(transaction: PayPalLedgerTransactionMock, currency: string) {
  const amount = (value?: string) =>
    value === undefined ? undefined : { currency_code: currency, value };
  return {
    ...(transaction.salesTax === undefined
      ? {}
      : { sales_tax_amount: amount(transaction.salesTax) }),
    ...(transaction.shipping === undefined
      ? {}
      : { shipping_amount: amount(transaction.shipping) }),
    ...(transaction.handling === undefined
      ? {}
      : { handling_amount: amount(transaction.handling) }),
    ...(transaction.insurance === undefined
      ? {}
      : { insurance_amount: amount(transaction.insurance) }),
  };
}

/** The transactions and the summary the screen reads, as the API returns them. */
export type PayPalLedgerPage = {
  transactions: Array<{
    id: string | null;
    created: string | null;
    type: string | null;
    description: string | null;
    invoiceId: string | null;
    counterparty: string | null;
    counterpartyEmail: string | null;
    amount: number | null;
    direction: "CREDIT" | "DEBIT";
    fee: number | null;
    net: number | null;
    currency: string | null;
    status: string | null;
    sourceId: string | null;
    link: string | null;
    breakdown: {
      currency: string | null;
      purchaseTotal: number | null;
      salesTax: number | null;
      shipping: number | null;
      handling: number | null;
      insurance: number | null;
      discount: number | null;
      shippingDiscount: number | null;
      payPalFee: number | null;
      partnerCommission: number | null;
      disputeFee: number | null;
      gross: number | null;
      net: number | null;
      conversion: number | null;
    } | null;
    lines: Array<{
      accountedFor: boolean;
      id: string | null;
      created: string | null;
      type: string | null;
      amount: number | null;
      currency: string | null;
      status: string | null;
      link: string | null;
    }>;
  }>;
  summary: Array<{
    currency: string | null;
    debitTurnover: number;
    creditTurnover: number;
    fees: number;
    closingBalance: number | null;
    netMovement: number;
  }>;
};
