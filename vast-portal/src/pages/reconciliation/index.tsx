import { FormEvent, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
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
import { darken, Theme } from '@mui/material/styles';
import { ReceiptAdd } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

// The invoice endpoint lives under the accounting namespace and is shared with the accounting screen.
import { generateInvoice } from 'api/accounting';
import { useGetReconciliationOrders } from 'api/reconciliation';
import MainCard from 'components/MainCard';
import type { ReconciliationFailure, ReconciliationOrder } from 'types/reconciliation';

// Order property names, matching the backend ReconciliationOrderField enum.
const orderFields = ['source', 'orderId', 'orderDate', 'buyer', 'buyerUsername', 'subTotal', 'itemsSubTotal', 'invoiceSubTotal'] as const;
const amountFields: string[] = ['subTotal', 'itemsSubTotal', 'invoiceSubTotal'];

// Fields shown as table columns; the detail view shows all of them.
const columnFields: string[] = ['source', 'orderId', 'buyer', 'buyerUsername', 'subTotal', 'itemsSubTotal', 'invoiceSubTotal'];

const formatAmount = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `€${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatText = (value?: string | null) => value ?? '—';

const formatFieldValue = (order: ReconciliationOrder, field: string) => {
  const value = order[field as keyof ReconciliationOrder];
  return amountFields.includes(field) ? formatAmount(value as number | null) : formatText(value as string | null);
};

const isFailed = (order: ReconciliationOrder) => order.failures.length > 0;

const failureKey = (failure: ReconciliationFailure) => `${failure.code}-${failure.fields.join('-')}`;

const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const orderKey = (order: ReconciliationOrder) => `${order.source}-${order.orderId}`;

export default function ReconciliationPage() {
  const intl = useIntl();
  const initialMonth = currentMonth();
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [requestedMonth, setRequestedMonth] = useState(initialMonth);
  const [selectedOrder, setSelectedOrder] = useState<ReconciliationOrder | null>(null);
  const [selectedFailure, setSelectedFailure] = useState<string | null>(null);
  const [generatingOrder, setGeneratingOrder] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const { reconciliationOrders, reconciliationOrdersError, reconciliationOrdersLoading } = useGetReconciliationOrders(requestedMonth);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestedMonth(selectedMonth);
  };

  const handleGenerateInvoice = async (order: ReconciliationOrder) => {
    setGeneratingOrder(orderKey(order));
    setGenerationError(null);
    setGenerationMessage(null);
    try {
      const result = await generateInvoice(order.orderId, order.source);
      setGenerationMessage(
        intl.formatMessage({ id: 'reconciliation-invoice-generated' }, { invoiceNumber: result.invoiceNumber, name: result.name })
      );
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : intl.formatMessage({ id: 'reconciliation-invoice-error' }));
    } finally {
      setGeneratingOrder(null);
    }
  };

  const openOrder = (order: ReconciliationOrder) => {
    setSelectedOrder(order);
    // Select the first failure so the highlighted fields are visible without a click.
    setSelectedFailure(order.failures.length ? failureKey(order.failures[0]) : null);
  };

  const closeOrder = () => {
    setSelectedOrder(null);
    setSelectedFailure(null);
  };

  const fieldLabel = (field: string) => intl.formatMessage({ id: `reconciliation-field-${field}` });

  const failureMessage = (order: ReconciliationOrder, failure: ReconciliationFailure) =>
    intl.formatMessage(
      { id: `reconciliation-failure-${failure.code}` },
      {
        ...Object.fromEntries(failure.fields.map((field) => [field, formatFieldValue(order, field)])),
        fields: failure.fields.map(fieldLabel).join(', ')
      }
    );

  const highlightedFields = selectedOrder?.failures.find((failure) => failureKey(failure) === selectedFailure)?.fields ?? [];

  const failedCount = reconciliationOrders?.orders.filter(isFailed).length ?? 0;

  return (
    <Stack spacing={3}>
      <MainCard title={intl.formatMessage({ id: 'reconciliation-title' })} contentSX={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          component="form"
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'flex-end' }}
          onSubmit={handleSubmit}
        >
          <TextField
            label={intl.formatMessage({ id: 'reconciliation-month' })}
            name="month"
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { pattern: '[0-9]{4}-[0-9]{2}' } }}
          />
          <Button type="submit" variant="contained" size="large" disabled={!selectedMonth}>
            {intl.formatMessage({ id: 'reconciliation-show-orders' })}
          </Button>
          {reconciliationOrders && (
            <Stack direction="row" spacing={1} sx={{ alignSelf: { sm: 'center' }, ml: { sm: 'auto !important' } }}>
              <Chip
                label={intl.formatMessage({ id: 'reconciliation-order-count' }, { count: reconciliationOrders.orders.length })}
                variant="outlined"
              />
              {failedCount > 0 && (
                <Chip
                  label={intl.formatMessage({ id: 'reconciliation-failed-count' }, { count: failedCount })}
                  color="error"
                  variant="outlined"
                />
              )}
            </Stack>
          )}
        </Stack>
      </MainCard>

      {reconciliationOrdersLoading && <Skeleton variant="rounded" height={320} />}

      {reconciliationOrdersError && (
        <Alert severity="error">{reconciliationOrdersError.message || intl.formatMessage({ id: 'reconciliation-load-error' })}</Alert>
      )}

      {generationError && <Alert severity="error">{generationError}</Alert>}
      {generationMessage && <Alert severity="success">{generationMessage}</Alert>}

      {!reconciliationOrdersLoading && !reconciliationOrdersError && reconciliationOrders && (
        <MainCard content={false}>
          {reconciliationOrders.orders.length ? (
            <TableContainer>
              <Table stickyHeader size="small" aria-label={intl.formatMessage({ id: 'reconciliation-orders-table' })}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 56 }}>{intl.formatMessage({ id: 'reconciliation-actions' })}</TableCell>
                    {columnFields.map((field) => (
                      <TableCell key={field} align={amountFields.includes(field) ? 'right' : 'left'}>
                        {fieldLabel(field)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reconciliationOrders.orders.map((order) => (
                    <TableRow
                      hover
                      key={orderKey(order)}
                      onClick={() => openOrder(order)}
                      sx={{
                        cursor: 'pointer',
                        ...(isFailed(order) && {
                          bgcolor: 'error.lighter',
                          // The theme tints every hovered row, so a failed row paints its own deeper red over it.
                          '& td': { color: 'error.dark' },
                          '&:hover td': { bgcolor: (theme: Theme) => darken(theme.palette.error.lighter, 0.08) }
                        })
                      }}
                    >
                      {/* The row opens the detail dialog, so the action cell must not bubble its click. */}
                      <TableCell sx={{ width: 56, whiteSpace: 'nowrap' }} onClick={(event) => event.stopPropagation()}>
                        <Tooltip title={intl.formatMessage({ id: 'reconciliation-generate-invoice' })} arrow>
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              disabled={generatingOrder === orderKey(order)}
                              aria-label={intl.formatMessage(
                                { id: 'reconciliation-generate-invoice-for' },
                                { source: order.source, orderId: order.orderId }
                              )}
                              onClick={() => handleGenerateInvoice(order)}
                            >
                              {generatingOrder === orderKey(order) ? (
                                <CircularProgress size={18} color="inherit" />
                              ) : (
                                <ReceiptAdd size={20} color="currentColor" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                      {columnFields.map((field) => (
                        <TableCell key={field} align={amountFields.includes(field) ? 'right' : 'left'}>
                          {field === 'source' ? (
                            <Chip label={order.source} size="small" color={isFailed(order) ? 'error' : 'primary'} variant="outlined" />
                          ) : (
                            formatFieldValue(order, field)
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">{intl.formatMessage({ id: 'reconciliation-empty' })}</Typography>
            </Box>
          )}
        </MainCard>
      )}

      <Dialog open={Boolean(selectedOrder)} onClose={closeOrder} fullWidth maxWidth="sm">
        {selectedOrder && (
          <>
            <DialogTitle>
              {intl.formatMessage({ id: 'reconciliation-detail-title' }, { source: selectedOrder.source, orderId: selectedOrder.orderId })}
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={0.5}>
                {orderFields.map((field) => (
                  <Stack
                    key={field}
                    direction="row"
                    justifyContent="space-between"
                    spacing={2}
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderLeft: 3,
                      borderColor: highlightedFields.includes(field) ? 'error.main' : 'transparent',
                      bgcolor: highlightedFields.includes(field) ? 'error.lighter' : 'transparent'
                    }}
                  >
                    <Typography color="text.secondary">{fieldLabel(field)}</Typography>
                    <Typography>{formatFieldValue(selectedOrder, field)}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                {intl.formatMessage({ id: 'reconciliation-detail-failures' })}
              </Typography>
              {isFailed(selectedOrder) ? (
                <List disablePadding>
                  {selectedOrder.failures.map((failure) => {
                    const key = failureKey(failure);
                    return (
                      <ListItemButton
                        key={key}
                        selected={key === selectedFailure}
                        onClick={() => setSelectedFailure(key === selectedFailure ? null : key)}
                      >
                        <ListItemText primary={failureMessage(selectedOrder, failure)} slotProps={{ primary: { color: 'error.dark' } }} />
                      </ListItemButton>
                    );
                  })}
                </List>
              ) : (
                <Typography color="text.secondary">{intl.formatMessage({ id: 'reconciliation-detail-no-failures' })}</Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={closeOrder}>{intl.formatMessage({ id: 'reconciliation-detail-close' })}</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Stack>
  );
}
