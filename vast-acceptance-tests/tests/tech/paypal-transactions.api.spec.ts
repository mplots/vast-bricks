import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "../support/api-test";
import {
  ledgerWindow,
  mockPayPalLedger,
  type PayPalLedgerPage,
  type PayPalLedgerTransactionMock,
} from "../support/paypal-transactions";
import { WireMockApi, wireMockMode } from "../support/wiremock";

/**
 * The PayPal transaction screen reads the account's own ledger a period at a time, live, and stores nothing. So what
 * these scenarios are about is that every kind of transaction is listed — not only the ones that pay for an order,
 * which is reconciliation's business — and that the period comes to the four figures the foot of the table states.
 */

test.describe.configure({ mode: wireMockMode() });

const month = "2026-08";

async function ledgerOf(
  request: APIRequestContext,
  period = month,
): Promise<PayPalLedgerPage> {
  const response = await request.get(
    `/api/private/paypal-transactions?period=${period}`,
  );
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as PayPalLedgerPage;
}

/** The periods PayPal was asked for, as the client wrote them into its requests. */
async function requestedPeriods(wireMock: WireMockApi) {
  const requests = await wireMock.findMethodHostRequests(
    "GET",
    "/v1/reporting/transactions",
  );
  return requests.map((searchRequest) => {
    const query = new URL(searchRequest.url ?? "", "http://paypal.test")
      .searchParams;
    return {
      from: query.get("start_date") ?? "",
      to: query.get("end_date") ?? "",
    };
  });
}

const payment: PayPalLedgerTransactionMock = {
  id: "test-paypal-payment",
  amount: "15.07",
  fee: "-0.96",
  eventCode: "T0006",
  subject: "Brick Owl Order #16000123",
  invoiceId: "16000123",
  payerName: "Alan Turing",
  payerEmail: "alan.turing@example.test",
  initiatedAt: "2026-08-05T09:15:00Z",
};

const withdrawal: PayPalLedgerTransactionMock = {
  id: "test-paypal-withdrawal",
  amount: "-14.00",
  eventCode: "T0400",
  initiatedAt: "2026-08-07T04:00:00Z",
};

test("lists the transactions of the selected month, oldest first", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [[withdrawal, payment]],
    month,
  );

  const { transactions } = await ledgerOf(request);

  // Oldest first, the way a ledger is read, whichever order PayPal listed them in.
  expect(transactions.map((transaction) => transaction.id)).toEqual([
    "test-paypal-payment",
    "test-paypal-withdrawal",
  ]);
  expect(transactions[0]).toMatchObject({
    created: "2026-08-05T09:15:00Z",
    type: "T0006",
    description: "Brick Owl Order #16000123",
    invoiceId: "16000123",
    counterparty: "Alan Turing",
    counterpartyEmail: "alan.turing@example.test",
    // Reported unsigned with the direction beside it, the way a bank states an entry.
    amount: 15.07,
    direction: "CREDIT",
    // Signed as PayPal stated it: a fee is normally a deduction, and a refunded payment returns part of one.
    fee: -0.96,
    net: 14.11,
    currency: "EUR",
    status: "S",
  });
});

test("lists every kind of transaction, not only the ones that paid for an order", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [
      [
        payment,
        { id: "test-paypal-refund", amount: "-5.07", eventCode: "T1107" },
        withdrawal,
        {
          id: "test-paypal-conversion",
          amount: "-2.00",
          eventCode: "T0200",
        },
      ],
    ],
    month,
  );

  const { transactions } = await ledgerOf(request);

  // Each of these was raised against nothing the period collected, so each is a transaction of the account.
  expect(
    transactions.map((transaction) => [
      transaction.type,
      transaction.direction,
      transaction.amount,
    ]),
  ).toEqual(
    expect.arrayContaining([
      ["T0006", "CREDIT", 15.07],
      ["T1107", "DEBIT", 5.07],
      ["T0400", "DEBIT", 14],
      ["T0200", "DEBIT", 2],
    ]),
  );
});

/**
 * PayPal reports what a reader thinks of as one payment as several balance-affecting records, and shows them under
 * one transaction in its own interface. `paypal_reference_id` is what ties them, so the ledger reads them as one
 * transaction too: the commission comes off its payment, and neither it nor a conversion is a transaction of the
 * period in its own right.
 */
const partnerCommission: PayPalLedgerTransactionMock = {
  id: "test-paypal-partner-commission",
  amount: "-1.84",
  eventCode: "T0113",
  referenceId: "test-paypal-payment",
  initiatedAt: "2026-08-05T09:15:02Z",
};

/** A payment PayPal broke down the way it does on its own transaction page. */
const brokenDownPayment: PayPalLedgerTransactionMock = {
  ...payment,
  amount: "20.19",
  fee: "-1.44",
  salesTax: "1.84",
  shipping: "8.25",
  handling: "1.04",
  insurance: "0.00",
};

test("takes the partner commission off the payment it came out of", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [[brokenDownPayment, partnerCommission]],
    month,
  );

  const { transactions } = await ledgerOf(request);

  // One transaction, not two: the commission is what this payment cost rather than a movement of its own.
  expect(transactions).toHaveLength(1);
  expect(transactions[0]).toMatchObject({
    id: "test-paypal-payment",
    amount: 20.19,
    direction: "CREDIT",
    // Everything that came off it, whoever took it: PayPal's own fee and the marketplace's commission.
    fee: -3.28,
    net: 16.91,
  });
  expect(transactions[0].breakdown).toMatchObject({
    payPalFee: -1.44,
    partnerCommission: -1.84,
  });
});

test("counts the partner commission once, in the transaction it came off", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [[brokenDownPayment, partnerCommission]],
    month,
  );

  const { summary } = await ledgerOf(request);

  // The commission is counted once, as part of what left the account: it is not a transaction of the ledger, but
  // it is money out, and a bank charging the same fee would book it as an entry of its own. So it is in the debit
  // turnover, with the fee line a memo of how much of that turnover was fees rather than a second subtraction.
  expect(summary).toEqual([
    {
      currency: "EUR",
      creditTurnover: 20.19,
      debitTurnover: 3.28,
      // One figure for everything that came off, whoever took it: which party took which part of a transaction's
      // cost is a detail of that transaction rather than something a foot is read for.
      fees: -3.28,
      netMovement: 16.91,
      closingBalance: null,
    },
  ]);
});

test("breaks the gross down the way PayPal's own transaction page does", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [[brokenDownPayment]],
    month,
  );

  const { transactions } = await ledgerOf(request);

  expect(transactions[0].breakdown).toMatchObject({
    // PayPal states what it added to the purchase rather than the purchase itself, so what is left of the gross
    // once those come off is what was bought.
    purchaseTotal: 9.06,
    salesTax: 1.84,
    shipping: 8.25,
    handling: 1.04,
    insurance: 0,
  });
});

test("leaves a transaction PayPal broke down in no way without a purchase total", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(settings, request, testInfo, [[withdrawal]], month);

  const { transactions } = await ledgerOf(request);

  // A purchase total equal to the gross would say a breakdown was stated when none was.
  expect(transactions[0].breakdown?.purchaseTotal).toBeNull();
});

test("carries what PayPal raised against a transaction as its lines rather than as transactions", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [
      [
        withdrawal,
        partnerCommission,
        {
          id: "test-paypal-conversion",
          amount: "-15.07",
          eventCode: "T0200",
          referenceId: "test-paypal-payment",
          initiatedAt: "2026-08-05T09:15:04Z",
        },
        payment,
      ],
    ],
    month,
  );

  const { transactions } = await ledgerOf(request);

  // The period holds the payment and the withdrawal; what was raised against the payment is inside it.
  expect(transactions.map((transaction) => transaction.id)).toEqual([
    "test-paypal-payment",
    "test-paypal-withdrawal",
  ]);
  expect(transactions[0].lines.map((line) => [line.type, line.amount])).toEqual(
    [
      ["T0113", -1.84],
      ["T0200", -15.07],
    ],
  );
  // A conversion moves what was left rather than taking anything out, so it is a line and touches no figure.
  expect(transactions[0].fee).toBe(-2.8);
  expect(transactions[1].lines).toEqual([]);
});

/**
 * A payment taken in a currency the balance is not held in does not stay in it: PayPal takes the whole of it back
 * out and puts the result into the balance's own currency. The account moved by the second of those, so that is the
 * currency the ledger states the transaction in.
 */
const convertedPayment: PayPalLedgerTransactionMock = {
  id: "test-paypal-usd-payment",
  amount: "22.50",
  fee: "-0.90",
  currency: "USD",
  initiatedAt: "2026-08-11T08:00:00Z",
};

const conversionOut: PayPalLedgerTransactionMock = {
  id: "test-paypal-conversion-out",
  amount: "-21.60",
  currency: "USD",
  eventCode: "T0200",
  referenceId: "test-paypal-usd-payment",
  initiatedAt: "2026-08-11T08:00:02Z",
};

const conversionIn: PayPalLedgerTransactionMock = {
  id: "test-paypal-conversion-in",
  amount: "19.80",
  currency: "EUR",
  eventCode: "T0200",
  referenceId: "test-paypal-usd-payment",
  initiatedAt: "2026-08-11T08:00:02Z",
};

test("states a converted transaction in the currency it was converted into", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [[convertedPayment, conversionOut, conversionIn]],
    month,
  );

  const { transactions } = await ledgerOf(request);

  expect(transactions).toHaveLength(1);
  expect(transactions[0]).toMatchObject({
    currency: "EUR",
    // What PayPal actually put into the balance, which is PayPal's own figure.
    net: 19.8,
    // The transaction's own gross at the rate the two legs imply: 22.50 × 19.80 / 21.60.
    amount: 20.63,
    direction: "CREDIT",
    // Everything between the two, which is the fee taken on the other side of the conversion.
    fee: -0.83,
  });
});

test("keeps a converted transaction's own account in PayPal's own currency", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [[convertedPayment, conversionOut, conversionIn]],
    month,
  );

  const { transactions } = await ledgerOf(request);

  // The detail panel states what PayPal reported, in the currency PayPal reported it in, so a reader holding the
  // two side by side is reading one thing twice. It does not stop at that net: the conversion takes it back out,
  // and the line after it is what the account moved by.
  expect(transactions[0].breakdown).toMatchObject({
    currency: "USD",
    gross: 22.5,
    payPalFee: -0.9,
    net: 21.6,
    conversion: -21.6,
  });
  // Both legs are stated by those two lines, so neither is listed again beside the account it is already in.
  expect(transactions[0].lines.every((line) => line.accountedFor)).toBe(true);
});

test("counts a refund raised against a payment as a movement of its own", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [
      [
        payment,
        {
          id: "test-paypal-refund-of-payment",
          amount: "-8.63",
          eventCode: "T1107",
          // It names the payment it reverses, and is no part of that payment's account all the same: it is money
          // going back out on a day of its own, which the payment's figures say nothing about.
          referenceId: "test-paypal-payment",
          initiatedAt: "2026-08-19T04:51:50Z",
        },
      ],
    ],
    month,
  );

  const { transactions, summary } = await ledgerOf(request);

  expect(transactions.map((transaction) => transaction.id)).toEqual([
    "test-paypal-payment",
    "test-paypal-refund-of-payment",
  ]);
  // Folded into the payment it names, its money would leave the ledger: the period would come out over by the
  // whole of the refund, which is exactly what a period read against the account's own balance would show.
  expect(summary).toEqual([
    {
      currency: "EUR",
      creditTurnover: 15.07,
      debitTurnover: 9.59,
      fees: -0.96,
      netMovement: 5.48,
      closingBalance: null,
    },
  ]);
});
test("counts a converted transaction only in the currency the account moved in", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [[convertedPayment, conversionOut, conversionIn]],
    month,
  );

  const { summary } = await ledgerOf(request);

  // No currency the money only passed through: the account holds euro, and that is the whole of what it moved by.
  // The conversion legs are counted in neither turnover — the transaction's own gross is already what the account
  // moved by in the currency it was converted into, and counting the legs too would state that money twice.
  expect(summary).toEqual([
    {
      currency: "EUR",
      creditTurnover: 20.63,
      debitTurnover: 0.83,
      fees: -0.83,
      netMovement: 19.8,
      closingBalance: null,
    },
  ]);
});

test("leaves a transaction PayPal reported no leg out of in the currency it landed in", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [[convertedPayment, conversionIn]],
    month,
  );

  const { transactions } = await ledgerOf(request);

  // There is no rate to read without both legs, so the transaction is stated at what landed rather than at a rate
  // nobody stated.
  expect(transactions[0]).toMatchObject({
    currency: "EUR",
    amount: 19.8,
    net: 19.8,
    fee: null,
  });
});

test("reads a record raised against a commission under the payment they both belong to", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [
      [
        payment,
        partnerCommission,
        {
          id: "test-paypal-commission-conversion",
          amount: "-1.84",
          eventCode: "T0200",
          // Raised against the commission rather than against the payment: the chain is followed to its head.
          referenceId: "test-paypal-partner-commission",
          initiatedAt: "2026-08-05T09:15:06Z",
        },
      ],
    ],
    month,
  );

  const { transactions } = await ledgerOf(request);

  expect(transactions).toHaveLength(1);
  expect(transactions[0].lines.map((line) => line.id)).toEqual([
    "test-paypal-partner-commission",
    "test-paypal-commission-conversion",
  ]);
});

test("takes a commission off its payment though the two are dated days apart", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [
      [
        payment,
        { ...partnerCommission, initiatedAt: "2026-08-20T11:00:00Z" },
        withdrawal,
      ],
    ],
    month,
  );

  const { transactions } = await ledgerOf(request);

  // A commission taken a fortnight later is still what its payment cost rather than a transaction of its own in
  // the middle of the month.
  expect(transactions.map((transaction) => transaction.id)).toEqual([
    "test-paypal-payment",
    "test-paypal-withdrawal",
  ]);
  expect(transactions[0].fee).toBe(-2.8);
});

test("lists a record naming nothing the period collected as a transaction of its own", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [
      [
        // PayPal writes a payment's own base id here — the checkout it came from, which is no transaction of the
        // ledger — and a commission raised against a payment of another month names one this period never collected.
        { ...payment, referenceId: "test-paypal-checkout" },
        {
          id: "test-paypal-older-commission",
          amount: "-0.80",
          eventCode: "T0113",
          referenceId: "test-paypal-payment-of-another-month",
        },
      ],
    ],
    month,
  );

  const { transactions } = await ledgerOf(request);

  expect(transactions.map((transaction) => transaction.id)).toEqual(
    expect.arrayContaining([
      "test-paypal-payment",
      "test-paypal-older-commission",
    ]),
  );
  expect(transactions[0].lines).toEqual([]);
});

test("reports no fee where PayPal deducted nothing", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(settings, request, testInfo, [[withdrawal]], month);

  const { transactions } = await ledgerOf(request);

  // Nothing deducted is a different fact from a fee of zero, so the field is absent rather than nought.
  expect(transactions[0].fee).toBeNull();
  expect(transactions[0].net).toBe(-14);
});

test("names the counterparty by the shipping recipient where PayPal spelled no payer", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [[{ ...payment, payerName: undefined, shippingName: "Grace Hopper" }]],
    month,
  );

  const { transactions } = await ledgerOf(request);

  expect(transactions[0].counterparty).toBe("Grace Hopper");
});

test("states what the period came to, per currency", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [
      [
        payment,
        withdrawal,
        {
          id: "test-paypal-usd-payment",
          amount: "20.00",
          fee: "-1.00",
          currency: "USD",
        },
      ],
    ],
    month,
  );

  const { summary } = await ledgerOf(request);

  expect(summary).toEqual([
    {
      currency: "EUR",
      creditTurnover: 15.07,
      // The withdrawal and the fee taken out of the payment, both being money that left the account.
      debitTurnover: 14.96,
      // Signed as PayPal states a fee, and already inside the debit turnover above rather than a term beside it.
      fees: -0.96,
      // What the balance moved by, which the two turnovers come to on their own.
      netMovement: 0.11,
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

test("states where the account stood when the period ended, as PayPal states it", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(settings, request, testInfo, [[payment]], month, [
    ["EUR", "1267.09"],
  ]);

  const { summary } = await ledgerOf(request);

  // PayPal's own figure rather than one worked out: unlike Stripe, it answers for the balance at a stated moment.
  expect(summary[0].closingBalance).toBe(1267.09);
  // And a different question from what the period did, which is the line above it.
  expect(summary[0].netMovement).toBe(14.11);
});

test("links every transaction to PayPal, which addresses one by its id alone", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [[payment, withdrawal]],
    month,
  );

  const { transactions } = await ledgerOf(request);
  const linkOf = (id: string) =>
    transactions.find((transaction) => transaction.id === id)?.link;

  expect(linkOf("test-paypal-payment")).toBe(
    "https://www.paypal.com/unifiedtransactions/details/payment/test-paypal-payment",
  );
  // Unlike Stripe, PayPal needs no account to address a transaction, so a withdrawal has a page too.
  expect(linkOf("test-paypal-withdrawal")).toBe(
    "https://www.paypal.com/unifiedtransactions/details/payment/test-paypal-withdrawal",
  );
});

test("asks PayPal for the month as a UTC window and follows its paging", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [[payment], [withdrawal]],
    month,
  );

  const { transactions } = await ledgerOf(request);

  // One list out of the pages PayPal returned it in.
  expect(transactions.map((transaction) => transaction.id)).toEqual([
    "test-paypal-payment",
    "test-paypal-withdrawal",
  ]);
  // The whole month in UTC, both ends included, and no padding: this screen reads the ledger itself, where a
  // transaction belongs to the period PayPal dated it in.
  const window = ledgerWindow(month);
  expect(await requestedPeriods(wireMock)).toEqual([
    { from: window.fromIso, to: window.toIso },
    { from: window.fromIso, to: window.toIso },
  ]);
});

test("reads a year as the whole year, a segment at a time", async ({
  request,
  settings,
}, testInfo) => {
  const year = "2025";
  const wireMock = await mockPayPalLedger(
    settings,
    request,
    testInfo,
    [[{ ...payment, initiatedAt: "2025-08-05T09:15:00Z" }]],
    year,
  );

  const { transactions } = await ledgerOf(request, year);

  expect(transactions).toHaveLength(1);
  // PayPal searches no more than 31 days in one request, so a year is covered by consecutive segments that overlap
  // nowhere: the first opens at the year and the last closes at it.
  const periods = await requestedPeriods(wireMock);
  const window = ledgerWindow(year);
  expect(periods.length).toBeGreaterThan(1);
  expect(periods[0].from).toBe(window.fromIso);
  expect(periods[periods.length - 1].to).toBe(window.toIso);
});

test("refuses a period that is neither a month nor a year", async ({
  request,
  settings,
}, testInfo) => {
  await mockPayPalLedger(settings, request, testInfo, [[payment]], month);

  const response = await request.get(
    "/api/private/paypal-transactions?period=2026-13-01",
  );

  expect(response.status()).toBe(400);
});

test("reads no transactions without a login", async ({ anonymousRequest }) => {
  const response = await anonymousRequest.get(
    `/api/private/paypal-transactions?period=${month}`,
  );

  expect(response.status()).toBe(401);
});
