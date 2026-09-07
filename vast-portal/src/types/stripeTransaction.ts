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
  /** What Stripe deducted from this transaction, unsigned, or `null` where it deducted nothing. */
  fee: number | null;
  /** What the transaction left in the balance: the amount less the fee, signed as the amount was. */
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
  /** What Stripe deducted across the period, unsigned, the marketplaces' application fees included. */
  fees: number;
  /** What the balance moved by: credits less debits less fees, and therefore signed. */
  net: number;
}

export interface StripeTransactionsPage {
  transactions: StripeTransaction[];
  summary: StripeTransactionCurrencySummary[];
}
