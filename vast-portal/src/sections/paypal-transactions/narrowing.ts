import type { Facet, Narrowable, SearchColumn } from 'utils/narrowing';
import type { PayPalTransaction } from 'types/payPalTransaction';

/**
 * What the PayPal transaction screen narrows a period by. The narrowing itself is {@link utils/narrowing}, shared
 * with the bank statement and Stripe transaction screens: this file is only what a PayPal transaction answers.
 *
 * <p>The three below are all fields PayPal states on every transaction, so none of them wants the option standing
 * for having answered nothing that the reconciliation screen has. A facet over the counterparty, which a withdrawal
 * to the bank has none of, is when to bring that option over.
 */

/**
 * Direction first, as on the bank statement: which way the balance moved is the coarsest question there is about a
 * ledger. Then PayPal's own event code, which is the question this screen is normally opened with — a reader looking
 * for the month's withdrawals, or for the partner fees the marketplaces took — and then whether the money has
 * settled.
 *
 * <p>Both of those are codes rather than words, so the options are worded from the catalog where it has a message
 * for the code and read as the code itself where it has not.
 */
export const transactionFacets: Facet<PayPalTransaction>[] = [
  {
    key: 'direction',
    valueOf: (transaction) => transaction.direction,
    labelId: (value) => `direction-${value.toLowerCase()}`,
    // Money in first, as a statement lists it: a ledger is read for what came in before what went back out.
    declared: ['CREDIT', 'DEBIT']
  },
  {
    key: 'type',
    valueOf: (transaction) => transaction.type ?? '',
    labelId: (value) => `paypal-transaction-event-${value}`,
    // Payments first, those being what a reader comes here for, then what comes back out of them, what the
    // marketplace took out of them, and what left for the bank; anything else follows in PayPal's own order.
    declared: ['T0006', 'T1107', 'T0113', 'T0400']
  },
  {
    key: 'status',
    valueOf: (transaction) => transaction.status ?? '',
    labelId: (value) => `paypal-transaction-status-${value}`,
    // Still to land first: a pending transaction is the one a reader has a question about.
    declared: ['P', 'S', 'V', 'D']
  }
];

/**
 * The columns a search field is offered under, in the order the table states them.
 *
 * <p>A column searches what it shows: the counterparty searches the account beside the name, the description
 * searches the label the marketplace put on the payment under PayPal's own subject, and the reference searches
 * PayPal's id together with the transaction it was raised against. All of them are what is in front of the reader in
 * that cell.
 */
export const transactionSearchColumns: SearchColumn<PayPalTransaction>[] = [
  { column: 'counterparty', textOf: (transaction) => [transaction.counterparty, transaction.counterpartyEmail] },
  { column: 'description', textOf: (transaction) => [transaction.description, transaction.invoiceId] },
  { column: 'reference', textOf: (transaction) => [transaction.id, transaction.sourceId] }
];

/** What this screen narrows by, as the shared narrowing is told it. */
export const transactionNarrowable: Narrowable<PayPalTransaction> = {
  facets: transactionFacets,
  searchColumns: transactionSearchColumns
};
