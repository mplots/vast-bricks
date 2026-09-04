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
  subTotal: number | null;
  itemsSubTotal: number | null;
  invoiceSubTotal: number | null;
  failures: ReconciliationFailure[];
}

export interface ReconciliationOrdersPage {
  selectedMonth: string;
  orders: ReconciliationOrder[];
}
