export interface ReconciliationFailure {
  rule: string;
  message: string;
}

export interface ReconciliationOrder {
  source: string;
  orderId: string;
  buyer: string;
  buyerUsername: string | null;
  subTotal: number | null;
  itemsSubTotal: number | null;
  failures: ReconciliationFailure[];
}

export interface ReconciliationOrdersPage {
  selectedMonth: string;
  orders: ReconciliationOrder[];
}
