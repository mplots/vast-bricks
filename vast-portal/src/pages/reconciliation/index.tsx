import { FormEvent, useState } from 'react';

import { emphasize } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip, { ChipProps } from '@mui/material/Chip';
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
import { ReceiptAdd } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

// The invoice endpoint lives under the accounting namespace and is shared with the accounting screen.
import { generateInvoice } from 'api/accounting';
import { useGetReconciliationOrders } from 'api/reconciliation';
import Dot from 'components/@extended/Dot';
import hasTextSelection from 'utils/textSelection';
import MainCard from 'components/MainCard';
import type { ReconciliationFailure, ReconciliationFailureLevel, ReconciliationOrder } from 'types/reconciliation';

// Order property names, matching the backend ReconciliationOrderField enum.
const orderFields = [
  'source',
  'orderId',
  'orderDate',
  'buyer',
  'buyerUsername',
  'paymentMethod',
  'subTotal',
  'itemsSubTotal',
  'grandTotal',
  'invoiceSubTotal',
  'paidAmount'
] as const;
const amountFields: string[] = ['subTotal', 'itemsSubTotal', 'grandTotal', 'invoiceSubTotal', 'paidAmount'];
const dateFields: string[] = ['orderDate'];

// Fields shown as table columns; the detail view shows all of them.
const columnFields: string[] = ['source', 'orderId', 'orderDate', 'buyer', 'paymentMethod', 'grandTotal', 'paidAmount'];

const formatAmount = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `€${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatText = (value?: string | null) => value ?? '—';

// Dates arrive as ISO days and are shown the way the rest of the portal shows them.
const formatDate = (value?: string | null) => {
  if (!value) {
    return '—';
  }
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

const formatFieldValue = (order: ReconciliationOrder, field: string) => {
  const value = order[field as keyof ReconciliationOrder];
  if (amountFields.includes(field)) {
    return formatAmount(value as number | null);
  }
  return dateFields.includes(field) ? formatDate(value as string | null) : formatText(value as string | null);
};

// The levels a failure is shown at, quietest first. `silent` is absent: those failures are not shown at all.
const shownLevels = ['info', 'warning', 'error'] as const;

type ShownLevel = (typeof shownLevels)[number];

const shownFailures = (order: ReconciliationOrder) => order.failures.filter((failure) => failure.level !== 'silent');

// The loudest level the order is shown at, or null when it has nothing to show.
const orderLevel = (order: ReconciliationOrder): ShownLevel | null =>
  shownLevels.reduce<ShownLevel | null>(
    (loudest, level) => (order.failures.some((failure) => failure.level === level) ? level : loudest),
    null
  );

const failureKey = (failure: ReconciliationFailure) => `${failure.code}-${failure.fields.join('-')}`;

/** What the level filter can show or hide: a failure level, or an order with nothing to show. */
type FilterLevel = ShownLevel | 'none';

// Loudest first, which is the order the chips read in and the order that matters when scanning.
const filterLevels: FilterLevel[] = ['error', 'warning', 'info', 'none'];

/** The chip colour and the row tint for a level; a reconciled order reads green, as its dot always has. */
const levelColor = (level: FilterLevel) => (level === 'none' ? 'success' : level);

// Each marketplace keeps its own chip color, as the accounting screen colors it.
const sourceColor = (source: string): ChipProps['color'] => (source === 'BrickOwl' ? 'secondary' : 'primary');

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
  // Errors and warnings by default: those are the rows the screen is opened to find.
  const [tintedLevels, setTintedLevels] = useState<FilterLevel[]>(['error', 'warning']);
  const { reconciliationOrders, reconciliationOrdersError, reconciliationOrdersLoading, reloadReconciliationOrders } =
    useGetReconciliationOrders(requestedMonth);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Asking for the month already shown asks for it again: the orders are reconciled against providers that keep
    // moving, so the button collects them anew rather than showing what the last click found.
    if (selectedMonth === requestedMonth) {
      reloadReconciliationOrders();
      return;
    }
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
    // Select the first shown failure so the highlighted fields are visible without a click.
    const [first] = shownFailures(order);
    setSelectedFailure(first ? failureKey(first) : null);
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

  const highlighted = selectedOrder?.failures.find((failure) => failureKey(failure) === selectedFailure);
  const highlightedFields = highlighted?.fields ?? [];
  const highlightLevel = (highlighted?.level ?? 'info') as ShownLevel;

  const levelLabel = (level: ReconciliationFailureLevel) => intl.formatMessage({ id: `reconciliation-level-${level}` });

  // The dot in the action cell states the order's loudest level, and reads as reconciled when it has none.
  const dotLabel = (level: ShownLevel | null) => (level ? levelLabel(level) : intl.formatMessage({ id: 'reconciliation-level-none' }));

  // One chip per level, loudest first, counting the orders that level is the loudest one of. A level no order is at
  // has nothing to toggle, so its chip is left out.
  const levelCounts = filterLevels
    .map((level) => ({
      level,
      count: reconciliationOrders?.orders.filter((order) => (orderLevel(order) ?? 'none') === level).length ?? 0
    }))
    .filter(({ count }) => count > 0);

  // Every order stays in the table; a level's chip decides whether its rows are tinted, not whether they are there.
  const isLevelTinted = (level: FilterLevel) => tintedLevels.includes(level);

  const toggleLevel = (level: FilterLevel) =>
    setTintedLevels((current) => (current.includes(level) ? current.filter((tinted) => tinted !== level) : [...current, level]));

  /** The row's background colour, or null when its level is toggled off. */
  const rowTint = (level: FilterLevel) => (isLevelTinted(level) ? levelColor(level) : null);

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
              {/* Each count is also the switch for its level: filled tints those rows, outlined leaves them plain. */}
              {levelCounts.map(({ level, count }) => (
                <Chip
                  key={level}
                  clickable
                  label={intl.formatMessage({ id: `reconciliation-${level}-count` }, { count })}
                  color={levelColor(level)}
                  variant={isLevelTinted(level) ? 'filled' : 'outlined'}
                  onClick={() => toggleLevel(level)}
                  aria-pressed={isLevelTinted(level)}
                />
              ))}
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
                    <TableCell sx={{ width: 84 }}>{intl.formatMessage({ id: 'reconciliation-actions' })}</TableCell>
                    {columnFields.map((field) => (
                      <TableCell key={field} align={amountFields.includes(field) ? 'right' : 'left'}>
                        {fieldLabel(field)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reconciliationOrders.orders.map((order) => {
                    const tint = rowTint(orderLevel(order) ?? 'none');
                    return (
                      <TableRow
                        hover
                        key={orderKey(order)}
                        // Not when the click merely ended a text selection: copying a cell must not open the detail.
                        onClick={() => !hasTextSelection() && openOrder(order)}
                        sx={(theme) => ({
                          cursor: 'pointer',
                          // The row itself carries the verdict: a dot alone was too quiet to find a bad order by.
                          // Hover deepens that same colour rather than jumping to the next step of the ramp, which
                          // would swamp the text; `emphasize` darkens a light tint and lightens a dark one, so it
                          // reads the same way in both themes. It has to out-specify MUI's own
                          // `.MuiTableRow-hover:hover`, which would otherwise grey the row and lose the level.
                          ...(tint && {
                            bgcolor: theme.palette[tint].lighter,
                            '&&.MuiTableRow-hover:hover': { bgcolor: emphasize(theme.palette[tint].lighter, 0.08) }
                          })
                        })}
                      >
                        {/* The row opens the detail dialog, so the action cell must not bubble its click. */}
                        <TableCell sx={{ width: 84, whiteSpace: 'nowrap' }} onClick={(event) => event.stopPropagation()}>
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            {/* The level is named as well as colored, so the dot does not carry it by color alone. */}
                            <Tooltip title={dotLabel(orderLevel(order))} arrow>
                              <Box component="span" role="img" aria-label={dotLabel(orderLevel(order))} sx={{ display: 'flex' }}>
                                <Dot size={8} color={orderLevel(order) ?? 'success'} />
                              </Box>
                            </Tooltip>
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
                          </Stack>
                        </TableCell>
                        {columnFields.map((field) => (
                          <TableCell
                            key={field}
                            align={amountFields.includes(field) ? 'right' : 'left'}
                            sx={dateFields.includes(field) ? { whiteSpace: 'nowrap' } : undefined}
                          >
                            {field === 'source' ? (
                              <Chip label={order.source} size="small" color={sourceColor(order.source)} variant="outlined" />
                            ) : (
                              formatFieldValue(order, field)
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
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
                      borderColor: highlightedFields.includes(field) ? `${highlightLevel}.main` : 'transparent',
                      bgcolor: highlightedFields.includes(field) ? `${highlightLevel}.lighter` : 'transparent'
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
              {shownFailures(selectedOrder).length ? (
                <List disablePadding>
                  {shownFailures(selectedOrder).map((failure) => {
                    const key = failureKey(failure);
                    const level = failure.level as ShownLevel;
                    return (
                      <ListItemButton
                        key={key}
                        selected={key === selectedFailure}
                        onClick={() => setSelectedFailure(key === selectedFailure ? null : key)}
                      >
                        <ListItemText
                          primary={failureMessage(selectedOrder, failure)}
                          slotProps={{ primary: { color: `${level}.dark` } }}
                        />
                        {/* The level is named as well as colored, so it does not rely on color alone. */}
                        <Chip label={levelLabel(level)} size="small" color={level} variant="outlined" sx={{ ml: 1 }} />
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
