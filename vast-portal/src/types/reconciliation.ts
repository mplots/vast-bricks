export interface ReconciliationFailure {
  /** Stable reason code; the portal words it via the `reconciliation-failure-<code>` message. */
  code: string;
  /** Order property names the rule used, in the order the message mentions them. */
  fields: string[];
}

export interface ReconciliationOrder {
  source: string;
  orderId: string;
  orderDate: string | null;
  buyer: string;
  buyerUsername: string | null;
  subTotal: number | null;
  itemsSubTotal: number | null;
  invoiceSubTotal: number | null;
  failures: ReconciliationFailure[];
}

export interface ReconciliationOrdersPage {
  selectedMonth: string;
  orders: ReconciliationOrder[];
}
