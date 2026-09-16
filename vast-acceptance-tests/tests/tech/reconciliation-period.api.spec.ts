import { expect, test } from "../support/api-test";
import { camt053, importDocument } from "../support/bank-statements";
import { endOfToday, mockReconciliationOrders } from "../support/reconciliation";
import { wireMockMode } from "../support/wiremock";

test.describe.configure({ mode: wireMockMode() });

for (const period of [
  { from: "2026-07-31", to: "2026-09-01" },
  { from: "2026-08-10", to: "2026-08-10" },
]) {
  test(`collects and reconciles inclusive order dates ${period.from} through ${period.to}`, async ({ request, settings }, testInfo) => {
    const dates = [
      new Date(Date.parse(`${period.from}T12:00:00Z`) - 86400000).toISOString().slice(0, 10),
      period.from,
      ...(period.to === period.from ? [] : [period.to]),
      new Date(Date.parse(`${period.to}T12:00:00Z`) + 86400000).toISOString().slice(0, 10),
    ];
    const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
      period,
      brickOwl: dates.map((date, index) => ({
        orderId: `160000${index}`,
        orderDate: String(Date.parse(`${date}T12:00:00Z`) / 1000),
        view: { buyer_name: "Test Buyer Alpha", sub_total: "10.00" },
      })),
    });

    const response = await request.get("/api/private/reconciliation/orders", { params: period });
    expect(response.status(), await response.text()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ from: period.from, to: period.to, fields: expect.any(Array) });
    expect(body.orders.map((order: { order: { orderDate: string } }) => order.order.orderDate))
      .toEqual(period.from === period.to ? [period.from] : [period.to, period.from]);

    // Both BrickLink exports must receive the exact bounds, not the encompassing months.
    const exports = await wireMock.findMethodHostRequests("POST", "/orderExcelFinal.asp");
    expect(exports).toHaveLength(2);
    for (const exported of exports) {
      const form = new URLSearchParams(exported.body().toString("utf8"));
      for (const [prefix, date] of [["f", period.from], ["t", period.to]]) {
        const [year, month, day] = date.split("-").map(Number);
        expect([form.get(`${prefix}YY`), form.get(`${prefix}MM`), form.get(`${prefix}DD`)])
          .toEqual([String(year), String(month), String(day)]);
      }
    }

    // The selected dates decide where the ledgers are read from, never where they stop: the window opens seven days
    // early and closes at the end of today, whatever was selected, because a refund can follow its order by months.
    const paddedFrom = new Date(Date.parse(`${period.from}T00:00:00Z`) - 7 * 86400000);
    const paddedTo = new Date(Date.parse(`${period.to}T23:59:59Z`) + 7 * 86400000);
    const windowTo = paddedTo > endOfToday() ? paddedTo : endOfToday();
    const stripe = await wireMock.findMethodHostRequests("GET", "/v1/balance_transactions");
    expect(stripe).toHaveLength(1);
    const stripeQuery = new URL(stripe[0].url ?? "", "http://stripe.test").searchParams;
    expect(stripeQuery.get("created[gte]")).toBe(String(paddedFrom.getTime() / 1000));
    expect(stripeQuery.get("created[lte]")).toBe(String(windowTo.getTime() / 1000));

    // PayPal is asked for the same window, except that it refuses a range reaching into the future, so its last
    // segment closes just short of now rather than at the end of today.
    const paypal = await wireMock.findMethodHostRequests("GET", "/v1/reporting/transactions");
    const segments = paypal.map((entry) => {
      const query = new URL(entry.url ?? "", "http://paypal.test").searchParams;
      return { from: Date.parse(query.get("start_date")!), to: Date.parse(query.get("end_date")!) };
    }).sort((a, b) => a.from - b.from);
    expect(segments[0].from).toBe(paddedFrom.getTime());
    expect(segments.at(-1)!.to).toBeLessThanOrEqual(Date.now());
    expect(segments.at(-1)!.to).toBeGreaterThan(Date.now() - 3600 * 1000);
    for (let index = 1; index < segments.length; index++) {
      expect(segments[index].from).toBe(segments[index - 1].to + 1000);
    }
  });
}

for (const query of [
  "from=2026-08-01", "to=2026-08-31",
  "from=2026-08-02&to=2026-08-01",
  "from=2026-02-30&to=2026-03-01",
  "from=2026-08-01&to=invalid",
  "from=2026-8-1&to=2026-08-31",
  "month=2026-08&from=2026-08-01&to=2026-08-31",
]) {
  test(`rejects invalid reconciliation period: ${query}`, async ({ request }) => {
    const response = await request.get(`/api/private/reconciliation/orders?${query}`);
    expect(response.status(), await response.text()).toBe(400);
  });
}


test("reads bank transfers booked today for a period whose ninety days ran out months ago", async ({ request, settings }, testInfo) => {
  // A buyer pays late and a store repays later still, so the booking days read never stop with the selected dates:
  // a period closed long ago is still read up to today, or the order would keep reporting a payment that has since
  // gone back.
  const period = { from: "2026-01-12", to: "2026-01-12" };
  await mockReconciliationOrders(settings, request, testInfo, {
    period,
    brickOwl: [{
      orderId: "7500002",
      orderDate: String(Date.parse("2026-01-12T12:00:00Z") / 1000),
      view: { buyer_name: "Test Buyer Beta", payment_method_type: "bank", sub_total: "8.00", base_order_total: "8.00" },
    }],
  });
  const today = new Date().toISOString().slice(0, 10);
  const imported = await importDocument(request, camt053({ entries: [{
    bookingDate: today, amount: "8.00", direction: "CRDT" as const,
    reference: "2026011200000002-1", counterpartyName: "Test Buyer Beta",
    remittance: "Payment for order 7500002",
  }] }));
  expect(imported.ok(), await imported.text()).toBeTruthy();

  const response = await request.get("/api/private/reconciliation/orders", { params: period });
  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders).toHaveLength(1);
  expect(body.orders[0].gateway.paidAmount).toBe(8);
});


test("reads bank transfers seven days before and ninety days after the selected dates", async ({ request, settings }, testInfo) => {
  const period = { from: "2026-08-10", to: "2026-08-10" };
  await mockReconciliationOrders(settings, request, testInfo, {
    period,
    brickOwl: [{
      orderId: "7500001",
      orderDate: String(Date.parse("2026-08-10T12:00:00Z") / 1000),
      view: { buyer_name: "Test Buyer Alpha", payment_method_type: "bank", sub_total: "5.00", base_order_total: "5.00" },
    }],
  });
  const imported = await importDocument(request, camt053({ entries: [
    { bookingDate: "2026-08-02", amount: "100.00" },
    { bookingDate: "2026-08-03", amount: "2.00" },
    { bookingDate: "2026-11-08", amount: "3.00" },
    { bookingDate: "2026-11-09", amount: "100.00" },
  ].map((entry, index) => ({ ...entry, direction: "CRDT" as const,
    reference: `2026081000000001-${index + 1}`, counterpartyName: "Test Buyer Alpha",
    remittance: "Payment for order 7500001" })) }));
  expect(imported.ok(), await imported.text()).toBeTruthy();
  const response = await request.get("/api/private/reconciliation/orders", { params: period });
  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders).toHaveLength(1);
  expect(body.orders[0].gateway.paidAmount).toBe(5);
});
