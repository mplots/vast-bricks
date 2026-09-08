import type { ReactNode } from 'react';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useIntl, type IntlShape } from 'react-intl';

import { formatAmount } from 'utils/amount';
import { wordedOr } from 'utils/wording';
import type { PayPalTransaction, PayPalTransactionLine } from 'types/payPalTransaction';

/**
 * One transaction as PayPal reports it, opened from the ledger.
 *
 * <p>The table states the transaction — what it was, who it was with, what it came to — because that is what a
 * period is read for. Everything PayPal reported it as lives here: the lines its gross was made up of, what came off
 * it, and the records PayPal raised against it. It is laid out the way PayPal's own transaction page is, so a reader
 * holding the two side by side is reading one thing twice rather than two things.
 *
 * <p>Read-only, as the ledger is: nothing here is stored, so there is nothing to edit.
 */
export interface PayPalTransactionDetailProps {
  transaction: PayPalTransaction | null;
  onClose: () => void;
}

/** PayPal's event code as a word, or as the code itself where the catalog has no word for it. */
const typeWord = (intl: IntlShape, type: string | null) => (type ? wordedOr(intl, `paypal-transaction-event-${type}`, type) : '—');

/**
 * The same, with PayPal's own code after it.
 *
 * <p>The table shows the word alone, which is what a period is read by. Here the code is worth the room: it is what
 * PayPal names the transaction by, so a reader holding this against PayPal has the thing to match on, and two codes
 * this catalog words alike are still told apart. A code with no word for it is left as itself rather than repeated.
 */
const typeDetail = (intl: IntlShape, type: string | null) => {
  if (!type) return '—';
  const word = typeWord(intl, type);
  return word === type ? word : `${word} (${type})`;
};

/** A figure with its currency, signed as it came: an account's lines carry their own signs. */
const money = (amount: number | null | undefined, currency: string | null) =>
  amount === null || amount === undefined ? '—' : `${formatAmount(amount)}${currency ? ` ${currency}` : ''}`;

/** The day and time PayPal dated something, read in UTC, which is the zone the period is read in. */
const formatMoment = (value: string | null) => {
  if (!value) return '—';
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-');
  const stated = year && month && day ? `${day}.${month}.${year}` : value;
  return time ? `${stated} ${time.slice(0, 5)}` : stated;
};

/** One label and what it says, the way the reconciliation detail states a field. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ px: 1, py: 0.5 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography sx={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{children}</Typography>
    </Stack>
  );
}

/**
 * One line of the amount account, the way a statement lays one out: what it is on the left, the figure on the right.
 *
 * <p>A line PayPal stated nothing for is left out rather than shown at nought — an insurance amount of zero down
 * every transaction says nothing a reader needs — except the gross and the net, which every transaction has and
 * which the lines between them add up from and to.
 */
function AmountLine({ label, amount, currency, sum }: { label: string; amount: number | null; currency: string | null; sum?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ px: 1, py: 0.5 }}>
      <Typography color={sum ? 'text.primary' : 'text.secondary'} sx={{ fontWeight: sum ? 600 : undefined }}>
        {label}
      </Typography>
      <Typography sx={{ whiteSpace: 'nowrap', fontWeight: sum ? 600 : undefined }}>{money(amount, currency)}</Typography>
    </Stack>
  );
}

export default function PayPalTransactionDetail({ transaction, onClose }: PayPalTransactionDetailProps) {
  // Mounted whether or not one is open, as the reconciliation detail is, so the dialog closes by animating away
  // rather than by vanishing with the transaction it was showing.
  return (
    <Dialog open={Boolean(transaction)} onClose={onClose} fullWidth maxWidth="sm">
      {transaction && <Detail transaction={transaction} onClose={onClose} />}
    </Dialog>
  );
}

function Detail({ transaction, onClose }: { transaction: PayPalTransaction; onClose: () => void }) {
  const intl = useIntl();
  const message = (id: string) => intl.formatMessage({ id });

  const breakdown = transaction.breakdown;
  // PayPal's own panel stays in PayPal's own currency. Where PayPal converted the transaction, the table states it
  // in what it was converted into, and a panel of lines labelled with that currency would be stating the wrong one.
  const currency = breakdown?.currency ?? transaction.currency;

  const lineWord = (line: PayPalTransactionLine) => (line.type ? wordedOr(intl, `paypal-transaction-event-${line.type}`, line.type) : '—');

  // Read off the two currencies rather than off the conversion line, because a transaction PayPal reported only one
  // leg of is converted all the same: it has no line to state, and the account still has to end where the money did.
  const converted = Boolean(breakdown?.currency) && breakdown?.currency !== transaction.currency;
  // Only what the account above has no line for. Nearly every record PayPal raises against a transaction is either
  // a deduction it names or a leg of the conversion it ends on, so listing them again would say the same thing
  // twice; anything else PayPal raised is still reported, so it can still be read.
  const unaccounted = transaction.lines.filter((line) => !line.accountedFor);

  return (
    <>
      <DialogTitle>
        {transaction.counterparty
          ? intl.formatMessage(
              { id: 'paypal-transaction-detail-title-with' },
              { type: typeWord(intl, transaction.type), counterparty: transaction.counterparty }
            )
          : typeWord(intl, transaction.type)}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle1">{message('paypal-transaction-detail-transaction')}</Typography>
            <Divider />
            <Field label={message('paypal-transaction-date')}>{formatMoment(transaction.created)}</Field>
            {/* PayPal's own code beside the word for it, so a reader checking this against PayPal has the thing
                PayPal names it by, and two codes that word alike are still told apart. */}
            <Field label={message('paypal-transaction-type')}>{typeDetail(intl, transaction.type)}</Field>
            <Field label={message('paypal-transaction-status')}>
              {transaction.status ? wordedOr(intl, `paypal-transaction-status-${transaction.status}`, transaction.status) : '—'}
            </Field>
            <Field label={message('paypal-transaction-reference')}>
              {transaction.link ? (
                <Link href={transaction.link} target="_blank" rel="noopener" aria-label={message('paypal-transaction-open-transaction')}>
                  {transaction.id ?? '—'}
                </Link>
              ) : (
                (transaction.id ?? '—')
              )}
            </Field>
            {transaction.invoiceId && <Field label={message('paypal-transaction-invoice')}>{transaction.invoiceId}</Field>}
            {transaction.description && <Field label={message('paypal-transaction-description')}>{transaction.description}</Field>}
            {transaction.counterparty && <Field label={message('paypal-transaction-counterparty')}>{transaction.counterparty}</Field>}
            {transaction.counterpartyEmail && (
              <Field label={message('paypal-transaction-counterparty-account')}>{transaction.counterpartyEmail}</Field>
            )}
          </Stack>

          {/* PayPal's own amount details, in PayPal's own order: what was bought, what was added to it, what it came
              to gross, what came off it, and what was left. */}
          <Stack spacing={0.5}>
            <Typography variant="subtitle1">{message('paypal-transaction-detail-amounts')}</Typography>
            <Divider />
            {breakdown?.purchaseTotal !== null && breakdown?.purchaseTotal !== undefined && (
              <AmountLine label={message('paypal-transaction-purchase-total')} amount={breakdown.purchaseTotal} currency={currency} />
            )}
            {breakdown?.salesTax !== null && breakdown?.salesTax !== undefined && (
              <AmountLine label={message('paypal-transaction-sales-tax')} amount={breakdown.salesTax} currency={currency} />
            )}
            {breakdown?.shipping !== null && breakdown?.shipping !== undefined && (
              <AmountLine label={message('paypal-transaction-shipping')} amount={breakdown.shipping} currency={currency} />
            )}
            {breakdown?.handling !== null && breakdown?.handling !== undefined && (
              <AmountLine label={message('paypal-transaction-handling')} amount={breakdown.handling} currency={currency} />
            )}
            {breakdown?.insurance !== null && breakdown?.insurance !== undefined && (
              <AmountLine label={message('paypal-transaction-insurance')} amount={breakdown.insurance} currency={currency} />
            )}
            {breakdown?.discount !== null && breakdown?.discount !== undefined && (
              <AmountLine label={message('paypal-transaction-discount')} amount={breakdown.discount} currency={currency} />
            )}
            {breakdown?.shippingDiscount !== null && breakdown?.shippingDiscount !== undefined && (
              <AmountLine label={message('paypal-transaction-shipping-discount')} amount={breakdown.shippingDiscount} currency={currency} />
            )}
            <Divider />
            <AmountLine label={message('paypal-transaction-gross')} amount={breakdown?.gross ?? null} currency={currency} />
            {breakdown?.payPalFee !== null && breakdown?.payPalFee !== undefined && (
              <AmountLine label={message('paypal-transaction-paypal-fee')} amount={breakdown.payPalFee} currency={currency} />
            )}
            {/* The commission the marketplace took as partner. It is a record of its own in PayPal's API and a line
                of this transaction in PayPal's interface, and it is the fee column's other half in the table. */}
            {breakdown?.partnerCommission !== null && breakdown?.partnerCommission !== undefined && (
              <AmountLine
                label={message('paypal-transaction-partner-commission')}
                amount={breakdown.partnerCommission}
                currency={currency}
              />
            )}
            {breakdown?.disputeFee !== null && breakdown?.disputeFee !== undefined && (
              <AmountLine label={message('paypal-transaction-dispute-fee')} amount={breakdown.disputeFee} currency={currency} />
            )}
            <Divider />
            <AmountLine
              label={message('paypal-transaction-net-amount')}
              amount={breakdown?.net ?? null}
              currency={currency}
              sum={!converted}
            />
            {/* Where PayPal converted the transaction, the account does not stop at a net in a currency it never
                held: the conversion takes that net back out, and what it came to in the currency the account moved
                in is the line the panel ends on — which is the figure the table states. */}
            {converted && (
              <>
                {breakdown?.conversion !== null && breakdown?.conversion !== undefined && (
                  <AmountLine label={message('paypal-transaction-conversion')} amount={breakdown.conversion} currency={currency} />
                )}
                <AmountLine
                  label={message('paypal-transaction-converted-amount')}
                  amount={transaction.net}
                  currency={transaction.currency}
                  sum
                />
              </>
            )}
          </Stack>

          {/* Whatever PayPal raised against this transaction that the account above has no line for, so nothing
              PayPal reported is out of the reader's reach. */}
          {unaccounted.length > 0 && (
            <Stack spacing={0.5}>
              <Typography variant="subtitle1">{message('paypal-transaction-detail-lines')}</Typography>
              <Divider />
              {unaccounted.map((line) => (
                <Stack key={line.id} direction="row" justifyContent="space-between" spacing={2} sx={{ px: 1, py: 0.5 }}>
                  <Stack>
                    <Typography>
                      {line.link ? (
                        <Link href={line.link} target="_blank" rel="noopener" aria-label={message('paypal-transaction-open-transaction')}>
                          {lineWord(line)}
                        </Link>
                      ) : (
                        lineWord(line)
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatMoment(line.created)}
                    </Typography>
                  </Stack>
                  <Typography sx={{ whiteSpace: 'nowrap' }}>{money(line.amount, line.currency)}</Typography>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{message('paypal-transaction-detail-close')}</Button>
      </DialogActions>
    </>
  );
}
