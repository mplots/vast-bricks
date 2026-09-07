import type { Facet, Narrowable, SearchColumn } from 'utils/narrowing';
import type { BankStatementEntry } from 'types/bankStatement';

/**
 * What the bank statement screen narrows a period by. The narrowing itself is {@link utils/narrowing}, shared with
 * the Stripe transaction screen: this file is only what a statement's entries answer.
 *
 * <p>An entry answers every facet there is so far — a booked entry always moved one way, in one currency — so there
 * is no option here standing for having answered nothing. A facet over a field an entry may leave empty is the day to
 * bring that option over from the reconciliation screen, which has one.
 */

/**
 * Debit and credit is the first facet: which way the account moved is the coarsest question there is about a
 * statement, and the one a reader writing mappings against incoming payments asks first.
 */
export const entryFacets: Facet<BankStatementEntry>[] = [
  {
    key: 'direction',
    valueOf: (entry) => entry.direction,
    // `CREDIT` and `DEBIT` are camt's own words rather than words to show, so the screen states them itself.
    labelId: (value) => `direction-${value.toLowerCase()}`,
    // Money in first: an entry a mapping is written against is normally a payment received.
    declared: ['CREDIT', 'DEBIT']
  }
];

/**
 * The columns a search field is offered under, in the order the table states them. The counterparty searches the
 * account beside the name, both being in that cell; the mapping offers none, being a field the reader writes in.
 */
export const entrySearchColumns: SearchColumn<BankStatementEntry>[] = [
  { column: 'counterparty', textOf: (entry) => [entry.counterpartyName, entry.counterpartyIban] },
  { column: 'details', textOf: (entry) => [entry.remittanceInformation] },
  { column: 'reference', textOf: (entry) => [entry.entryReference] }
];

/** What this screen narrows by, as the shared narrowing is told it. */
export const entryNarrowable: Narrowable<BankStatementEntry> = { facets: entryFacets, searchColumns: entrySearchColumns };
