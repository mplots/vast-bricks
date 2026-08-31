export interface ReconciliationOrder {
  source: string;
  orderId: string;
  buyer: string;
  buyerUsername: string | null;
}

export interface ReconciliationOrdersPage {
  selectedMonth: string;
  orders: ReconciliationOrder[];
}
