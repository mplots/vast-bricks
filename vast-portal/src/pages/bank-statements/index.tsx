import { useDeferredValue, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';

import { styled } from '@mui/material/styles';
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
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { DocumentUpload, FilterSearch, Refresh, SearchNormal1 } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { importBankStatement, updateBankStatementMapping, useGetBankStatementEntries } from 'api/bankStatements';
import IconButton from 'components/@extended/IconButton';
import MainCard from 'components/MainCard';
import { HEADER_HEIGHT } from 'config';
import useConfig from 'hooks/useConfig';
import BankStatementFilterDrawer from 'sections/bank-statements/BankStatementFilterDrawer';
import EntryTextField from 'sections/bank-statements/EntryTextField';
import Highlighted from 'sections/bank-statements/Highlighted';
import PeriodPicker from 'sections/bank-statements/PeriodPicker';
import SummaryFooter from 'sections/bank-statements/SummaryFooter';
import { formatAmount, numericCell } from 'sections/bank-statements/amount';
import { noNarrowing, searchColumns, shownEntries, termsFor, toggled, type EntryNarrowing } from 'sections/bank-statements/narrowing';
import { periodIn, viewOf, type PeriodView } from 'sections/bank-statements/period';
import { currentMonth } from 'sections/reconciliation/month';
import toolButtonSx from 'sections/reconciliation/toolButton';
import type { BankStatementEntry, BankStatementImportResult } from 'types/bankStatement';

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
const amountColumn = columns.findIndex((column) => column.key === 'amount');

/**
 * Where the table's head comes to rest while the page scrolls: the app header's own bottom.
 *
 * <p>The page is the one thing that scrolls, as it is on the reconciliation screen. A window of its own for the
 * entries would have given the head and the foot something nearer to hold on to, but it would also have given the
 * screen a second scrollbar beside the page's, and a reader scrolling a table should not have to notice which of two
 * bars they are pushing. So the head stops under the app header and the foot stops at the bottom of the window,
 * which means nothing between the table and the page may clip: a scrolling ancestor would catch them both and hold
 * them inside the card.
 */
const STICKY_TOP = HEADER_HEIGHT;

/**
 * The entries beside their filter panel, sliding over where the panel was when it is closed.
 *
 * <p>A docked drawer holds its width whether it is open or shut, so the table takes that width back with a negative
 * margin rather than the panel giving it up: the panel slides out of its own place and the table follows it across.
 */
const Main = styled('main', { shouldForwardProp: (prop: string) => prop !== 'open' && prop !== 'container' })<{
  open: boolean;
  container: boolean;
}>(({ theme }) => ({
  flexGrow: 1,
  minWidth: 0,
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.shorter
  }),
  marginLeft: -300,
  // Below the breakpoint the panel is a temporary overlay, which takes no width out of the page at all.
  [theme.breakpoints.down('lg')]: { marginLeft: 0 },
  variants: [
    { props: ({ container }) => container, style: { [theme.breakpoints.only('lg')]: { marginLeft: 0 } } },
    { props: ({ container, open }) => container && !open, style: { [theme.breakpoints.only('lg')]: { marginLeft: -260 } } },
    {
      props: ({ open }) => open,
      style: {
        transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.shorter
        }),
        marginLeft: 0
      }
    }
  ]
}));

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

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
    <EntryTextField
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
      <EntryTextField
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

export default function BankStatementsPage() {
  const intl = useIntl();
  // One string holds both what is being read and which view is reading it: `YYYY-MM` is a month, `YYYY` a year. The
  // screen opens on this month, which is the period a statement is imported for.
  const [selectedPeriod, setSelectedPeriod] = useState(currentMonth());
  // Which entries of the period are being read: what was ticked, and what was searched for. It is held beside the
  // period, and for the same reason: this screen is read a period at a time rather than linked to, so what it is
  // showing is state of its own rather than an address the way the reconciliation screen's narrowing is.
  const [narrowing, setNarrowing] = useState<EntryNarrowing>(noNarrowing);
  const { container } = useConfig();
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));
  // Room for it means it is open: the entries are read against what they were narrowed to, so the panel showing that
  // is worth its width wherever there is width to spare.
  const [filtersOpen, setFiltersOpen] = useState(!downLG);
  // The search row is asked for rather than always there: most reading of a statement is reading it, and a row of
  // empty fields under the headings would cost every reader a line of the table to say so.
  const [searchOpen, setSearchOpen] = useState(false);
  // The search row rests under the heading row, so it has to know how tall that row came out. It is measured rather
  // than stated: a heading wraps onto a second line on a narrow screen, and a row stopping at a height that was
  // assumed would land over the headings on the first scroll of the page.
  const [headingRow, setHeadingRow] = useState<HTMLTableRowElement | null>(null);
  const [headingHeight, setHeadingHeight] = useState(0);
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

  /** Reads the same span in the other view, rather than starting the reader over at a period they did not ask for. */
  const handleView = (view: PeriodView | null) => {
    if (view) setSelectedPeriod(periodIn(selectedPeriod, view));
  };

  const view = viewOf(selectedPeriod);
  const collectedEntries = bankStatementEntries ?? [];
  // A year of entries is thousands of rows, and every one of them is filtered again at each keystroke of a search.
  // The field itself answers the key at once and the table catches up a render later, so typing never waits on a
  // period however long it is.
  const settled = useDeferredValue(narrowing);
  const shown = shownEntries(collectedEntries, settled);
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
      <PeriodPicker value={selectedPeriod} onChange={setSelectedPeriod} />
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
      {/* Beside the period rather than inside it: this is a question about how the table is read, not about which
          period is being read. The one already being read is disabled rather than merely unselected, there being
          nothing to ask for by pressing it. */}
      <ToggleButtonGroup
        exclusive
        value={view}
        onChange={(_event, picked: PeriodView | null) => handleView(picked)}
        aria-label={intl.formatMessage({ id: 'bank-statement-view' })}
      >
        <ToggleButton disabled={view === 'month'} value="month" sx={{ px: 2, py: 0.5, textTransform: 'none' }}>
          {intl.formatMessage({ id: 'bank-statement-view-month' })}
        </ToggleButton>
        <ToggleButton disabled={view === 'year'} value="year" sx={{ px: 2, py: 0.5, textTransform: 'none' }}>
          {intl.formatMessage({ id: 'bank-statement-view-year' })}
        </ToggleButton>
      </ToggleButtonGroup>
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

        <Main open={filtersOpen} container={container}>
          <Stack sx={{ gap: 3, mt: 2.5 }}>
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
              content={false}
              title={periodTitle}
              secondary={actions}
              // Nothing between the table and the page may clip, the stuck head and foot being the reason: a scrolling
              // ancestor would catch them and hold them inside the card.
              sx={{ overflow: 'visible' }}
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
                      sx={{
                        minWidth: 1100,
                        // Laid out to the stated column shares rather than to what is in the cells, so nothing moves
                        // sideways when the search row opens or another period is read.
                        tableLayout: 'fixed',
                        // The theme gives every head cell but the last `position: relative`, to hang the column divider
                        // off, and that beats the `sticky` the stickyHeader prop asks for. Asked for again here, where it
                        // out-specifies the theme, so the head stays put.
                        '& .MuiTableCell-stickyHeader:not(:last-of-type)': { position: 'sticky' },
                        // The page is what scrolls, so the head stops under the app header rather than at nought, and it
                        // keeps the ground the row it sits in would otherwise have carried behind it.
                        '& .MuiTableCell-stickyHeader': { top: STICKY_TOP, bgcolor: 'secondary.lighter' },
                        // The search row rests under the headings rather than beside them, at the height they came out
                        // at, so the two of them stack up under the app header instead of over each other. It carries
                        // the card's own ground rather than the head's tint: the tint is what says a row is headings,
                        // and fields to type in sitting on it read as headings that happen to be editable. The two
                        // grounds are also what tell the reader where the head's naming stops and its asking starts,
                        // which saves the row a line of its own.
                        '& thead tr:nth-of-type(2) .MuiTableCell-stickyHeader': {
                          top: STICKY_TOP + headingHeight,
                          bgcolor: 'background.paper'
                        },
                        // The rule under the head goes under the last row of it, whichever of the two that is: a rule
                        // under the headings as well would make the search row a band of its own rather than part of
                        // the head it belongs to.
                        '& thead tr:last-of-type .MuiTableCell-root': { borderBottom: (theme) => `2px solid ${theme.palette.divider}` },
                        // The head hangs a divider off every column but the last. They crossed the line under every entry
                        // and made a grid of the statement; the head is grounded and ruled off already, which is enough to
                        // read it as the head.
                        '& .MuiTableCell-stickyHeader:after': { display: 'none' },
                        // An entry is separated from the next by its ground rather than by a line of its own. A statement
                        // is dozens of rows long and a line under each of them read exactly as loudly as the rule under
                        // the head and the rule above the summary, which are the two the reader is steering by, so the
                        // ladder is taken away and those two are left to carry the table's shape.
                        // The columns are laid out to their stated shares, so text that cannot be broken at a space
                        // — an IBAN, a reference, a remittance line a payer ran together — is broken anyway rather
                        // than allowed to spill across the column beside it.
                        '& tbody .MuiTableCell-root': { borderBottom: 0, overflowWrap: 'anywhere' },
                        '& tbody .MuiTableRow-root:nth-of-type(even)': { bgcolor: 'secondary.lighter' },
                        // The banded ground is the theme's own hover colour, so the row under the pointer answers in a
                        // different one rather than in the one every other row already wears.
                        '& tbody .MuiTableRow-root:hover': { bgcolor: 'primary.lighter' }
                      }}
                    >
                      <colgroup>
                        {columns.map((column) => (
                          <col key={column.key} style={{ width: column.width }} />
                        ))}
                      </colgroup>
                      <TableHead>
                        <TableRow ref={setHeadingRow}>
                          {columns.map((column, index) => (
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
                            {columns.map((column) => {
                              const searchable = searchColumns.some((searched) => searched.column === column.key);
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
                            <TableCell colSpan={columns.length} sx={{ py: 6, textAlign: 'center' }}>
                              <Typography color="text.secondary">{intl.formatMessage({ id: 'bank-statement-filtered-empty' })}</Typography>
                            </TableCell>
                          </TableRow>
                        )}
                        {shown.map((entry) => (
                          <TableRow key={entry.id} hover>
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
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{transactionCode(entry) || '—'}</TableCell>
                            <TableCell>
                              {/* Wrapped rather than held on one line: a bank's reference is as long as that bank
                                  made it, and the column is a share of the table rather than as wide as the longest
                                  one that turns up. */}
                              <Typography variant="caption" color="text.secondary">
                                <Highlighted text={entry.entryReference} terms={termsOf('reference')} />
                              </Typography>
                            </TableCell>
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
                        <SummaryFooter summary={bankStatementSummary} before={amountColumn} after={columns.length - amountColumn - 1} />
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
        </Main>
      </Box>
    </Stack>
  );
}
