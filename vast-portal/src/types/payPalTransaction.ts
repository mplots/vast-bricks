export type PayPalTransactionDirection = 'CREDIT' | 'DEBIT';

/** One transaction of the PayPal account, as PayPal reported it. */
export interface PayPalTransaction {
  /** PayPal's own id for the transaction, which is what the ledger is keyed by. */
  id: string | null;
  /** When PayPal dated it, as an ISO instant in UTC, which is the zone the period is read in. */
  created: string | null;
  /**
   * PayPal's own event code for what happened: `T0006` a payment received, `T0113` a partner fee, `T1107` a refund,
   * `T0400` a withdrawal to the bank. It is a code and not a word, which is why the screen words the ones a merchant
   * account meets and shows the code itself for the rest.
   */
  type: string | null;
  /** What PayPal carried on the transaction as its subject, where it carried one. */
  description: string | null;
  /** What the marketplace labelled the payment with. BrickOwl puts its bare order number here. */
  invoiceId: string | null;
  /** Who the money moved to or from, as PayPal spells them. */
  counterparty: string | null;
  /** The account the payer paid from, which is the second thing the counterparty column states. */
  counterpartyEmail: string | null;
  /** Unsigned, the way a bank states an entry's amount; `direction` says which way the balance moved. */
  amount: number | null;
  direction: PayPalTransactionDirection;
  /**
   * Everything deducted from the transaction, keeping the sign PayPal gave it, or `null` where nothing was.
   *
   * <p>The whole deduction rather than PayPal's own processing fee alone: the commission the marketplace took as
   * partner is money out of this transaction just as the fee is, and where PayPal converted the transaction this is
   * everything between its gross and what landed. What it was made of is in `breakdown`, which the detail view lays
   * out the way PayPal's own panel does.
   */
  fee: number | null;
  /** What the transaction left in the balance: the amount with everything deducted from it added in. */
  net: number | null;
  /**
   * The currency the account moved in, which is the one PayPal converted the transaction into where it converted
   * it: a row in the currency the money passed through for a moment matches nothing in the bank.
   */
  currency: string | null;
  /** PayPal's own status letter: `S` settled, `P` pending, `V` reversed, `D` denied. */
  status: string | null;
  /** What the transaction was raised against — the payment a partner fee or a refund came out of. */
  sourceId: string | null;
  /** Where PayPal shows it. */
  link: string | null;
  /** What the gross was made up of and what came off it, as PayPal's own details panel lists them. */
  breakdown: PayPalTransactionBreakdown | null;
  /**
   * The other records PayPal raised against this transaction: the partner commission folded into the fee above, and
   * the conversions that moved what was left into another currency. They are not transactions of the account, which
   * is why they are here and not in the period's own list.
   */
  lines: PayPalTransactionLine[];
}

/**
 * PayPal's own account of what a transaction came to, top to bottom, as its details panel states it.
 *
 * <p>The purchase total is the only derived figure: PayPal reports what it added to the purchase rather than the
 * purchase itself, so what is left of the gross once those are taken off is what was bought.
 */
export interface PayPalTransactionBreakdown {
  /**
   * The currency PayPal stated the transaction itself in, which is not necessarily the one the transaction is
   * stated in: a converted transaction is stated in the currency it was converted into, while this panel stays in
   * PayPal's own terms, as PayPal's own page does.
   */
  currency: string | null;
  purchaseTotal: number | null;
  salesTax: number | null;
  shipping: number | null;
  handling: number | null;
  insurance: number | null;
  discount: number | null;
  shippingDiscount: number | null;
  /** PayPal's own processing fee, signed as PayPal signed it. */
  payPalFee: number | null;
  /** What the marketplace took as partner, signed as PayPal signed it. */
  partnerCommission: number | null;
  /** What PayPal charged for a dispute on the transaction, signed as PayPal signed it. */
  disputeFee: number | null;
  /** What PayPal stated the transaction moved, signed, this panel being an account rather than a column. */
  gross: number | null;
  /** What PayPal's own account of the transaction ends on: the gross with everything above taken off. */
  net: number | null;
  /**
   * What the conversion took back out of PayPal's own currency, or `null` where PayPal converted nothing. It is what
   * carries the account over into the currency the transaction is stated in, so the panel does not stop at a net in
   * a currency the account never held.
   */
  conversion: number | null;
}

/** One record PayPal raised against a transaction. */
export interface PayPalTransactionLine {
  /**
   * Whether the amount details already state this record — a deduction they name, or a leg of the conversion they
   * end on. Nearly every record is one of those, so the detail view lists only the ones that are not.
   */
  accountedFor: boolean;
  id: string | null;
  created: string | null;
  /** PayPal's event code: `T0113` for the partner commission, `T0200` for a conversion. */
  type: string | null;
  /** Signed as PayPal stated it, this being a line of an account rather than a column of a table. */
  amount: number | null;
  currency: string | null;
  status: string | null;
  link: string | null;
}

/**
 * What a period came to in one currency. One group per currency the account moved in, because an account moving in
 * two currencies has two accounts of itself and adding them would state a sum PayPal never stated.
 */
export interface PayPalTransactionCurrencySummary {
  currency: string | null;
  /** Unsigned, the way a transaction's amount is: the direction is in the name rather than in the sign. */
  debitTurnover: number;
  creditTurnover: number;
  /**
   * What was deducted across the period, signed as each deduction was — PayPal's own charges and what the
   * marketplaces took as partner alike.
   *
   * <p>A memo of how much of the turnovers were fees rather than a term beside them: a deduction is money that left
   * the account, so it is already counted in the turnover it moved. The Stripe ledger states its own the same way.
   */
  fees: number;
  /** What the balance moved by: credits less debits, which the two turnovers come to on their own. */
  netMovement: number;
  /** Where the account stood at the end of the period, as PayPal states it, or `null` where PayPal did not say. */
  closingBalance: number | null;
}

export interface PayPalTransactionsPage {
  transactions: PayPalTransaction[];
  summary: PayPalTransactionCurrencySummary[];
}
