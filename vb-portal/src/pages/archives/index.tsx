import { FormEvent, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableFooter from '@mui/material/TableFooter';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { CloseCircle, MinusCirlce, TickCircle } from 'iconsax-reactjs';

import { downloadMissingArchives, useGetArchives } from 'api/archives';
import MainCard from 'components/MainCard';
import type { AccountingOrder, AccountingSummary } from 'types/accounting';
import type { VatInvoiceArchiveStatus } from 'types/archives';

const previousMonth = () => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const formatAmount = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

const numericCell = { textAlign: 'right', whiteSpace: 'nowrap' } as const;
const archiveCell = { textAlign: 'center', whiteSpace: 'nowrap' } as const;

interface ArchiveStatusProps {
  available: boolean;
  notRequired?: boolean;
  downloading: boolean;
  availableLabel: string;
  missingLabel: string;
  onDownload: () => void;
}

function ArchiveStatus({ available, notRequired, downloading, availableLabel, missingLabel, onDownload }: ArchiveStatusProps) {
  if (available) {
    return (
      <Tooltip title={availableLabel}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }} aria-label={availableLabel}>
          <TickCircle size={22} color="currentColor" variant="Bold" />
        </Box>
      </Tooltip>
    );
  }

  if (notRequired) {
    return (
      <Tooltip title="VAT invoice not required">
        <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }} aria-label="VAT invoice not required">
          <MinusCirlce size={22} color="currentColor" variant="Bold" />
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={`${missingLabel} — download all missing archives`}>
      <span>
        <IconButton
          color="error"
          size="small"
          disabled={downloading}
          aria-label={`${missingLabel} — download all missing archives`}
          onClick={onDownload}
        >
          {downloading ? <CircularProgress size={20} color="inherit" /> : <CloseCircle size={22} color="currentColor" variant="Bold" />}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function OrderRow({
  order,
  apiArchived,
  accountingArchived,
  vatInvoiceStatus,
  downloading,
  onDownload
}: {
  order: AccountingOrder;
  apiArchived: boolean;
  accountingArchived: boolean;
  vatInvoiceStatus: VatInvoiceArchiveStatus;
  downloading: boolean;
  onDownload: () => void;
}) {
  const grandTotal = (
    <TableCell
      sx={{
        ...numericCell,
        color: order.grandTotalMismatch ? 'error.main' : 'inherit',
        fontWeight: order.grandTotalMismatch ? 700 : 400
      }}
    >
      {formatAmount(order.grandTotal)}
    </TableCell>
  );

  return (
    <TableRow hover>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(order.orderDate)}</TableCell>
      <TableCell>{order.orderNumber}</TableCell>
      <TableCell>{order.buyerName}</TableCell>
      <TableCell>{order.location || '—'}</TableCell>
      <TableCell sx={numericCell}>{order.lotCount ?? '—'}</TableCell>
      <TableCell sx={numericCell}>{order.itemCount ?? '—'}</TableCell>
      <TableCell sx={numericCell}>{formatAmount(order.orderTotal)}</TableCell>
      <TableCell sx={numericCell}>{formatAmount(order.shipping)}</TableCell>
      <TableCell sx={numericCell}>{order.marketplaceTaxPresent ? formatAmount(order.marketplaceTax) : '—'}</TableCell>
      {order.grandTotalMismatch ? (
        <Tooltip title={`Calculated: ${formatAmount(order.calculatedGrandTotal)}`} arrow>
          {grandTotal}
        </Tooltip>
      ) : (
        grandTotal
      )}
      <TableCell sx={numericCell}>{order.vatPresent ? formatAmount(order.vat) : '—'}</TableCell>
      <TableCell sx={archiveCell}>
        <ArchiveStatus
          available={apiArchived}
          downloading={downloading}
          availableLabel="API archive available"
          missingLabel="API archive missing"
          onDownload={onDownload}
        />
      </TableCell>
      <TableCell sx={archiveCell}>
        <ArchiveStatus
          available={accountingArchived}
          downloading={downloading}
          availableLabel="Accounting archive available"
          missingLabel="Accounting archive missing"
          onDownload={onDownload}
        />
      </TableCell>
      <TableCell sx={archiveCell}>
        <ArchiveStatus
          available={vatInvoiceStatus === 'AVAILABLE'}
          notRequired={vatInvoiceStatus === 'NOT_REQUIRED'}
          downloading={downloading}
          availableLabel="VAT invoice archive available"
          missingLabel="VAT invoice archive missing"
          onDownload={onDownload}
        />
      </TableCell>
    </TableRow>
  );
}

function SummaryRow({ summary }: { summary: AccountingSummary }) {
  return (
    <TableRow>
      <TableCell colSpan={4} sx={{ fontWeight: 700 }}>
        Total
      </TableCell>
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{summary.lotCount}</TableCell>
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{summary.itemCount}</TableCell>
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{formatAmount(summary.orderTotal)}</TableCell>
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{formatAmount(summary.shipping)}</TableCell>
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{formatAmount(summary.marketplaceTax)}</TableCell>
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{formatAmount(summary.grandTotal)}</TableCell>
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{formatAmount(summary.vat)}</TableCell>
      <TableCell colSpan={3} />
    </TableRow>
  );
}

export default function ArchivesPage() {
  const initialMonth = previousMonth();
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [requestedMonth, setRequestedMonth] = useState(initialMonth);
  const [downloadingOrder, setDownloadingOrder] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const { archives, archivesError, archivesLoading, reloadArchives } = useGetArchives(requestedMonth);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestedMonth(selectedMonth);
  };

  const handleDownload = async (orderId: string) => {
    setDownloadingOrder(orderId);
    setDownloadError(null);
    try {
      await downloadMissingArchives(orderId);
      await reloadArchives();
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Failed to download missing archives.');
    } finally {
      setDownloadingOrder(null);
    }
  };

  return (
    <Stack spacing={3}>
      <MainCard title="Archives" contentSX={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          component="form"
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'flex-end' }}
          onSubmit={handleSubmit}
        >
          <TextField
            label="Order month"
            name="month"
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { pattern: '[0-9]{4}-[0-9]{2}' } }}
          />
          <Button type="submit" variant="contained" size="large" disabled={!selectedMonth}>
            Show orders
          </Button>
          {archives && (
            <Box sx={{ alignSelf: { sm: 'center' }, ml: { sm: 'auto !important' }, color: 'text.secondary' }}>
              {archives.orders.length} {archives.orders.length === 1 ? 'BrickLink order' : 'BrickLink orders'}
            </Box>
          )}
        </Stack>
      </MainCard>

      {archivesLoading && <Skeleton variant="rounded" height={420} />}

      {archivesError && <Alert severity="error">{archivesError.message || 'Failed to load archived orders.'}</Alert>}
      {downloadError && <Alert severity="error">{downloadError}</Alert>}

      {!archivesLoading && !archivesError && archives && (
        <MainCard content={false}>
          {archives.orders.length ? (
            <TableContainer>
              <Table stickyHeader size="small" sx={{ minWidth: 1400 }} aria-label="Archived BrickLink orders">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Number</TableCell>
                    <TableCell>Buyer name</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell sx={numericCell}>Lots</TableCell>
                    <TableCell sx={numericCell}>Items</TableCell>
                    <TableCell sx={numericCell}>Order total</TableCell>
                    <TableCell sx={numericCell}>Shipping</TableCell>
                    <TableCell sx={numericCell}>Tax</TableCell>
                    <TableCell sx={numericCell}>Grand total</TableCell>
                    <TableCell sx={numericCell}>VAT</TableCell>
                    <TableCell sx={archiveCell}>API</TableCell>
                    <TableCell sx={archiveCell}>Accounting</TableCell>
                    <TableCell sx={archiveCell}>VAT invoice</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {archives.orders.map((archive) => (
                    <OrderRow
                      key={archive.order.orderNumber}
                      {...archive}
                      downloading={downloadingOrder === archive.order.orderNumber}
                      onDownload={() => handleDownload(archive.order.orderNumber)}
                    />
                  ))}
                </TableBody>
                <TableFooter>
                  <SummaryRow summary={archives.summary} />
                </TableFooter>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">No BrickLink orders found for this month.</Typography>
            </Box>
          )}
        </MainCard>
      )}
    </Stack>
  );
}
