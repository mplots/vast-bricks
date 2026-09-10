import { useDeferredValue, useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { FilterSearch, Refresh, SearchNormal1 } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { useGetPayPalTransactions } from 'api/payPalTransactions';
import Highlighted from 'components/Highlighted';
import IconButton from 'components/@extended/IconButton';
import MainCard from 'components/MainCard';
import { PanelMain } from 'components/SidePanel';
import TableSummaryFooter, { type SummaryLine } from 'components/TableSummaryFooter';
import TableTextField from 'components/TableTextField';
import ledgerTableSx from 'components/ledgerTable';
import PeriodHeaderPicker from 'components/period/PeriodHeaderPicker';
import toolButtonSx from 'components/toolButton';
import useConfig from 'hooks/useConfig';
import PayPalTransactionDetail from 'sections/paypal-transactions/PayPalTransactionDetail';
import PayPalTransactionFilterDrawer from 'sections/paypal-transactions/PayPalTransactionFilterDrawer';
import { transactionNarrowable, transactionSearchColumns } from 'sections/paypal-transactions/narrowing';
import { formatAmount, numericCell, signedAmount as signed } from 'utils/amount';
import { currentMonth } from 'utils/month';
import { noNarrowing, shownRows, termsFor, toggled, type Narrowing } from 'utils/narrowing';
import { wordedOr } from 'utils/wording';
import type { PayPalTransaction, PayPalTransactionCurrencySummary } from 'types/payPalTransaction';

/**
 * The table's columns and the share of the table each of them takes, so the summary under it knows which of them the
 * amount stands in and every column keeps its place.
 *
 * <p>The widths are stated for the reason the two ledger screens beside this one state theirs: a column measured
 * from its own content moves whenever the content does — the search row opening under the headings, a period stepped
 * to whose amounts are a digit longer, a month widened to its year — and a reader who has just found the transaction
 * they were looking for should not have the table shift under them to say so.
 *
 * <p>They are laid out the way the ledger reads: who the money moved between and what it was for, then the three
 * amounts in the order PayPal subtracts them — what it took, what it kept, what was left — so the arithmetic reads
 * across the row. The counterparty is where a bank statement puts it and where a PayPal ledger wants it: PayPal
 * names a person on nearly every transaction, which is more than Stripe does.
 */
const columns = [
  { key: 'date', width: '8%' },
  { key: 'type', width: '9%' },
  { key: 'counterparty', width: '17%' },
  { key: 'description', width: '16%' },
  { key: 'amount', width: '12%' },
  { key: 'fee', width: '9%' },
  { key: 'net', width: '11%' },
  { key: 'status', width: '7%' },
  { key: 'reference', width: '11%' }
] as const;
const amountColumn = columns.findIndex((column) => column.key === 'amount');

/**
 * The day PayPal dated a transaction, as `dd.mm.yyyy`, read in UTC.
 *
 * <p>UTC because that is the zone the period was asked for in: the window a month is fetched as is a UTC window, so
 * a transaction shown in the reader's own zone could read as falling outside the month it was collected for.
 */
const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const [date] = value.split('T');
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

/** The time of day beside it, to the minute: two transactions of one day are read in the order they happened. */
const formatTime = (value?: string | null) => {
  if (!value) return null;
  const time = value.split('T')[1];
  return time ? time.slice(0, 5) : null;
};

/** An amount with its currency, or an em dash where PayPal stated none. */
const withCurrency = (amount: number | null, currency: string | null) =>
  amount === null || amount === undefined ? '—' : `${formatAmount(amount)}${currency ? ` ${currency}` : ''}`;

/**
 * The four lines a currency is accounted for in, in the order a ledger states them.
 *
 * <p>They are the bank statement's, with a memo under the debits saying how much of them were fees. The
 * turnovers are every movement of the account, the fees deducted inside a transaction included: a fee is not a
 * transaction of this ledger, but it is money that left the account, and a bank charging the same fee would book it
 * as an entry of its own. So a fee line sits under the turnover it is part of rather than between the turnovers and
 * the sum, where it would read as a second subtraction.
 *
 * <p>The Stripe ledger's foot says the same things in the same order, the two being read against each other and
 * against the bank statement's.
 *
 * <p>The fee memo keeps the sign it came with rather than always reading as a deduction. PayPal states a fee as an
 * amount of its own, and a period holding refunds can have given more of it back than it took.
 *
 * <p>The last line is what the balance moved by rather than a closing balance. PayPal knows the account's balance and
 * this screen does not ask for it: a balance is a fact about now, and the period being read is normally not now.
 */
const summaryLines = (currency: PayPalTransactionCurrencySummary, label: (id: string) => string): SummaryLine[] => {
  const suffix = currency.currency ? ` ${currency.currency}` : '';

  return [
    {
      key: `${currency.currency}:debit`,
      // The turnovers are reported unsigned, so the sign is put back here from what the line is, the way a row puts
      // it back from the transaction's direction. Debit first, as on the two screens beside this one: the feet are
      // read against each other, so they state the same figures in the same order.
      amount: `−${formatAmount(Math.abs(currency.debitTurnover))}${suffix}`,
      label: label('paypal-transaction-debit-turnover'),
      colour: 'error.main'
    },
    {
      // Part of the turnover above rather than a term of its own, so it stands under it and is set quieter than the
      // figures that do add up. One figure for everything that came off, whoever took it: which party took which
      // part of a transaction's cost is a detail of that transaction, stated where the rest of its account is, and
      // a foot is read for what a period came to.
      key: `${currency.currency}:fees`,
      amount: `${signed(currency.fees)}${suffix}`,
      label: label('paypal-transaction-fees'),
      colour: 'text.secondary'
    },
    {
      key: `${currency.currency}:credit`,
      amount: `+${formatAmount(Math.abs(currency.creditTurnover))}${suffix}`,
      label: label('paypal-transaction-credit-turnover'),
      colour: 'success.main'
    },
    {
      // What the two turnovers come to, so it is ruled off from them, and signed already: a period that gave back
      // more than it took is a fact about the period rather than a direction of movement.
      key: `${currency.currency}:net`,
      amount: `${formatAmount(currency.netMovement)}${suffix}`,
      label: label('paypal-transaction-net-movement'),
      sum: true
    },
    // And where the account stood when the period ended, which is a different question from what the period did: it
    // holds everything before the period as well. PayPal's own figure rather than one worked out, and a period it
    // did not answer for states none rather than a guess.
    ...(currency.closingBalance === null
      ? []
      : [
          {
            key: `${currency.currency}:balance`,
            amount: `${formatAmount(currency.closingBalance)}${suffix}`,
            label: label('paypal-transaction-closing-balance'),
            balance: true
          }
        ])
  ];
};

/**
 * One column's search field, sitting in the search row under the column it searches.
 *
 * <p>The same field the bank statement and Stripe transaction screens are searched in, labelled by the column it
 * searches rather than by a placeholder repeating the heading right above it. Escape empties it, which is the way
 * out of a search from inside it.
 */
function SearchField({ column, value, onChange }: { column: string; value: string; onChange: (query: string) => void }) {
  const intl = useIntl();

  return (
    <TableTextField
      value={value}
      placeholder={intl.formatMessage({ id: 'paypal-transaction-search-placeholder' })}
      ariaLabel={intl.formatMessage(
        { id: 'paypal-transaction-search-in' },
        { column: intl.formatMessage({ id: `paypal-transaction-${column}` }) }
      )}
      icon={<SearchNormal1 size={14} />}
      onChange={onChange}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onChange('');
      }}
    />
  );
}

/**
 * PayPal's own id for the transaction, with what it was raised against under it, and the link PayPal shows it at.
 *
 * <p>The link rides the reference rather than taking a column of its own, as the reconciliation and Stripe screens'
 * links ride the field naming what they open. Unlike Stripe's, it needs no account to be addressed under, so every
 * transaction PayPal reported has one.
 */
function ReferenceCell({ transaction, terms }: { transaction: PayPalTransaction; terms: string[] }) {
  const intl = useIntl();

  const reference = (
    <Typography variant="caption" color="text.secondary">
      <Highlighted text={transaction.id ?? '—'} terms={terms} />
    </Typography>
  );

  return (
    <TableCell>
      {transaction.link ? (
        <Link
          href={transaction.link}
          target="_blank"
          rel="noopener"
          // The row opens the transaction's own account, so a link out to PayPal stops its click reaching the row.
          onClick={(event) => event.stopPropagation()}
          aria-label={intl.formatMessage({ id: 'paypal-transaction-open-transaction' })}
        >
          {reference}
        </Link>
      ) : (
        reference
      )}
      {transaction.sourceId && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          <Highlighted text={transaction.sourceId} terms={terms} />
        </Typography>
      )}
    </TableCell>
  );
}

export default function PayPalTransactionsPage() {
  const intl = useIntl();
  // One string holds both what is being read and which view is reading it: `YYYY-MM` is a month, `YYYY` a year. The
  // screen opens on this month, which is the period a ledger is normally looked over.
  const [selectedPeriod, setSelectedPeriod] = useState(currentMonth());
  // Which transactions of the period are being read: what was ticked, and what was searched for. Held beside the
  // period, and for the same reason as on the screens beside this one: a ledger is read a period at a time in front
  // of the transactions rather than linked to, so what it is showing is state of its own.
  const [narrowing, setNarrowing] = useState<Narrowing>(noNarrowing);
  const { container } = useConfig();
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));
  // Room for it means it is open: the transactions are read against what they were narrowed to, so the panel showing
  // that is worth its width wherever there is width to spare.
  const [filtersOpen, setFiltersOpen] = useState(!downLG);
  // The search row is asked for rather than always there: most reading of a ledger is reading it, and a row of empty
  // fields under the headings would cost every reader a line of the table to say so.
  const [searchOpen, setSearchOpen] = useState(false);
  // The search row rests under the heading row, so it has to know how tall that row came out. Measured rather than
  // stated: a heading wraps onto a second line on a narrow screen.
  const [headingRow, setHeadingRow] = useState<HTMLTableRowElement | null>(null);
  const [headingHeight, setHeadingHeight] = useState(0);
  // The transaction whose own account is open. PayPal reported it as several records and the table states it as
  // one, so this is where it comes apart again.
  const [selected, setSelected] = useState<PayPalTransaction | null>(null);

  const {
    payPalTransactions,
    payPalTransactionSummary,
    payPalTransactionsError,
    payPalTransactionsLoading,
    payPalTransactionsRefreshing,
    reloadPayPalTransactions
  } = useGetPayPalTransactions(selectedPeriod);

  useEffect(() => {
    if (!headingRow) return;
    // The whole row rather than its content box: the row carries a border under it, and the search row resting a
    // border's width too high would leave the headings showing through above it.
    const observer = new ResizeObserver(() => setHeadingHeight(headingRow.offsetHeight));
    observer.observe(headingRow);
    return () => observer.disconnect();
  }, [headingRow]);

  const collected = payPalTransactions ?? [];
  // A year of transactions is filtered again at every keystroke of a search. The field itself answers the key at
  // once and the table catches up a render later, so typing never waits on the period however long it is.
  const settled = useDeferredValue(narrowing);
  const shown = shownRows(collected, transactionNarrowable, settled);
  // Marked from the narrowing the transactions were filtered by rather than from what is in the fields this moment,
  // so a cell never marks a word that is not why its row is here.
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
   * What is being read: the way into the panel that narrows it, the way into the search row, the period itself, and
   * how much of the period the narrowing left on screen.
   */
  const periodTitle = (
    <Stack component="span" direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Only while the panel is away: open, the panel is its own close button. */}
      {!filtersOpen && (
        <Tooltip title={intl.formatMessage({ id: 'paypal-transaction-filters' })} arrow>
          <IconButton
            variant="light"
            color="secondary"
            aria-label={intl.formatMessage({ id: 'paypal-transaction-filters' })}
            onClick={() => setFiltersOpen(true)}
            sx={toolButtonSx}
          >
            <FilterSearch size={18} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={intl.formatMessage({ id: searchOpen ? 'paypal-transaction-search-hide' : 'paypal-transaction-search' })} arrow>
        <IconButton
          variant={searchOpen ? 'contained' : 'light'}
          color={searchOpen ? 'primary' : 'secondary'}
          aria-pressed={searchOpen}
          aria-label={intl.formatMessage({ id: searchOpen ? 'paypal-transaction-search-hide' : 'paypal-transaction-search' })}
          onClick={toggleSearch}
          sx={searchOpen ? undefined : toolButtonSx}
        >
          <SearchNormal1 size={18} />
        </IconButton>
      </Tooltip>
      <PeriodHeaderPicker value={selectedPeriod} onChange={setSelectedPeriod} />
      {/* Only once a period has been read: until then there is nothing to have shown a part of. */}
      {payPalTransactions && (
        <Typography component="span" variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
          {intl.formatMessage({ id: 'paypal-transaction-filter-showing' }, { shown: shown.length, total: collected.length })}
        </Typography>
      )}
    </Stack>
  );

  const actions = (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
      {/* Nothing is stored, so this asks PayPal for the period again. It is its icon alone, saying what it is in its
          tooltip and its label, and refuses a second click until the first has answered. */}
      <Tooltip title={intl.formatMessage({ id: 'paypal-transaction-refresh' })} arrow>
        <span>
          <IconButton
            variant="light"
            color="secondary"
            disabled={payPalTransactionsRefreshing}
            aria-label={intl.formatMessage({ id: 'paypal-transaction-refresh' })}
            onClick={() => reloadPayPalTransactions()}
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
        <PayPalTransactionFilterDrawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          transactions={collected}
          narrowing={narrowing}
          onToggle={toggleFilter}
          onClear={clearFilters}
        />

        <PanelMain open={filtersOpen} container={container}>
          <Stack sx={{ gap: 3, mt: 2.5 }}>
            <MainCard
              content={false}
              title={periodTitle}
              secondary={actions}
              // Nothing between the table and the page may clip, the stuck head and foot being the reason: a
              // scrolling ancestor would catch them and hold them inside the card.
              sx={{ overflow: 'visible' }}
            >
              {payPalTransactionsLoading && <Skeleton variant="rounded" height={320} sx={{ m: 2.5 }} />}

              {payPalTransactionsError && (
                <Alert severity="error" sx={{ m: 2.5 }}>
                  {payPalTransactionsError.message || intl.formatMessage({ id: 'paypal-transaction-load-error' })}
                </Alert>
              )}

              {!payPalTransactionsLoading &&
                !payPalTransactionsError &&
                payPalTransactions &&
                (collected.length ? (
                  <TableContainer sx={{ overflow: 'visible' }}>
                    <Table
                      stickyHeader
                      size="small"
                      aria-label={intl.formatMessage({ id: 'paypal-transaction-table' })}
                      sx={ledgerTableSx(headingHeight, 1200)}
                    >
                      <colgroup>
                        {columns.map((column) => (
                          <col key={column.key} style={{ width: column.width }} />
                        ))}
                      </colgroup>
                      <TableHead>
                        <TableRow ref={setHeadingRow}>
                          {columns.map((column) => (
                            <TableCell key={column.key} sx={['amount', 'fee', 'net'].includes(column.key) ? numericCell : undefined}>
                              {intl.formatMessage({ id: `paypal-transaction-${column.key}` })}
                            </TableCell>
                          ))}
                        </TableRow>
                        {/* One field per column that can be searched, under the column it searches. A column with
                            nothing to search keeps its cell so the row stays in step with the table. */}
                        {searchOpen && (
                          <TableRow>
                            {columns.map((column) => {
                              const searchable = transactionSearchColumns.some((searched) => searched.column === column.key);
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
                            take away the fields the reader has to reach to get their transactions back. */}
                        {shown.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={columns.length} sx={{ py: 6, textAlign: 'center' }}>
                              <Typography color="text.secondary">
                                {intl.formatMessage({ id: 'paypal-transaction-filtered-empty' })}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                        {shown.map((transaction) => (
                          // Selecting a transaction opens what PayPal reported it as: the lines its gross was made
                          // up of, what came off it, and the records PayPal raised against it. The table states the
                          // transaction; this is where it comes apart again.
                          <TableRow key={transaction.id} hover onClick={() => setSelected(transaction)} sx={{ cursor: 'pointer' }}>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <Typography variant="body2">{formatDate(transaction.created)}</Typography>
                              {formatTime(transaction.created) && (
                                <Typography variant="caption" color="text.secondary">
                                  {formatTime(transaction.created)}
                                </Typography>
                              )}
                            </TableCell>
                            {/* PayPal states an event code rather than a word, so the codes a merchant account meets
                                are worded here and the rest read as the code itself. */}
                            <TableCell>
                              {transaction.type ? wordedOr(intl, `paypal-transaction-event-${transaction.type}`, transaction.type) : '—'}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                <Highlighted text={transaction.counterparty || '—'} terms={termsOf('counterparty')} />
                              </Typography>
                              {transaction.counterpartyEmail && (
                                <Typography variant="caption" color="text.secondary">
                                  <Highlighted text={transaction.counterpartyEmail} terms={termsOf('counterparty')} />
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                <Highlighted text={transaction.description || '—'} terms={termsOf('description')} />
                              </Typography>
                              {/* What the marketplace labelled the payment with, which for BrickOwl is the order
                                  number a reader is normally looking the transaction up by. */}
                              {transaction.invoiceId && (
                                <Typography variant="caption" color="text.secondary">
                                  <Highlighted text={transaction.invoiceId} terms={termsOf('description')} />
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ ...numericCell, color: transaction.direction === 'CREDIT' ? 'success.main' : 'error.main' }}>
                              {/* The amount is reported unsigned, the way a bank states an entry, so the sign is put
                                  back here from the direction rather than the column reading the same both ways. */}
                              {transaction.direction === 'CREDIT' ? '+' : '−'}
                              {withCurrency(transaction.amount, transaction.currency)}
                            </TableCell>
                            {/* Everything that came off the transaction, whoever took it: PayPal's own processing fee
                                and the commission the marketplace took as partner are both money out of it, and one
                                figure is what a reader of the ledger wants. What it was made of is in the detail
                                view, laid out the way PayPal's own panel lays it out. Nothing deducted is no fee
                                rather than a zero, and the sign is PayPal's own. */}
                            <TableCell sx={{ ...numericCell, color: 'text.secondary' }}>
                              {transaction.fee === null ? '—' : signed(transaction.fee)}
                            </TableCell>
                            <TableCell sx={numericCell}>{withCurrency(transaction.net, transaction.currency)}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {transaction.status
                                ? wordedOr(intl, `paypal-transaction-status-${transaction.status}`, transaction.status)
                                : '—'}
                            </TableCell>
                            <ReferenceCell transaction={transaction} terms={termsOf('reference')} />
                          </TableRow>
                        ))}
                      </TableBody>
                      {/* Under the transactions it is the account of. It is the period's own account and not the
                          narrowed one: the turnovers are what the period came to whichever way the transactions were
                          narrowed. The amount column is found by name rather than counted out here, so a column
                          moved or added does not silently slide the totals into the wrong one. */}
                      {payPalTransactionSummary && payPalTransactionSummary.length > 0 && (
                        <TableSummaryFooter
                          lines={payPalTransactionSummary.flatMap((currency) => summaryLines(currency, (id) => intl.formatMessage({ id })))}
                          before={amountColumn}
                          after={columns.length - amountColumn - 1}
                        />
                      )}
                    </Table>
                  </TableContainer>
                ) : (
                  <Box sx={{ p: 6, textAlign: 'center' }}>
                    <Typography color="text.secondary">{intl.formatMessage({ id: 'paypal-transaction-empty' })}</Typography>
                  </Box>
                ))}
            </MainCard>
          </Stack>
        </PanelMain>
      </Box>

      <PayPalTransactionDetail transaction={selected} onClose={() => setSelected(null)} />
    </Stack>
  );
}
