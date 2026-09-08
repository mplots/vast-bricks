import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "../support/api-test";
import { stubStripeBalanceTransactions } from "../support/stripe";
import {
  ledgerWindow,
  mockStripeLedger,
  type StripeLedgerPage,
  type StripeLedgerTransactionMock,
} from "../support/stripe-transactions";
import { WireMockApi, wireMockMode } from "../support/wiremock";

/**
 * The Stripe transaction screen reads the account's own ledger a period at a time, live, and stores nothing. So what
 * these scenarios are about is that every kind of balance transaction is listed — not only the ones that pay for an
 * order, which is reconciliation's business — and that the period comes to the four figures the foot of the table
 * states.
 */

test.describe.configure({ mode: wireMockMode() });

const month = "2026-08";

async function ledgerOf(
  request: APIRequestContext,
  period = month,
): Promise<StripeLedgerPage> {
  const response = await request.get(
    `/api/private/stripe-transactions?period=${period}`,
  );
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as StripeLedgerPage;
}

/** The period Stripe was asked for, as the client wrote it into its request. */
async function requestedPeriods(wireMock: WireMockApi) {
  const requests = await wireMock.findMethodHostRequests(
    "GET",
    "/v1/balance_transactions",
  );
  return requests.map((balanceRequest) => {
    const query = new URL(balanceRequest.url ?? "", "http://stripe.test")
      .searchParams;
    return {
      from: query.get("created[gte]") ?? "",
      to: query.get("created[lte]") ?? "",
    };
  });
}

const payment: StripeLedgerTransactionMock = {
  id: "txn_test-payment",
  amount: 1507,
  fee: 47,
  type: "charge",
  description: "Brick Owl Order #16000123",
  createdAt: "2026-08-05T09:15:00Z",
  charge: { id: "ch_test-payment", paymentIntent: "pi_test-payment" },
};

const payout: StripeLedgerTransactionMock = {
  id: "txn_test-payout",
  amount: -1400,
  type: "payout",
  description: "STRIPE PAYOUT",
  createdAt: "2026-08-07T04:00:00Z",
};

test("lists the balance transactions of the selected month, oldest first", async ({
  request,
  settings,
}, testInfo) => {
  await mockStripeLedger(settings, request, testInfo, [[payout, payment]]);

  const { transactions } = await ledgerOf(request);

  // Oldest first, the way a ledger is read, whichever order Stripe listed them in.
  expect(transactions.map((transaction) => transaction.id)).toEqual([
    "txn_test-payment",
    "txn_test-payout",
  ]);
  expect(transactions[0]).toMatchObject({
    created: "2026-08-05T09:15:00Z",
    type: "charge",
    description: "Brick Owl Order #16000123",
    // Reported unsigned with the direction beside it, the way a bank states an entry.
    amount: 15.07,
    direction: "CREDIT",
    // Signed as a deduction, the way PayPal states one: Stripe states a fee the other way up and the backend turns
    // it round so the two ledgers read alike.
    fee: -0.47,
    net: 14.6,
    currency: "EUR",
    status: "available",
    sourceId: "ch_test-payment",
  });
});

test("lists every kind of balance transaction, not only the ones that paid for an order", async ({
  request,
  settings,
}, testInfo) => {
  await mockStripeLedger(settings, request, testInfo, [
    [
      payment,
      { id: "txn_test-refund", amount: -507, type: "refund" },
      payout,
      { id: "txn_test-fee", amount: -12, type: "stripe_fee" },
    ],
  ]);

  const { transactions } = await ledgerOf(request);

  expect(
    transactions.map((transaction) => [
      transaction.type,
      transaction.direction,
      transaction.amount,
    ]),
  ).toEqual(
    expect.arrayContaining([
      ["charge", "CREDIT", 15.07],
      ["refund", "DEBIT", 5.07],
      ["payout", "DEBIT", 14],
      ["stripe_fee", "DEBIT", 0.12],
    ]),
  );
});

test("reports no fee where Stripe deducted nothing", async ({
  request,
  settings,
}, testInfo) => {
  await mockStripeLedger(settings, request, testInfo, [[payout]]);

  const { transactions } = await ledgerOf(request);

  // Nothing deducted is a different fact from a fee of zero, so the field is absent rather than nought.
  expect(transactions[0].fee).toBeNull();
  expect(transactions[0].net).toBe(-14);
});

test("states what the period came to, per currency", async ({
  request,
  settings,
}, testInfo) => {
  await mockStripeLedger(settings, request, testInfo, [
    [
      payment,
      payout,
      {
        id: "txn_test-usd-payment",
        amount: 2000,
        fee: 100,
        currency: "usd",
        charge: { id: "ch_test-usd", paymentIntent: "pi_test-usd" },
      },
    ],
  ]);

  const { summary } = await ledgerOf(request);

  expect(summary).toEqual([
    {
      currency: "EUR",
      creditTurnover: 15.07,
      // The payout and the fee taken out of the payment, both being money that left the account.
      debitTurnover: 14.47,
      // Signed as a deduction, and already inside the debit turnover above rather than a term beside it.
      fees: -0.47,
      // What the balance moved by: credits less debits less fees.
      netMovement: 0.6,
      // Stripe was not asked what it holds in this scenario, and a balance that could not be established is left
      // unstated rather than guessed.
      closingBalance: null,
    },
    {
      currency: "USD",
      creditTurnover: 20,
      debitTurnover: 1,
      fees: -1,
      netMovement: 19,
      closingBalance: null,
    },
  ]);
});

test("states where the account stood when the period ended", async ({
  request,
  settings,
}, testInfo) => {
  await mockStripeLedger(settings, request, testInfo, [[payment]], {
    period: month,
    // What the account holds now, held and pending together: what it stood at is everything in it, not only the
    // part that could have been spent that day.
    held: { available: [[100_00, "eur"]], pending: [[5_00, "eur"]] },
  });

  const { summary } = await ledgerOf(request);

  // Nothing has moved since the period ended, so the closing balance is simply what Stripe holds.
  expect(summary[0].closingBalance).toBe(105);
  // And a different question from what the period did, which is the line above it.
  expect(summary[0].netMovement).toBe(14.6);
});

test("works the closing balance back over what has moved since the period ended", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = await mockStripeLedger(
    settings,
    request,
    testInfo,
    [[payment]],
    {
      period: month,
      held: { available: [[100_00, "eur"]] },
    },
  );
  // Stripe answers for the balance at this moment and no other, so a period that has ended is worked back to: this
  // landed after the month, and the account did not hold it when the month closed.
  await stubStripeBalanceTransactions(
    wireMock,
    [
      [
        {
          id: "txn_test-later",
          object: "balance_transaction",
          created: Math.floor(
            new Date("2026-09-02T10:00:00Z").getTime() / 1000,
          ),
          type: "charge",
          status: "available",
          currency: "eur",
          amount: 20_00,
          fee: 0,
          fee_details: [],
          net: 20_00,
          description: null,
          source: null,
        },
      ],
    ],
    { equalTo: String(ledgerWindow(month).to + 1) },
  );

  const { summary } = await ledgerOf(request);

  expect(summary[0].closingBalance).toBe(80);
});

test("links a payment to Stripe and leaves a payout without one", async ({
  request,
  settings,
}, testInfo) => {
  await mockStripeLedger(settings, request, testInfo, [[payment, payout]]);

  const { transactions } = await ledgerOf(request);
  const linkOf = (id: string) =>
    transactions.find((transaction) => transaction.id === id)?.link;

  expect(linkOf("txn_test-payment")).toBe(
    "https://dashboard.stripe.com/acct_test-stripe-account/payments/pi_test-payment",
  );
  // Stripe addresses a payment, not a payout, so a guessed link is left off rather than sent somewhere unrelated.
  expect(linkOf("txn_test-payout")).toBeNull();
});

test("addresses a payment taken without a payment intent by its charge", async ({
  request,
  settings,
}, testInfo) => {
  await mockStripeLedger(settings, request, testInfo, [
    [{ ...payment, charge: { id: "ch_test-older", paymentIntent: null } }],
  ]);

  const { transactions } = await ledgerOf(request);

  expect(transactions[0].link).toBe(
    "https://dashboard.stripe.com/acct_test-stripe-account/payments/ch_test-older",
  );
});

test("asks Stripe for the month as a UTC window and follows its paging", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = await mockStripeLedger(settings, request, testInfo, [
    [payment],
    [payout],
  ]);

  const { transactions } = await ledgerOf(request);

  // One list out of the pages Stripe returned it in.
  expect(transactions.map((transaction) => transaction.id)).toEqual([
    "txn_test-payment",
    "txn_test-payout",
  ]);
  // The whole month in UTC, both ends included, and no padding: this screen reads the ledger itself, where a
  // transaction belongs to the period Stripe dated it in.
  expect(await requestedPeriods(wireMock)).toEqual([
    { from: "1785542400", to: "1788220799" },
    { from: "1785542400", to: "1788220799" },
  ]);
});

test("reads a year as the whole year", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = await mockStripeLedger(settings, request, testInfo, [
    [payment],
  ]);

  const { transactions } = await ledgerOf(request, "2026");

  expect(transactions).toHaveLength(1);
  expect(await requestedPeriods(wireMock)).toEqual([
    { from: "1767225600", to: "1798761599" },
  ]);
});

test("refuses a period that is neither a month nor a year", async ({
  request,
  settings,
}, testInfo) => {
  await mockStripeLedger(settings, request, testInfo, [[payment]]);

  const response = await request.get(
    "/api/private/stripe-transactions?period=2026-13-01",
  );

  expect(response.status()).toBe(400);
});

test("reads no transactions without a login", async ({ anonymousRequest }) => {
  const response = await anonymousRequest.get(
    `/api/private/stripe-transactions?period=${month}`,
  );

  expect(response.status()).toBe(401);
});
