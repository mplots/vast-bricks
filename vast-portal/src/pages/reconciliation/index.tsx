import { useEffect, useRef, useState, type ReactNode } from 'react';

import { emphasize, styled } from '@mui/material/styles';
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
import useMediaQuery from '@mui/material/useMediaQuery';
import { FilterSearch, ReceiptAdd, Refresh } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

// The invoice endpoint lives under the accounting namespace and is shared with the accounting screen.
import { generateInvoice } from 'api/accounting';
import { useGetReconciliationOrders } from 'api/reconciliation';
import hasTextSelection from 'utils/textSelection';
import IconButton from 'components/@extended/IconButton';
import FilterFacets, { type FilterFacet, type FilterSelection } from 'components/FilterFacets';
import MainCard from 'components/MainCard';
import OrderTaxTypeIcon from 'components/OrderTaxTypeIcon';
import ReconciliationFilterDrawer from 'sections/reconciliation/ReconciliationFilterDrawer';
import useConfig from 'hooks/useConfig';
import { HEADER_HEIGHT } from 'config';
import type { ReconciliationFailure, ReconciliationFailureLevel, ReconciliationOrder } from 'types/reconciliation';
import { orderTaxTypes, type OrderTaxType } from 'types/tax';

// Order property names, matching the backend ReconciliationOrderField enum.
const orderFields = [
  'source',
  'orderId',
  'orderDate',
  'buyer',
  'buyerUsername',
  'paymentMethod',
  'taxType',
  'subTotal',
  'itemsSubTotal',
  'grandTotal',
  'invoiceSubTotal',
  'paidAmount'
] as const;
const amountFields: string[] = ['subTotal', 'itemsSubTotal', 'grandTotal', 'invoiceSubTotal', 'paidAmount'];
const dateFields: string[] = ['orderDate'];

// Fields shown as table columns; the detail view shows all of them.
// The tax type is absent: it rides in the actions cell as an icon rather than spending a column on a word.
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

/**
 * One thing the collected orders can be filtered by. A facet says how an order answers it and how that answer reads;
 * everything else — the options, their counts, the narrowing — follows from that, so another filter is another entry
 * in the list rather than another branch anywhere.
 */
type OrderFacet = {
  key: string;
  /** The order's answer, or null when it stated none. */
  valueOf: (order: ReconciliationOrder) => string | null;
  /** How the answer reads. A value the marketplaces word themselves is already its own label. */
  label: (value: string) => string;
  /** Values in the order their options read, ahead of any value not named here. */
  declared?: readonly string[];
  icon?: (value: string) => ReactNode;
  color?: (value: string) => ChipProps['color'];
};

/**
 * The option standing for an order that answered a facet with nothing. It is prefixed with a character no provider
 * sends, so it cannot collide with a value one of them does.
 */
const unstated = '\u0000unstated';

// Each marketplace keeps its own chip color, as the accounting screen colors it.
const sourceColor = (source: string): ChipProps['color'] => (source === 'BrickOwl' ? 'secondary' : 'primary');

const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const orderKey = (order: ReconciliationOrder) => `${order.source}-${order.orderId}`;

/** The results beside the filter panel, sliding over where the panel was when it is closed. */
const Main = styled('main', { shouldForwardProp: (prop: string) => prop !== 'open' && prop !== 'container' })<{
  open: boolean;
  container: boolean;
}>(({ theme }) => ({
  flexGrow: 1,
  minWidth: 0,
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.shorter
  }),
  marginLeft: -300,
  [theme.breakpoints.down('lg')]: { paddingLeft: 0, marginLeft: 0 },
  variants: [
    { props: ({ container }) => container, style: { [theme.breakpoints.only('lg')]: { marginLeft: 0 } } },
    { props: ({ container, open }) => container && !open, style: { [theme.breakpoints.only('lg')]: { marginLeft: -260 } } },
    {
      props: ({ open }) => open,
      style: {
        transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.shorter
        }),
        marginLeft: 0
      }
    }
  ]
}));

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
  // Nothing is filtered out until it is asked for: the month is collected to be looked at whole first.
  const [selection, setSelection] = useState<FilterSelection>({});
  // Colouring is not filtering: this decides how the rows that are shown read, not which rows those are. Errors and
  // warnings are coloured by default, being the rows the screen is opened to find.
  const [tintedLevels, setTintedLevels] = useState<FilterLevel[]>(['error', 'warning']);
  const { container } = useConfig();
  // The header card sticks under the app header, and the table's own head and the panel stop under it in turn. Its
  // height is measured rather than assumed: it wraps its controls onto another line on a narrow screen.
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerBottom, setHeaderBottom] = useState(HEADER_HEIGHT);
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));
  const [filtersOpen, setFiltersOpen] = useState(!downLG);
  const {
    reconciliationOrders,
    reconciliationOrdersError,
    reconciliationOrdersLoading,
    reconciliationOrdersRefreshing,
    reloadReconciliationOrders
  } = useGetReconciliationOrders(requestedMonth);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }
    const observer = new ResizeObserver(() => setHeaderBottom(HEADER_HEIGHT + header.offsetHeight));
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    // A month input reports every keystroke of the year, so only a whole month is worth asking the providers for.
    if (!/^\d{4}-\d{2}$/.test(month) || month === requestedMonth) {
      return;
    }
    // Another month is another set of orders, and a filter that fitted the last one may hide all of it.
    setSelection({});
    setRequestedMonth(month);
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

  // The backend words nothing, so the tax type arrives as a code and is worded here, as a failure code is. Every
  // other field is already the value it reads as.
  const fieldValue = (order: ReconciliationOrder, field: string) => {
    if (field !== 'taxType') {
      return formatFieldValue(order, field);
    }
    return order.taxType ? intl.formatMessage({ id: `order-tax-type-${order.taxType}` }) : '—';
  };

  const failureMessage = (order: ReconciliationOrder, failure: ReconciliationFailure) =>
    intl.formatMessage(
      { id: `reconciliation-failure-${failure.code}` },
      {
        ...Object.fromEntries(failure.fields.map((field) => [field, fieldValue(order, field)])),
        fields: failure.fields.map(fieldLabel).join(', ')
      }
    );

  const highlighted = selectedOrder?.failures.find((failure) => failureKey(failure) === selectedFailure);
  const highlightedFields = highlighted?.fields ?? [];
  const highlightLevel = (highlighted?.level ?? 'info') as ShownLevel;

  const levelLabel = (level: ReconciliationFailureLevel) => intl.formatMessage({ id: `reconciliation-level-${level}` });

  // An order's loudest level, worded, and reading as reconciled when it has none.
  const levelName = (level: ShownLevel | null) => (level ? levelLabel(level) : intl.formatMessage({ id: 'reconciliation-level-none' }));

  const rowLabel = (order: ReconciliationOrder) =>
    intl.formatMessage(
      { id: 'reconciliation-order-row' },
      { source: order.source, orderId: order.orderId, level: levelName(orderLevel(order)) }
    );

  const taxTypeName = (taxType: OrderTaxType) => intl.formatMessage({ id: `order-tax-type-${taxType}` });

  // What the month's orders can be narrowed by. Adding a filter is adding an entry here.
  const facets: OrderFacet[] = [
    {
      key: 'level',
      valueOf: (order) => orderLevel(order) ?? 'none',
      label: (value) => levelName(value === 'none' ? null : (value as ShownLevel)),
      declared: filterLevels,
      color: (value) => levelColor(value as FilterLevel)
    },
    {
      key: 'taxType',
      valueOf: (order) => order.taxType,
      label: (value) => taxTypeName(value as OrderTaxType),
      declared: orderTaxTypes,
      icon: (value) => <OrderTaxTypeIcon taxType={value as OrderTaxType} size={16} />
    },
    {
      key: 'paymentMethod',
      valueOf: (order) => order.paymentMethod,
      // Collected as the marketplace worded it, so the wording is already the label.
      label: (value) => value
    }
  ];

  const collectedOrders = reconciliationOrders?.orders ?? [];

  /** A facet with nothing selected lets every order through; several selected values widen it. */
  const matches = (order: ReconciliationOrder, facet: OrderFacet) => {
    const selected = selection[facet.key] ?? [];
    return selected.length === 0 || selected.includes(facet.valueOf(order) ?? unstated);
  };

  const shownOrders = collectedOrders.filter((order) => facets.every((facet) => matches(order, facet)));

  const optionLabel = (facet: OrderFacet, value: string) =>
    value === unstated ? intl.formatMessage({ id: 'reconciliation-filter-unstated' }) : facet.label(value);

  const filterFacets: FilterFacet[] = facets
    .map((facet) => {
      // Counted against what the other facets already let through, so a count states what selecting it would leave.
      const scoped = collectedOrders.filter((order) => facets.every((other) => other.key === facet.key || matches(order, other)));
      const counts = new Map<string, number>();
      // Every value the month collected keeps its box, at nought where the rest of the selection has emptied it: a
      // group that shed options as you narrowed would move under the pointer that was narrowing it.
      collectedOrders.forEach((order) => counts.set(facet.valueOf(order) ?? unstated, 0));
      scoped.forEach((order) => {
        const value = facet.valueOf(order) ?? unstated;
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });

      const rank = (value: string) => {
        const declared = facet.declared?.indexOf(value) ?? -1;
        // Unstated last; then the declared order; then whatever the providers sent, alphabetically by label.
        return value === unstated ? 2 : declared >= 0 ? 0 : 1;
      };
      const options = [...counts.entries()]
        .map(([value, count]) => ({
          value,
          count,
          label: optionLabel(facet, value),
          icon: value === unstated ? undefined : facet.icon?.(value),
          color: value === unstated ? undefined : facet.color?.(value)
        }))
        .sort((left, right) => {
          if (rank(left.value) !== rank(right.value)) {
            return rank(left.value) - rank(right.value);
          }
          const declared = facet.declared;
          if (declared && rank(left.value) === 0) {
            return declared.indexOf(left.value) - declared.indexOf(right.value);
          }
          return left.label.localeCompare(right.label);
        });

      return { key: facet.key, label: intl.formatMessage({ id: `reconciliation-filter-${facet.key}` }), options };
    })
    // A facet the whole month answers the same way narrows nothing, so it is not offered at all.
    .filter((facet) => facet.options.length > 1);

  const isFiltered = facets.some((facet) => (selection[facet.key]?.length ?? 0) > 0);

  // One chip per level among the orders on screen, loudest first, counting the orders that level is the loudest one
  // of. The chip switches that level's row colour; it never hides a row, which is what the filters are for.
  const levelCounts = filterLevels
    .map((level) => ({ level, count: shownOrders.filter((order) => (orderLevel(order) ?? 'none') === level).length }))
    .filter(({ count }) => count > 0);

  const isLevelTinted = (level: FilterLevel) => tintedLevels.includes(level);

  const toggleLevel = (level: FilterLevel) =>
    setTintedLevels((current) => (current.includes(level) ? current.filter((tinted) => tinted !== level) : [...current, level]));

  /** The row's background colour, or null when its level is coloured off. */
  const rowTint = (level: FilterLevel) => (isLevelTinted(level) ? levelColor(level) : null);

  const toggleFilter = (facetKey: string, value: string) =>
    setSelection((current) => {
      const selected = current[facetKey] ?? [];
      return {
        ...current,
        [facetKey]: selected.includes(value) ? selected.filter((kept) => kept !== value) : [...selected, value]
      };
    });

  return (
    <Stack>
      {/* The header over both: what month is being read, whether it is being read again, and how much of it is on
          screen. It runs the width of the panel and the table and keeps its own card, as they keep theirs. */}
      <MainCard
        ref={headerRef}
        content={false}
        // Above the panel's own sticky edge and the table's sticky head, both of which stop underneath it.
        sx={{ position: 'sticky', top: HEADER_HEIGHT, zIndex: 3 }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} useFlexGap sx={{ p: 2, gap: 2, flexWrap: 'wrap', alignItems: { sm: 'center' } }}>
          {/* Both controls are their icon alone, so each says what it is in its tooltip and its label. */}
          <Tooltip title={intl.formatMessage({ id: 'reconciliation-filters' })} arrow>
            <IconButton
              variant="contained"
              color="primary"
              aria-label={intl.formatMessage({ id: 'reconciliation-filters' })}
              aria-pressed={filtersOpen}
              onClick={() => setFiltersOpen((shown) => !shown)}
            >
              <FilterSearch size={18} />
            </IconButton>
          </Tooltip>
          {/* Choosing a month collects it: the orders are what the screen is for, and a second click to see them
              said nothing the choice had not. */}
          <TextField
            label={intl.formatMessage({ id: 'reconciliation-month' })}
            name="month"
            type="month"
            size="small"
            value={selectedMonth}
            onChange={(event) => handleMonthChange(event.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { pattern: '[0-9]{4}-[0-9]{2}' } }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ ml: { sm: 'auto' } }}>
            {intl.formatMessage({ id: 'reconciliation-filter-showing' }, { shown: shownOrders.length, total: collectedOrders.length })}
          </Typography>
          {/* The providers keep moving, so the month already on screen is worth asking for again. Collecting queries
              every one of them, so the button says it is working and refuses a second click until it is done. */}
          <Tooltip
            title={intl.formatMessage({ id: reconciliationOrdersRefreshing ? 'reconciliation-refreshing' : 'reconciliation-refresh' })}
            arrow
          >
            <span>
              <IconButton
                variant="outlined"
                color="secondary"
                disabled={!requestedMonth || reconciliationOrdersRefreshing}
                aria-label={intl.formatMessage({ id: 'reconciliation-refresh' })}
                onClick={() => reloadReconciliationOrders()}
              >
                {reconciliationOrdersRefreshing ? <CircularProgress size={18} color="inherit" /> : <Refresh size={18} />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </MainCard>

      <Box sx={{ display: 'flex' }}>
        <ReconciliationFilterDrawer
          stickyTop={headerBottom + 20}
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          filtered={isFiltered}
          onClear={() => setSelection({})}
          highlights={
            <Stack direction="row" useFlexGap sx={{ gap: 0.75, flexWrap: 'wrap' }}>
              {levelCounts.map(({ level, count }) => (
                <Chip
                  key={level}
                  clickable
                  size="small"
                  label={intl.formatMessage({ id: `reconciliation-${level}-count` }, { count })}
                  color={levelColor(level)}
                  variant={isLevelTinted(level) ? 'filled' : 'outlined'}
                  onClick={() => toggleLevel(level)}
                  aria-pressed={isLevelTinted(level)}
                />
              ))}
            </Stack>
          }
        >
          <FilterFacets facets={filterFacets} selection={selection} onToggle={toggleFilter} />
        </ReconciliationFilterDrawer>

        <Main open={filtersOpen} container={container}>
          <Stack spacing={2} sx={{ mt: 2.5 }}>
            {reconciliationOrdersLoading && <Skeleton variant="rounded" height={320} />}

            {reconciliationOrdersError && (
              <Alert severity="error">{reconciliationOrdersError.message || intl.formatMessage({ id: 'reconciliation-load-error' })}</Alert>
            )}

            {generationError && <Alert severity="error">{generationError}</Alert>}
            {generationMessage && <Alert severity="success">{generationMessage}</Alert>}

            {!reconciliationOrdersLoading && !reconciliationOrdersError && reconciliationOrders && (
              <MainCard
                content={false}
                // The table scrolls with the page, so nothing between it and the page may clip: a scrolling ancestor
                // would catch the sticky head and hold it inside the card instead of under the app header.
                sx={{ overflow: 'visible' }}
              >
                {shownOrders.length ? (
                  <TableContainer sx={{ overflow: 'visible' }}>
                    <Table
                      stickyHeader
                      size="small"
                      aria-label={intl.formatMessage({ id: 'reconciliation-orders-table' })}
                      sx={{
                        // The theme gives every head cell but the last `position: relative`, to hang the column divider
                        // off, and that beats the `sticky` the stickyHeader prop asks for. Asked for again here, where it
                        // out-specifies the theme, so the head stays put and the divider still hangs.
                        '& .MuiTableCell-stickyHeader:not(:last-of-type)': { position: 'sticky' },
                        // The page is what scrolls, so the head stops under the app header rather than at nought, and
                        // it needs its own ground and its own edge: the row it sits in keeps both behind it.
                        '& .MuiTableCell-stickyHeader': {
                          top: headerBottom,
                          bgcolor: 'secondary.lighter',
                          borderBottom: (theme) => `2px solid ${theme.palette.divider}`
                        }
                      }}
                    >
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: 92 }}>{intl.formatMessage({ id: 'reconciliation-actions' })}</TableCell>
                          {columnFields.map((field) => (
                            <TableCell key={field} align={amountFields.includes(field) ? 'right' : 'left'}>
                              {fieldLabel(field)}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {shownOrders.map((order) => {
                          const tint = rowTint(orderLevel(order) ?? 'none');
                          return (
                            <TableRow
                              hover
                              key={orderKey(order)}
                              // The tint states the level by colour alone, so the row names it for a reader that cannot see
                              // the colour. The dot that used to name it is gone: the tint says the same thing louder.
                              aria-label={rowLabel(order)}
                              // Not when the click merely ended a text selection: copying a cell must not open the detail.
                              onClick={() => !hasTextSelection() && openOrder(order)}
                              sx={(theme) => ({
                                cursor: 'pointer',
                                // The row itself carries the verdict, which is why the dot that once did is gone. The
                                // colouring chips decide which levels are tinted; the filters decide which rows are here.
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
                              <TableCell sx={{ width: 92, whiteSpace: 'nowrap' }} onClick={(event) => event.stopPropagation()}>
                                <Stack direction="row" spacing={0.75} alignItems="center">
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
                                  {/* The type is a mark here and a word in the detail view, so the icon never says it
                                alone: its label is the same wording the detail view shows. */}
                                  {order.taxType && (
                                    <Tooltip title={taxTypeName(order.taxType)} arrow>
                                      <Box
                                        component="span"
                                        role="img"
                                        aria-label={taxTypeName(order.taxType)}
                                        sx={{ display: 'inline-flex' }}
                                      >
                                        <OrderTaxTypeIcon taxType={order.taxType} />
                                      </Box>
                                    </Tooltip>
                                  )}
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
                                    fieldValue(order, field)
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
                    {/* A month that collected nothing and a month whose filters let nothing through read differently:
                  one is an answer about the month, the other is an answer about the filters. */}
                    <Typography color="text.secondary">
                      {intl.formatMessage({ id: isFiltered ? 'reconciliation-filtered-empty' : 'reconciliation-empty' })}
                    </Typography>
                    {isFiltered && (
                      <Button size="small" color="secondary" onClick={() => setSelection({})} sx={{ mt: 1 }}>
                        {intl.formatMessage({ id: 'reconciliation-filter-clear' })}
                      </Button>
                    )}
                  </Box>
                )}
              </MainCard>
            )}
          </Stack>
        </Main>
      </Box>

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
                    <Typography>{fieldValue(selectedOrder, field)}</Typography>
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
