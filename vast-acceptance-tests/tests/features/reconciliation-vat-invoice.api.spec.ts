import { expect, test } from "../support/api-test";
import { archiveBaseDirectory } from "../support/order-archive";
import {
  archiveDirectory,
  writeBrickLinkVatInvoice,
} from "../support/order-import";
import { mockReconciliationOrders } from "../support/reconciliation";
import { wireMockMode } from "../support/wiremock";

/**
 * The VAT invoice BrickLink issues for an order it collected the tax on, and whether the store still has it.
 *
 * <p>The store did not write that invoice and cannot write it again: BrickLink serves it for as long as BrickLink
 * cares to, and the archived copy is the one that will still be there when an inspection asks. So the report says
 * plainly which export-taxable orders have no copy, and says nothing at all about the orders that were never owed
 * one.
 */

test.describe.configure({ mode: wireMockMode() });

const month = "2026-08";

/**
 * One BrickLink order of the month. `salesTax` is what the marketplace collected as facilitator, which with no VAT
 * charged under the store's own registration is what makes the order an export it taxed all the same.
 */
function collectedOrder(orderId: number, salesTax: string) {
  return {
    month,
    brickLink: {
      fullNameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?>
<ORDERS>
  <ORDER>
    <ORDERID>${orderId}</ORDERID>
    <ORDERDATE>8/12/2026</ORDERDATE>
    <BUYER>Marta Ozola</BUYER>
    <ORDERITEMS>7</ORDERITEMS>
    <ORDERLOTS>3</ORDERLOTS>
    <ORDERTOTAL>10.00</ORDERTOTAL>
    <ORDERSHIPPING>2.50</ORDERSHIPPING>
    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
    <BASEGRANDTOTAL>12.50</BASEGRANDTOTAL>
    <PAYCURRENCYCODE>EUR</PAYCURRENCYCODE>
    <PAYMENTTYPE>PayPal (Onsite)</PAYMENTTYPE>
    <VATCHARGES>0.00</VATCHARGES>
    <ORDERSALESTAX>${salesTax}</ORDERSALESTAX>
    <ORDERVAT>0.00</ORDERVAT>
  </ORDER>
</ORDERS>`,
      usernameOrdersXml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS/>`,
    },
  };
}

/** A store's own archive directory, empty until a scenario puts something in it. */
async function emptyArchive(
  settings: { set: (key: string, value: string) => Promise<void> },
  tenantCode: string,
) {
  const base = archiveBaseDirectory();
  await settings.set("VAST_ORDER_ARCHIVE_DIR", base);
  return archiveDirectory(base, tenantCode);
}

async function reconciled(
  request: Parameters<typeof mockReconciliationOrders>[1],
) {
  const response = await request.get(
    `/api/private/reconciliation/orders?month=${month}`,
  );
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).orders[0];
}

const vatInvoiceMissing = (order: { failures: { code: string }[] }) =>
  order.failures.filter(
    (failure: { code: string }) => failure.code === "vat-invoice-missing",
  );

test("reports the archived VAT invoice of an export-taxable order and nothing to fix", async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const orderId = 32456701;
  await mockReconciliationOrders(
    settings,
    request,
    testInfo,
    collectedOrder(orderId, "1.05"),
  );
  writeBrickLinkVatInvoice(
    await emptyArchive(settings, authentication.tenant.code),
    orderId,
    "2026-08-12T09:00:00.000Z",
  );

  const order = await reconciled(request);
  expect(order.order.taxType).toBe("export-taxable");
  expect(order.archive.vatInvoice).toBe(true);
  expect(vatInvoiceMissing(order)).toEqual([]);
});

test("fails an export-taxable order the store archived no VAT invoice for", async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const orderId = 32456702;
  await mockReconciliationOrders(
    settings,
    request,
    testInfo,
    collectedOrder(orderId, "1.05"),
  );
  await emptyArchive(settings, authentication.tenant.code);

  const order = await reconciled(request);
  expect(order.order.taxType).toBe("export-taxable");
  expect(order.archive.vatInvoice).toBeNull();
  // At `error`, because the document can stop being fetchable: this is something to go and do.
  expect(vatInvoiceMissing(order)).toEqual([
    {
      code: "vat-invoice-missing",
      level: "error",
      fields: ["archive.vatInvoice", "order.taxType"],
    },
  ]);
});

test("says nothing about an export the marketplace collected no tax on", async ({
  request,
  settings,
  authentication,
}, testInfo) => {
  const orderId = 32456703;
  await mockReconciliationOrders(
    settings,
    request,
    testInfo,
    collectedOrder(orderId, "0.00"),
  );
  await emptyArchive(settings, authentication.tenant.code);

  const order = await reconciled(request);
  // BrickLink taxed nothing, so it issued no invoice, so there is nothing for the store to be holding.
  expect(order.order.taxType).toBe("export");
  expect(order.archive.vatInvoice).toBeNull();
  expect(vatInvoiceMissing(order)).toEqual([]);
});
