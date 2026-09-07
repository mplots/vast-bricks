import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';

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
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DocumentUpload, Refresh } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { importBankStatement, updateBankStatementMapping, useGetBankStatementEntries } from 'api/bankStatements';
import IconButton from 'components/@extended/IconButton';
import MainCard from 'components/MainCard';
import { HEADER_HEIGHT } from 'config';
import PeriodPicker from 'sections/bank-statements/PeriodPicker';
import SummaryFooter from 'sections/bank-statements/SummaryFooter';
import { formatAmount, numericCell } from 'sections/bank-statements/amount';
import { periodIn, viewOf, type PeriodView } from 'sections/bank-statements/period';
import { currentMonth } from 'sections/reconciliation/month';
import toolButtonSx from 'sections/reconciliation/toolButton';
import type { BankStatementEntry, BankStatementImportResult } from 'types/bankStatement';

/** The table's columns, so the summary under it knows which of them the amount stands in. */
const columns = ['date', 'counterparty', 'details', 'amount', 'code', 'reference', 'mapping'] as const;
const amountColumn = columns.indexOf('amount');

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

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

/** The bank's own code for what the entry was, its own wording first: `IZP` says more here than `PMNT/ICDT`. */
const transactionCode = (entry: BankStatementEntry) =>
  entry.proprietaryCode ?? [entry.domainCode, entry.familyCode, entry.subFamilyCode].filter(Boolean).join('/');

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
    <TableCell sx={{ minWidth: 200 }}>
      <TextField
        fullWidth
        size="small"
        variant="standard"
        value={draft}
        disabled={saving}
        placeholder={intl.formatMessage({ id: 'bank-statement-mapping-placeholder' })}
        onChange={(event) => edit(event.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        slotProps={{ htmlInput: { 'aria-label': intl.formatMessage({ id: 'bank-statement-mapping' }) } }}
        // A line under this field in every row is another rung of the ladder the table has just been rid of, and a
        // louder one than the entries it runs beside. It draws its underline when the row is pointed at or the field
        // is being written in, and reads as the value it holds otherwise; the placeholder says there is something to
        // write here even while the line is away.
        sx={(theme) => ({
          '& .MuiInput-root:before': { borderBottomColor: 'transparent' },
          'tr:hover & .MuiInput-root:before, & .MuiInput-root.Mui-focused:before': {
            borderBottomColor: theme.palette.divider
          }
        })}
      />
    </TableCell>
  );
}

export default function BankStatementsPage() {
  const intl = useIntl();
  // One string holds both what is being read and which view is reading it: `YYYY-MM` is a month, `YYYY` a year. The
  // screen opens on this month, which is the period a statement is imported for.
  const [selectedPeriod, setSelectedPeriod] = useState(currentMonth());
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
    <Stack sx={{ gap: 3 }}>
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
        title={<PeriodPicker value={selectedPeriod} onChange={setSelectedPeriod} />}
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
          (bankStatementEntries.length ? (
            <TableContainer sx={{ overflow: 'visible' }}>
              <Table
                stickyHeader
                size="small"
                aria-label={intl.formatMessage({ id: 'bank-statement-table' })}
                sx={{
                  minWidth: 1100,
                  // The theme gives every head cell but the last `position: relative`, to hang the column divider
                  // off, and that beats the `sticky` the stickyHeader prop asks for. Asked for again here, where it
                  // out-specifies the theme, so the head stays put.
                  '& .MuiTableCell-stickyHeader:not(:last-of-type)': { position: 'sticky' },
                  // The page is what scrolls, so the head stops under the app header rather than at nought, and it
                  // keeps the ground and the edge the row it sits in would otherwise have carried behind it.
                  '& .MuiTableCell-stickyHeader': {
                    top: STICKY_TOP,
                    bgcolor: 'secondary.lighter',
                    borderBottom: (theme) => `2px solid ${theme.palette.divider}`
                  },
                  // The head hangs a divider off every column but the last. They crossed the line under every entry
                  // and made a grid of the statement; the head is grounded and ruled off already, which is enough to
                  // read it as the head.
                  '& .MuiTableCell-stickyHeader:after': { display: 'none' },
                  // An entry is separated from the next by its ground rather than by a line of its own. A statement
                  // is dozens of rows long and a line under each of them read exactly as loudly as the rule under
                  // the head and the rule above the summary, which are the two the reader is steering by, so the
                  // ladder is taken away and those two are left to carry the table's shape.
                  '& tbody .MuiTableCell-root': { borderBottom: 0 },
                  '& tbody .MuiTableRow-root:nth-of-type(even)': { bgcolor: 'secondary.lighter' },
                  // The banded ground is the theme's own hover colour, so the row under the pointer answers in a
                  // different one rather than in the one every other row already wears.
                  '& tbody .MuiTableRow-root:hover': { bgcolor: 'primary.lighter' }
                }}
              >
                <TableHead>
                  <TableRow>
                    {columns.map((column, index) => (
                      <TableCell key={column} sx={index === amountColumn ? numericCell : undefined}>
                        {intl.formatMessage({ id: `bank-statement-${column}` })}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bankStatementEntries.map((entry) => (
                    <TableRow key={entry.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(entry.bookingDate)}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{entry.counterpartyName || '—'}</Typography>
                        {entry.counterpartyIban && (
                          <Typography variant="caption" color="text.secondary">
                            {entry.counterpartyIban}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{entry.remittanceInformation || '—'}</TableCell>
                      <TableCell sx={{ ...numericCell, color: entry.direction === 'CREDIT' ? 'success.main' : 'error.main' }}>
                        {/* The amount is stored unsigned, the way the bank states it, so the sign is put back here
                            from the direction rather than the column reading the same in both directions. */}
                        {entry.direction === 'CREDIT' ? '+' : '−'}
                        {formatAmount(entry.amount)} {entry.currency}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{transactionCode(entry) || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          {entry.entryReference}
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
                {/* Under the entries it is the account of, and only once there is a period's worth of them to
                    account for. The amount column is found by name rather than counted out here, so a column moved
                    or added does not silently slide the totals into the wrong one. */}
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
  );
}
