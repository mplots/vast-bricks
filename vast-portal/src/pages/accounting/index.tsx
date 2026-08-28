import { FormEvent, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
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
import { ReceiptAdd } from 'iconsax-reactjs';

import { generateInvoice, useGetAccounting } from 'api/accounting';
import MainCard from 'components/MainCard';
import type { AccountingOrder, AccountingSummary } from 'types/accounting';

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

function OrderRow({
  order,
  generating,
  onGenerate
}: {
  order: AccountingOrder;
  generating: boolean;
  onGenerate: () => void;
}) {
  const rowColor = order.unmatchedOnlinePayment ? '#fee2e2' : order.bankTransfer ? '#fef3c7' : undefined;
  const rowHoverColor = order.unmatchedOnlinePayment ? '#fecaca' : order.bankTransfer ? '#fde68a' : undefined;
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
    <TableRow
      hover
      sx={
        rowColor
          ? {
              backgroundColor: rowColor,
              '&.MuiTableRow-hover:hover': { backgroundColor: rowHoverColor }
            }
          : undefined
      }
    >
      <TableCell sx={{ width: 56, whiteSpace: 'nowrap' }}>
        <Tooltip title="Generate invoice" arrow>
          <span>
            <IconButton
              size="small"
              color="primary"
              disabled={generating}
              aria-label={`Generate invoice for order ${order.orderNumber}`}
              onClick={onGenerate}
            >
              {generating ? <CircularProgress size={18} color="inherit" /> : <ReceiptAdd size={20} color="currentColor" />}
            </IconButton>
          </span>
        </Tooltip>
      </TableCell>
      <TableCell>
        <Chip
          label={order.source}
          size="small"
          color={order.source === 'Brick Owl' ? 'secondary' : 'primary'}
          variant="outlined"
        />
      </TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(order.orderDate)}</TableCell>
      <TableCell>{order.orderNumber}</TableCell>
      <TableCell>{order.buyerName}</TableCell>
      <TableCell>{order.location || '—'}</TableCell>
      <TableCell>{order.paymentMethod || '—'}</TableCell>
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
      <TableCell sx={numericCell}>{formatAmount(order.paidAmount)}</TableCell>
      <TableCell sx={numericCell}>{order.vatPresent ? formatAmount(order.vat) : '—'}</TableCell>
    </TableRow>
  );
}

function SummaryRow({ summary }: { summary: AccountingSummary }) {
  return (
    <TableRow>
      <TableCell />
      <TableCell colSpan={6} sx={{ fontWeight: 700 }}>
        Total
      </TableCell>
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{summary.lotCount}</TableCell>
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{summary.itemCount}</TableCell>
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{formatAmount(summary.orderTotal)}</TableCell>
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{formatAmount(summary.shipping)}</TableCell>
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{formatAmount(summary.marketplaceTax)}</TableCell>
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{formatAmount(summary.grandTotal)}</TableCell>
      <TableCell />
      <TableCell sx={{ ...numericCell, fontWeight: 700 }}>{formatAmount(summary.vat)}</TableCell>
    </TableRow>
  );
}

export default function AccountingPage() {
  const initialMonth = previousMonth();
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [requestedMonth, setRequestedMonth] = useState(initialMonth);
  const [generatingOrder, setGeneratingOrder] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const { accounting, accountingError, accountingLoading } = useGetAccounting(requestedMonth);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestedMonth(selectedMonth);
  };

  const handleGenerateInvoice = async (order: AccountingOrder) => {
    const orderKey = `${order.source}-${order.orderNumber}`;
    setGeneratingOrder(orderKey);
    setGenerationError(null);
    setGenerationMessage(null);
    try {
      const result = await generateInvoice(order.orderNumber, order.source);
      setGenerationMessage(`Created Manakabata invoice ${result.invoiceNumber} for ${result.name}.`);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate invoice.');
    } finally {
      setGeneratingOrder(null);
    }
  };

  return (
    <Stack spacing={3}>
      <MainCard title="Accounting" contentSX={{ p: { xs: 2, sm: 3 } }}>
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
          {accounting && (
            <Chip
              label={`${accounting.orders.length} ${accounting.orders.length === 1 ? 'order' : 'orders'}`}
              variant="outlined"
              sx={{ alignSelf: { sm: 'center' }, ml: { sm: 'auto !important' } }}
            />
          )}
        </Stack>
      </MainCard>

      {accountingLoading && <Skeleton variant="rounded" height={420} />}

      {accountingError && <Alert severity="error">{accountingError.message || 'Failed to load accounting orders.'}</Alert>}
      {generationError && <Alert severity="error">{generationError}</Alert>}
      {generationMessage && <Alert severity="success">{generationMessage}</Alert>}

      {!accountingLoading && !accountingError && accounting && (
        <MainCard content={false}>
          {accounting.orders.length ? (
            <TableContainer>
              <Table stickyHeader size="small" sx={{ minWidth: 1600 }} aria-label="Accounting orders">
                <TableHead>
                  <TableRow>
                    <TableCell>Actions</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Number</TableCell>
                    <TableCell>Buyer name</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Payment source</TableCell>
                    <TableCell sx={numericCell}>Lots</TableCell>
                    <TableCell sx={numericCell}>Items</TableCell>
                    <TableCell sx={numericCell}>Order total</TableCell>
                    <TableCell sx={numericCell}>Shipping</TableCell>
                    <TableCell sx={numericCell}>Tax</TableCell>
                    <TableCell sx={numericCell}>Grand total</TableCell>
                    <TableCell sx={numericCell}>Paid amount</TableCell>
                    <TableCell sx={numericCell}>VAT</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accounting.orders.map((order) => (
                    <OrderRow
                      key={`${order.source}-${order.orderNumber}`}
                      order={order}
                      generating={generatingOrder === `${order.source}-${order.orderNumber}`}
                      onGenerate={() => handleGenerateInvoice(order)}
                    />
                  ))}
                </TableBody>
                <TableFooter>
                  <SummaryRow summary={accounting.summary} />
                </TableFooter>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">No orders found for this month.</Typography>
            </Box>
          )}
        </MainCard>
      )}
    </Stack>
  );
}
