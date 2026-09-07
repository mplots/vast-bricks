import type { Facet, Narrowable, SearchColumn } from 'utils/narrowing';
import type { StripeTransaction } from 'types/stripeTransaction';

/**
 * What the Stripe transaction screen narrows a period by. The narrowing itself is {@link utils/narrowing}, shared
 * with the bank statement screen: this file is only what a balance transaction answers.
 *
 * <p>A transaction may leave a field empty — Stripe carries no description on a payout — so a facet over one would
 * want the option standing for having answered nothing that the reconciliation screen has. The three below are all
 * fields Stripe states on every transaction.
 */

/**
 * Direction first, as on the bank statement: which way the balance moved is the coarsest question there is about a
 * ledger. Then what Stripe says the transaction is, which is the question this screen is normally opened with — a
 * reader looking for the month's payouts, or for the fees behind them — and then whether the money has landed.
 */
export const transactionFacets: Facet<StripeTransaction>[] = [
  {
    key: 'direction',
    valueOf: (transaction) => transaction.direction,
    labelId: (value) => `direction-${value.toLowerCase()}`,
    // Money in first, as a statement lists it: a ledger is read for what came in before what went back out.
    declared: ['CREDIT', 'DEBIT']
  },
  {
    key: 'type',
    // Stripe's own word for what the transaction is, shown as Stripe words it: the set grows with the products the
    // account uses, so a screen that translated them would go quiet on the next one Stripe adds.
    valueOf: (transaction) => transaction.type ?? '',
    // Payments first, those being what a reader comes here for, then what comes back out of them and what Stripe
    // took; anything else follows in Stripe's own alphabet.
    declared: ['charge', 'payment', 'refund', 'payout', 'stripe_fee']
  },
  {
    key: 'status',
    valueOf: (transaction) => transaction.status ?? '',
    // Still to land first: a pending transaction is the one a reader has a question about.
    declared: ['pending', 'available']
  }
];

/**
 * The columns a search field is offered under, in the order the table states them. The reference searches Stripe's
 * id for the transaction together with the charge or payout behind it, both being in that cell, so a reader pasting
 * either finds the row.
 */
export const transactionSearchColumns: SearchColumn<StripeTransaction>[] = [
  { column: 'description', textOf: (transaction) => [transaction.description] },
  { column: 'reference', textOf: (transaction) => [transaction.id, transaction.sourceId] }
];

/** What this screen narrows by, as the shared narrowing is told it. */
export const transactionNarrowable: Narrowable<StripeTransaction> = {
  facets: transactionFacets,
  searchColumns: transactionSearchColumns
};
