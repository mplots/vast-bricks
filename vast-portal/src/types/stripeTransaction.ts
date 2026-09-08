export type StripeTransactionDirection = 'CREDIT' | 'DEBIT';

/** One balance transaction of the Stripe account, as Stripe reported it. */
export interface StripeTransaction {
  /** Stripe's own id for the transaction, which is what the ledger is keyed by. */
  id: string;
  /** When Stripe dated it, as an ISO instant in UTC, which is the zone the period is read in. */
  created: string | null;
  /** What Stripe says the transaction is: `charge`, `refund`, `payout`, `stripe_fee`. */
  type: string | null;
  /** Whatever Stripe carried on the transaction, which for a payment is what the marketplace labelled it. */
  description: string | null;
  /** Unsigned, the way a bank states an entry's amount; `direction` says which way the balance moved. */
  amount: number | null;
  direction: StripeTransactionDirection;
  /**
   * What Stripe deducted from this transaction, signed as a deduction, or `null` where it deducted nothing. Stripe
   * states a fee the other way up from PayPal, so the backend negates it and the two ledgers state a fee alike.
   */
  fee: number | null;
  /** What the transaction left in the balance: the amount with the fee added in, signed as the amount was. */
  net: number | null;
  currency: string | null;
  status: string | null;
  /** What the transaction was raised against — the charge, refund or payout it belongs to. */
  sourceId: string | null;
  /** Where Stripe shows it, or `null` when it has no page a reader can be sent to. */
  link: string | null;
}

/**
 * What a period came to in one currency. One group per currency the account moved in, because an account moving in
 * two currencies has two accounts of itself and adding them would state a sum Stripe never stated.
 */
export interface StripeTransactionCurrencySummary {
  currency: string | null;
  /** Unsigned, the way a transaction's amount is: the direction is in the name rather than in the sign. */
  debitTurnover: number;
  creditTurnover: number;
  /**
   * What Stripe deducted across the period, signed as each fee was.
   *
   * <p>A memo of how much of the turnovers were fees rather than a term beside them: a fee is money that left the
   * account, so it is already counted in the turnover it moved. The PayPal ledger states its own the same way.
   */
  fees: number;
  /** What the balance moved by: credits less debits less fees, and therefore signed. */
  netMovement: number;
  /**
   * Where the account stood at the end of the period, or `null` where it could not be established. Stripe answers
   * for the balance at this moment and no other, so it is worked back from what the account holds now.
   */
  closingBalance: number | null;
}

export interface StripeTransactionsPage {
  transactions: StripeTransaction[];
  summary: StripeTransactionCurrencySummary[];
}
