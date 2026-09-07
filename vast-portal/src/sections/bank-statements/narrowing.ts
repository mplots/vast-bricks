import type { BankStatementEntry } from 'types/bankStatement';

/**
 * One thing the entries of a period can be narrowed by. A facet states how an entry answers it and how that answer
 * reads; the options, their counts and the narrowing all follow from those two, so another filter is another entry in
 * the list below rather than another branch on the screen.
 *
 * <p>An entry answers every facet there is so far — a booked entry always moved one way, in one currency — so there
 * is no option here standing for having answered nothing. A facet over a field an entry may leave empty is the day to
 * bring that option over from the reconciliation screen, which has one.
 */
export interface EntryFacet {
  key: string;
  /** The entry's own answer. */
  valueOf: (entry: BankStatementEntry) => string;
  /** The message the answer reads as, where it is the screen's own word rather than the bank's. */
  labelId?: (value: string) => string;
  /** Values in the order their options read, ahead of any value not named here. */
  declared?: readonly string[];
}

/** Selected values per facet key. A facet with none selected narrows nothing. */
export type EntrySelection = Record<string, string[]>;

/**
 * What the screen can narrow a period by. Debit and credit is the first: which way the account moved is the coarsest
 * question there is about a statement, and the one a reader writing mappings against incoming payments asks first.
 */
export const entryFacets: EntryFacet[] = [
  {
    key: 'direction',
    valueOf: (entry) => entry.direction,
    // `CREDIT` and `DEBIT` are camt's own words rather than words to show, so the screen states them itself.
    labelId: (value) => `bank-statement-direction-${value.toLowerCase()}`,
    // Money in first: an entry a mapping is written against is normally a payment received.
    declared: ['CREDIT', 'DEBIT']
  }
];

/**
 * The text of one table column a search field is offered under, and the entry text that field is held against.
 *
 * <p>A column searches what it shows, which is why the counterparty searches the account beside the name: both are
 * in that cell, and a reader pasting an IBAN is searching what is in front of them. A column the reader writes in
 * offers no field — the mapping is a text input in every row, and an input cannot carry the mark that says which
 * part of it was found.
 */
export interface EntrySearchColumn {
  /** The table column the field sits under. */
  column: string;
  /** The strings that column states, whichever of them the entry has. */
  textOf: (entry: BankStatementEntry) => (string | null)[];
}

/** The columns a search field is offered under, in the order the table states them. */
export const searchColumns: EntrySearchColumn[] = [
  { column: 'counterparty', textOf: (entry) => [entry.counterpartyName, entry.counterpartyIban] },
  { column: 'details', textOf: (entry) => [entry.remittanceInformation] },
  { column: 'reference', textOf: (entry) => [entry.entryReference] }
];

/** What is searched for, per column. A column with nothing typed under it narrows nothing. */
export type EntrySearch = Record<string, string>;

/**
 * What the entries on screen have been narrowed to: the facet values ticked, and what was typed under each column.
 *
 * <p>They are one thing rather than two because they narrow together — a facet's counts are of the entries the
 * searches already let through, exactly as they are of the entries the other facets let through — so nothing on this
 * screen ever holds one without the other.
 */
export interface EntryNarrowing {
  selection: EntrySelection;
  search: EntrySearch;
}

export const noNarrowing: EntryNarrowing = { selection: {}, search: {} };

/** A facet with nothing selected lets every entry through; several selected values widen it. */
export const matches = (entry: BankStatementEntry, facet: EntryFacet, selection: EntrySelection) => {
  const selected = selection[facet.key] ?? [];
  return selected.length === 0 || selected.includes(facet.valueOf(entry));
};

/**
 * The words one column's field asks for. It is split on whitespace and each word has to be found, so a counterparty
 * the bank spelled the other way round from the reader — surname first, as banks often state it — is still searched
 * for by typing the name out.
 */
const searchTerms = (query: string) => query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/** The words a column is being searched for, which are also the words its cells mark as found. */
export const termsFor = (search: EntrySearch, column: string) => searchTerms(search[column] ?? '');

/**
 * Whether an entry answers every column's field. Within one field each word asked for has to appear somewhere in
 * that column's own text, case ignored and anywhere within a word, which is what makes half a name or a fragment of
 * an order number worth typing. Across fields they narrow: a name under the counterparty and a number under the
 * details asks for the entries answering both.
 *
 * <p>No closer approximation is attempted: a search that guessed at spelling would hide the entry a mapping is being
 * written for.
 */
export const matchesSearch = (entry: BankStatementEntry, search: EntrySearch) =>
  searchColumns.every((searched) => {
    const terms = termsFor(search, searched.column);
    if (terms.length === 0) return true;
    const text = searched.textOf(entry).filter(Boolean).join(' ').toLowerCase();
    return terms.every((term) => text.includes(term));
  });

/** The entries every facet and every search field let through. */
export const shownEntries = (entries: BankStatementEntry[], { selection, search }: EntryNarrowing) =>
  entries.filter((entry) => matchesSearch(entry, search) && entryFacets.every((facet) => matches(entry, facet, selection)));

/** Whether anything is searched for at all. */
const isSearched = (search: EntrySearch) => searchColumns.some((searched) => termsFor(search, searched.column).length > 0);

/** Whether anything is narrowed at all, which is all the clear button has to know. */
export const isNarrowed = ({ selection, search }: EntryNarrowing) =>
  isSearched(search) || entryFacets.some((facet) => (selection[facet.key]?.length ?? 0) > 0);

/** The selection with one value of one facet turned over. */
export const toggled = (selection: EntrySelection, facetKey: string, value: string): EntrySelection => {
  const selected = selection[facetKey] ?? [];
  return {
    ...selection,
    [facetKey]: selected.includes(value) ? selected.filter((kept) => kept !== value) : [...selected, value]
  };
};
