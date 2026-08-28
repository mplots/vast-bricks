import type { AccountingOrder, AccountingSummary } from './accounting';

export type VatInvoiceArchiveStatus = 'AVAILABLE' | 'MISSING' | 'NOT_REQUIRED';

export interface ArchiveOrder {
  order: AccountingOrder;
  apiArchived: boolean;
  accountingArchived: boolean;
  vatInvoiceStatus: VatInvoiceArchiveStatus;
}

export interface ArchivesPage {
  selectedMonth: string;
  orders: ArchiveOrder[];
  summary: AccountingSummary;
}
