export interface ReconciliationOrder {
  source: string;
  orderId: string;
  buyer: string;
  buyerUsername: string | null;
  subTotal: number | null;
  itemsSubTotal: number | null;
}

export interface ReconciliationOrdersPage {
  selectedMonth: string;
  orders: ReconciliationOrder[];
}
