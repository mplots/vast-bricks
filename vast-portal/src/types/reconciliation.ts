import type { OrderTaxType } from 'types/tax';

/** How prominently a failure is shown; `silent` failures are not shown at all. */
export type ReconciliationFailureLevel = 'silent' | 'info' | 'warning' | 'error';

export interface ReconciliationFailure {
  /** Stable reason code; the portal words it via the `reconciliation-failure-<code>` message. */
  code: string;
  /** How loudly the failure asks to be dealt with. */
  level: ReconciliationFailureLevel;
  /** Field paths the rule used, as `<source>.<field>`, in the order the message mentions them. */
  fields: string[];
}

/** Which account of the order stated a field. Reconciliation holds these against each other. */
export type ReconciliationFieldSource =
  | 'order'
  | 'gateway'
  | 'shipment'
  | 'accounting'
  | 'stored'
  | 'archive'
  | 'storeSync'
  | 'calculated';

/** One field an order carries, named as the orders expose it and attributed to the source that stated it. */
export interface ReconciliationFieldDescriptor {
  name: string;
  source: ReconciliationFieldSource;
}

/** What the marketplace reported about the order itself, which every other source is reconciled against. */
export interface ReconciliationOrderFields {
  source: string;
  orderId: string;
  orderDate: string | null;
  buyer: string;
  buyerUsername: string | null;
  /** Where the order was shipped, as a two-letter ISO code, or `null` where nothing states one it can resolve. */
  country: string | null;
  itemCount: number | null;
  lotCount: number | null;
  /** How the order was paid, in the provider's own wording. */
  paymentMethod: string | null;
  /** Currency the buyer paid in, as an ISO 4217 code reported by the marketplace. */
  currency: string | null;
  /** How the order is treated for tax, derived from what the marketplace reported. */
  taxType: OrderTaxType | null;
  /** What the marketplace collected on the order as tax facilitator, or `null` when it collected none. */
  facilitatorTax: number | null;
  /** The marketplace's own account of its commission on the order, or `null` for BrickLink, which states none. */
  marketplaceFee: number | null;
  subTotal: number | null;
  /**
   * What the marketplace charged the buyer for shipping the order, or `null` where it charged none. It is the buyer's
   * side of the postage that `shipment.totalAmount` states from the post office's.
   */
  shippingCost: number | null;
  /** Order total in the store's base currency, shipping and additional charges included. */
  grandTotal: number | null;
  /** What the marketplace reports was refunded on the order, or `null` when it reports none. Nothing collects it yet. */
  refundedAmount: number | null;
}

/**
 * What the payment provider reports about the payment matched to the order. Two of its fields carry the same names as
 * the order's own: they are one quantity claimed by two sources, which is what the rules compare.
 */
export interface ReconciliationGatewayFields {
  /** What the provider took for the order, before its own fees. It is also what says a payment was matched at all. */
  paidAmount: number | null;
  /**
   * What the provider charged for taking the payment, or `null` when it charged none. It is the store's own cost of
   * being paid rather than anything the buyer or the marketplace owes, which is why it stands apart from the
   * facilitator tax deducted from the same payment.
   */
  feeAmount: number | null;
  /** What the payment shows the marketplace took as tax facilitator, or `null` when it shows none. */
  facilitatorTax: number | null;
  /** What the provider shows has been refunded out of the payment to date, or `null` when it shows none. */
  refundedAmount: number | null;
  /** Where the provider shows the matched payment, or `null` when there is no payment to link to. */
  paymentUrl: string | null;
  /**
   * The bank entries this order was settled by, each by the bank's own reference, empty for an order no transfer was
   * matched to. It says which entries rather than how much, and it is how the matching split knows an order and an
   * entry are two ends of one link — including the links nobody wrote by hand.
   */
  entryReferences: string[];
}

/**
 * What the shipping provider reports about the shipment sent for the order. A shipment names its order in the notes
 * the store wrote on it, so an order nothing was shipped for carries nothing here.
 */
export interface ReconciliationShipmentFields {
  /**
   * What the post office charged for the order's shipment: the postage with every additional service on it, and what
   * every parcel of a split shipment came to, or `null` when no shipment was matched to the order.
   */
  totalAmount: number | null;
}

/**
 * What the accounting system holds for the order: the invoice that was written for it. Every field is `null` on an
 * order no invoice was matched to, which is itself the fact that the order has not been invoiced.
 */
export interface ReconciliationAccountingFields {
  /** What the invoice was written for before VAT. */
  subTotal: number | null;
  /** The VAT the invoice charges on that sub-total. */
  vat: number | null;
  /** What the invoice comes to with VAT, which is what the buyer is billed. */
  grandTotal: number | null;
}

/** What reconciliation derives from the collected sources rather than any of them stating it. */
export interface ReconciliationCalculatedFields {
  /**
   * What the accounting invoice has to come to: the grand total less the facilitator tax and less what the provider
   * shows was refunded.
   */
  targetInvoice: number | null;
  /**
   * What this store calculates the marketplace's own commission on the order as, from BrickLink's or BrickOwl's
   * published rate schedule rather than from what either states on the order. Read beside `order.marketplaceFee` so
   * BrickOwl's own reported figure can be checked against it; `null` for an order with no grand total to apply a
   * rate to.
   */
  marketplaceFee: number | null;
  /**
   * What this store calculates Stripe's or PayPal's own charge for taking the payment as, from each provider's
   * published rate rather than from what a payment states. Read beside `gateway.feeAmount` so the provider's own
   * reported fee can be checked against it; `null` for a payment method neither provider processes, or an order
   * with no grand total.
   */
  paymentFee: number | null;
}

/**
 * What the orders table holds for the order: the copy the import job stored out of the order archive.
 *
 * <p>Every field carries the name of an order field, as the gateway's facilitator tax does: one quantity claimed
 * twice, which is what the rules holding them against each other are for. This is the marketplace's own account
 * read live on one side and read off the store's archive on the other, and the two agreeing is the question.
 *
 * <p>All `null` on an order nothing was stored for, which `present` is what tells apart from a stored row that
 * states nulls of its own.
 */
export interface ReconciliationStoredFields {
  present: boolean;
  orderDate: string | null;
  buyer: string | null;
  buyerUsername: string | null;
  itemCount: number | null;
  lotCount: number | null;
  paymentMethod: string | null;
  currency: string | null;
  taxType: OrderTaxType | null;
  facilitatorTax: number | null;
  subTotal: number | null;
  shippingCost: number | null;
  grandTotal: number | null;
  refundedAmount: number | null;
}

/**
 * What the store's own order archive holds for the order: the copies it took of the marketplace's own documents. It
 * is nobody's account of what the order came to, only of what survives of it, which is why it is a source apart.
 */
export interface ReconciliationArchiveFields {
  /**
   * Whether the VAT invoice BrickLink issued for the order is in the store's archive, or `null` where it holds none.
   * It is only ever `true`: the archive names the orders it has an invoice for, so silence is an order with none.
   */
  vatInvoice: boolean | null;
}

/**
 * What the store synchronization system holds for the order. It says whether one more system acted on the order
 * rather than what the order came to, which is why it is a source apart from the accounts of it.
 */
export interface ReconciliationStoreSyncFields {
  /**
   * Whether BrickSync holds its own record of the order, or `null` where it holds none. It is only ever `true`: the
   * synchronization names the orders it recorded, so silence is an order it never saw.
   */
  order: boolean | null;
}

export interface ReconciliationOrder {
  order: ReconciliationOrderFields;
  gateway: ReconciliationGatewayFields;
  shipment: ReconciliationShipmentFields;
  accounting: ReconciliationAccountingFields;
  stored: ReconciliationStoredFields;
  archive: ReconciliationArchiveFields;
  storeSync: ReconciliationStoreSyncFields;
  calculated: ReconciliationCalculatedFields;
  failures: ReconciliationFailure[];
}

export interface ReconciliationOrdersPage {
  selectedMonth: string | null;
  from: string;
  to: string;
  /** Every field an order carries and where it came from, in the order the orders expose them. */
  fields: ReconciliationFieldDescriptor[];
  orders: ReconciliationOrder[];
}
