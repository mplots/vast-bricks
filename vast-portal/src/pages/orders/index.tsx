import { useEffect, useMemo, useRef, useState } from 'react';

import { alpha, styled, type Theme } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip, { type ChipProps } from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableFooter from '@mui/material/TableFooter';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DocumentDownload, FilterSearch, Kanban, ReceiptAdd, Refresh } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';
import { useSearchParams } from 'react-router-dom';

// The invoice endpoint lives under the accounting namespace and is shared with the accounting screen.
import { generateInvoice } from 'api/accounting';
import { useGetOrders } from 'api/orders';
import IconButton from 'components/@extended/IconButton';
import ColumnPicker from 'components/ColumnPicker';
import FilterFacets, { type FilterFacet, type FilterSelection } from 'components/FilterFacets';
import MainCard from 'components/MainCard';
import OrderTaxTypeIcon from 'components/OrderTaxTypeIcon';
import DatePeriodPicker from 'components/period/DatePeriodPicker';
import { paneGap, stickyTop, STICKY_TOP } from 'components/SidePanel';
import toolButtonSx from 'components/toolButton';
import useColumnDrag from 'hooks/useColumnDrag';
import useConfig from 'hooks/useConfig';
import useLocalStorage from 'hooks/useLocalStorage';
import OrdersColumnDrawer from 'sections/orders/OrdersColumnDrawer';
import OrdersFilterDrawer from 'sections/orders/OrdersFilterDrawer';
import { formatAmount, numericCell } from 'utils/amount';
import { downloadCsv, type CsvValue } from 'utils/csv';
import { currentMonth, monthDate } from 'utils/month';
import { orderUrl } from 'utils/orderLink';
import type { StoreOrder } from 'types/order';
import { orderTaxTypes, type OrderTaxType } from 'types/tax';

/**
 * The store's own orders, a range of days at a time.
 *
 * <p>The reconciliation report reads the same orders by collecting them live from every provider each time it is
 * opened, which is why it is a report rather than a screen: it costs a dozen provider calls and takes as long as the
 * slowest of them. These are the orders the import job has already put in the database, so this screen is a read and
 * answers at once - which is what makes it the one the portal opens on, and what makes it the screen an order is
 * acted on from.
 *
 * <p>It is worn the way the report is, deliberately: the same range picker in the same sticky bar, the same panel of
 * facets down the left and columns down the right, the same two-row head naming what stated each run of columns, the
 * same draggable headings, the same export. A reader moving between the two is reading the same orders and should
 * not have to learn a second screen to do it.
 */

/**
 * Every column the table can show, in the order it opens with.
 *
 * <p>Addressed as {@code <source>.<field>}, the paths the reconciliation report uses, because the marketplace's own
 * account will not be the only thing this screen states for long: what a payment provider or the accounting system
 * holds for an order is a second account of it, and two sources naming one field - a refund, a facilitator tax -
 * have to stand beside each other without either being renamed around the other.
 *
 * <p>The tax type is absent: it rides in the actions cell as a mark rather than spending a column on a word, exactly
 * as it does on the report.
 */
const columnFields = [
  'order.source',
  'order.orderDate',
  'order.orderId',
  'order.buyer',
  'order.buyerUsername',
  'order.country',
  'order.lotCount',
  'order.itemCount',
  'order.paymentMethod',
  'order.currency',
  'order.subTotal',
  'order.shippingCost',
  'order.facilitatorTax',
  'order.marketplaceFee',
  'order.grandTotal',
  'order.refundedAmount',
  // Follows the amounts it is derived from, as it does on the report, so the columns read as the subtraction they
  // are: what the order came to, less the facilitator tax, less what has been refunded.
  'calculated.targetInvoice',
  'calculated.marketplaceFee',
  'calculated.paymentFee'
] as const;

type ColumnField = (typeof columnFields)[number];

/** The sources a column can come from. `calculated` is derived here rather than stored or reported by any of them. */
const fieldSources = ['order', 'calculated'] as const;

type FieldSource = (typeof fieldSources)[number];

/** The source a column path names, which is the segment before its dot. */
const sourceOf = (column: string) => column.split('.')[0] as FieldSource;

const amountFields: string[] = [
  'order.subTotal',
  'order.shippingCost',
  'order.facilitatorTax',
  'order.marketplaceFee',
  'order.grandTotal',
  'order.refundedAmount',
  'calculated.targetInvoice',
  'calculated.marketplaceFee',
  'calculated.paymentFee'
];
const numericFields: string[] = [...amountFields, 'order.lotCount', 'order.itemCount'];
const dateFields: string[] = ['order.orderDate'];

const storedColumnsKey = 'vast-orders-columns';
const columnParam = 'columns';

/** The facets the orders can be narrowed by, each read off the order itself. */
const facetFields = ['source', 'country', 'paymentMethod', 'currency', 'taxType'] as const;

type Facet = (typeof facetFields)[number];

const TITLE_HEIGHT = 68;
/** The secondary head, which names the source each run of columns came from. */
const GROUP_HEIGHT = 33;
const CARD_RADIUS = 12;

/** The edge between one source's run of columns and the next: the one vertical line this table draws. */
const bandEdge = { borderInlineStart: (theme: Theme) => `1px solid ${theme.palette.divider}` };

const groupTitleSx = {
  textTransform: 'none',
  fontWeight: 400,
  color: 'text.secondary',
  whiteSpace: 'nowrap'
} as const;

/** BrickOwl's own orange, so a marketplace reads as itself rather than as a second theme colour. */
const sourceColor = (source: string): ChipProps['color'] => (source === 'BRICKOWL' ? 'warning' : 'primary');

const orderKey = (order: StoreOrder) => `${order.source}-${order.orderId}`;

/**
 * The columns a stored or addressed choice actually names, in the order it named them.
 *
 * <p>Both the address and the browser's own storage are text written by somebody else, so a column that no longer
 * exists is dropped rather than trusted, and a choice naming none of them is no choice at all.
 */
const columnsIn = (stated: string[] | null | undefined): ColumnField[] | null => {
  const kept = (stated ?? []).filter((column): column is ColumnField => (columnFields as readonly string[]).includes(column));
  return kept.length ? kept : null;
};

const formatCount = (value: number | null) => (value === null || value === undefined ? '—' : value.toLocaleString());

/**
 * A column's total across the given orders, or null where none of them stated it - a footer sum rather than a per-row
 * read. Summed in cents, as the report sums its own totals, so decimal addition cannot introduce a fraction of one;
 * an order the column has no answer for is left out rather than read as nothing owed.
 */
const sumOf = (orders: StoreOrder[], amountOf: (order: StoreOrder) => number | null): number | null => {
  let total = 0;
  let collected = false;
  orders.forEach((order) => {
    const value = amountOf(order);
    if (value !== null) {
      total += Math.round(value * 100);
      collected = true;
    }
  });
  return collected ? total / 100 : null;
};

/**
 * An amount, or an em dash where the marketplace stated none.
 *
 * <p>No currency written beside it: every amount on an order is in what the buyer paid in, which the currency column
 * already states once for the row, so repeating it beside every amount would say the same thing several times over.
 */
const money = (value: number | null) => (value === null || value === undefined ? '—' : formatAmount(value));

/**
 * A euro amount, unlike every other figure on this table: the target invoice is the one column the backend has
 * already converted out of whatever the buyer paid in, so it is the one column that may say which currency it is in
 * without saying something untrue about the others.
 */
const moneyEur = (value: number | null) => (value === null || value === undefined ? '—' : `€${formatAmount(value)}`);

const formatDay = (value: string) => {
  const day = new Date(value);
  return Number.isNaN(day.getTime())
    ? '—'
    : `${String(day.getUTCDate()).padStart(2, '0')}.${String(day.getUTCMonth() + 1).padStart(2, '0')}.${day.getUTCFullYear()}`;
};

/** The day an order was placed, as the range is stated in: UTC, which is how the order dates are stored. */
const dayOf = (value: string) => value.slice(0, 10);

const Main = styled('main', {
  shouldForwardProp: (prop: string) => prop !== 'open' && prop !== 'columns' && prop !== 'container'
})<{ open: boolean; columns: boolean; container: boolean }>(({ theme }) => ({
  flexGrow: 1,
  minWidth: 0,
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.shorter
  }),
  // A docked drawer holds its width whether it is open or shut, so the table slides over the shut one's place.
  marginLeft: -300,
  marginRight: -300,
  [theme.breakpoints.down('lg')]: { paddingLeft: 0, marginLeft: 0, marginRight: 0 },
  variants: [
    { props: ({ container }) => container, style: { [theme.breakpoints.only('lg')]: { marginLeft: 0, marginRight: 0 } } },
    { props: ({ container, open }) => container && !open, style: { [theme.breakpoints.only('lg')]: { marginLeft: -260 } } },
    { props: ({ container, columns }) => container && !columns, style: { [theme.breakpoints.only('lg')]: { marginRight: -260 } } },
    {
      props: ({ open }) => open,
      style: {
        transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.shorter
        }),
        marginLeft: 0
      }
    },
    {
      props: ({ columns }) => columns,
      style: {
        transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.shorter
        }),
        marginRight: 0
      }
    }
  ]
}));

export default function OrdersPage() {
  const intl = useIntl();
  const { container } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();

  // Open with the screen: the orders are read by narrowing them, so the panel is part of the screen rather than a
  // tool fetched for it. The columns panel opposite stays shut, a table being read rather than arranged most days.
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const cardTopRef = useRef<HTMLDivElement | null>(null);

  const [generatingOrder, setGeneratingOrder] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);

  // The arrangement this browser opens with, which the panel's own button is what writes.
  const [storedColumns, setStoredColumns] = useLocalStorage<string[] | null>(storedColumnsKey, null);

  // The month now, so a screen opened with nothing in the address reads what has just come in.
  const month = currentMonth();
  const defaultFrom = `${month}-01`;
  const defaultTo = (() => {
    const first = monthDate(month);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  })();

  const dateFrom = searchParams.get('dateFrom') ?? defaultFrom;
  const dateTo = searchParams.get('dateTo') ?? defaultTo;

  const { orders, ordersError, ordersLoading, ordersRefreshing, reloadOrders } = useGetOrders(dateFrom, dateTo);
  const collected = useMemo(() => orders?.orders ?? [], [orders]);

  const shownColumns = columnsIn(searchParams.getAll(columnParam)) ?? columnsIn(storedColumns) ?? [...columnFields];

  const updateParams = (change: (params: URLSearchParams) => void, replace = false) => {
    const params = new URLSearchParams(searchParams);
    change(params);
    setSearchParams(params, { replace });
  };

  const setColumns = (next: string[]) =>
    updateParams((params) => {
      params.delete(columnParam);
      next.forEach((column) => params.append(columnParam, column));
    }, true);

  const toggleColumn = (key: string) =>
    setColumns(
      shownColumns.includes(key as ColumnField)
        ? shownColumns.filter((column) => column !== key)
        : // A column asked for lands where it sits in the arrangement the screen opens with, so ticking one back on
          // puts it where a reader last saw it rather than at the end.
          columnFields.filter((column) => column === key || shownColumns.includes(column))
    );

  const toggleColumnGroup = (keys: string[], show: boolean) =>
    setColumns(
      show
        ? columnFields.filter((column) => keys.includes(column) || shownColumns.includes(column))
        : shownColumns.filter((column) => !keys.includes(column))
    );

  const columnDrag = useColumnDrag(shownColumns, setColumns);

  const sourceLabel = (source: string) => intl.formatMessage({ id: `orders-source-${source.toLowerCase()}`, defaultMessage: source });

  const fieldSourceLabel = (source: FieldSource) => intl.formatMessage({ id: `orders-field-source-${source}` });

  const taxTypeName = (taxType: OrderTaxType) => intl.formatMessage({ id: `order-tax-type-${taxType}` });

  // The applied range and the columns travel in the address, so a screen can be reloaded or handed to someone as
  // the link it is.
  const selection: FilterSelection = Object.fromEntries(facetFields.map((facet) => [facet, searchParams.getAll(facet)]));

  const valueOf = (order: StoreOrder, facet: Facet): string => {
    switch (facet) {
      case 'source':
        return order.source;
      case 'country':
        return order.country ?? '';
      case 'paymentMethod':
        return order.paymentMethod ?? '';
      case 'currency':
        return order.currency ?? '';
      case 'taxType':
        return order.taxType ?? '';
    }
  };

  /** How a facet's value reads: a marketplace and a tax type are worded, a currency and a method already read. */
  const facetLabel = (facet: Facet, value: string) => {
    if (facet === 'source') return sourceLabel(value);
    if (facet === 'taxType') return taxTypeName(value as OrderTaxType);
    return value;
  };

  /**
   * The orders a facet lets through, counting the other facets first.
   *
   * <p>So a facet's own counts are of the orders the others already allow: ticking several values of one facet
   * widens it and ticking across facets narrows, which is what the counts have to say.
   */
  const passing = (order: StoreOrder, except?: string) =>
    facetFields.every((facet) => {
      const selected = selection[facet] ?? [];
      return facet === except || !selected.length || selected.includes(valueOf(order, facet));
    });

  const shownOrders = useMemo(
    () => collected.filter((order) => passing(order)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collected, searchParams]
  );

  // The columns a reader adds up rather than reads order by order, so they are the ones the footer sums.
  const targetInvoiceTotal = useMemo(() => sumOf(shownOrders, (order) => order.targetInvoice), [shownOrders]);
  const calculatedMarketplaceFeeTotal = useMemo(
    () => sumOf(shownOrders, (order) => order.calculatedMarketplaceFee),
    [shownOrders]
  );
  const calculatedPaymentFeeTotal = useMemo(
    () => sumOf(shownOrders, (order) => order.calculatedPaymentFee),
    [shownOrders]
  );

  const filterFacets: FilterFacet[] = facetFields.map((facet) => {
    const counts = new Map<string, number>();
    collected
      .filter((order) => passing(order, facet))
      .forEach((order) => {
        const value = valueOf(order, facet);
        if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
      });
    return {
      key: facet,
      label: intl.formatMessage({ id: `orders-filter-${facet}` }),
      options: [...counts.entries()]
        .sort(([left], [right]) =>
          // A tax type reads in the order the rules classify them in rather than alphabetically; the others have no
          // order of their own, so they take the reader's.
          facet === 'taxType'
            ? orderTaxTypes.indexOf(left as OrderTaxType) - orderTaxTypes.indexOf(right as OrderTaxType)
            : left.localeCompare(right)
        )
        .map(([value, count]) => ({
          value,
          label: facetLabel(facet, value),
          count,
          icon: facet === 'taxType' ? <OrderTaxTypeIcon taxType={value as OrderTaxType} size={16} /> : undefined,
          color: facet === 'source' ? sourceColor(value) : undefined
        }))
    };
  });

  const isFiltered = facetFields.some((facet) => (selection[facet] ?? []).length > 0);

  const toggleFilter = (facetKey: string, value: string) =>
    updateParams((params) => {
      const selected = params.getAll(facetKey);
      const next = selected.includes(value) ? selected.filter((kept) => kept !== value) : [...selected, value];
      params.delete(facetKey);
      next.forEach((kept) => params.append(facetKey, kept));
    }, true);

  const clearFilters = () => updateParams((params) => facetFields.forEach((facet) => params.delete(facet)), true);

  const applyPeriod = (from: string, to: string, view: 'month' | 'year' | 'range') =>
    updateParams((params) => {
      params.set('periodView', view);
      params.set('dateFrom', from);
      params.set('dateTo', to);
    });

  /**
   * Writes the accounting invoice for one order.
   *
   * <p>It acts on an order, so it belongs on the screen orders are read from. The reconciliation report holds
   * several accounts of an order against each other and says what disagrees; acting on one was always a second job
   * it happened to be carrying.
   */
  const handleGenerateInvoice = async (order: StoreOrder) => {
    setGeneratingOrder(orderKey(order));
    setGenerationError(null);
    setGenerationMessage(null);
    try {
      // The marketplace's own code, not the label beside it: the endpoint normalises `BRICKOWL` the same way it
      // normalises the spellings the other screens send, and a translated word would reach it as nothing it knows.
      const result = await generateInvoice(order.orderId, order.source);
      setGenerationMessage(
        intl.formatMessage({ id: 'orders-invoice-generated' }, { invoiceNumber: result.invoiceNumber, name: result.name })
      );
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : intl.formatMessage({ id: 'orders-invoice-error' }));
    } finally {
      setGeneratingOrder(null);
    }
  };

  /** What a column reads as, in a word. The cells that are more than a word are drawn by the row itself. */
  const cellOf = (order: StoreOrder, column: ColumnField): string => {
    switch (column) {
      case 'order.source':
        return sourceLabel(order.source);
      case 'order.orderDate':
        return formatDay(order.orderDate);
      case 'order.orderId':
        return order.orderId;
      case 'order.buyer':
        return order.buyer ?? '—';
      case 'order.buyerUsername':
        return order.buyerUsername ?? '—';
      case 'order.country':
        return order.country ?? '—';
      case 'order.lotCount':
        return formatCount(order.lotCount);
      case 'order.itemCount':
        return formatCount(order.itemCount);
      case 'order.paymentMethod':
        return order.paymentMethod ?? '—';
      case 'order.currency':
        return order.currency ?? '—';
      case 'order.subTotal':
        return money(order.subTotal);
      case 'order.shippingCost':
        return money(order.shippingCost);
      case 'order.facilitatorTax':
        return money(order.facilitatorTax);
      case 'order.marketplaceFee':
        return money(order.marketplaceFee);
      case 'order.grandTotal':
        return money(order.grandTotal);
      case 'order.refundedAmount':
        return money(order.refundedAmount);
      case 'calculated.targetInvoice':
        return moneyEur(order.targetInvoice);
      case 'calculated.marketplaceFee':
        return money(order.calculatedMarketplaceFee);
      case 'calculated.paymentFee':
        return money(order.calculatedPaymentFee);
    }
  };

  /** The number behind an amount column, which is what an export states rather than the way it is written. */
  const amountOf = (order: StoreOrder, column: ColumnField): number | null => {
    switch (column) {
      case 'order.subTotal':
        return order.subTotal;
      case 'order.shippingCost':
        return order.shippingCost;
      case 'order.facilitatorTax':
        return order.facilitatorTax;
      case 'order.marketplaceFee':
        return order.marketplaceFee;
      case 'order.grandTotal':
        return order.grandTotal;
      case 'order.refundedAmount':
        return order.refundedAmount;
      case 'calculated.targetInvoice':
        return order.targetInvoice;
      case 'calculated.marketplaceFee':
        return order.calculatedMarketplaceFee;
      case 'calculated.paymentFee':
        return order.calculatedPaymentFee;
      default:
        return null;
    }
  };

  /**
   * The shown columns in runs of one source, which is what the secondary head names.
   *
   * <p>A source split apart by a column of another is two runs rather than one: columns that are not next to each
   * other are not a band, and a heading spanning them would claim the column between them. A table is arranged so
   * its amounts read as the sums they make, which is not the order the sources come in, so a source standing in two
   * places is ordinary rather than exceptional.
   */
  const runs = (() => {
    const built: { source: FieldSource; fields: ColumnField[] }[] = [];
    shownColumns.forEach((column) => {
      const last = built.at(-1);
      const source = sourceOf(column);
      if (last?.source === source) {
        last.fields.push(column);
      } else {
        built.push({ source, fields: [column] });
      }
    });
    return built;
  })();

  const bandStarts = new Set(runs.slice(1).map((run) => run.fields[0]));

  const downloadReport = () => {
    const rows: CsvValue[][] = [
      shownColumns.map((column) => intl.formatMessage({ id: `orders-${column}` })),
      ...shownOrders.map((order) =>
        shownColumns.map((column) => {
          // The export states values rather than the way they are written on screen: a date as the day it is, an
          // amount as the number it is, so a spreadsheet reads them as those rather than as text.
          if (column === 'order.orderDate') return dayOf(order.orderDate);
          if (amountFields.includes(column)) return amountOf(order, column);
          if (column === 'order.lotCount') return order.lotCount;
          if (column === 'order.itemCount') return order.itemCount;
          return cellOf(order, column);
        })
      )
    ];
    downloadCsv(`orders-${dateFrom}-${dateTo}.csv`, rows);
  };

  const arrangedColumns = JSON.stringify(shownColumns);
  const columnsChanged = arrangedColumns !== JSON.stringify(columnFields);
  const columnsSaved = arrangedColumns === JSON.stringify(columnsIn(storedColumns) ?? columnFields);

  // Whether the card's top has gone under the app header, which is when the title bar has to carry its own ground.
  useEffect(() => {
    const top = cardTopRef.current;
    if (!top) return undefined;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      rootMargin: `-${STICKY_TOP}px 0px 0px 0px`
    });
    observer.observe(top);
    return () => observer.disconnect();
  }, []);

  const periodTitle = (
    <Stack component="span" direction="row" useFlexGap sx={{ gap: 1.5, alignItems: 'center' }}>
      {/* Only while the panel is away, and at the end of the bar it comes back to: open, the panel is its own close
          button, and a button here that turned it off would be a second answer to a question it already answers. */}
      {!filtersOpen && (
        <Tooltip title={intl.formatMessage({ id: 'orders-filters' })} arrow>
          <IconButton
            variant="light"
            color="secondary"
            aria-label={intl.formatMessage({ id: 'orders-filters' })}
            onClick={() => setFiltersOpen(true)}
            sx={toolButtonSx}
          >
            <FilterSearch size={18} />
          </IconButton>
        </Tooltip>
      )}
      <DatePeriodPicker
        allowRange
        from={dateFrom}
        to={dateTo}
        view={
          searchParams.get('periodView') === 'year'
            ? 'year'
            : searchParams.get('periodView') === 'month' || !searchParams.has('dateFrom')
              ? 'month'
              : 'range'
        }
        onApply={applyPeriod}
      />
      {orders && (
        <Typography component="span" variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
          {intl.formatMessage({ id: 'orders-filter-showing' }, { shown: shownOrders.length, total: collected.length })}
        </Typography>
      )}
    </Stack>
  );

  const rangeActions = (
    <Stack direction="row" useFlexGap sx={{ gap: 0.5, alignItems: 'center' }}>
      <Tooltip title={intl.formatMessage({ id: 'orders-download-csv' })} arrow>
        <span>
          <IconButton
            variant="light"
            color="secondary"
            disabled={!orders || ordersRefreshing || !!ordersError || !shownColumns.length}
            aria-label={intl.formatMessage({ id: 'orders-download-csv' })}
            onClick={downloadReport}
            sx={toolButtonSx}
          >
            <DocumentDownload size={18} />
          </IconButton>
        </span>
      </Tooltip>
      {!columnsOpen && (
        <Tooltip title={intl.formatMessage({ id: 'orders-columns' })} arrow>
          <IconButton
            variant="light"
            color="secondary"
            aria-label={intl.formatMessage({ id: 'orders-columns' })}
            onClick={() => setColumnsOpen(true)}
            sx={toolButtonSx}
          >
            <Kanban size={18} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={intl.formatMessage({ id: ordersRefreshing ? 'orders-refreshing' : 'orders-refresh' })} arrow>
        <span>
          <IconButton
            variant="light"
            color="secondary"
            disabled={ordersRefreshing}
            aria-label={intl.formatMessage({ id: 'orders-refresh' })}
            onClick={() => reloadOrders()}
            sx={toolButtonSx}
          >
            {ordersRefreshing ? <CircularProgress size={18} color="inherit" /> : <Refresh size={18} />}
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );

  return (
    <Stack>
      <Box sx={{ display: 'flex' }}>
        <OrdersFilterDrawer open={filtersOpen} onClose={() => setFiltersOpen(false)} filtered={isFiltered} onClear={clearFilters}>
          <FilterFacets facets={filterFacets} selection={selection} onToggle={toggleFilter} />
        </OrdersFilterDrawer>

        <Main open={filtersOpen} columns={columnsOpen} container={container}>
          <Stack spacing={2} sx={{ mt: paneGap }}>
            {generationError && <Alert severity="error">{generationError}</Alert>}
            {generationMessage && <Alert severity="success">{generationMessage}</Alert>}

            <MainCard
              content={false}
              title={periodTitle}
              secondary={rangeActions}
              // The bar draws its own bottom edge, the card's divider being a sibling that would scroll out from
              // under it.
              divider={false}
              sx={{
                // The table scrolls with the page, so nothing between it and the page may clip: a scrolling ancestor
                // would catch the sticky head and hold it inside the card.
                overflow: 'visible',
                '& .MuiCardHeader-root': {
                  position: 'sticky',
                  top: stickyTop(),
                  zIndex: 3,
                  height: TITLE_HEIGHT,
                  py: 0,
                  bgcolor: 'background.paper',
                  borderTopLeftRadius: 'inherit',
                  borderTopRightRadius: 'inherit',
                  // Once the card's top has gone, what lies behind the corners those curves cut away is a row, which
                  // shows through as a notch of its colour. So while the bar is stuck its ground is laid in two: the
                  // page's own colour square to the corners, and the paper rounded over it.
                  ...(stuck && {
                    bgcolor: 'background.default',
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      zIndex: -1,
                      bgcolor: 'background.paper',
                      borderTopLeftRadius: CARD_RADIUS,
                      borderTopRightRadius: CARD_RADIUS
                    },
                    // The app header is translucent and blurs whatever passes behind it, which for a table is a
                    // smear of rows. The bar carries a plain ground up into that band and leaves the blur nothing.
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      insetInline: 0,
                      bottom: '100%',
                      height: STICKY_TOP,
                      bgcolor: 'background.default'
                    }
                  }),
                  borderBottom: (theme) => `1px solid ${theme.palette.divider}`
                },
                // The card cannot clip what overflows it, the sticky head being the reason, so the last row rounds
                // its own outer corners rather than filling the card's.
                '& tbody .MuiTableRow-root:last-of-type .MuiTableCell-root': {
                  '&:first-of-type': { borderBottomLeftRadius: CARD_RADIUS },
                  '&:last-of-type': { borderBottomRightRadius: CARD_RADIUS },
                  borderBottom: 'none'
                }
              }}
            >
              <Box ref={cardTopRef} sx={{ position: 'absolute', top: 0, left: 0, width: '1px', height: '1px' }} />

              {ordersLoading && <Skeleton variant="rounded" height={320} sx={{ m: 2.5 }} />}

              {ordersError && (
                <Alert severity="error" sx={{ m: 2.5 }}>
                  {ordersError.message || intl.formatMessage({ id: 'orders-load-error' })}
                </Alert>
              )}

              {!ordersLoading &&
                !ordersError &&
                orders &&
                (shownOrders.length ? (
                  <TableContainer sx={{ overflow: 'visible' }}>
                    <Table
                      stickyHeader
                      size="small"
                      aria-label={intl.formatMessage({ id: 'orders-table' })}
                      sx={{
                        // The theme gives every head cell but the last `position: relative`, to hang the column
                        // divider off, and that beats the `sticky` the stickyHeader prop asks for.
                        '& .MuiTableCell-stickyHeader:not(:last-of-type)': { position: 'sticky' },
                        // The head is two rows, so each stops at its own height: the sources under the title bar and
                        // the columns under the sources. The bottom edge belongs to the row the body meets.
                        '& .MuiTableCell-stickyHeader': {
                          top: stickyTop(TITLE_HEIGHT + GROUP_HEIGHT),
                          bgcolor: 'secondary.lighter',
                          borderBottom: (theme: Theme) => `2px solid ${theme.palette.divider}`
                        },
                        '& .MuiTableRow-root:first-of-type .MuiTableCell-stickyHeader': {
                          top: stickyTop(TITLE_HEIGHT),
                          height: GROUP_HEIGHT,
                          borderBottom: 'none'
                        },
                        // A line is spent only where the table changes. The theme hangs a divider off every heading
                        // but the last, which would cross the line under every order and make a grid of the range;
                        // the only vertical line this table draws is the edge between one source's run and the next.
                        '& .MuiTableCell-stickyHeader:after': { display: 'none' },
                        // The line between one order and the next is rhythm rather than structure, so it is set well
                        // under the two rules that are.
                        '& tbody .MuiTableCell-root': {
                          borderBottomColor: (theme: Theme) => alpha(theme.palette.divider, 0.4)
                        }
                      }}
                    >
                      <TableHead>
                        {/* Which account each run of columns came from, said once over the run rather than in every
                            heading under it. Two columns of one source that a reader has not put next to each other
                            are two runs, so a source may be named more than once. */}
                        <TableRow>
                          <TableCell sx={{ width: 92 }} />
                          {runs.map((run, index) => (
                            <TableCell
                              key={`${run.source}-${run.fields[0]}`}
                              colSpan={run.fields.length}
                              sx={{ ...groupTitleSx, ...(index > 0 && bandEdge) }}
                            >
                              {fieldSourceLabel(run.source)}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ width: 92 }} />
                          {shownColumns.map((column) => {
                            // The heading is what a column is dragged by, so its own styling is laid under whatever
                            // the drag wants to draw on it - the edge a drop would land against.
                            const { sx, ...dragging } = columnDrag(column);
                            return (
                              <TableCell
                                key={column}
                                align={numericFields.includes(column) ? 'right' : 'left'}
                                {...dragging}
                                sx={{ whiteSpace: 'nowrap', ...(bandStarts.has(column) && bandEdge), ...sx }}
                              >
                                {intl.formatMessage({ id: `orders-${column}` })}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {shownOrders.map((order) => (
                          <TableRow key={order.id} hover>
                            <TableCell sx={{ width: 92, whiteSpace: 'nowrap' }}>
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <Tooltip title={intl.formatMessage({ id: 'orders-generate-invoice' })} arrow>
                                  <span>
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      disabled={generatingOrder === orderKey(order)}
                                      aria-label={intl.formatMessage(
                                        { id: 'orders-generate-invoice-for' },
                                        { source: sourceLabel(order.source), orderId: order.orderId }
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
                                {/* The type is a mark rather than a column of one repeated word, as it is on the
                                    report. Its label is the wording a column would have carried, so the icon never
                                    says it alone. */}
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
                            {shownColumns.map((column) => (
                              <TableCell
                                key={column}
                                align={numericFields.includes(column) ? 'right' : 'left'}
                                sx={{
                                  ...(numericFields.includes(column) ? numericCell : {}),
                                  ...(bandStarts.has(column) && bandEdge),
                                  ...(dateFields.includes(column) && { whiteSpace: 'nowrap' })
                                }}
                              >
                                {column === 'order.source' ? (
                                  // The marketplace reads as a mark rather than a word repeated down a hundred rows.
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    color={sourceColor(order.source)}
                                    label={sourceLabel(order.source)}
                                  />
                                ) : column === 'order.orderId' && orderUrl(order.source, order.orderId) ? (
                                  // The link sits on the id, as it does on the report: the order a row raises a
                                  // question about is then one click away from the row.
                                  <Link
                                    href={orderUrl(order.source, order.orderId)!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    underline="hover"
                                  >
                                    {order.orderId}
                                  </Link>
                                ) : (
                                  cellOf(order, column)
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter sx={{ bgcolor: 'transparent', border: 0 }}>
                        <TableRow
                          sx={{
                            '& .MuiTableCell-root': {
                              bgcolor: 'secondary.lighter',
                              color: 'text.primary',
                              fontWeight: 600,
                              fontSize: '0.875rem',
                              whiteSpace: 'nowrap',
                              borderTop: (theme: Theme) => `2px solid ${theme.palette.divider}`
                            }
                          }}
                        >
                          <TableCell component="th" scope="row" sx={{ width: 92 }}>
                            {intl.formatMessage({ id: 'orders-total' })}
                          </TableCell>
                          {shownColumns.map((column) => (
                            <TableCell
                              key={column}
                              align={numericFields.includes(column) ? 'right' : 'left'}
                              sx={{ ...(bandStarts.has(column) && bandEdge) }}
                            >
                              {column === 'calculated.targetInvoice' && moneyEur(targetInvoiceTotal)}
                              {column === 'calculated.marketplaceFee' && money(calculatedMarketplaceFeeTotal)}
                              {column === 'calculated.paymentFee' && money(calculatedPaymentFeeTotal)}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info" sx={{ m: 2.5 }}>
                    {intl.formatMessage({ id: collected.length ? 'orders-none-shown' : 'orders-none' })}
                  </Alert>
                ))}
            </MainCard>
          </Stack>
        </Main>

        <OrdersColumnDrawer
          open={columnsOpen}
          onClose={() => setColumnsOpen(false)}
          changed={columnsChanged}
          saved={columnsSaved}
          onReset={() => setColumns([...columnFields])}
          onSave={() => setStoredColumns(shownColumns)}
        >
          <ColumnPicker
            groups={fieldSources.map((source) => ({
              key: source,
              label: fieldSourceLabel(source),
              columns: columnFields
                .filter((column) => sourceOf(column) === source)
                .map((column) => ({ key: column, label: intl.formatMessage({ id: `orders-${column}` }) }))
            }))}
            shown={shownColumns}
            onToggle={toggleColumn}
            onToggleGroup={toggleColumnGroup}
            groupLabel={(label) => intl.formatMessage({ id: 'orders-columns-group-toggle' }, { group: label })}
          />
        </OrdersColumnDrawer>
      </Box>
    </Stack>
  );
}
