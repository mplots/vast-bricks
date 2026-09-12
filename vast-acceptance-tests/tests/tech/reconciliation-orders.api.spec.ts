import type { APIRequestContext } from "@playwright/test";

import { expect, test } from "../support/api-test";
import { camt053, importDocument } from "../support/bank-statements";
import {
  BrickOwlOrderMock,
  mockReconciliationOrders,
  paymentWindow,
} from "../support/reconciliation";
import { WireMockApi, wireMockMode } from "../support/wiremock";

/**
 * As much of a reconciled order as the assertions read back. Its fields sit under the source that stated them, which
 * is how the API exposes them, so a test naming `gateway.refundedAmount` is naming the account it means.
 */
type ReconciledOrderShape = {
  order: {
    source: string;
    orderId: string;
    grandTotal: number | null;
    facilitatorTax: number | null;
    refundedAmount: number | null;
  };
  gateway: { paidAmount: number | null; refundedAmount: number | null };
  calculated: { targetInvoice: number | null };
};

/** The periods PayPal was searched for, in the order the client asked for them. */
async function payPalSearchedPeriods(wireMock: WireMockApi) {
  const transactionRequests = await wireMock.findMethodHostRequests(
    "GET",
    "/v1/reporting/transactions",
  );
  return transactionRequests.map((transactionRequest) => {
    const query = new URL(transactionRequest.url ?? "", "http://paypal.test")
      .searchParams;
    return {
      from: query.get("start_date") ?? "",
      to: query.get("end_date") ?? "",
    };
  });
}

test.describe.configure({ mode: wireMockMode() });

const brickLinkPayPalOrdersXml = (
  orders: Array<{ orderId: string; buyer: string; total: string }>,
) =>
  `<?xml version="1.0" encoding="UTF-8"?><ORDERS>${orders
    .map(
      (order) => `
  <ORDER>
    <ORDERID>${order.orderId}</ORDERID>
    <ORDERDATE>8/30/2026</ORDERDATE>
    <BUYER>${order.buyer}</BUYER>
    <ORDERTOTAL>${order.total}</ORDERTOTAL>
    <BASEGRANDTOTAL>${order.total}</BASEGRANDTOTAL>
    <PAYMENTTYPE>PayPal (Onsite)</PAYMENTTYPE>
    <ITEM><ITEMID>3001</ITEMID><PRICE>${order.total}</PRICE><QTY>1</QTY></ITEM>
  </ORDER>`,
    )
    .join("")}</ORDERS>`;

const brickLinkOrderXml = (
  orderId: string,
  orderTotal: string,
  items: Array<[string, string]>,
  orderDate = "8/30/2026",
) => `
  <ORDER>
    <ORDERID>${orderId}</ORDERID>
    <ORDERDATE>${orderDate}</ORDERDATE>
    <BUYER>some buyer</BUYER>
    <ORDERTOTAL>${orderTotal}</ORDERTOTAL>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    ${items.map(([price, quantity]) => `<ITEM><PRICE>${price}</PRICE><QTY>${quantity}</QTY></ITEM>`).join("\n    ")}
  </ORDER>`;

const brickLinkOrdersXml = (...orders: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><ORDERS>${orders.join("")}</ORDERS>`;

const emptyOrdersXml = brickLinkOrdersXml();

test("lists BrickLink reconciliation orders for the selected month", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456563</ORDERID>
    <ORDERDATE>8/30/2026</ORDERDATE>
    <BUYER>some buyer</BUYER>
    <ORDERTOTAL>0.43</ORDERTOTAL>
    <ORDERSHIPPING>3.00</ORDERSHIPPING>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    <PAYCURRENCYCODE> usd </PAYCURRENCYCODE>
    <BASEGRANDTOTAL>3.435</BASEGRANDTOTAL>
    <PAYMENTTYPE>Credit/Debit (Powered by Stripe)</PAYMENTTYPE>
    <LOCATION>Latvia, Riga</LOCATION>
    <VATCHARGES>0.07</VATCHARGES>
    <ITEM>
      <ITEMID>3001</ITEMID>
      <PRICE>0.1000</PRICE>
      <QTY>2</QTY>
    </ITEM>
    <ITEM>
      <ITEMID>3002</ITEMID>
      <PRICE>0.2300</PRICE>
      <QTY>1</QTY>
    </ITEM>
  </ORDER>
  <ORDER>
    <ORDERID>32456564</ORDERID>
    <ORDERDATE>8/31/2026</ORDERDATE>
    <BUYER>another buyer</BUYER>
    <ORDERTOTAL>3.00</ORDERTOTAL>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    <PAYMENTTYPE>Bank Transfer</PAYMENTTYPE>
    <ITEM>
      <ITEMID>3003</ITEMID>
      <PRICE>1.0000</PRICE>
      <QTY>3</QTY>
    </ITEM>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456563</ORDERID>
    <BUYER>some-buyer-username</BUYER>
  </ORDER>
  <ORDER>
    <ORDERID>32456564</ORDERID>
    <BUYER>another-buyer-username</BUYER>
  </ORDER>
</ORDERS>`,
    },
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  await expect(response.json()).resolves.toEqual({
    selectedMonth: "2026-08",
    from: "2026-08-01",
    to: "2026-08-31",
    // The field roster rides with every month and is asserted on its own below.
    fields: expect.any(Array),
    orders: [
      {
        order: {
          source: "BrickLink",
          orderId: "32456564",
          orderUrl:
            "https://www.bricklink.com/orderDetail.asp?ID=32456564&viewChk=Y&viewWeight=Y&viewRemain=Y",
          orderDate: "2026-08-31",
          buyer: "another buyer",
          buyerUsername: "another-buyer-username",
          itemCount: null,
          lotCount: null,
          paymentMethod: "Bank Transfer",
          currency: null,
          taxType: null,
          facilitatorTax: null,
          subTotal: 3,
          shippingCost: null,
          grandTotal: null,
          refundedAmount: null,
        },
        gateway: {
          paidAmount: null,
          feeAmount: null,
          facilitatorTax: null,
          refundedAmount: null,
          paymentUrl: null,
          entryReferences: [],
        },
        shipment: { totalAmount: null },
        accounting: {
          subTotal: null,
          vat: null,
          grandTotal: null,
        },
        calculated: {
          targetInvoice: null,
        },
        // No grand total was collected, so there is nothing to invoice for and no payment is required.
        failures: [],
      },
      {
        order: {
          source: "BrickLink",
          orderId: "32456563",
          orderUrl:
            "https://www.bricklink.com/orderDetail.asp?ID=32456563&viewChk=Y&viewWeight=Y&viewRemain=Y",
          orderDate: "2026-08-30",
          buyer: "some buyer",
          buyerUsername: "some-buyer-username",
          itemCount: null,
          lotCount: null,
          paymentMethod: "Stripe",
          currency: "USD",
          taxType: "domestic",
          facilitatorTax: null,
          subTotal: 0.43,
          // What BrickLink charged the buyer for shipping, as its ORDERSHIPPING.
          shippingCost: 3,
          grandTotal: 3.44,
          refundedAmount: null,
        },
        gateway: {
          paidAmount: null,
          feeAmount: null,
          facilitatorTax: null,
          refundedAmount: null,
          paymentUrl: null,
          entryReferences: [],
        },
        shipment: { totalAmount: null },
        accounting: {
          subTotal: null,
          vat: null,
          grandTotal: null,
        },
        calculated: {
          targetInvoice: 3.44,
        },
        // Paid through Stripe, but no Stripe payment names this order.
        failures: [
          {
            code: "amount-missing",
            level: "error",
            fields: ["gateway.paidAmount"],
          },
        ],
      },
    ],
  });
});

test("lists BrickOwl reconciliation orders for the selected month", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Alpha",
          customer_username: "test_alpha",
          sub_total: "2.70",
          ship_total: "2.50",
          payment_method_type: "paypal",
          payment_currency: "gbp",
          base_order_total: "5.20",
          billing_country_code: "LV",
          tax_scheme_id: "1",
          tax_rate: "21",
        },
      },
      {
        orderId: "test-order-0811",
        orderDate: "1786406400",
        view: {
          buyer_name: "Test Buyer Beta",
          customer_username: "test_beta",
          sub_total: "6.00",
        },
      },
      {
        orderId: "test-order-0901",
        orderDate: "1788220800",
        view: {
          buyer_name: "Test Buyer Gamma",
          customer_username: "test_gamma",
          sub_total: "9.99",
        },
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  await expect(response.json()).resolves.toEqual({
    selectedMonth: "2026-08",
    from: "2026-08-01",
    to: "2026-08-31",
    // The field roster rides with every month and is asserted on its own below.
    fields: expect.any(Array),
    orders: [
      {
        order: {
          source: "BrickOwl",
          orderId: "test-order-0811",
          orderUrl:
            "https://www.brickowl.com/mystore/orders/history/test-order-0811",
          orderDate: "2026-08-11",
          buyer: "Test Buyer Beta",
          buyerUsername: "test_beta",
          itemCount: null,
          lotCount: null,
          paymentMethod: null,
          currency: null,
          taxType: null,
          facilitatorTax: null,
          subTotal: 6,
          shippingCost: null,
          grandTotal: null,
          refundedAmount: null,
        },
        gateway: {
          paidAmount: null,
          feeAmount: null,
          facilitatorTax: null,
          refundedAmount: null,
          paymentUrl: null,
          entryReferences: [],
        },
        shipment: { totalAmount: null },
        accounting: {
          subTotal: null,
          vat: null,
          grandTotal: null,
        },
        calculated: {
          targetInvoice: null,
        },
        // No grand total was collected, so there is nothing to invoice for and no payment is required.
        failures: [],
      },
      {
        order: {
          source: "BrickOwl",
          orderId: "test-order-0810",
          orderUrl:
            "https://www.brickowl.com/mystore/orders/history/test-order-0810",
          orderDate: "2026-08-10",
          buyer: "Test Buyer Alpha",
          buyerUsername: "test_alpha",
          itemCount: null,
          lotCount: null,
          paymentMethod: "PayPal",
          currency: "GBP",
          // BrickOwl names a tax scheme only for a registration of its own, so a scheme with a rate is a taxed
          // export.
          taxType: "export-taxable",
          facilitatorTax: null,
          subTotal: 2.7,
          // What BrickOwl charged the buyer for shipping, as its ship_total.
          shippingCost: 2.5,
          grandTotal: 5.2,
          refundedAmount: null,
        },
        gateway: {
          paidAmount: null,
          feeAmount: null,
          facilitatorTax: null,
          refundedAmount: null,
          paymentUrl: null,
          entryReferences: [],
        },
        shipment: { totalAmount: null },
        accounting: {
          subTotal: null,
          vat: null,
          grandTotal: null,
        },
        calculated: {
          targetInvoice: 5.2,
        },
        // Paid through PayPal, but no PayPal payment names this order.
        failures: [
          {
            code: "amount-missing",
            level: "error",
            fields: ["gateway.paidAmount"],
          },
        ],
      },
    ],
  });
});

test("targets the invoice at the grand total less what the marketplace collected as tax facilitator", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456580</ORDERID>
    <ORDERDATE>8/30/2026</ORDERDATE>
    <BUYER>export buyer</BUYER>
    <ORDERTOTAL>11.00</ORDERTOTAL>
    <BASEGRANDTOTAL>12.10</BASEGRANDTOTAL>
    <LOCATION>United States, California</LOCATION>
    <VATCHARGES>0.00</VATCHARGES>
    <ORDERSALESTAX>1.10</ORDERSALESTAX>
    <ORDERVAT>0.00</ORDERVAT>
    <ITEM><ITEMID>3001</ITEMID><PRICE>11.0000</PRICE><QTY>1</QTY></ITEM>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    brickOwl: [
      {
        orderId: "test-order-0812",
        orderDate: "1786320000",
        view: {
          buyer_name: "Export Buyer",
          sub_total: "4.30",
          base_order_total: "5.20",
          billing_country_code: "GB",
          tax_scheme_id: "2",
          tax_rate: "20",
          tax_amount: "0.90",
        },
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(
    body.orders.map((order: ReconciledOrderShape) => [
      order.order.orderId,
      order.order.grandTotal,
      order.order.facilitatorTax,
      order.calculated.targetInvoice,
    ]),
  ).toEqual([
    ["32456580", 12.1, 1.1, 11],
    ["test-order-0812", 5.2, 0.9, 4.3],
  ]);
});

test("lists BrickOwl reconciliation orders that span several batch requests", async ({
  request,
  settings,
}, testInfo) => {
  const brickOwlOrders: BrickOwlOrderMock[] = Array.from(
    { length: 60 },
    (_, index) => ({
      orderId: `bulk-order-${index + 1}`,
      orderDate: "1786320000",
      view: {
        buyer_name: `Bulk Buyer ${index + 1}`,
        customer_username: `bulk_${index + 1}`,
        sub_total: "1.00",
      },
    }),
  );

  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: brickOwlOrders,
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders).toHaveLength(60);
  expect(body.orders[0]).toEqual({
    order: {
      source: "BrickOwl",
      orderId: "bulk-order-1",
      orderUrl: "https://www.brickowl.com/mystore/orders/history/bulk-order-1",
      orderDate: "2026-08-10",
      buyer: "Bulk Buyer 1",
      buyerUsername: "bulk_1",
      itemCount: null,
      lotCount: null,
      paymentMethod: null,
      currency: null,
      taxType: null,
      facilitatorTax: null,
      subTotal: 1,
      shippingCost: null,
      grandTotal: null,
      refundedAmount: null,
    },
    gateway: {
      paidAmount: null,
      feeAmount: null,
      facilitatorTax: null,
      refundedAmount: null,
      paymentUrl: null,
      entryReferences: [],
    },
    shipment: { totalAmount: null },
    accounting: {
      subTotal: null,
      vat: null,
      grandTotal: null,
    },
    calculated: {
      targetInvoice: null,
    },
    // No grand total was collected, so there is nothing to invoice for and no payment is required.
    failures: [],
  });
  expect(body.orders[59].order.orderId).toBe("bulk-order-60");

  const batchRequests = await wireMock.findMethodHostRequests(
    "POST",
    "/v1/bulk/batch",
  );
  // One batch per fifty orders: sixty orders are two, and the order detail is all that is asked for.
  expect(batchRequests).toHaveLength(2);
});

test("lists the reconciled orders of every provider newest first", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456570</ORDERID>
    <ORDERDATE>8/5/2026</ORDERDATE>
    <BUYER>early buyer</BUYER>
  </ORDER>
  <ORDER>
    <ORDERID>32456575</ORDERID>
    <ORDERDATE>8/25/2026</ORDERDATE>
    <BUYER>late buyer</BUYER>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    brickOwl: [
      {
        orderId: "owl-order-0815",
        orderDate: "1786752000",
        view: { buyer_name: "Middle Buyer" },
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  // The providers are collected one after another, so interleaved dates prove the whole list is sorted.
  expect(
    body.orders.map(
      (order: { order: { orderId: string; orderDate: string } }) => [
        order.order.orderId,
        order.order.orderDate,
      ],
    ),
  ).toEqual([
    ["32456575", "2026-08-25"],
    ["owl-order-0815", "2026-08-15"],
    ["32456570", "2026-08-05"],
  ]);
});

test("returns no reconciliation orders when no provider reports orders", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo);

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  await expect(response.json()).resolves.toEqual({
    selectedMonth: "2026-08",
    from: "2026-08-01",
    to: "2026-08-31",
    // The field roster rides with every month and is asserted on its own below.
    fields: expect.any(Array),
    orders: [],
  });
});

test("reports every order field with the source that stated it", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  // The roster is what lets a reader be told which account stated a field rather than infer it from the name, so it
  // states every field in the order the orders expose them.
  expect(body.fields).toEqual([
    { name: "order.source", source: "order" },
    { name: "order.orderId", source: "order" },
    { name: "order.orderDate", source: "order" },
    { name: "order.buyer", source: "order" },
    { name: "order.buyerUsername", source: "order" },
    { name: "order.itemCount", source: "order" },
    { name: "order.lotCount", source: "order" },
    { name: "order.paymentMethod", source: "order" },
    { name: "order.currency", source: "order" },
    { name: "order.taxType", source: "order" },
    { name: "order.facilitatorTax", source: "order" },
    { name: "order.subTotal", source: "order" },
    { name: "order.shippingCost", source: "order" },
    { name: "order.grandTotal", source: "order" },
    { name: "order.refundedAmount", source: "order" },
    { name: "gateway.paidAmount", source: "gateway" },
    { name: "gateway.feeAmount", source: "gateway" },
    { name: "gateway.facilitatorTax", source: "gateway" },
    { name: "gateway.refundedAmount", source: "gateway" },
    { name: "shipment.totalAmount", source: "shipment" },
    { name: "accounting.subTotal", source: "accounting" },
    { name: "accounting.vat", source: "accounting" },
    { name: "accounting.grandTotal", source: "accounting" },
    { name: "calculated.targetInvoice", source: "calculated" },
  ]);
  // A field sits at the path that names it, so the two accounts of one refund carry one name under two sources.
  expect(
    body.fields.filter((field: { name: string }) =>
      field.name.endsWith(".refundedAmount"),
    ),
  ).toHaveLength(2);
});

test("reports what Stripe was paid for a BrickOwl order named in the payment description", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Alpha",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
    stripe: [{ description: "Brick Owl Order test-order-0810", amount: 520 }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBe(5.2);
  expect(body.orders[0].failures).toEqual([]);
});

test("asks both payment providers for the days around the month, so a payment taken later is still collected", async ({
  request,
  settings,
}, testInfo) => {
  // A provider does not date a payment where the marketplace dates its order: Stripe dates a balance transaction at
  // the capture of the charge, which can fall days after the buyer ordered, and the marketplaces date an order in a
  // zone of their own. An order of the last of the month was therefore reported unpaid while its payment was
  // collected in a month holding no order to attach it to. The month is one whose padded window has wholly passed,
  // so the window is asked for as it stands.
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-05",
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-05",
  );

  expect(response.status(), await response.text()).toBe(200);
  const window = paymentWindow("2026-05");

  const balanceTransactionRequests = await wireMock.findMethodHostRequests(
    "GET",
    "/v1/balance_transactions",
  );
  expect(balanceTransactionRequests).toHaveLength(1);
  const stripeQuery = new URL(
    balanceTransactionRequests[0].url ?? "",
    "http://stripe.test",
  ).searchParams;
  expect(stripeQuery.get("created[gte]")).toBe(String(window.fromEpochSeconds));
  expect(stripeQuery.get("created[lte]")).toBe(String(window.toEpochSeconds));

  // PayPal searches no more than 31 days at a time, so the same window arrives as consecutive segments that together
  // cover it end to end and overlap nowhere, a transaction reported twice being a payment counted twice.
  const searched = await payPalSearchedPeriods(wireMock);
  expect(searched.length).toBeGreaterThan(1);
  expect(searched[0].from).toBe(window.fromIso);
  expect(searched[searched.length - 1].to).toBe(window.toIso);
  searched.slice(1).forEach((segment, index) => {
    expect(new Date(segment.from).getTime()).toBe(
      new Date(searched[index].to).getTime() + 1000,
    );
  });
});

test("searches PayPal no further than now, so the current month reconciles", async ({
  request,
  settings,
}, testInfo) => {
  // The days the window is padded by have not happened yet in the month being lived through, and PayPal refuses a
  // range reaching into the future. Stripe accepts one, and is asked for the whole window.
  const currentMonth = new Date().toISOString().slice(0, 7);
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: currentMonth,
  });

  const response = await request.get(
    `/api/private/reconciliation/orders?month=${currentMonth}`,
  );

  expect(response.status(), await response.text()).toBe(200);
  const window = paymentWindow(currentMonth);

  const searched = await payPalSearchedPeriods(wireMock);
  const searchedTo = new Date(searched[searched.length - 1].to).getTime();
  expect(searched[0].from).toBe(window.fromIso);
  expect(searchedTo).toBeLessThanOrEqual(Date.now());
  expect(searchedTo).toBeLessThan(new Date(window.to).getTime());
  // PayPal rejects a date carrying a fraction of a second, which the clock the window is closed at reports.
  searched.forEach((segment) => {
    expect(segment.from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(segment.to).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  const balanceTransactionRequests = await wireMock.findMethodHostRequests(
    "GET",
    "/v1/balance_transactions",
  );
  const stripeQuery = new URL(
    balanceTransactionRequests[0].url ?? "",
    "http://stripe.test",
  ).searchParams;
  expect(stripeQuery.get("created[lte]")).toBe(String(window.toEpochSeconds));
});

test("asks PayPal nothing for a month that has not happened", async ({
  request,
  settings,
}, testInfo) => {
  const futureMonth = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0))
    .toISOString()
    .slice(0, 7);
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: futureMonth,
  });

  const response = await request.get(
    `/api/private/reconciliation/orders?month=${futureMonth}`,
  );

  expect(response.status(), await response.text()).toBe(200);
  expect(
    await wireMock.findMethodHostRequests("GET", "/v1/reporting/transactions"),
  ).toHaveLength(0);
});

test("reports what Stripe was paid for a BrickLink order by the buyer username in the payment description", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456563</ORDERID>
    <ORDERDATE>8/30/2026</ORDERDATE>
    <BUYER>some buyer</BUYER>
    <ORDERTOTAL>3.44</ORDERTOTAL>
    <BASEGRANDTOTAL>3.44</BASEGRANDTOTAL>
    <PAYMENTTYPE>Credit/Debit (Powered by Stripe)</PAYMENTTYPE>
    <ITEM>
      <ITEMID>3001</ITEMID>
      <PRICE>3.4400</PRICE>
      <QTY>1</QTY>
    </ITEM>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456563</ORDERID>
    <BUYER>some-buyer-username</BUYER>
  </ORDER>
</ORDERS>`,
    },
    stripe: [
      {
        description: "Payment for BrickLink from some-buyer-username",
        amount: 344,
        type: "payment",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBe(3.44);
  expect(body.orders[0].failures).toEqual([]);
});

test("tells one buyer's BrickLink orders apart by what the Stripe payment took", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: "32456563", buyer: "some buyer", total: "38.80" },
        { orderId: "32456564", buyer: "some buyer", total: "3.44" },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER><ORDERID>32456563</ORDERID><BUYER>some-buyer-username</BUYER></ORDER>
  <ORDER><ORDERID>32456564</ORDERID><BUYER>some-buyer-username</BUYER></ORDER>
</ORDERS>`,
    },
    stripe: [
      {
        description: "Payment for BrickLink from some-buyer-username",
        amount: 344,
        type: "payment",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  const paid = Object.fromEntries(
    body.orders.map((order: ReconciledOrderShape) => [
      order.order.orderId,
      order.gateway.paidAmount,
    ]),
  );
  expect(paid).toEqual({ "32456563": null, "32456564": 3.44 });
});

test("reports no paid amount when several BrickLink orders share the buyer the payment names", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456563</ORDERID>
    <ORDERDATE>8/30/2026</ORDERDATE>
    <BUYER>some buyer</BUYER>
  </ORDER>
  <ORDER>
    <ORDERID>32456564</ORDERID>
    <ORDERDATE>8/31/2026</ORDERDATE>
    <BUYER>some buyer</BUYER>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456563</ORDERID>
    <BUYER>some-buyer-username</BUYER>
  </ORDER>
  <ORDER>
    <ORDERID>32456564</ORDERID>
    <BUYER>some-buyer-username</BUYER>
  </ORDER>
</ORDERS>`,
    },
    stripe: [
      {
        description: "Payment for BrickLink from some-buyer-username",
        amount: 344,
        type: "payment",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(
    body.orders.map((order: ReconciledOrderShape) => order.gateway.paidAmount),
  ).toEqual([null, null]);
});

test("reports no paid amount from Stripe fee and refund transactions that name an order", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0810",
        orderDate: "1786320000",
        view: { buyer_name: "Test Buyer Alpha", base_order_total: "5.20" },
      },
    ],
    stripe: [
      {
        description: "Brick Owl Order test-order-0810",
        amount: -30,
        type: "stripe_fee",
      },
      {
        description: "REFUND FOR CHARGE (Brick Owl Order test-order-0810)",
        amount: -520,
        type: "refund",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBeNull();
});

test("reduces the target invoice of a BrickOwl order by what Stripe shows was partly refunded", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Alpha",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
    // The charge keeps the running total of its refunds, so a partial refund is stated there and not per refund.
    stripe: [
      {
        description: "Brick Owl Order test-order-0810",
        amount: 520,
        amountRefunded: 200,
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  // The payment still took the whole grand total: what came back afterwards is not a shortfall in what was paid.
  expect(body.orders[0].gateway.paidAmount).toBe(5.2);
  expect(body.orders[0].gateway.refundedAmount).toBe(2);
  expect(body.orders[0].calculated.targetInvoice).toBe(3.2);
  // The order states no refund total of its own, so the two accounts of the refund disagree.
  expect(body.orders[0].order.refundedAmount).toBeNull();
  expect(
    body.orders[0].failures.map((failure: { code: string }) => failure.code),
  ).toEqual(["refunded-amount-mismatch"]);
});

test("leaves nothing to invoice for a BrickLink order Stripe shows was refunded in full", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(`
  <ORDER>
    <ORDERID>32100001</ORDERID>
    <BUYER>Alan Turing</BUYER>
    <DATEORDERED>08/30/2026 10:00</DATEORDERED>
    <ORDERTOTAL>19.63</ORDERTOTAL>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    <BASEGRANDTOTAL>19.63</BASEGRANDTOTAL>
    <PAYMENTTYPE>Credit/Debit (Powered by Stripe)</PAYMENTTYPE>
    <LOCATION>Poland</LOCATION>
    <VATCHARGES>0.00</VATCHARGES>
    <ITEM>
      <ITEMID>3001</ITEMID>
      <PRICE>19.6300</PRICE>
      <QTY>1</QTY>
    </ITEM>
  </ORDER>`),
      usernameOrdersXml: brickLinkOrdersXml(`
  <ORDER>
    <ORDERID>32100001</ORDERID>
    <BUYER>alan-t</BUYER>
  </ORDER>`),
    },
    stripe: [
      {
        description: "Payment for BrickLink from alan-t",
        amount: 1963,
        amountRefunded: 1963,
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBe(19.63);
  expect(body.orders[0].gateway.refundedAmount).toBe(19.63);
  expect(body.orders[0].calculated.targetInvoice).toBe(0);
  expect(
    body.orders[0].failures.map((failure: { code: string }) => failure.code),
  ).toEqual(["refunded-amount-mismatch"]);
});

test("leaves nothing to invoice, rather than less than nothing, for a refunded order the marketplace taxed", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Alpha",
          payment_method_type: "stripe",
          sub_total: "4.20",
          base_order_total: "5.20",
          tax_scheme_id: "gb-vat",
          tax_rate: "20",
          tax_amount: "1.00",
        },
      },
    ],
    // The marketplace keeps the tax it took whether or not the buyer was refunded, so the two subtractions
    // together reach past the grand total.
    stripe: [
      {
        description: "Brick Owl Order test-order-0810",
        amount: 520,
        applicationFee: 100,
        amountRefunded: 520,
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].order.facilitatorTax).toBe(1);
  expect(body.orders[0].gateway.refundedAmount).toBe(5.2);
  expect(body.orders[0].calculated.targetInvoice).toBe(0);
});

test("leaves no target invoice for a fully refunded BrickOwl order no payment was matched to", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0813",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Alpha",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
          refund_total: "5.20",
        },
      },
    ],
    // Nothing Stripe reports names the order, so no payment is matched to it.
    stripe: [{ description: "Brick Owl Order some-other-order", amount: 520 }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].order.refundedAmount).toBe(5.2);
  expect(body.orders[0].gateway.paidAmount).toBeNull();
  // With no payment collected there is no account of the money the refund could come out of, so the order has no
  // target at all rather than a target of nothing.
  expect(body.orders[0].calculated.targetInvoice).toBeNull();
  // Nothing being left to invoice for is where no payment is owed, so the payment is not reported as missing.
  // The order is reported at info all the same: the gateway only released a reservation, which is worth seeing
  // rather than reading as a reconciled order.
  expect(body.orders[0].failures).toEqual([
    {
      code: "refunded-without-payment",
      level: "info",
      fields: [
        "order.refundedAmount",
        "order.grandTotal",
        "gateway.paidAmount",
      ],
    },
  ]);
});

test("keeps the target invoice of a partly refunded BrickOwl order no payment was matched to", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0814",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Alpha",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
          refund_total: "2.00",
        },
      },
    ],
    stripe: [{ description: "Brick Owl Order some-other-order", amount: 520 }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBeNull();
  // Only the gateway's refund is subtracted, so a partial marketplace refund leaves the whole grand total targeted.
  expect(body.orders[0].calculated.targetInvoice).toBe(5.2);
  // There is still something to invoice for, so the payment that was never collected is still missing.
  expect(
    body.orders[0].failures.map((failure: { code: string }) => failure.code),
  ).toEqual(["amount-missing"]);
});

test("reports no refunded amount for a Stripe payment nothing was refunded out of", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Alpha",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
    stripe: [{ description: "Brick Owl Order test-order-0810", amount: 520 }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.refundedAmount).toBeNull();
  expect(body.orders[0].calculated.targetInvoice).toBe(5.2);
});

test("reports no paid amount when no Stripe payment names the order", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0810",
        orderDate: "1786320000",
        view: { buyer_name: "Test Buyer Alpha", base_order_total: "5.20" },
      },
    ],
    stripe: [{ description: "Brick Owl Order some-other-order", amount: 520 }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBeNull();
});

test("collects Stripe payments that span several pages", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-order-1",
        orderDate: "1786320000",
        view: { buyer_name: "First Buyer" },
      },
      {
        orderId: "owl-order-2",
        orderDate: "1786320000",
        view: { buyer_name: "Second Buyer" },
      },
    ],
    stripePages: [
      [{ description: "Brick Owl Order owl-order-1", amount: 100 }],
      [{ description: "Brick Owl Order owl-order-2", amount: 250 }],
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  const paidByOrder = Object.fromEntries(
    body.orders.map((order: ReconciledOrderShape) => [
      order.order.orderId,
      order.gateway.paidAmount,
    ]),
  );
  expect(paidByOrder).toEqual({ "owl-order-1": 1, "owl-order-2": 2.5 });

  const balanceTransactionRequests = await wireMock.findMethodHostRequests(
    "GET",
    "/v1/balance_transactions",
  );
  expect(balanceTransactionRequests).toHaveLength(2);
});

test("reports a bad gateway when Stripe fails", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
  });
  await wireMock.addMethodHostMapping("GET", "/v1/balance_transactions", {
    response: {
      status: 500,
      json: { error: { message: "Stripe is unavailable" } },
    },
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(502);
});

test("reports the facilitator tax Stripe shows a BrickLink order was taken", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(`
  <ORDER>
    <ORDERID>32466549</ORDERID>
    <ORDERDATE>8/30/2026</ORDERDATE>
    <BUYER>some buyer</BUYER>
    <ORDERTOTAL>26.08</ORDERTOTAL>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    <BASEGRANDTOTAL>28.69</BASEGRANDTOTAL>
    <PAYMENTTYPE>Credit/Debit (Powered by Stripe)</PAYMENTTYPE>
    <LOCATION>Australia, New South Wales</LOCATION>
    <VATCHARGES>0.00</VATCHARGES>
    <ORDERSALESTAX>2.61</ORDERSALESTAX>
    <ITEM>
      <ITEMID>3001</ITEMID>
      <PRICE>26.0800</PRICE>
      <QTY>1</QTY>
    </ITEM>
  </ORDER>`),
      usernameOrdersXml: brickLinkOrdersXml(`
  <ORDER>
    <ORDERID>32466549</ORDERID>
    <BUYER>Zemeckis84</BUYER>
  </ORDER>`),
    },
    // The marketplace takes the tax it collected back out of the payment as its application fee.
    stripe: [
      {
        description: "Payment for BrickLink from Zemeckis84",
        amount: 2869,
        applicationFee: 261,
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].order.taxType).toBe("export-taxable");
  expect(body.orders[0].order.facilitatorTax).toBe(2.61);
  expect(body.orders[0].gateway.facilitatorTax).toBe(2.61);
  expect(body.orders[0].failures).toEqual([]);
});

test("reports no facilitator tax for a Stripe payment the marketplace took no application fee from", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
    stripe: [{ description: "Brick Owl Order owl-order-0810", amount: 520 }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.facilitatorTax).toBeNull();
  expect(body.orders[0].failures).toEqual([]);
});

test("reports the facilitator tax PayPal shows a BrickOwl order was taken", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "7500001",
        orderDate: "1786320000",
        view: {
          buyer_name: "Edith Clarke",
          payment_method_type: "paypal",
          sub_total: "7.69",
          base_order_total: "9.66",
          tax_scheme_id: "gb-vat",
          tax_rate: "20",
          tax_amount: "1.97",
        },
      },
    ],
    payPal: [
      {
        transactionId: "owl-payment",
        invoiceId: "7500001",
        payerName: "Edith Clarke",
        amount: "9.66",
      },
      // What BrickOwl took back out of that payment under its own registration, as PayPal books it.
      { eventCode: "T0113", referenceId: "owl-payment", amount: "-1.97" },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].order.taxType).toBe("export-taxable");
  expect(body.orders[0].order.facilitatorTax).toBe(1.97);
  expect(body.orders[0].gateway.facilitatorTax).toBe(1.97);
  expect(body.orders[0].failures).toEqual([]);
});

test("leaves a PayPal order no partner fee was raised against without a facilitator tax", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "8779732",
        orderDate: "1786320000",
        view: {
          buyer_name: "Hedy Lamarr",
          payment_method_type: "paypal",
          sub_total: "4.88",
          base_order_total: "5.89",
          billing_country_code: "LV",
          tax_rate: "21",
        },
      },
    ],
    // The payment carries the VAT the store charged itself, and the marketplace took none of it back.
    payPal: [
      {
        transactionId: "owl-payment",
        invoiceId: "8779732",
        payerName: "Hedy Lamarr",
        amount: "5.89",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].order.taxType).toBe("domestic");
  expect(body.orders[0].order.facilitatorTax).toBeNull();
  expect(body.orders[0].gateway.facilitatorTax).toBeNull();
  expect(body.orders[0].failures).toEqual([]);
});

test("sums the partner fees PayPal raised against one BrickLink payment", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456590</ORDERID>
    <ORDERDATE>8/12/2026</ORDERDATE>
    <BUYER>Katherine Johnson</BUYER>
    <ORDERTOTAL>9.81</ORDERTOTAL>
    <BASEGRANDTOTAL>11.78</BASEGRANDTOTAL>
    <PAYMENTTYPE>PayPal (Onsite)</PAYMENTTYPE>
    <LOCATION>United Kingdom, England</LOCATION>
    <VATCHARGES>0.00</VATCHARGES>
    <ORDERSALESTAX>1.10</ORDERSALESTAX>
    <ORDERVAT>0.87</ORDERVAT>
    <ITEM><ITEMID>3001</ITEMID><PRICE>9.8100</PRICE><QTY>1</QTY></ITEM>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: emptyOrdersXml,
    },
    payPal: [
      {
        transactionId: "link-payment",
        payerName: "Katherine Johnson",
        amount: "11.78",
      },
      { eventCode: "T0113", referenceId: "link-payment", amount: "-1.10" },
      { eventCode: "T0113", referenceId: "link-payment", amount: "-0.87" },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].order.facilitatorTax).toBe(1.97);
  expect(body.orders[0].gateway.facilitatorTax).toBe(1.97);
  expect(body.orders[0].failures).toEqual([]);
});

test("collects the accounting invoice onto the order it notes", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-09",
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(
        brickLinkOrderXml("32466549", "5.00", [["2.5000", "2"]], "9/1/2026"),
      ),
      usernameOrdersXml: emptyOrdersXml,
    },
    manakabata: [
      { invoiceNote: "bricklink:32466549", subtotal: "5.00", tax: "1.05" },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-09",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  // All three amounts come from the one invoice, so they are merged together or not at all.
  expect(body.orders[0].accounting).toEqual({
    subTotal: 5,
    vat: 1.05,
    grandTotal: 6.05,
  });
});

test("collects an accounting invoice noted in the legacy format", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-09",
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(
        brickLinkOrderXml("32466553", "5.00", [["2.5000", "2"]], "9/1/2026"),
      ),
      usernameOrdersXml: emptyOrdersXml,
    },
    manakabata: [{ invoiceNote: "BrickLink order 32466553", subtotal: "5.00" }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-09",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].accounting.subTotal).toBe(5);
});

test("leaves an order no accounting invoice notes uninvoiced", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-09",
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(
        brickLinkOrderXml("32466561", "5.00", [["2.5000", "2"]], "9/1/2026"),
      ),
      usernameOrdersXml: emptyOrdersXml,
    },
    // An invoice noting another order, so the list is searched rather than taken as this order's.
    manakabata: [{ invoiceNote: "bricklink:32466562", subtotal: "5.00" }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-09",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].accounting).toEqual({
    subTotal: null,
    vat: null,
    grandTotal: null,
  });
});

test("links each order to where its own marketplace shows it", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(
        brickLinkOrderXml("32509898", "5.00", [["2.5000", "2"]], "8/30/2026"),
      ),
      usernameOrdersXml: emptyOrdersXml,
    },
    brickOwl: [
      {
        orderId: "1449775",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(
    body.orders.map(
      (order: { order: { orderId: string; orderUrl: string } }) => [
        order.order.orderId,
        order.order.orderUrl,
      ],
    ),
  ).toEqual([
    [
      "32509898",
      "https://www.bricklink.com/orderDetail.asp?ID=32509898&viewChk=Y&viewWeight=Y&viewRemain=Y",
    ],
    ["1449775", "https://www.brickowl.com/mystore/orders/history/1449775"],
  ]);
});

test("links a Stripe-paid order to the payment in the Stripe dashboard", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
    stripe: [
      {
        description: "Brick Owl Order owl-order-0810",
        amount: 520,
        paymentIntent: "pi_test-payment-0810",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paymentUrl).toBe(
    "https://dashboard.stripe.com/acct_test-stripe-account/payments/pi_test-payment-0810",
  );
});

test("links a Stripe-paid order to the charge when the payment was made without a payment intent", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
    stripe: [
      {
        description: "Brick Owl Order owl-order-0810",
        amount: 520,
        paymentIntent: null,
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paymentUrl).toBe(
    "https://dashboard.stripe.com/acct_test-stripe-account/payments/ch_test-charge-1",
  );
});

test("links a PayPal-paid order to the transaction in PayPal", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "7500001",
        orderDate: "1786320000",
        view: {
          buyer_name: "Edith Clarke",
          payment_method_type: "paypal",
          sub_total: "7.69",
          base_order_total: "7.69",
        },
      },
    ],
    payPal: [
      { invoiceId: "7500001", payerName: "Edith Clarke", amount: "7.69" },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paymentUrl).toBe(
    "https://www.paypal.com/unifiedtransactions/details/payment/test-paypal-transaction-1",
  );
});

test("leaves an order no payment was matched to without a payment link", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "owl-order-0810",
        orderDate: "1786320000",
        view: {
          buyer_name: "some buyer",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
        },
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paymentUrl).toBeNull();
});

test("reports what PayPal was paid for a BrickOwl order it labelled with the order number", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "7500001",
        orderDate: "1786320000",
        view: {
          buyer_name: "Edith Clarke",
          payment_method_type: "paypal",
          sub_total: "7.69",
          base_order_total: "7.69",
        },
      },
    ],
    payPal: [
      { invoiceId: "7500001", payerName: "Edith Clarke", amount: "7.69" },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBe(7.69);
  expect(body.orders[0].failures).toEqual([]);
});

test("reports what PayPal was paid for a BrickLink order by the buyer the payment names", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: "32456563", buyer: "Emmy Noether", total: "11.39" },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    // The payment spells the buyer with different casing and spacing than the order does.
    payPal: [{ payerName: "riku  WATANABE", amount: "11.39" }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBe(11.39);
  expect(body.orders[0].failures).toEqual([]);
});

test("reports what PayPal was paid for a BrickLink order by the shipping name when the payer is named otherwise", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: "32456563", buyer: "Hedy Lamarr", total: "5.89" },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    payPal: [
      {
        payerName: "Someone Else",
        shippingName: "Hedy Lamarr",
        amount: "5.89",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBe(5.89);
});

test("falls back to the amount and day when no name matches a BrickLink order", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: "32456563", buyer: "Mary Jackson", total: "23.06" },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    // 'Mary Jacson' is how PayPal spells this buyer; it matches no order, so the amount and the day decide.
    payPal: [
      {
        payerName: "Mary Jacson",
        amount: "23.06",
        initiatedAt: "2026-08-30T05:24:15Z",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBe(23.06);
});

test("reports no paid amount when the amount and day match several BrickLink orders", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: "32456563", buyer: "First Buyer", total: "23.06" },
        { orderId: "32456564", buyer: "Second Buyer", total: "23.06" },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    payPal: [
      {
        payerName: "Nobody Known",
        amount: "23.06",
        initiatedAt: "2026-08-30T05:24:15Z",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(
    body.orders.map((order: ReconciledOrderShape) => order.gateway.paidAmount),
  ).toEqual([null, null]);
});

test("tells one buyer's BrickLink orders apart by what the payment took", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: "32456563", buyer: "Rosalind Franklin", total: "38.80" },
        { orderId: "32456564", buyer: "Rosalind Franklin", total: "5.06" },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    // The buyer is known and ordered twice, so what the payment took says which of the two it settled.
    payPal: [
      {
        payerName: "Rosalind Franklin",
        amount: "38.80",
        initiatedAt: "2026-08-30T05:24:15Z",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  const paid = Object.fromEntries(
    body.orders.map((order: ReconciledOrderShape) => [
      order.order.orderId,
      order.gateway.paidAmount,
    ]),
  );
  expect(paid).toEqual({ "32456563": 38.8, "32456564": null });
});

test("reports no paid amount when one buyer's BrickLink orders came to the same amount", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: "32456563", buyer: "Rosalind Franklin", total: "38.80" },
        { orderId: "32456564", buyer: "Rosalind Franklin", total: "38.80" },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    // Neither the name nor the amount tells these two apart, and a guessed payment reads like a reconciled one.
    payPal: [
      {
        payerName: "Rosalind Franklin",
        amount: "38.80",
        initiatedAt: "2026-08-30T05:24:15Z",
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(
    body.orders.map((order: ReconciledOrderShape) => order.gateway.paidAmount),
  ).toEqual([null, null]);
});

test("reports no paid amount from a PayPal fee, refund or withdrawal that names the buyer", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkPayPalOrdersXml([
        { orderId: "32456563", buyer: "Katherine Johnson", total: "11.78" },
      ]),
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    payPal: [
      { payerName: "Katherine Johnson", amount: "11.78", eventCode: "T0113" },
      { payerName: "Katherine Johnson", amount: "11.78", eventCode: "T0007" },
      { payerName: "Katherine Johnson", amount: "11.78", eventCode: "T0200" },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBeNull();
});

test("does not attach a PayPal payment to an order settled another way", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>32456563</ORDERID>
    <ORDERDATE>8/30/2026</ORDERDATE>
    <BUYER>Bank Payer</BUYER>
    <ORDERTOTAL>7.00</ORDERTOTAL>
    <BASEGRANDTOTAL>7.00</BASEGRANDTOTAL>
    <PAYMENTTYPE>Bank Transfer</PAYMENTTYPE>
    <ITEM><ITEMID>3001</ITEMID><PRICE>7.0000</PRICE><QTY>1</QTY></ITEM>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
    payPal: [{ payerName: "Bank Payer", amount: "7.00" }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].gateway.paidAmount).toBeNull();
  expect(body.orders[0].failures).toEqual([
    { code: "amount-missing", level: "error", fields: ["gateway.paidAmount"] },
  ]);
});

test("collects PayPal payments that span several pages", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "7500001",
        orderDate: "1786320000",
        view: { buyer_name: "First Buyer", payment_method_type: "paypal" },
      },
      {
        orderId: "5120724",
        orderDate: "1786320000",
        view: { buyer_name: "Second Buyer", payment_method_type: "paypal" },
      },
    ],
    payPalPages: [
      [{ invoiceId: "7500001", amount: "7.69" }],
      [{ invoiceId: "5120724", amount: "7.71" }],
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  const paidByOrder = Object.fromEntries(
    body.orders.map((order: ReconciledOrderShape) => [
      order.order.orderId,
      order.gateway.paidAmount,
    ]),
  );
  expect(paidByOrder).toEqual({ "7500001": 7.69, "5120724": 7.71 });

  // Two pages of the segment the window opens with, and one page of the segment that closes it.
  const transactionRequests = await wireMock.findMethodHostRequests(
    "GET",
    "/v1/reporting/transactions",
  );
  expect(transactionRequests).toHaveLength(3);
});

/**
 * Bank transfers, which are payments like a card provider's but read out of the statements a person imported rather
 * than asked of a provider. The bank is the payment provider of an order settled that way, so what it booked is
 * collected under the gateway source and the same rules judge it.
 *
 * A transfer is attached to an order only by the order id it names — the mapping a person wrote first, then the
 * remittance the payer wrote — so these scenarios import a document and then reconcile the month, rather than mocking
 * a provider.
 */

/** BrickLink orders the marketplace says were settled by bank transfer. */
const brickLinkBankTransferOrdersXml = (
  orders: Array<{ orderId: string; buyer: string; total: string }>,
) =>
  `<?xml version="1.0" encoding="UTF-8"?><ORDERS>${orders
    .map(
      (order) => `
  <ORDER>
    <ORDERID>${order.orderId}</ORDERID>
    <ORDERDATE>8/30/2026</ORDERDATE>
    <BUYER>${order.buyer}</BUYER>
    <ORDERTOTAL>${order.total}</ORDERTOTAL>
    <BASEGRANDTOTAL>${order.total}</BASEGRANDTOTAL>
    <PAYMENTTYPE>Bank Transfer</PAYMENTTYPE>
    <ITEM><ITEMID>3001</ITEMID><PRICE>${order.total}</PRICE><QTY>1</QTY></ITEM>
  </ORDER>`,
    )
    .join("")}</ORDERS>`;

/** A BrickOwl order the marketplace says was settled by bank transfer, which it words as `bank`. */
const brickOwlBankTransferOrder = (
  orderId: string,
  total: string,
): BrickOwlOrderMock => ({
  orderId,
  orderDate: "1786320000",
  view: {
    buyer_name: "Grace Hopper",
    payment_method_type: "bank",
    sub_total: total,
    base_order_total: total,
  },
});

/**
 * One booked entry of the statement, dated a few days into the month after the order's. That is deliberate: a buyer
 * pays a bank transfer when they get around to it, and the window the entries are read for reaches past the month
 * for exactly that reason.
 */
const bankEntry = (entry: {
  reference: string;
  amount: string;
  remittance?: string;
  direction?: "CRDT" | "DBIT";
}) => ({
  reference: entry.reference,
  amount: entry.amount,
  direction: entry.direction ?? ("CRDT" as const),
  bookingDate: "2026-09-02",
  counterpartyName: "Grace Hopper",
  remittance: entry.remittance,
});

/** The reconciled order with this id, whichever place the month's sort put it in. */
const orderOf = (body: { orders: any[] }, orderId: string) =>
  body.orders.find((order: any) => order.order.orderId === orderId);

/** The stored entry the month after the orders, which is where these scenarios book their transfers. */
async function storedEntries(request: APIRequestContext) {
  const response = await request.get(
    "/api/private/bank-statements/entries?period=2026-09",
  );
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).entries as Array<{
    id: number;
    entryReference: string;
  }>;
}

async function reconciled(request: APIRequestContext) {
  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );
  expect(response.status(), await response.text()).toBe(200);
  return await response.json();
}

test("reports what the bank was paid for a BrickOwl order the transfer names", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [brickOwlBankTransferOrder("7500001", "7.69")],
  });
  await importDocument(
    request,
    camt053({
      entries: [
        bankEntry({
          reference: "2026090200000001-1",
          amount: "7.69",
          remittance: "Payment for order 7500001, thanks",
        }),
      ],
    }),
  );

  const body = await reconciled(request);

  expect(orderOf(body, "7500001").gateway.paidAmount).toBe(7.69);
  expect(orderOf(body, "7500001").failures).toEqual([]);
});

test("reports what the bank was paid for a BrickLink order the transfer names", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkBankTransferOrdersXml([
        { orderId: "32456563", buyer: "Grace Hopper", total: "11.39" },
      ]),
      usernameOrdersXml: emptyOrdersXml,
    },
  });
  await importDocument(
    request,
    camt053({
      entries: [
        bankEntry({
          reference: "2026090200000002-1",
          amount: "11.39",
          remittance: "BL 32456563",
        }),
      ],
    }),
  );

  const body = await reconciled(request);

  expect(orderOf(body, "32456563").gateway.paidAmount).toBe(11.39);
  expect(orderOf(body, "32456563").failures).toEqual([]);
});

test("prefers the mapping a person wrote to what the payer wrote on the transfer", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      brickOwlBankTransferOrder("7500001", "5.00"),
      brickOwlBankTransferOrder("7500002", "9.99"),
    ],
  });
  // The payer named the wrong order, which is exactly the case the mapping column exists for.
  await importDocument(
    request,
    camt053({
      entries: [
        bankEntry({
          reference: "2026090200000003-1",
          amount: "9.99",
          remittance: "order 7500001",
        }),
      ],
    }),
  );
  const stored = await storedEntries(request);
  await request.put(
    `/api/private/bank-statements/entries/${stored[0].id}/mapping`,
    { data: { mapping: "7500002" } },
  );

  const body = await reconciled(request);

  expect(orderOf(body, "7500002").gateway.paidAmount).toBe(9.99);
  expect(orderOf(body, "7500002").failures).toEqual([]);
  expect(orderOf(body, "7500001").gateway.paidAmount).toBeNull();
});

test("sums every bank transfer that names one order", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [brickOwlBankTransferOrder("7500001", "7.69")],
  });
  // A buyer who underpaid and was asked for the rest paid twice, and both transfers are money the store received.
  await importDocument(
    request,
    camt053({
      entries: [
        bankEntry({
          reference: "2026090200000004-1",
          amount: "4.00",
          remittance: "order 7500001",
        }),
        bankEntry({
          reference: "2026090200000005-1",
          amount: "3.69",
          remittance: "order 7500001 remainder",
        }),
      ],
    }),
  );

  const body = await reconciled(request);

  expect(orderOf(body, "7500001").gateway.paidAmount).toBe(7.69);
  expect(orderOf(body, "7500001").failures).toEqual([]);
});

test("names the bank entries an order was settled by, however they were matched", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [brickOwlBankTransferOrder("7500001", "7.69")],
  });
  // One the payer named the order on and one a person mapped by hand: the order is settled by both, and says so
  // the same way for both. Only the mapping is written on the entry, so an order that named neither would leave
  // the screen able to draw the link a person typed and not the one the matching found for itself.
  await importDocument(
    request,
    camt053({
      entries: [
        bankEntry({
          reference: "2026090200000006-1",
          amount: "4.00",
          remittance: "order 7500001",
        }),
        bankEntry({
          reference: "2026090200000007-1",
          amount: "3.69",
          remittance: "no order named here",
        }),
      ],
    }),
  );
  const stored = await storedEntries(request);
  const mapped = stored.find(
    (entry) => entry.entryReference === "2026090200000007-1",
  );
  await request.put(
    `/api/private/bank-statements/entries/${mapped!.id}/mapping`,
    { data: { mapping: "7500001" } },
  );

  const body = await reconciled(request);

  expect(orderOf(body, "7500001").gateway.entryReferences.toSorted()).toEqual([
    "2026090200000006-1",
    "2026090200000007-1",
  ]);
  // What it was settled by, not how much: the amounts say that, and they still add up.
  expect(orderOf(body, "7500001").gateway.paidAmount).toBe(7.69);
});

test("names no bank entry on an order no transfer settled", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [brickOwlBankTransferOrder("7500001", "7.69")],
  });

  const body = await reconciled(request);

  expect(orderOf(body, "7500001").gateway.entryReferences).toEqual([]);
});

test("reports a bank transfer sent back out as the gateway's refund", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [brickOwlBankTransferOrder("7500001", "7.69")],
  });
  await importDocument(
    request,
    camt053({
      entries: [
        bankEntry({
          reference: "2026090200000006-1",
          amount: "7.69",
          remittance: "order 7500001",
        }),
        bankEntry({
          reference: "2026090200000007-1",
          amount: "2.00",
          direction: "DBIT",
          remittance: "refund order 7500001",
        }),
      ],
    }),
  );

  const body = await reconciled(request);

  const order = orderOf(body, "7500001");
  expect(order.gateway.paidAmount).toBe(7.69);
  expect(order.gateway.refundedAmount).toBe(2);
  // What may still be invoiced is cut by the refund, the store no longer holding it.
  expect(order.calculated.targetInvoice).toBe(5.69);
  // The marketplace reports no refund of its own, so the two accounts of it disagree.
  expect(order.failures).toEqual([
    {
      code: "refunded-amount-mismatch",
      level: "error",
      fields: ["order.refundedAmount", "gateway.refundedAmount"],
    },
  ]);
});

test("attaches a bank transfer naming two collected orders to neither", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      brickOwlBankTransferOrder("7500001", "5.00"),
      brickOwlBankTransferOrder("7500002", "9.99"),
    ],
  });
  await importDocument(
    request,
    camt053({
      entries: [
        bankEntry({
          reference: "2026090200000008-1",
          amount: "9.99",
          remittance: "orders 7500001 7500002",
        }),
      ],
    }),
  );

  const body = await reconciled(request);

  expect(orderOf(body, "7500001").gateway.paidAmount).toBeNull();
  expect(orderOf(body, "7500002").gateway.paidAmount).toBeNull();
});

test("does not attach a bank transfer to an order settled another way", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "7500001",
        orderDate: "1786320000",
        view: {
          buyer_name: "Grace Hopper",
          payment_method_type: "stripe",
          sub_total: "7.69",
          base_order_total: "7.69",
        },
      },
    ],
  });
  await importDocument(
    request,
    camt053({
      entries: [
        bankEntry({
          reference: "2026090200000009-1",
          amount: "7.69",
          remittance: "order 7500001",
        }),
      ],
    }),
  );

  const body = await reconciled(request);

  expect(orderOf(body, "7500001").gateway.paidAmount).toBeNull();
});

test("does not read an order id out of a longer number on a transfer", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [brickOwlBankTransferOrder("7500001", "7.69")],
  });
  await importDocument(
    request,
    camt053({
      entries: [
        bankEntry({
          reference: "2026090200000010-1",
          amount: "7.69",
          remittance: "invoice 75000012",
        }),
      ],
    }),
  );

  const body = await reconciled(request);

  expect(orderOf(body, "7500001").gateway.paidAmount).toBeNull();
});

test("reports a bad gateway when PayPal fails", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
  });
  await wireMock.addMethodHostMapping("GET", "/v1/reporting/transactions", {
    response: { status: 500, json: { message: "PayPal is unavailable" } },
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(502);
});

test("rejects an invalid reconciliation month", async ({ request }) => {
  const response = await request.get(
    "/api/private/reconciliation/orders?month=August-2026",
  );

  expect(response.status(), await response.text()).toBe(400);
});

test("requires a reconciliation month", async ({ request }) => {
  const response = await request.get("/api/private/reconciliation/orders");

  expect(response.status(), await response.text()).toBe(400);
});

/** A BrickLink order as the export reports it, in whatever status the scenario is about. */
const cancellableBrickLinkOrderXml = (
  orderId: string,
  total: string,
  status: string,
) => `
  <ORDER>
    <ORDERID>${orderId}</ORDERID>
    <BUYER>Alan Turing</BUYER>
    <DATEORDERED>08/30/2026 10:00</DATEORDERED>
    <ORDERSTATUS>${status}</ORDERSTATUS>
    <ORDERTOTAL>${total}</ORDERTOTAL>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    <BASEGRANDTOTAL>${total}</BASEGRANDTOTAL>
    <PAYMENTTYPE>Credit/Debit (Powered by Stripe)</PAYMENTTYPE>
    <LOCATION>Poland</LOCATION>
    <VATCHARGES>0.00</VATCHARGES>
    <ITEM><ITEMID>3001</ITEMID><PRICE>${total}</PRICE><QTY>1</QTY></ITEM>
  </ORDER>`;

const brickLinkUsernameXml = (orderId: string, username: string) => `
  <ORDER>
    <ORDERID>${orderId}</ORDERID>
    <BUYER>${username}</BUYER>
  </ORDER>`;

test("collects the refund BrickLink states on a cancelled order", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(
        cancellableBrickLinkOrderXml("32100002", "19.63", "Cancelled"),
      ),
      usernameOrdersXml: brickLinkOrdersXml(
        brickLinkUsernameXml("32100002", "alan-t"),
      ),
      refunds: { "32100002": "EUR&nbsp;19.63" },
    },
    stripe: [
      {
        description: "Payment for BrickLink from alan-t",
        amount: 1963,
        amountRefunded: 1963,
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].order.refundedAmount).toBe(19.63);
  expect(body.orders[0].gateway.refundedAmount).toBe(19.63);
  // The two sides of the refund now agree, which is what the marketplace's side was missing.
  expect(body.orders[0].failures).toEqual([]);
});

test("asks for a detail page only for the orders BrickLink cancelled", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(
        cancellableBrickLinkOrderXml("32100002", "19.63", "Cancelled"),
        cancellableBrickLinkOrderXml("32100003", "5.00", "Completed"),
      ),
      usernameOrdersXml: brickLinkOrdersXml(),
      refunds: { "32100002": "EUR&nbsp;19.63" },
    },
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const detailRequests = await wireMock.findMethodHostRequests(
    "GET",
    "/orderDetail.asp",
  );
  expect(detailRequests).toHaveLength(1);
  expect(detailRequests[0].url).toContain("ID=32100002");

  const body = await response.json();
  const byOrderId = Object.fromEntries(
    body.orders.map((order: ReconciledOrderShape) => [
      order.order.orderId,
      order.order.refundedAmount,
    ]),
  );
  expect(byOrderId).toEqual({ "32100002": 19.63, "32100003": null });
});

test("collects no refund where a cancelled order's page states none", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(
        cancellableBrickLinkOrderXml("32100002", "19.63", "Cancelled"),
      ),
      usernameOrdersXml: brickLinkOrdersXml(
        brickLinkUsernameXml("32100002", "alan-t"),
      ),
    },
    stripe: [
      {
        description: "Payment for BrickLink from alan-t",
        amount: 1963,
        amountRefunded: 1963,
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].order.refundedAmount).toBeNull();
  expect(
    body.orders[0].failures.map((failure: { code: string }) => failure.code),
  ).toEqual(["refunded-amount-mismatch"]);
});

test("collects each cancelled order's own refund", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(
        cancellableBrickLinkOrderXml("32100002", "19.63", "Cancelled"),
        cancellableBrickLinkOrderXml("32100003", "5.00", "Cancelled"),
      ),
      usernameOrdersXml: brickLinkOrdersXml(),
      // The second page states its amount with a thousands separator, which collects normalized like any other.
      refunds: {
        "32100002": "EUR&nbsp;19.63",
        "32100003": "EUR&nbsp;1,234.567",
      },
    },
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  const byOrderId = Object.fromEntries(
    body.orders.map((order: ReconciledOrderShape) => [
      order.order.orderId,
      order.order.refundedAmount,
    ]),
  );
  expect(byOrderId).toEqual({ "32100002": 19.63, "32100003": 1234.57 });
});

test("asks for no detail page in a month BrickLink cancelled nothing in", async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: brickLinkOrdersXml(
        cancellableBrickLinkOrderXml("32100003", "5.00", "Completed"),
      ),
      usernameOrdersXml: brickLinkOrdersXml(),
    },
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  await expect(
    wireMock.findMethodHostRequests("GET", "/orderDetail.asp"),
  ).resolves.toHaveLength(0);
});

test("collects the refund BrickOwl states on an order", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0811",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Alpha",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
          refund_total: "2.00",
        },
      },
    ],
    stripe: [
      {
        description: "Brick Owl Order test-order-0811",
        amount: 520,
        amountRefunded: 200,
      },
    ],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].order.refundedAmount).toBe(2);
  expect(body.orders[0].gateway.refundedAmount).toBe(2);
  // The two sides of the refund agree, which is what the marketplace's side was missing.
  expect(body.orders[0].failures).toEqual([]);
});

test("collects no refund from a BrickOwl order whose refund total is zero", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickOwl: [
      {
        orderId: "test-order-0812",
        orderDate: "1786320000",
        view: {
          buyer_name: "Test Buyer Alpha",
          payment_method_type: "stripe",
          sub_total: "5.20",
          base_order_total: "5.20",
          // BrickOwl writes a refund total on every order, so a zero is the marketplace reporting no refund.
          refund_total: "0.00",
        },
      },
    ],
    stripe: [{ description: "Brick Owl Order test-order-0812", amount: 520 }],
  });

  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );

  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  expect(body.orders[0].order.refundedAmount).toBeNull();
  expect(body.orders[0].gateway.refundedAmount).toBeNull();
  expect(body.orders[0].failures).toEqual([]);
});

test("collects marketplace item and lot counts, preserving zero and missing counts", async ({
  request,
  settings,
}, testInfo) => {
  await mockReconciliationOrders(settings, request, testInfo, {
    month: "2026-08",
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS>
        <ORDER><ORDERID>99000001</ORDERID><ORDERDATE>8/10/2026</ORDERDATE>
          <BUYER>Test Buyer Alpha</BUYER><ORDERITEMS>1234</ORDERITEMS><ORDERLOTS>56</ORDERLOTS>
          <ITEM><ITEMID>3001</ITEMID><QTY>3</QTY><PRICE>1.00</PRICE></ITEM>
        </ORDER>
        <ORDER><ORDERID>99000002</ORDERID><ORDERDATE>8/10/2026</ORDERDATE>
          <ORDERITEMS>0</ORDERITEMS><ORDERLOTS>0</ORDERLOTS>
        </ORDER>
        <ORDER><ORDERID>99000003</ORDERID><ORDERDATE>8/10/2026</ORDERDATE></ORDER>
      </ORDERS>`,
    },
    brickOwl: [
      {
        orderId: "7500001",
        orderDate: "1786320000",
        view: { total_quantity: "987", total_lots: "43" },
      },
      {
        orderId: "7500002",
        orderDate: "1786320000",
        view: { total_quantity: "0", total_lots: "0" },
      },
      { orderId: "7500003", orderDate: "1786320000", view: {} },
    ],
  });
  const response = await request.get(
    "/api/private/reconciliation/orders?month=2026-08",
  );
  expect(response.status(), await response.text()).toBe(200);
  const body = await response.json();
  for (const [id, itemCount, lotCount] of [
    ["99000001", 1234, 56],
    ["99000002", 0, 0],
    ["99000003", null, null],
    ["7500001", 987, 43],
    ["7500002", 0, 0],
    ["7500003", null, null],
  ]) {
    expect(
      body.orders.find(
        (order: { order: { orderId: string } }) => order.order.orderId === id,
      )?.order,
    ).toMatchObject({ itemCount, lotCount });
  }
});
