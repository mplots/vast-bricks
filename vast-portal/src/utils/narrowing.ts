/**
 * Narrowing a table of rows down to the ones a reader asked for: what was ticked in the panel beside it, and what
 * was typed under its columns.
 *
 * <p>It is written over whatever the rows are because two screens read a ledger a period at a time — the bank
 * statement's entries and the Stripe account's transactions — and they narrow one the same way. A screen states its
 * facets and its searchable columns; the options, their counts, the marking and the narrowing all follow, so adding
 * a filter to a screen is adding a facet to that screen's list rather than another branch anywhere here.
 */

/** One thing a screen's rows can be narrowed by: how a row answers it, and how that answer reads. */
export interface Facet<T> {
  key: string;
  /** The row's own answer. */
  valueOf: (row: T) => string;
  /** The message the answer reads as, where it is the screen's own word rather than the provider's. */
  labelId?: (value: string) => string;
  /** Values in the order their options read, ahead of any value not named here. */
  declared?: readonly string[];
}

/** Selected values per facet key. A facet with none selected narrows nothing. */
export type Selection = Record<string, string[]>;

/**
 * The text of one table column a search field is offered under, and the row text that field is held against.
 *
 * <p>A column searches what it shows, which is why a counterparty column searches the account beside the name: both
 * are in that cell, and a reader pasting an IBAN is searching what is in front of them. A column the reader writes
 * in offers no field — a text input cannot carry the mark that says which part of it was found.
 */
export interface SearchColumn<T> {
  /** The table column the field sits under. */
  column: string;
  /** The strings that column states, whichever of them the row has. */
  textOf: (row: T) => (string | null | undefined)[];
}

/** What is searched for, per column. A column with nothing typed under it narrows nothing. */
export type Search = Record<string, string>;

/**
 * What the rows on screen have been narrowed to: the facet values ticked, and what was typed under each column.
 *
 * <p>They are one thing rather than two because they narrow together — a facet's counts are of the rows the searches
 * already let through, exactly as they are of the rows the other facets let through — so no screen ever holds one
 * without the other.
 */
export interface Narrowing {
  selection: Selection;
  search: Search;
}

export const noNarrowing: Narrowing = { selection: {}, search: {} };

/** What one screen narrows by: its facets, and the columns it offers a search field under. */
export interface Narrowable<T> {
  facets: Facet<T>[];
  searchColumns: SearchColumn<T>[];
}

/** A facet with nothing selected lets every row through; several selected values widen it. */
export const matches = <T>(row: T, facet: Facet<T>, selection: Selection) => {
  const selected = selection[facet.key] ?? [];
  return selected.length === 0 || selected.includes(facet.valueOf(row));
};

/**
 * The words one column's field asks for. It is split on whitespace and each word has to be found, so a name the
 * provider spelled the other way round from the reader — surname first, as banks often state it — is still searched
 * for by typing the name out.
 */
const searchTerms = (query: string) => query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/** The words a column is being searched for, which are also the words its cells mark as found. */
export const termsFor = (search: Search, column: string) => searchTerms(search[column] ?? '');

/**
 * Whether a row answers every column's field. Within one field each word asked for has to appear somewhere in that
 * column's own text, case ignored and anywhere within a word, which is what makes half a name or a fragment of an
 * order number worth typing. Across fields they narrow: a name under one column and a number under another asks for
 * the rows answering both.
 *
 * <p>No closer approximation is attempted: a search that guessed at spelling would hide the row the reader is
 * looking for.
 */
export const matchesSearch = <T>(row: T, columns: SearchColumn<T>[], search: Search) =>
  columns.every((searched) => {
    const terms = termsFor(search, searched.column);
    if (terms.length === 0) return true;
    const text = searched.textOf(row).filter(Boolean).join(' ').toLowerCase();
    return terms.every((term) => text.includes(term));
  });

/** The rows every facet and every search field let through. */
export const shownRows = <T>(rows: T[], { facets, searchColumns }: Narrowable<T>, { selection, search }: Narrowing) =>
  rows.filter((row) => matchesSearch(row, searchColumns, search) && facets.every((facet) => matches(row, facet, selection)));

/** Whether anything is narrowed at all, which is all a clear button has to know. */
export const isNarrowed = <T>({ facets, searchColumns }: Narrowable<T>, { selection, search }: Narrowing) =>
  searchColumns.some((searched) => termsFor(search, searched.column).length > 0) ||
  facets.some((facet) => (selection[facet.key]?.length ?? 0) > 0);

/** The selection with one value of one facet turned over. */
export const toggled = (selection: Selection, facetKey: string, value: string): Selection => {
  const selected = selection[facetKey] ?? [];
  return {
    ...selection,
    [facetKey]: selected.includes(value) ? selected.filter((kept) => kept !== value) : [...selected, value]
  };
};

/** One facet as the panel shows it: its options, in the order they read, each with the count of rows left of it. */
export interface FacetOptions {
  key: string;
  options: { value: string; label: string; count: number }[];
}

/**
 * The options and counts of every facet a screen offers, which is the whole of what its filter panel has to be told.
 *
 * <p>A group's counts are of the rows the rest of the narrowing already lets through — the other facets and the
 * search alike — so a count states what ticking it would leave. Every value the period holds keeps its box, at
 * nought where the rest of the narrowing has emptied it: a group that shed options as it was narrowed would move
 * under the pointer that was narrowing it. And a facet the whole period answers the same way narrows nothing, so it
 * is not offered at all.
 */
export const facetOptions = <T>(
  rows: T[],
  { facets, searchColumns }: Narrowable<T>,
  { selection, search }: Narrowing,
  labelOf: (facet: Facet<T>, value: string) => string
): FacetOptions[] =>
  facets
    .map((facet) => {
      const scoped = rows.filter(
        (row) =>
          matchesSearch(row, searchColumns, search) && facets.every((other) => other.key === facet.key || matches(row, other, selection))
      );

      const counts = new Map<string, number>();
      rows.forEach((row) => counts.set(facet.valueOf(row), 0));
      scoped.forEach((row) => counts.set(facet.valueOf(row), (counts.get(facet.valueOf(row)) ?? 0) + 1));

      const options = [...counts.entries()]
        .sort(([left], [right]) => {
          const declared = facet.declared;
          if (!declared) return left.localeCompare(right);
          // A value the facet names reads where it named it; anything else follows, in its own order.
          const places = [declared.indexOf(left), declared.indexOf(right)];
          const [leftPlace, rightPlace] = places.map((place) => (place < 0 ? declared.length : place));
          return leftPlace === rightPlace ? left.localeCompare(right) : leftPlace - rightPlace;
        })
        .map(([value, count]) => ({ value, label: labelOf(facet, value), count }));

      return { key: facet.key, options };
    })
    .filter((facet) => facet.options.length > 1);
