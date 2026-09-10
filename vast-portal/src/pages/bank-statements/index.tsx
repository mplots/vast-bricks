import { useDeferredValue, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { DocumentUpload, FilterSearch, Refresh, SearchNormal1 } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { importBankStatement, updateBankStatementMapping, useGetBankStatementEntries } from 'api/bankStatements';
import Highlighted from 'components/Highlighted';
import IconButton from 'components/@extended/IconButton';
import MainCard from 'components/MainCard';
import { PanelMain, paneGap, stickyTop } from 'components/SidePanel';
import TableSummaryFooter, { type SummaryLine } from 'components/TableSummaryFooter';
import TableTextField from 'components/TableTextField';
import ledgerTableSx from 'components/ledgerTable';
import { settledBy, useBankMatching } from 'contexts/BankMatchingContext';
import PeriodHeaderPicker from 'components/period/PeriodHeaderPicker';
import toolButtonSx from 'components/toolButton';
import useConfig from 'hooks/useConfig';
import BankStatementFilterDrawer from 'sections/bank-statements/BankStatementFilterDrawer';
import { entryNarrowable, entrySearchColumns } from 'sections/bank-statements/narrowing';
import { formatAmount, numericCell } from 'utils/amount';
import { currentMonth } from 'utils/month';
import { noNarrowing, shownRows, termsFor, toggled, type Narrowing } from 'utils/narrowing';
import type { BankStatementCurrencySummary, BankStatementEntry, BankStatementImportResult } from 'types/bankStatement';

/**
 * The table's columns and the share of the table each of them takes, so the summary under it knows which of them the
 * amount stands in and every column keeps its place.
 *
 * <p>The widths are stated because the table is laid out to them rather than to what is in it. A column measured
 * from its own content moves whenever the content changes — the search row appearing under the headings, a period
 * stepped to whose amounts are a digit longer, a month widened to its year — and a reader who has just found the
 * entry they were looking for should not have the table shift under them to say so. They are shares rather than
 * pixels so the columns grow with the width the table is given.
 */
const columns = [
  { key: 'date', width: '9%' },
  { key: 'counterparty', width: '19%' },
  { key: 'details', width: '24%' },
  { key: 'amount', width: '12%' },
  { key: 'code', width: '8%' },
  { key: 'reference', width: '14%' },
  { key: 'mapping', width: '14%' }
] as const;

/**
 * What an entry reads as in the pane of the matching split: when it was booked, who it was with, what they wrote on
 * it, what it came to, and what it names.
 *
 * <p>A set of its own because a pane is half a screen, and the whole table in half a screen is a table read sideways
 * — the mapping being the column furthest right, it is the one a reader would have to scroll to, which is the one
 * thing this screen is open for. The bank's own code and reference are what a scroll would have been spent on.
 */
const matchingColumns = [
  { key: 'date', width: '14%' },
  { key: 'counterparty', width: '25%' },
  { key: 'details', width: '26%' },
  { key: 'amount', width: '17%' },
  { key: 'mapping', width: '18%' }
] as const;

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

/**
 * The four lines a currency is accounted for in, in the order a bank states them.
 *
 * <p>The two turnovers, then the two figures that answer two different questions: what the period moved the account
 * by, which the turnovers come to, and where the account stood when it ended, which holds every entry before the
 * period as well. Every ledger screen states both, so this and the two provider ledgers can be read against each
 * other.
 *
 * <p>They are the screen's rather than the footer's: what a period comes to is a fact about bank statements, and the
 * footer only lays the lines out and holds them still while the entries scroll under them.
 */
const summaryLines = (currency: BankStatementCurrencySummary, label: (id: string) => string): SummaryLine[] => [
  {
    key: `${currency.currency}:debit`,
    // The turnovers are stored unsigned, so the sign is put back here from what the line is, the way an entry's row
    // puts it back from the entry's direction.
    amount: `−${formatAmount(Math.abs(currency.debitTurnover))} ${currency.currency}`,
    label: label('bank-statement-debit-turnover'),
    colour: 'error.main'
  },
  {
    key: `${currency.currency}:credit`,
    amount: `+${formatAmount(Math.abs(currency.creditTurnover))} ${currency.currency}`,
    label: label('bank-statement-credit-turnover'),
    colour: 'success.main'
  },
  {
    // What the period itself moved the account by, which is what the two turnovers above come to, so it is ruled
    // off from them. Signed already: a period that paid out more than it took in is a fact about the period rather
    // than a direction of movement.
    key: `${currency.currency}:net`,
    amount: `${formatAmount(currency.netMovement)} ${currency.currency}`,
    label: label('bank-statement-net-movement'),
    sum: true
  },
  {
    // And where the account stood when the period ended, which is a different question from what the period did:
    // it holds everything before the period as well. Every ledger screen states both, so the three can be read
    // against each other.
    key: `${currency.currency}:balance`,
    amount: `${formatAmount(currency.closingBalance)} ${currency.currency}`,
    label: label('bank-statement-closing-balance'),
    balance: true
  }
];

/** The bank's own code for what the entry was, its own wording first: `IZP` says more here than `PMNT/ICDT`. */
const transactionCode = (entry: BankStatementEntry) =>
  entry.proprietaryCode ?? [entry.domainCode, entry.familyCode, entry.subFamilyCode].filter(Boolean).join('/');

/**
 * One column's search field, sitting in the search row under the column it searches.
 *
 * <p>It is the same field the mapping is written in — the one this screen is typed in anywhere — labelled by the
 * column it searches rather than by a placeholder repeating the heading right above it. Escape empties it, which is
 * the way out of a search from inside it: the panel's clear button says the same thing about the whole narrowing, but
 * a reader who has just mistyped a name is already at the keyboard.
 */
function SearchField({ column, value, onChange }: { column: string; value: string; onChange: (query: string) => void }) {
  const intl = useIntl();

  return (
    <TableTextField
      value={value}
      placeholder={intl.formatMessage({ id: 'bank-statement-search-placeholder' })}
      ariaLabel={intl.formatMessage({ id: 'bank-statement-search-in' }, { column: intl.formatMessage({ id: `bank-statement-${column}` }) })}
      icon={<SearchNormal1 size={14} />}
      onChange={onChange}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onChange('');
      }}
    />
  );
}

/**
 * The mapping a person writes against an entry, and the only editable thing on this screen.
 *
 * <p>It keeps its own draft so typing does not wait on the server, saves what was typed when the field is left, and
 * puts back what the server holds if the save fails — the entry is the record, and a field showing something the
 * record does not hold would be a lie about what an order will later be matched against.
 */
function MappingCell({
  entry,
  onSaved,
  onError
}: {
  entry: BankStatementEntry;
  onSaved: (saved: BankStatementEntry) => void;
  onError: (message: string) => void;
}) {
  const intl = useIntl();
  const stored = entry.mapping ?? '';
  const [draft, setDraft] = useState(stored);
  const [saving, setSaving] = useState(false);
  // What to save, held beside the state as well: Escape puts the stored value back and leaves the field in the same
  // breath, and the blur that follows is dispatched before React has re-rendered, so a save reading the state would
  // read exactly the value that was just abandoned.
  const latest = useRef(stored);

  const edit = (value: string) => {
    latest.current = value;
    setDraft(value);
  };

  const save = async () => {
    if (latest.current.trim() === stored.trim()) return;
    setSaving(true);
    try {
      onSaved(await updateBankStatementMapping(entry.id, latest.current));
    } catch (error) {
      edit(stored);
      onError(error instanceof Error ? error.message : intl.formatMessage({ id: 'bank-statement-mapping-error' }));
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      edit(stored);
    }
    if (event.key === 'Enter' || event.key === 'Escape') {
      (event.target as HTMLInputElement).blur();
    }
  };

  return (
    <TableCell>
      <TableTextField
        value={draft}
        disabled={saving}
        placeholder={intl.formatMessage({ id: 'bank-statement-mapping-placeholder' })}
        ariaLabel={intl.formatMessage({ id: 'bank-statement-mapping' })}
        onChange={edit}
        onBlur={save}
        onKeyDown={handleKeyDown}
      />
    </TableCell>
  );
}

/**
 * @param initialPeriod where the screen opens, for a caller that knows which period is in question. The split beside
 * the reconciliation orders opens it on their month; the screen on its own opens on this one.
 */
export default function BankStatementsPage({ initialPeriod }: { initialPeriod?: string } = {}) {
  const intl = useIntl();
  // What the two screens of a split hold in common. Inactive outside one, which leaves this screen as it was.
  const matching = useBankMatching();
  // One string holds both what is being read and which view is reading it: `YYYY-MM` is a month, `YYYY` a year. The
  // screen opens on this month, which is the period a statement is imported for.
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod || currentMonth());
  // Which entries of the period are being read: what was ticked, and what was searched for. It is held beside the
  // period, and for the same reason: this screen is read a period at a time rather than linked to, so what it is
  // showing is state of its own rather than an address the way the reconciliation screen's narrowing is.
  const [narrowing, setNarrowing] = useState<Narrowing>(noNarrowing);
  const { container } = useConfig();
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));
  // Room for it means it is open: the entries are read against what they were narrowed to, so the panel showing that
  // is worth its width wherever there is width to spare.
  // Room for it means it is open — except in the split beside the orders, where the pane is half a screen and the
  // panel would be taking that width from the entries it narrows.
  const [filtersOpen, setFiltersOpen] = useState(!downLG && !matching.active);
  // The search row is asked for rather than always there: most reading of a statement is reading it, and a row of
  // empty fields under the headings would cost every reader a line of the table to say so.
  const [searchOpen, setSearchOpen] = useState(false);
  // The search row rests under the heading row, so it has to know how tall that row came out. It is measured rather
  // than stated: a heading wraps onto a second line on a narrow screen, and a row stopping at a height that was
  // assumed would land over the headings on the first scroll of the page.
  const [headingRow, setHeadingRow] = useState<HTMLTableRowElement | null>(null);
  const [headingHeight, setHeadingHeight] = useState(0);
  // The bar over the entries sticks, so the head has to know how tall it came out. Measured rather than stated: the
  // period, the view toggle and the buttons wrap onto a second line in a narrow window — and in the pane of the
  // matching split, which is half a screen — and a head stopping at an assumed height would land over them.
  const card = useRef<HTMLDivElement>(null);
  const [titleHeight, setTitleHeight] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BankStatementImportResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const {
    bankStatementEntries,
    bankStatementSummary,
    bankStatementEntriesError,
    bankStatementEntriesLoading,
    bankStatementEntriesRefreshing,
    reloadBankStatementEntries
  } = useGetBankStatementEntries(selectedPeriod);

  useEffect(() => {
    const bar = card.current?.querySelector<HTMLElement>('.MuiCardHeader-root');
    if (!bar) return;
    const observer = new ResizeObserver(() => setTitleHeight(bar.offsetHeight));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!headingRow) return;
    // The whole row rather than its content box: the row carries a border under it, and the search row resting a
    // border's width too high would leave the headings showing through above it.
    const observer = new ResizeObserver(() => setHeadingHeight(headingRow.offsetHeight));
    observer.observe(headingRow);
    return () => observer.disconnect();
  }, [headingRow]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared at once so choosing the same file again still fires a change, which is the whole point of a screen
    // whose statements are re-imported.
    event.target.value = '';
    if (!file) return;

    setImporting(true);
    setActionError(null);
    setImportResult(null);
    try {
      setImportResult(await importBankStatement(await file.text()));
      await reloadBankStatementEntries();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : intl.formatMessage({ id: 'bank-statement-import-error' }));
    } finally {
      setImporting(false);
    }
  };

  /** Puts the saved entry back in the list without re-reading the period, so the row settles where it already is. */
  const handleSaved = (saved: BankStatementEntry) => {
    setActionError(null);
    reloadBankStatementEntries(
      (page) =>
        // The summary is carried over untouched: a mapping is the one field of an entry that no total is derived
        // from, so nothing under the table has changed.
        page ? { ...page, entries: page.entries.map((entry) => (entry.id === saved.id ? saved : entry)) } : page,
      { revalidate: false }
    );
  };

  // Half a screen holds fewer columns than a whole one, and the table is laid out to whichever set it is showing.
  const shownColumns = matching.active ? matchingColumns : columns;
  const amountColumn = shownColumns.findIndex((column) => column.key === 'amount');

  // Said to the split, which draws no lines across a panel: one slides over the very rows the lines run between.
  useEffect(() => matching.notePanel('entries', filtersOpen), [matching, filtersOpen]);

  /** Whether this row is the entry picked in the split. */
  const picked = (entry: BankStatementEntry) => matching.entry?.id === entry.id;

  /**
   * Whether this entry already names the order picked on the other side. Picking one end of a link lights up both
   * ends of it, so an order picked to see what paid it shows its own entries wherever they sit in the period.
   */
  const linkedToPicked = (entry: BankStatementEntry) => matching.order != null && settledBy(matching.order, entry);

  const collectedEntries = bankStatementEntries ?? [];
  // A year of entries is thousands of rows, and every one of them is filtered again at each keystroke of a search.
  // The field itself answers the key at once and the table catches up a render later, so typing never waits on a
  // period however long it is.
  const settled = useDeferredValue(narrowing);
  const shown = shownRows(collectedEntries, entryNarrowable, settled);
  // Marked from the narrowing the entries were filtered by rather than from what is in the fields this moment, so a
  // cell never marks a word that is not why its row is here.
  const termsOf = (column: string) => termsFor(settled.search, column);

  /** What is typed under one column. */
  const search = (column: string, query: string) =>
    setNarrowing((current) => ({ ...current, search: { ...current.search, [column]: query } }));

  /**
   * Shows or hides the search row, emptying it as it goes away.
   *
   * <p>A row put away with words still in it would go on narrowing the table from somewhere the reader cannot see,
   * which is the one thing a screen that states how much of a period it is showing must not do.
   */
  const toggleSearch = () => {
    if (searchOpen) setNarrowing((current) => ({ ...current, search: {} }));
    setSearchOpen(!searchOpen);
  };

  const toggleFilter = (facetKey: string, value: string) =>
    setNarrowing((current) => ({ ...current, selection: toggled(current.selection, facetKey, value) }));
  const clearFilters = () => setNarrowing(noNarrowing);

  /**
   * What is being read: the way into the panel that narrows it, the period itself, and how much of the period the
   * narrowing left on screen.
   */
  const periodTitle = (
    <Stack component="span" direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Only while the panel is away: open, the panel is its own close button. It is its icon alone, so it says
          what it is in its tooltip and its label. */}
      {!filtersOpen && (
        <Tooltip title={intl.formatMessage({ id: 'bank-statement-filters' })} arrow>
          <IconButton
            variant="light"
            color="secondary"
            aria-label={intl.formatMessage({ id: 'bank-statement-filters' })}
            onClick={() => setFiltersOpen(true)}
            sx={toolButtonSx}
          >
            <FilterSearch size={18} />
          </IconButton>
        </Tooltip>
      )}
      {/* Beside the panel's own switch: both open a surface that narrows the entries, one down the side and one in
          the table's head. It is its icon alone, and it says whether it is on through its label as well as through
          its own filled state. */}
      <Tooltip title={intl.formatMessage({ id: searchOpen ? 'bank-statement-search-hide' : 'bank-statement-search' })} arrow>
        <IconButton
          variant={searchOpen ? 'contained' : 'light'}
          color={searchOpen ? 'primary' : 'secondary'}
          aria-pressed={searchOpen}
          aria-label={intl.formatMessage({ id: searchOpen ? 'bank-statement-search-hide' : 'bank-statement-search' })}
          onClick={toggleSearch}
          sx={searchOpen ? undefined : toolButtonSx}
        >
          <SearchNormal1 size={18} />
        </IconButton>
      </Tooltip>
      <PeriodHeaderPicker value={selectedPeriod} onChange={setSelectedPeriod} />
      {/* Only once a period has been read: until then there is nothing to have shown a part of. It is the first
          thing a narrow screen gives up, the period and the buttons being what the bar is for. */}
      {bankStatementEntries && (
        <Typography component="span" variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
          {intl.formatMessage({ id: 'bank-statement-filter-showing' }, { shown: shown.length, total: collectedEntries.length })}
        </Typography>
      )}
    </Stack>
  );

  const actions = (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
      <input ref={fileInput} type="file" accept=".xml,text/xml,application/xml" hidden onChange={handleFile} />
      <Button
        variant="contained"
        size="small"
        disabled={importing}
        startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <DocumentUpload size={16} />}
        onClick={() => fileInput.current?.click()}
      >
        {intl.formatMessage({ id: 'bank-statement-import' })}
      </Button>
      <Tooltip title={intl.formatMessage({ id: 'bank-statement-refresh' })} arrow>
        <span>
          <IconButton
            variant="light"
            color="secondary"
            disabled={bankStatementEntriesRefreshing}
            aria-label={intl.formatMessage({ id: 'bank-statement-refresh' })}
            onClick={() => reloadBankStatementEntries()}
            sx={toolButtonSx}
          >
            <Refresh size={18} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );

  return (
    <Stack>
      <Box sx={{ display: 'flex' }}>
        <BankStatementFilterDrawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          entries={collectedEntries}
          narrowing={narrowing}
          onToggle={toggleFilter}
          onClear={clearFilters}
        />

        <PanelMain open={filtersOpen} container={container}>
          <Stack sx={{ gap: 3, mt: paneGap }}>
            {importResult && (
              <Alert severity="success" onClose={() => setImportResult(null)}>
                {intl.formatMessage(
                  { id: 'bank-statement-imported' },
                  {
                    accounts: importResult.accounts.map((account) => account.accountIban).join(', '),
                    read: importResult.entriesRead,
                    created: importResult.created,
                    updated: importResult.updated
                  }
                )}
              </Alert>
            )}

            {actionError && (
              <Alert severity="error" onClose={() => setActionError(null)}>
                {actionError}
              </Alert>
            )}

            <MainCard
              ref={card}
              content={false}
              title={periodTitle}
              secondary={actions}
              // The bar draws its own bottom edge, the card's divider being a sibling that would scroll out from
              // under it.
              divider={false}
              sx={{
                // Nothing between the table and the page may clip, the stuck head and foot being the reason: a
                // scrolling ancestor would catch them and hold them inside the card.
                overflow: 'visible',
                // The period is what the table is of, so it stays over the entries the way the head does: a period
                // long enough to scroll is a period whose picker must still be reachable at the bottom of it. It
                // rests at the same origin as everything else this screen sticks — the app header on the page, the
                // pane's own top in the matching split.
                '& .MuiCardHeader-root': {
                  position: 'sticky',
                  top: stickyTop(),
                  zIndex: 3,
                  bgcolor: 'background.paper',
                  borderTopLeftRadius: 'inherit',
                  borderTopRightRadius: 'inherit',
                  borderBottom: '1px solid',
                  borderColor: 'divider'
                }
              }}
            >
              {bankStatementEntriesLoading && <Skeleton variant="rounded" height={320} sx={{ m: 2.5 }} />}

              {bankStatementEntriesError && (
                <Alert severity="error" sx={{ m: 2.5 }}>
                  {bankStatementEntriesError.message || intl.formatMessage({ id: 'bank-statement-load-error' })}
                </Alert>
              )}

              {!bankStatementEntriesLoading &&
                !bankStatementEntriesError &&
                bankStatementEntries &&
                (collectedEntries.length ? (
                  <TableContainer sx={{ overflow: 'visible' }}>
                    <Table
                      stickyHeader
                      size="small"
                      aria-label={intl.formatMessage({ id: 'bank-statement-table' })}
                      // No width held open in the pane of the split: the columns are shares of the table, so they take whatever
                      // the pane gives them, and a width held open there is a table read sideways to reach the
                      // mapping — which is the column the split is open for.
                      sx={ledgerTableSx(headingHeight, matching.active ? 0 : 1100, titleHeight)}
                    >
                      <colgroup>
                        {shownColumns.map((column) => (
                          <col key={column.key} style={{ width: column.width }} />
                        ))}
                      </colgroup>
                      <TableHead>
                        <TableRow ref={setHeadingRow}>
                          {shownColumns.map((column, index) => (
                            <TableCell key={column.key} sx={index === amountColumn ? numericCell : undefined}>
                              {intl.formatMessage({ id: `bank-statement-${column.key}` })}
                            </TableCell>
                          ))}
                        </TableRow>
                        {/* One field per column that can be searched, under the column it searches: the text a
                            reader is matching against is in that column, so that is where the field for it goes. A
                            column with nothing to search keeps its cell so the row stays in step with the table. */}
                        {searchOpen && (
                          <TableRow>
                            {shownColumns.map((column) => {
                              const searchable = entrySearchColumns.some((searched) => searched.column === column.key);
                              return (
                                <TableCell key={column.key} sx={{ py: 0.75 }}>
                                  {searchable && (
                                    <SearchField
                                      column={column.key}
                                      value={narrowing.search[column.key] ?? ''}
                                      onChange={(query) => search(column.key, query)}
                                    />
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        )}
                      </TableHead>
                      <TableBody>
                        {/* A narrowing that let nothing through says so in the table rather than in place of it: the
                            search row is in this table's own head, and a message drawn instead of the table would
                            take away the fields the reader has to reach to get their entries back. */}
                        {shown.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={shownColumns.length} sx={{ py: 6, textAlign: 'center' }}>
                              <Typography color="text.secondary">{intl.formatMessage({ id: 'bank-statement-filtered-empty' })}</Typography>
                            </TableCell>
                          </TableRow>
                        )}
                        {shown.map((entry) => (
                          <TableRow
                            key={entry.id}
                            hover
                            // In the split a row is a thing to pick; outside one it is a row to read and to write a
                            // mapping in, and it answers no click at all.
                            onClick={matching.active ? () => matching.selectEntry(picked(entry) ? null : entry) : undefined}
                            aria-selected={picked(entry)}
                            // Which end of a link this row is, for the line the split draws between the two, and
                            // what the link is made of: the reference an order names it by, the row to write a
                            // mapping on, and whether the mapping is what tied it — an automatic match has nothing
                            // to untie.
                            data-vast-link={picked(entry) ? 'picked' : linkedToPicked(entry) ? 'counterpart' : undefined}
                            data-vast-entry={matching.active ? entry.entryReference : undefined}
                            data-vast-entry-id={matching.active ? entry.id : undefined}
                            data-vast-mapped={matching.active && entry.mapping?.trim() ? 'true' : undefined}
                            // An entry that is an end of a link is marked as one by the split, which marks both ends
                            // alike. No ground of its own: this table already colours an amount by its direction,
                            // and a row tinted for being spoken for would be a second colour saying a second thing.
                            sx={matching.active ? { cursor: 'pointer' } : undefined}
                          >
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(entry.bookingDate)}</TableCell>
                            <TableCell>
                              {/* Both lines of the cell are marked, the field under this column searching both. */}
                              <Typography variant="body2">
                                <Highlighted text={entry.counterpartyName || '—'} terms={termsOf('counterparty')} />
                              </Typography>
                              {entry.counterpartyIban && (
                                <Typography variant="caption" color="text.secondary">
                                  <Highlighted text={entry.counterpartyIban} terms={termsOf('counterparty')} />
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Highlighted text={entry.remittanceInformation || '—'} terms={termsOf('details')} />
                            </TableCell>
                            <TableCell sx={{ ...numericCell, color: entry.direction === 'CREDIT' ? 'success.main' : 'error.main' }}>
                              {/* The amount is stored unsigned, the way the bank states it, so the sign is put back here
                            from the direction rather than the column reading the same in both directions. */}
                              {entry.direction === 'CREDIT' ? '+' : '−'}
                              {formatAmount(entry.amount)} {entry.currency}
                            </TableCell>
                            {/* The bank's own code and reference keep their columns on the whole screen and lose
                                them in the pane of the split, where the width they took is the mapping's. */}
                            {!matching.active && (
                              <>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{transactionCode(entry) || '—'}</TableCell>
                                <TableCell>
                                  {/* Wrapped rather than held on one line: a bank's reference is as long as that
                                      bank made it, and the column is a share of the table rather than as wide as
                                      the longest one that turns up. */}
                                  <Typography variant="caption" color="text.secondary">
                                    <Highlighted text={entry.entryReference} terms={termsOf('reference')} />
                                  </Typography>
                                </TableCell>
                              </>
                            )}
                            {/* Keyed by what the server holds, so an entry whose mapping changed underneath — a reload,
                          another tab — comes back with the stored value rather than a draft of the old one. */}
                            <MappingCell
                              key={`${entry.id}:${entry.mapping ?? ''}`}
                              entry={entry}
                              onSaved={handleSaved}
                              onError={setActionError}
                            />
                          </TableRow>
                        ))}
                      </TableBody>
                      {/* Under the entries it is the account of, and only once there is a period's worth of them
                          to account for. It is the period's own account and not the narrowed one: the turnovers are
                          both shown whichever way the entries were narrowed, and a closing balance is derived over
                          every stored entry up to the end of the period, so it could not be narrowed at all. The
                          amount column is found by name rather than counted out here, so a column moved or added
                          does not silently slide the totals into the wrong one. */}
                      {bankStatementSummary && bankStatementSummary.length > 0 && (
                        <TableSummaryFooter
                          lines={bankStatementSummary.flatMap((currency) => summaryLines(currency, (id) => intl.formatMessage({ id })))}
                          before={amountColumn}
                          after={shownColumns.length - amountColumn - 1}
                          // In the pane the columns after the amount are the narrow ones, so the name stands on the
                          // wide side of the figure rather than wrapping in a column a third of a half-screen wide.
                          labelBefore={matching.active}
                        />
                      )}
                    </Table>
                  </TableContainer>
                ) : (
                  <Box sx={{ p: 6, textAlign: 'center' }}>
                    <Typography color="text.secondary">{intl.formatMessage({ id: 'bank-statement-empty' })}</Typography>
                  </Box>
                ))}
            </MainCard>
          </Stack>
        </PanelMain>
      </Box>
    </Stack>
  );
}
