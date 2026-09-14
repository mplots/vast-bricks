import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The archive as the import finds it: files on disk, written by the scenario rather than by an archive run.
 *
 * <p>The import reads nothing but the directory, so stating the files directly is stating the whole input. It also
 * lets a scenario put an order on disk in two states at once, which is what the upsert is about and what an archive
 * run could only reach by being run twice against two different mocked marketplaces.
 */

/** The cast is fictional and reused across scenarios, so nobody is tempted to paste a real buyer beside it. */
export type ArchivedBrickLinkOrder = {
  orderId: number;
  archivedAt: string;
  dateOrdered?: string;
  /** The buyer's account, which is how BrickLink names a buyer everywhere but the shipping address. */
  buyerName?: string;
  /** The name the order is shipped to, which is the only place BrickLink states a person. */
  shippedTo?: string;
  uniqueCount?: number;
  totalCount?: number;
  grandTotal?: string;
  currency?: string;
};

/**
 * The accounting export a BrickLink store sees under its own account, which is what the import prefers for every
 * field it states. The buyer is the exception it does not state: the export names a buyer by their account whether
 * or not it was asked for real names, so the name is read off the API record instead.
 */
export type ArchivedAccountingOrder = {
  orderId: number;
  archivedAt: string;
  /** As the export states a day: month/day/year, no time of day. */
  orderDate?: string;
  /**
   * The buyer's account. Named `BUYER` because that is what the export calls the column, and it holds an account
   * rather than a person whatever the export was asked for.
   */
  buyer?: string;
  lots?: number;
  items?: number;
  subTotal?: string;
  shipping?: string;
  /** What the marketplace collected as VAT. With no VAT charged under the store's own registration beside it,
   * this is what makes an order facilitator-taxed. */
  vat?: string;
  salesTax?: string;
  /** VAT the store itself charged under its own registration, which is a different thing from the two above. */
  vatCharges?: string;
  grandTotal?: string;
  currency?: string;
  /** What the buyer paid in, which need not be what the order is totalled in. */
  paymentCurrency?: string;
  paymentType?: string;
};

export type ArchivedBrickOwlOrder = {
  orderId: string;
  archivedAt: string;
  orderTime?: string;
  /**
   * The offset BrickOwl states its ISO times with, which is London's rather than UTC: `+01:00` in summer and
   * `+00:00` in winter. A scenario states it where the difference is the point.
   */
  offset?: string;
  buyerName?: string;
  customerUsername?: string;
  totalLots?: number;
  totalQuantity?: number;
  subTotal?: string;
  shipping?: string;
  taxAmount?: string;
  taxRate?: string;
  refundTotal?: string;
  paymentMethodType?: string;
  paymentCurrency?: string;
  baseOrderTotal?: string;
  baseCurrency?: string;
};

export type ImportedOrder = {
  source: string;
  orderId: string;
  orderUrl: string | null;
  orderDate: string;
  buyer: string | null;
  buyerUsername: string | null;
  lotCount: number | null;
  itemCount: number | null;
  paymentMethod: string | null;
  currency: string | null;
  taxType: string | null;
  facilitatorTax: string | null;
  subTotal: string | null;
  shippingCost: string | null;
  grandTotal: string | null;
  refundedAmount: string | null;
  archivedAt: string;
};

/** The archive is written to the filesystem the service runs on, so a scenario gets a directory of its own. */
export function archiveDirectory(base: string, tenantCode: string): string {
  const directory = join(base, tenantCode);
  mkdirSync(directory, { recursive: true });
  return directory;
}

/** BrickLink's own record of an order, envelope and all, exactly as the archive writes it. */
export function writeBrickLinkOrder(
  directory: string,
  archived: ArchivedBrickLinkOrder,
): string {
  const body = {
    meta: { code: 200, message: "OK", description: "OK" },
    data: {
      order_id: archived.orderId,
      date_ordered: archived.dateOrdered ?? "2026-02-03T08:09:10.000Z",
      date_status_changed: archived.archivedAt,
      status: "COMPLETED",
      buyer_name: archived.buyerName ?? "brickfan_marta",
      // The only place BrickLink states a person rather than an account.
      shipping: { address: { name: { full: archived.shippedTo ?? "Marta Ozola" } } },
      total_count: archived.totalCount ?? 42,
      unique_count: archived.uniqueCount ?? 7,
      payment: {
        method: "PayPal (Onsite)",
        currency_code: archived.currency ?? "EUR",
      },
      cost: {
        currency_code: archived.currency ?? "EUR",
        grand_total: archived.grandTotal ?? "31.40",
        subtotal: "28.90",
        shipping: "2.50",
      },
    },
  };
  return write(
    directory,
    "bricklink",
    String(archived.orderId),
    archived.archivedAt,
    body,
  );
}

/** BrickOwl's own record of an order: the flat order object its batch endpoint answers with. */
export function writeBrickOwlOrder(
  directory: string,
  archived: ArchivedBrickOwlOrder,
): string {
  const body = {
    order_id: archived.orderId,
    order_time: `${archived.orderTime ?? "2026-02-04T09:10:11"}${archived.offset ?? "+00:00"}`,
    iso_order_time: `${archived.orderTime ?? "2026-02-04T09:10:11"}${archived.offset ?? "+00:00"}`,
    updated_time: `${archived.archivedAt}${archived.offset ?? "+00:00"}`,
    status: "Shipped",
    buyer_name: archived.buyerName ?? "Juris Berzins",
    customer_username: archived.customerUsername ?? "owlfan_juris",
    total_lots: archived.totalLots ?? 5,
    total_quantity: archived.totalQuantity ?? 19,
    sub_total: archived.subTotal ?? "10.00",
    ship_total: archived.shipping ?? "2.34",
    tax_amount: archived.taxAmount ?? "0.00",
    tax_rate: archived.taxRate ?? "0.00",
    refund_total: archived.refundTotal ?? "0.00",
    payment_method_type: archived.paymentMethodType ?? "paypal",
    payment_currency: archived.paymentCurrency ?? "EUR",
    base_currency: archived.baseCurrency ?? "EUR",
    base_order_total: archived.baseOrderTotal ?? "12.34",
  };
  return write(
    directory,
    "brickowl",
    archived.orderId,
    archived.archivedAt,
    body,
  );
}

/** The accounting export as BrickStore serves it: one order per export, which is how the archive asks for it. */
export function writeBrickLinkAccounting(
  directory: string,
  archived: ArchivedAccountingOrder,
): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><ORDERS><ORDER>
  <ORDERID>${archived.orderId}</ORDERID>
  <ORDERDATE>${archived.orderDate ?? "2/3/2026"}</ORDERDATE>
  <BUYER>${archived.buyer ?? "brickfan_marta"}</BUYER>
  <ORDERSHIPPING>${archived.shipping ?? "2.50"}</ORDERSHIPPING>
  <ORDERTOTAL>${archived.subTotal ?? "28.90"}</ORDERTOTAL>
  <ORDERSALESTAX>${archived.salesTax ?? "0.00"}</ORDERSALESTAX>
  <ORDERVAT>${archived.vat ?? "0.00"}</ORDERVAT>
  <VATCHARGES>${archived.vatCharges ?? "0.00"}</VATCHARGES>
  <ORDERLOTS>${archived.lots ?? 7}</ORDERLOTS>
  <ORDERITEMS>${archived.items ?? 42}</ORDERITEMS>
  <BASECURRENCYCODE>${archived.currency ?? "EUR"}</BASECURRENCYCODE>
  <BASEGRANDTOTAL>${archived.grandTotal ?? "31.40"}</BASEGRANDTOTAL>
  <PAYCURRENCYCODE>${archived.paymentCurrency ?? "EUR"}</PAYCURRENCYCODE>
  <PAYMENTTYPE>${archived.paymentType ?? "PayPal (Onsite)"}</PAYMENTTYPE>
  <LOCATION>Latvia, Riga</LOCATION>
</ORDER></ORDERS>`;
  const path = join(
    directory,
    `bricklink-accounting-${archived.orderId}-${archived.archivedAt}.xml`,
  );
  writeFileSync(path, xml);
  return path;
}

/** The order detail page, which is the only place BrickLink states what came back on an order. */
export function writeBrickLinkDetail(
  directory: string,
  orderId: number,
  archivedAt: string,
  refunded?: string,
): string {
  const body = refunded
    ? `<html><body><p>Total refunded: <strong>EUR&nbsp;${refunded}</strong></p></body></html>`
    : "<html><body><p>Nothing came back on this order.</p></body></html>";
  const path = join(
    directory,
    `bricklink-detail-${orderId}-${archivedAt}.html`,
  );
  writeFileSync(path, body);
  return path;
}

/**
 * An order archived the way the archive job leaves one: all three files, under the same moment.
 *
 * <p>This is the ordinary case, so most scenarios state an order this way and the ones about the preference between
 * the files write them separately.
 */
export function writeBrickLinkArchive(
  directory: string,
  archived: ArchivedBrickLinkOrder & {
    accounting?: Partial<ArchivedAccountingOrder>;
    refunded?: string;
  },
): void {
  writeBrickLinkOrder(directory, archived);
  writeBrickLinkAccounting(directory, {
    ...archived.accounting,
    orderId: archived.orderId,
    archivedAt: archived.archivedAt,
  });
  writeBrickLinkDetail(
    directory,
    archived.orderId,
    archived.archivedAt,
    archived.refunded,
  );
}

function write(
  directory: string,
  source: string,
  orderId: string,
  archivedAt: string,
  body: unknown,
): string {
  const path = join(directory, `${source}-api-${orderId}-${archivedAt}.json`);
  writeFileSync(path, JSON.stringify(body));
  return path;
}
