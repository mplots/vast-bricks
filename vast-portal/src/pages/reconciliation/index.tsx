import { FormEvent, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { useGetReconciliationOrders } from 'api/reconciliation';
import MainCard from 'components/MainCard';
import type { ReconciliationOrder } from 'types/reconciliation';

const formatAmount = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `€${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatText = (value?: string | null) => value ?? '—';

// Every collected field, including the ones the table does not show as a column.
const detailFields = (order: ReconciliationOrder): Array<[string, string]> => [
  ['Source', formatText(order.source)],
  ['Order ID', formatText(order.orderId)],
  ['Buyer', formatText(order.buyer)],
  ['Buyer username', formatText(order.buyerUsername)],
  ['Sub-total', formatAmount(order.subTotal)],
  ['Items sub-total', formatAmount(order.itemsSubTotal)]
];

const isFailed = (order: ReconciliationOrder) => order.failures.length > 0;

const previousMonth = () => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export default function ReconciliationPage() {
  const initialMonth = previousMonth();
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [requestedMonth, setRequestedMonth] = useState(initialMonth);
  const [selectedOrder, setSelectedOrder] = useState<ReconciliationOrder | null>(null);
  const { reconciliationOrders, reconciliationOrdersError, reconciliationOrdersLoading } = useGetReconciliationOrders(requestedMonth);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestedMonth(selectedMonth);
  };

  const failedCount = reconciliationOrders?.orders.filter(isFailed).length ?? 0;

  return (
    <Stack spacing={3}>
      <MainCard title="Reconciliation" contentSX={{ p: { xs: 2, sm: 3 } }}>
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
          {reconciliationOrders && (
            <Stack direction="row" spacing={1} sx={{ alignSelf: { sm: 'center' }, ml: { sm: 'auto !important' } }}>
              <Chip
                label={`${reconciliationOrders.orders.length} ${reconciliationOrders.orders.length === 1 ? 'order' : 'orders'}`}
                variant="outlined"
              />
              {failedCount > 0 && <Chip label={`${failedCount} failed`} color="error" variant="outlined" />}
            </Stack>
          )}
        </Stack>
      </MainCard>

      {reconciliationOrdersLoading && <Skeleton variant="rounded" height={320} />}

      {reconciliationOrdersError && (
        <Alert severity="error">{reconciliationOrdersError.message || 'Failed to load reconciliation orders.'}</Alert>
      )}

      {!reconciliationOrdersLoading && !reconciliationOrdersError && reconciliationOrders && (
        <MainCard content={false}>
          {reconciliationOrders.orders.length ? (
            <TableContainer>
              <Table stickyHeader size="small" aria-label="Reconciliation orders">
                <TableHead>
                  <TableRow>
                    <TableCell>Source</TableCell>
                    <TableCell>Order ID</TableCell>
                    <TableCell>Buyer</TableCell>
                    <TableCell>Buyer username</TableCell>
                    <TableCell align="right">Sub-total</TableCell>
                    <TableCell align="right">Items sub-total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reconciliationOrders.orders.map((order) => (
                    <TableRow
                      hover
                      key={`${order.source}-${order.orderId}`}
                      onClick={() => setSelectedOrder(order)}
                      sx={{
                        cursor: 'pointer',
                        ...(isFailed(order) && { bgcolor: 'error.lighter', '& td': { color: 'error.dark' } })
                      }}
                    >
                      <TableCell>
                        <Chip label={order.source} size="small" color={isFailed(order) ? 'error' : 'primary'} variant="outlined" />
                      </TableCell>
                      <TableCell>{order.orderId}</TableCell>
                      <TableCell>{order.buyer}</TableCell>
                      <TableCell>{formatText(order.buyerUsername)}</TableCell>
                      <TableCell align="right">{formatAmount(order.subTotal)}</TableCell>
                      <TableCell align="right">{formatAmount(order.itemsSubTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">No orders found for this month.</Typography>
            </Box>
          )}
        </MainCard>
      )}

      <Dialog open={Boolean(selectedOrder)} onClose={() => setSelectedOrder(null)} fullWidth maxWidth="sm">
        {selectedOrder && (
          <>
            <DialogTitle>
              {selectedOrder.source} order #{selectedOrder.orderId}
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={1}>
                {detailFields(selectedOrder).map(([label, value]) => (
                  <Stack key={label} direction="row" justifyContent="space-between" spacing={2}>
                    <Typography color="text.secondary">{label}</Typography>
                    <Typography>{value}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom>
                Failed reconciliation
              </Typography>
              {isFailed(selectedOrder) ? (
                <Stack spacing={1}>
                  {selectedOrder.failures.map((failure) => (
                    <Alert key={failure.rule} severity="error" variant="outlined">
                      {failure.message}
                    </Alert>
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary">No reconciliation failures.</Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedOrder(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Stack>
  );
}
