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
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DocumentUpload, Refresh } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { importBankStatement, updateBankStatementMapping, useGetBankStatementEntries } from 'api/bankStatements';
import IconButton from 'components/@extended/IconButton';
import MainCard from 'components/MainCard';
import MonthPicker from 'sections/reconciliation/MonthPicker';
import { currentMonth } from 'sections/reconciliation/month';
import toolButtonSx from 'sections/reconciliation/toolButton';
import type { BankStatementEntry, BankStatementImportResult } from 'types/bankStatement';

const numericCell = { textAlign: 'right', whiteSpace: 'nowrap' } as const;

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

const formatAmount = (value: number) => Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      />
    </TableCell>
  );
}

export default function BankStatementsPage() {
  const intl = useIntl();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BankStatementImportResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const {
    bankStatementEntries,
    bankStatementEntriesError,
    bankStatementEntriesLoading,
    bankStatementEntriesRefreshing,
    reloadBankStatementEntries
  } = useGetBankStatementEntries(selectedMonth);

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

  /** Puts the saved entry back in the list without re-reading the month, so the row settles where it already is. */
  const handleSaved = (saved: BankStatementEntry) => {
    setActionError(null);
    reloadBankStatementEntries(
      (page) => (page ? { entries: page.entries.map((entry) => (entry.id === saved.id ? saved : entry)) } : page),
      { revalidate: false }
    );
  };

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
        title={<MonthPicker value={selectedMonth} max={currentMonth()} onChange={setSelectedMonth} />}
        secondary={actions}
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
            <TableContainer>
              <Table size="small" sx={{ minWidth: 1100 }} aria-label={intl.formatMessage({ id: 'bank-statement-table' })}>
                <TableHead>
                  <TableRow>
                    <TableCell>{intl.formatMessage({ id: 'bank-statement-date' })}</TableCell>
                    <TableCell>{intl.formatMessage({ id: 'bank-statement-counterparty' })}</TableCell>
                    <TableCell>{intl.formatMessage({ id: 'bank-statement-details' })}</TableCell>
                    <TableCell sx={numericCell}>{intl.formatMessage({ id: 'bank-statement-amount' })}</TableCell>
                    <TableCell>{intl.formatMessage({ id: 'bank-statement-code' })}</TableCell>
                    <TableCell>{intl.formatMessage({ id: 'bank-statement-reference' })}</TableCell>
                    <TableCell>{intl.formatMessage({ id: 'bank-statement-mapping' })}</TableCell>
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
