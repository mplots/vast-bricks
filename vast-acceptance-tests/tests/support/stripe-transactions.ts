import type { APIRequestContext, TestInfo } from "@playwright/test";

import type { SettingsOverrides } from "./api-test";
import {
  mockStripeSettings,
  stubStripeBalance,
  stubStripeBalanceTransactions,
  type StripeHeldMock,
} from "./stripe";
import { WireMockApi } from "./wiremock";

/**
 * The balance transactions a Stripe transaction scenario states, so a scenario names the ledger facts it is about
 * and nothing of Stripe's own protocol. Stripe's paging and the settings that point the client at WireMock are
 * `support/stripe`, shared with the reconciliation fixtures.
 */
export type StripeLedgerTransactionMock = {
  /** Stripe's id for the transaction. Left out to have one made up from the transaction's place in the list. */
  id?: string;
  /** Amount in minor units, negative for money leaving the balance, as Stripe reports it. */
  amount: number;
  /** Balance transaction type: `charge`, `refund`, `payout`, `stripe_fee` and the rest of Stripe's own list. */
  type?: string;
  /** What Stripe deducted from the transaction, in minor units. */
  fee?: number;
  /** What Stripe carried on the transaction, which for a payment is what the marketplace labelled it. */
  description?: string;
  /** When Stripe dated it, as an ISO instant. Its second is what the period window is asserted against. */
  createdAt?: string;
  currency?: string;
  status?: string;
  /**
   * The charge behind the transaction, expanded as the client asks for it. Left out for a transaction that is not a
   * charge, which is what leaves a payout or a fee without a payment link.
   */
  charge?: { id: string; paymentIntent?: string | null };
};

/** The UTC window a period is fetched as, in the epoch seconds Stripe is asked for it in. */
export function ledgerWindow(period: string) {
  const [year, month] = period.split("-").map(Number);
  const from = month
    ? Date.UTC(year, month - 1, 1, 0, 0, 0)
    : Date.UTC(year, 0, 1, 0, 0, 0);
  const to = month
    ? Date.UTC(year, month, 0, 23, 59, 59)
    : Date.UTC(year, 11, 31, 23, 59, 59);
  return { from: from / 1000, to: to / 1000 };
}

/**
 * Mocks Stripe for one scenario: the settings that reach WireMock, and the pages the ledger is returned in.
 *
 * <p>A scenario reading a closing balance states `period`, which pins its transactions to that period's own window:
 * the ledger asks for a second window when it works the balance back from what the account holds now, and an
 * unpinned stub would answer that one with the period's transactions too.
 */
export async function mockStripeLedger(
  settings: SettingsOverrides,
  request: APIRequestContext,
  testInfo: TestInfo,
  pages: StripeLedgerTransactionMock[][],
  options: { period?: string; held?: StripeHeldMock } = {},
) {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  await mockStripeSettings(settings, wireMock);
  if (options.held) await stubStripeBalance(wireMock, options.held);

  let transactionNumber = 0;
  await stubStripeBalanceTransactions(
    wireMock,
    pages.map((page) =>
      page.map((transaction) =>
        balanceTransaction(transaction, ++transactionNumber),
      ),
    ),
    options.period === undefined
      ? undefined
      : { equalTo: String(ledgerWindow(options.period).from) },
  );

  return wireMock;
}

function balanceTransaction(
  transaction: StripeLedgerTransactionMock,
  number: number,
) {
  const type = transaction.type ?? "charge";
  const fee = transaction.fee ?? 0;
  return {
    id: transaction.id ?? `txn_test-${number}`,
    object: "balance_transaction",
    created: Math.floor(
      new Date(transaction.createdAt ?? "2026-08-15T12:00:00Z").getTime() /
        1000,
    ),
    type,
    reporting_category: type,
    status: transaction.status ?? "available",
    currency: transaction.currency ?? "eur",
    amount: transaction.amount,
    fee,
    fee_details:
      fee === 0 ? [] : [{ amount: fee, currency: "eur", type: "stripe_fee" }],
    net: transaction.amount - fee,
    description: transaction.description ?? null,
    // The client asks for the source to be expanded, so a charge arrives as the object rather than as its id.
    source: transaction.charge
      ? {
          id: transaction.charge.id,
          object: "charge",
          payment_intent: transaction.charge.paymentIntent ?? null,
        }
      : null,
  };
}

/** The transactions and the summary the screen reads, as the API returns them. */
export type StripeLedgerPage = {
  transactions: Array<{
    id: string;
    created: string | null;
    type: string | null;
    description: string | null;
    amount: number | null;
    direction: "CREDIT" | "DEBIT";
    fee: number | null;
    net: number | null;
    currency: string | null;
    status: string | null;
    sourceId: string | null;
    link: string | null;
  }>;
  summary: Array<{
    currency: string | null;
    debitTurnover: number;
    creditTurnover: number;
    fees: number;
    netMovement: number;
    closingBalance: number | null;
  }>;
};
