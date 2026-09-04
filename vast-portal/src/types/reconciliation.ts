/** How prominently a failure is shown; `silent` failures are not shown at all. */
export type ReconciliationFailureLevel = 'silent' | 'info' | 'warning' | 'error';

export interface ReconciliationFailure {
  /** Stable reason code; the portal words it via the `reconciliation-failure-<code>` message. */
  code: string;
  /** How loudly the failure asks to be dealt with. */
  level: ReconciliationFailureLevel;
  /** Order property names the rule used, in the order the message mentions them. */
  fields: string[];
}

export interface ReconciliationOrder {
  source: string;
  orderId: string;
  orderDate: string | null;
  buyer: string;
  buyerUsername: string | null;
  /** How the order was paid, in the provider's own wording. */
  paymentMethod: string | null;
  subTotal: number | null;
  itemsSubTotal: number | null;
  /** Order total in the store's base currency, shipping and additional charges included. */
  grandTotal: number | null;
  invoiceSubTotal: number | null;
  /** What the payment provider took for the order, before its own fees. */
  paidAmount: number | null;
  failures: ReconciliationFailure[];
}

export interface ReconciliationOrdersPage {
  selectedMonth: string;
  orders: ReconciliationOrder[];
}
