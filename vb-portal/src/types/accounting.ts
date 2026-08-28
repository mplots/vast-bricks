export interface AccountingOrder {
  source: string;
  orderDate: string | null;
  orderNumber: string;
  buyerName: string;
  location: string | null;
  paymentMethod: string | null;
  paymentMatchStatus: string | null;
  unmatchedOnlinePayment: boolean;
  bankTransfer: boolean;
  lotCount: number | null;
  itemCount: number | null;
  orderTotal: number | null;
  shipping: number | null;
  marketplaceTax: number | null;
  marketplaceTaxPresent: boolean;
  grandTotal: number | null;
  calculatedGrandTotal: number | null;
  grandTotalMismatch: boolean;
  paidAmount: number | null;
  vat: number | null;
  vatPresent: boolean;
}

export interface AccountingSummary {
  lotCount: number;
  itemCount: number;
  orderTotal: number;
  shipping: number;
  marketplaceTax: number;
  grandTotal: number;
  vat: number;
}

export interface AccountingPage {
  selectedMonth: string;
  orders: AccountingOrder[];
  summary: AccountingSummary;
}
