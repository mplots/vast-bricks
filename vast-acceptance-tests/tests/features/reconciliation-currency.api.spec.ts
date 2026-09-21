import { expect, test } from "../support/api-test";
import { anEcbRateDate, mockEcb } from "../support/ecb";
import { mockReconciliationOrders } from "../support/reconciliation";

async function rates(settings: Parameters<typeof mockEcb>[0], request: Parameters<typeof mockEcb>[1], info: Parameters<typeof mockEcb>[2]) {
  const date = anEcbRateDate(info);
  await mockEcb(settings, request, info, date, { XTS: "2", USD: "2", JPY: "100" });
  expect((await request.post("/api/private/jobs/currency-rate-sync/run?force=true")).status()).toBe(202);
  await expect.poll(async () => (await (await request.get("/api/private/jobs/currency-rate-sync")).json()).lastRun?.outcome).toBe("succeeded");
  return { date, seconds: Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000) };
}

async function report(request: Parameters<typeof mockEcb>[1], date: string) {
  const response = await request.get(`/api/private/reconciliation/orders?from=${date}&to=${date}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).orders[0];
}

test("Stripe settlement, marketplace base, and charge refund use their own currencies", async ({ request, settings }, info) => {
  const { date, seconds } = await rates(settings, request, info);
  await mockReconciliationOrders(settings, request, info, {
    period: { from: date, to: date },
    brickOwl: [{ orderId: "910001", orderDate: String(seconds), view: {
      base_currency: "XTS", payment_currency: "DKK", base_order_total: "200", sub_total: "180", ship_total: "20",
      payment_method_type: "stripe", refund_total: "40", brickowl_fee: "4.77",
    } }],
    stripe: [{ description: "Brick Owl Order 910001", amount: 10000, stripeFee: 175, currency: "eur", chargeCurrency: "XTS", amountRefunded: 4000, created: seconds }],
  });
  const row = await report(request, date);
  expect(row.order).toMatchObject({ currency: "DKK", grandTotal: 100, subTotal: 90, shippingCost: 10, refundedAmount: 20 });
  expect(row.gateway).toMatchObject({ paidAmount: 100, feeAmount: 1.75, refundedAmount: 20 });
  expect(row.calculated).toMatchObject({ targetInvoice: 80, paymentFee: 1.75, marketplaceFee: 2.39 });
  expect(row.failures.map((failure: { code: string }) => failure.code)).not.toContain("refunded-amount-mismatch");
});

test("PayPal converts each refund and fee before aggregating", async ({ request, settings }, info) => {
  const { date, seconds } = await rates(settings, request, info);
  await mockReconciliationOrders(settings, request, info, {
    period: { from: date, to: date },
    brickOwl: [{ orderId: "910002", orderDate: String(seconds), view: { base_currency: "EUR", payment_currency: "XTS", base_order_total: "100", payment_method_type: "paypal", refund_total: "30" } }],
    payPal: [
      { invoiceId: "910002", transactionId: "PAY-CURRENCY", amount: "200", currency: "XTS", feeAmount: "-3.75", feeCurrency: "EUR", initiatedAt: `${date}T00:00:00Z` },
      { referenceId: "PAY-CURRENCY", eventCode: "T1107", amount: "-40", currency: "XTS", initiatedAt: `${date}T00:00:00Z` },
      { referenceId: "PAY-CURRENCY", eventCode: "T1107", amount: "-10", currency: "EUR", initiatedAt: `${date}T00:00:00Z` },
      { referenceId: "PAY-CURRENCY", eventCode: "T0113", amount: "-6", currency: "XTS", initiatedAt: `${date}T00:00:00Z` },
    ],
  });
  const row = await report(request, date);
  expect(row.gateway).toMatchObject({ paidAmount: 100, feeAmount: 3.75, refundedAmount: 30, facilitatorTax: 3 });
  expect(row.calculated.targetInvoice).toBe(70);
});

test("a refund without a rate leaves the invoice unknown instead of subtracting only known refunds", async ({ request, settings }, info) => {
  const date = "2026-08-10";
  await mockReconciliationOrders(settings, request, info, {
    period: { from: date, to: date },
    brickOwl: [{ orderId: "910003", orderDate: String(Date.parse(date) / 1000), view: { base_order_total: "100", payment_method_type: "paypal" } }],
    payPal: [
      { invoiceId: "910003", transactionId: "PAY-MISSING", amount: "100", initiatedAt: `${date}T00:00:00Z` },
      { referenceId: "PAY-MISSING", eventCode: "T1107", amount: "-10", currency: "EUR", initiatedAt: `${date}T00:00:00Z` },
      { referenceId: "PAY-MISSING", eventCode: "T1107", amount: "-20", currency: "ZZZ", initiatedAt: `${date}T00:00:00Z` },
    ],
  });
  const row = await report(request, date);
  expect(row.gateway.refundedAmount).toBeNull();
  expect(row.calculated.targetInvoice).toBeNull();
  expect(row.failures.map((failure: { code: string }) => failure.code)).toContain("currency-conversion-missing");
});

test("Stripe zero-decimal charge refunds are not divided by one hundred", async ({ request, settings }, info) => {
  const { date, seconds } = await rates(settings, request, info);
  await mockReconciliationOrders(settings, request, info, {
    period: { from: date, to: date },
    brickOwl: [{ orderId: "910004", orderDate: String(seconds), view: { base_order_total: "100", payment_method_type: "stripe", refund_total: "20" } }],
    stripe: [{ description: "Brick Owl Order 910004", amount: 10000, chargeCurrency: "jpy", amountRefunded: 2000, created: seconds }],
  });
  const row = await report(request, date);
  expect(row.gateway.refundedAmount).toBe(20);
  expect(row.calculated.targetInvoice).toBe(80);
});

test("BrickLink commission uses USD tier thresholds", async ({ request, settings }, info) => {
  const { date } = await rates(settings, request, info);
  const [year, month, day] = date.split("-");
  await mockReconciliationOrders(settings, request, info, {
    period: { from: date, to: date },
    brickLink: {
      fullNameOrdersXml: `<ORDERS><ORDER><ORDERID>910005</ORDERID><ORDERDATE>${month}/${day}/${year}</ORDERDATE><BASECURRENCYCODE>EUR</BASECURRENCYCODE><PAYCURRENCYCODE>DKK</PAYCURRENCYCODE><BASEGRANDTOTAL>600</BASEGRANDTOTAL></ORDER></ORDERS>`,
      usernameOrdersXml: "<ORDERS/>",
    },
  });
  const row = await report(request, date);
  // EUR 600 = USD 1200. USD 15 + 10 + 2 = USD 27 = EUR 13.50.
  expect(row.calculated.marketplaceFee).toBe(13.5);
});

test("bank credits and refunds are converted before summing", async ({ request, settings }, info) => {
  const { camt053, importDocument } = await import("../support/bank-statements");
  const { date, seconds } = await rates(settings, request, info);
  const imported = await importDocument(request, camt053({ entries: [
    { reference: "FX-CREDIT-1", amount: "120", currency: "XTS", direction: "CRDT", bookingDate: date, remittance: "910030" },
    { reference: "FX-CREDIT-2", amount: "40", currency: "EUR", direction: "CRDT", bookingDate: date, remittance: "910030" },
    { reference: "FX-REFUND", amount: "20", currency: "XTS", direction: "DBIT", bookingDate: date, remittance: "910030" },
  ] }));
  expect(imported.ok(), await imported.text()).toBeTruthy();
  await mockReconciliationOrders(settings, request, info, {
    period: { from: date, to: date },
    brickOwl: [{ orderId: "910030", orderDate: String(seconds), view: { base_order_total: "100", payment_method_type: "bank", refund_total: "10" } }],
  });
  const row = await report(request, date);
  expect(row.gateway).toMatchObject({ paidAmount: 100, refundedAmount: 10 });
  expect(row.calculated.targetInvoice).toBe(90);
});
