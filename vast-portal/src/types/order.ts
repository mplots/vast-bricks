import type { OrderTaxType } from 'types/tax';

/** The store's own orders, as the import job last read them out of the order archive. */

/** The marketplace an order was placed on, as the API states it. Its wording lives in the catalogs. */
export type OrderSource = 'BRICKLINK' | 'BRICKOWL';

/**
 * One order, stating everything the reconciliation report states about an order itself.
 *
 * <p>The same field names, deliberately: the two screens show the same orders, and a reader moving between them
 * should not have to translate. What is absent is what the other sources report on an order - the payment gateway,
 * the post office, the accounting invoice - which reconciliation collects live and stores nowhere.
 */
export interface StoreOrder {
  id: number;
  source: OrderSource;
  /** The marketplace's own order id. Text, because the two marketplaces number their orders differently. */
  orderId: string;
  /** Where the marketplace shows the order, which the screen hangs on the order id. */
  orderUrl: string | null;
  /** When the order was placed, as an instant. BrickLink's own account of it states a day and no time of day. */
  orderDate: string;
  /** The buyer's own name. */
  buyer: string | null;
  /** The buyer's account with the marketplace, which is a different fact from their name. */
  buyerUsername: string | null;
  itemCount: number | null;
  lotCount: number | null;
  /** How the order was paid, unified across the marketplaces' wordings. */
  paymentMethod: string | null;
  /** What the buyer paid in. The grand total is in the store's own base currency. */
  currency: string | null;
  taxType: OrderTaxType | null;
  /** What the marketplace collected as tax facilitator, or null where it collected none. */
  facilitatorTax: number | null;
  subTotal: number | null;
  /** What the buyer was charged for shipping, not what the post office charged the store. */
  shippingCost: number | null;
  grandTotal: number | null;
  /** What the marketplace reports was refunded, or null where it reports none. */
  refundedAmount: number | null;
  /** When the archive this row was read from was taken, which is how current the row is. */
  archivedAt: string;
}

export interface StoreOrdersPage {
  from: string;
  to: string;
  orders: StoreOrder[];
}
