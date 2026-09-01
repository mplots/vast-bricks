import { FormEvent, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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

const formatAmount = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `€${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

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
  const { reconciliationOrders, reconciliationOrdersError, reconciliationOrdersLoading } = useGetReconciliationOrders(requestedMonth);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestedMonth(selectedMonth);
  };

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
            <Chip
              label={`${reconciliationOrders.orders.length} ${reconciliationOrders.orders.length === 1 ? 'order' : 'orders'}`}
              variant="outlined"
              sx={{ alignSelf: { sm: 'center' }, ml: { sm: 'auto !important' } }}
            />
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
                    <TableRow hover key={`${order.source}-${order.orderId}`}>
                      <TableCell>
                        <Chip label={order.source} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>{order.orderId}</TableCell>
                      <TableCell>{order.buyer}</TableCell>
                      <TableCell>{order.buyerUsername ?? '—'}</TableCell>
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
    </Stack>
  );
}
