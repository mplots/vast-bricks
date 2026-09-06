import { useEffect, useRef, useState, type ReactNode } from 'react';

import { emphasize, styled, type Theme } from '@mui/material/styles';
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
import Link from '@mui/material/Link';
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
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ArrowLeft2, ArrowRight2, FilterSearch, Kanban, ReceiptAdd, Refresh } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';
import { useSearchParams } from 'react-router-dom';

// The invoice endpoint lives under the accounting namespace and is shared with the accounting screen.
import { generateInvoice } from 'api/accounting';
import { useGetReconciliationOrders } from 'api/reconciliation';
import hasTextSelection from 'utils/textSelection';
import IconButton from 'components/@extended/IconButton';
import ColumnPicker from 'components/ColumnPicker';
import FilterFacets, { type FilterFacet, type FilterSelection } from 'components/FilterFacets';
import MainCard from 'components/MainCard';
import MonthPicker from 'sections/reconciliation/MonthPicker';
import {
  columnFields,
  columnParam,
  columnsIn,
  defaultColumns,
  defaultOrder,
  fullOrder,
  orderFields,
  readStored,
  storedColumnsKey,
  type StoredColumns
} from 'sections/reconciliation/columns';
import { currentMonth, monthDate, monthOf } from 'sections/reconciliation/month';
import OrderTaxTypeIcon from 'components/OrderTaxTypeIcon';
import ReconciliationColumnDrawer from 'sections/reconciliation/ReconciliationColumnDrawer';
import ReconciliationFilterDrawer from 'sections/reconciliation/ReconciliationFilterDrawer';
import { STICKY_TOP } from 'sections/reconciliation/SidePanel';
import toolButtonSx from 'sections/reconciliation/toolButton';
import useColumnDrag from 'hooks/useColumnDrag';
import useConfig from 'hooks/useConfig';
import useLocalStorage from 'hooks/useLocalStorage';
import type {
  ReconciliationFailure,
  ReconciliationFailureLevel,
  ReconciliationFieldSource,
  ReconciliationOrder
} from 'types/reconciliation';
import { orderTaxTypes, type OrderTaxType } from 'types/tax';

const amountFields: string[] = [
  'order.facilitatorTax',
  'order.subTotal',
  'order.grandTotal',
  'order.refundedAmount',
  'gateway.paidAmount',
  'gateway.facilitatorTax',
  'gateway.refundedAmount',
  'calculated.targetInvoice'
];
const dateFields: string[] = ['order.orderDate'];

// A field path is not a name a message can interpolate — an ICU argument carries no dot — so a failure hands its
// values over under the path's segments joined up: `order.refundedAmount` is `{orderRefundedAmount}`.
const placeholderName = (field: string) => field.replace(/\.(.)/g, (ignored, first: string) => first.toUpperCase());

// A field is addressed by the path it sits at, `<source>.<field>`, so reading one is walking that path. An unknown
// path reads as nothing collected, which is what a field the API has gained since this screen was built would be.
const valueAt = (order: ReconciliationOrder, path: string): unknown =>
  path.split('.').reduce<unknown>((held, segment) => (held as Record<string, unknown>)?.[segment], order);

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
  const value = valueAt(order, field);
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

/** The marketplaces orders are collected from, spelled as the backend labels them and listed as it names them. */
const marketplaces = ['BrickLink', 'BrickOwl'] as const;

/**
 * The month an address is asking for. One that names no month, or names something that is not a month or has not
 * happened, is read as this one.
 */
const monthIn = (params: URLSearchParams) => {
  const asked = params.get('month');
  return asked && /^\d{4}-\d{2}$/.test(asked) && asked <= currentMonth() ? asked : currentMonth();
};

/**
 * How a facet value is written in the address. Every value is written as it was collected but one: the unstated
 * option carries a character no address can hold, so it is written as the plain word instead. A collected value that
 * happens to read as that word takes a `!` in front of it, and one that already reads that way takes another, so no
 * marketplace can word its way into the option that stands for having worded nothing.
 */
const writtenValue = (value: string) => (value === unstated ? 'unstated' : value.replace(/^(!*unstated)$/, '!$1'));

const readValue = (written: string) => (written === 'unstated' ? unstated : written.replace(/^!(!*unstated)$/, '$1'));

/**
 * The parameter the coloured levels ride in, holding them as one comma-separated list rather than one entry each: a
 * level is a word of this screen's own rather than a marketplace's, so the separator is safe here, and an empty list
 * is how an address says that nothing is coloured — which repeated entries could not say at all.
 */
const highlightParam = 'highlight';

/** Errors and warnings are coloured until an address says otherwise, being the rows the screen is opened to find. */
const defaultTinted: FilterLevel[] = ['error', 'warning'];

/** The levels an address colours: the default where it names none, and only what it names where it does. */
const tintedIn = (params: URLSearchParams) => {
  const asked = params.get(highlightParam);
  if (asked === null) {
    return defaultTinted;
  }
  const named = asked.split(',');
  // Read back loudest first rather than in the order the address happens to list them, and anything that is not a
  // level is not one.
  return filterLevels.filter((level) => named.includes(level));
};

const orderKey = (order: ReconciliationOrder) => `${order.order.source}-${order.order.orderId}`;

/**
 * The height of the table card's title bar. It sticks under the app header and the table's head stops under it in
 * turn, so the two of them need to agree on a number. It is kept to a single row — the month, how much of it is on
 * screen, and the buttons — which is what lets that number be stated rather than measured.
 */
const TITLE_HEIGHT = 68;

/**
 * The height of the head's first row, which names the account each run of columns came from. It is stated rather
 * than measured because the row below it sticks under it: a row that stopped at a height read back after the fact
 * would land over the groups on the first scroll of the page.
 */
const GROUP_HEIGHT = 33;

/**
 * The edge between one run of columns and the next, drawn the full height of the table so a group reads down it and
 * not only across its head. It is the divider's own colour rather than a colour per source: the rows are already
 * tinted by how an order reconciled, which is the thing being looked for, and a second colour running through them
 * would compete with it.
 */
const bandEdge = { borderInlineStart: (theme: Theme) => `1px solid ${theme.palette.divider}` };

/**
 * How a group's name is set against the column headings under it. The theme heads a table in bold uppercase, and a
 * group saying its name that way says it as loudly as the columns it stands over — but it is the quieter of the two,
 * naming where the headings came from rather than what they are. So it is set lighter, in the secondary colour and
 * in its own case, and the headings stay the loudest thing in the head.
 *
 * <p>It is also kept to one line. A name is not always as wide as the run it spans — a run of one narrow column
 * least of all — and a name broken across two lines reads as two names and leaves the row a different height than
 * the one the columns below it stick under. The run's own columns widen to hold it instead.
 */
const groupTitleSx = {
  textTransform: 'none',
  fontWeight: 400,
  color: 'text.secondary',
  whiteSpace: 'nowrap'
} as const;

/** The corner MainCard rounds itself to, which anything painting its own ground at the card's edge has to match. */
const CARD_RADIUS = 12;

/**
 * The results between the two panels — the filters on one side, the columns on the other — sliding over where a
 * panel was when it is closed.
 */
const Main = styled('main', {
  shouldForwardProp: (prop: string) => prop !== 'open' && prop !== 'columns' && prop !== 'container'
})<{
  open: boolean;
  /** Whether the panel on the other side is open, which is the same question about the other margin. */
  columns: boolean;
  container: boolean;
}>(({ theme }) => ({
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
    },
    { props: ({ container }) => container, style: { [theme.breakpoints.only('lg')]: { marginRight: 0 } } },
    { props: ({ container, columns }) => container && !columns, style: { [theme.breakpoints.only('lg')]: { marginRight: -260 } } },
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

export default function ReconciliationPage() {
  const intl = useIntl();
  // What is being read is where the screen is rather than something it merely remembers, so all of it is kept in the
  // address: the month, the filters narrowing it, and the levels coloured. A reload, a bookmark, a link handed to
  // someone else, or the browser's own Back arrow then all land on the table they left, and a step to another month
  // is a step with the same narrowing and colouring rather than a fresh start. An address that names no month, or
  // names one that is not a month or has not happened, is read as this one.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMonth = monthIn(searchParams);
  // Colouring is not filtering: this decides how the rows that are shown read, not which rows those are.
  const tintedLevels = tintedIn(searchParams);
  const [selectedOrder, setSelectedOrder] = useState<ReconciliationOrder | null>(null);
  const [selectedFailure, setSelectedFailure] = useState<string | null>(null);
  const [generatingOrder, setGeneratingOrder] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const { container } = useConfig();
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));
  // At rest the title bar is the card's rounded top and must round with it; stuck, the card's top is gone and a
  // rounded bar leaves two wedges at its corners for the rows behind to show through. Which of the two it is, is the
  // one thing about this screen that cannot be said in CSS, so a mark at the card's top says it.
  const cardTopRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(!downLG);
  // The columns are arranged now and then and read every day, so their panel stays shut until it is asked for.
  const [columnsOpen, setColumnsOpen] = useState(false);
  // Which columns are read is where the screen is as much as which orders are, so the address carries them too and a
  // link hands the table over arranged as it was left. What this browser opens with is a separate question, asked of
  // storage rather than of the address and answered only when the save button says so: an address that names columns
  // is answering for the visit it opened, and one that names none falls back to what was saved here.
  const [storedColumns, setStoredColumns] = useLocalStorage<StoredColumns>(storedColumnsKey, defaultColumns);
  const remembered = readStored(storedColumns);
  const shownColumns = columnsIn(searchParams) ?? remembered.shown;
  // The address carries the shown columns alone — that is what a link is worth handing over — so where the hidden
  // ones stand is the screen's own to hold until it is saved. It starts from what was saved, which is what brings a
  // hidden column back where it was left rather than at the end of the list.
  const [columnBase, setColumnBase] = useState<string[]>(remembered.order);
  const columnOrder = fullOrder(shownColumns, columnBase);
  // The columns are dragged by their own headings as well as from the panel; both settle the same order.
  const columnDrag = useColumnDrag(shownColumns, (shown) => reorderShownColumns(shown));
  const {
    reconciliationOrders,
    reconciliationOrdersError,
    reconciliationOrdersLoading,
    reconciliationOrdersRefreshing,
    reloadReconciliationOrders
  } = useGetReconciliationOrders(selectedMonth);

  useEffect(() => {
    const cardTop = cardTopRef.current;
    if (!cardTop) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      rootMargin: `-${STICKY_TOP}px 0px 0px 0px`
    });
    observer.observe(cardTop);
    return () => observer.disconnect();
  }, []);

  /**
   * Rewrites the address from the parameters it holds at the time rather than the ones this render read: a second
   * click of an arrow has to step off the month the first one moved to, not from the same place twice, and a second
   * tick has to work from the selection the first one made.
   *
   * <p>Whatever the change does not touch is carried across, which is what walks the filters and the colouring from
   * one month to the next.
   */
  const updateParams = (change: (params: URLSearchParams) => void, replace = false) =>
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        change(params);
        return params;
      },
      { replace }
    );

  /**
   * Arranges the table: the address takes the shown columns in the order they are read, and the screen keeps the
   * whole order behind them. Neither is remembered past this visit until the save button says to remember it.
   */
  const applyColumns = (order: string[], shown: string[]) => {
    setColumnBase(order);
    // Arranging the table is not a place to have been, no more than narrowing it is: Back is for the month.
    updateParams((params) => params.set(columnParam, shown.join(',')), true);
  };

  /** Shows or hides one column, a shown one taking its place in the table's own order rather than at the end. */
  const toggleColumn = (field: string) =>
    applyColumns(
      columnOrder,
      shownColumns.includes(field)
        ? shownColumns.filter((kept) => kept !== field)
        : columnOrder.filter((kept) => kept === field || shownColumns.includes(kept))
    );

  /**
   * Shows or hides every column of one source at once. The shown columns keep the table's own order rather than
   * arriving in the group's, so asking for everything a source says does not rearrange what was already read.
   */
  const toggleColumnGroup = (fields: string[], show: boolean) =>
    applyColumns(
      columnOrder,
      show
        ? columnOrder.filter((kept) => fields.includes(kept) || shownColumns.includes(kept))
        : shownColumns.filter((kept) => !fields.includes(kept))
    );

  /**
   * Takes an order of the shown columns alone, which is what dragging the table's own headings settles: the hidden
   * ones are not there to be dragged, so they settle around what moved rather than being moved themselves.
   */
  const reorderShownColumns = (shown: string[]) => applyColumns(fullOrder(shown, columnOrder), shown);

  const resetColumns = () => applyColumns(defaultOrder, columnFields);

  const columnsChanged = shownColumns.join(',') !== columnFields.join(',') || columnOrder.join(',') !== defaultOrder.join(',');

  /** Makes this arrangement the one this browser opens with, hidden columns and the places they hold included. */
  const saveColumns = () => setStoredColumns({ order: columnOrder, shown: shownColumns });

  const columnsSaved = shownColumns.join(',') === remembered.shown.join(',') && columnOrder.join(',') === remembered.order.join(',');

  /** Moves to the month `next` names. */
  const goToMonth = (next: (from: string) => string) => updateParams((params) => params.set('month', next(monthIn(params))));

  const handleMonthChange = (month: string) => goToMonth(() => month);

  // The screen is read a month at a time, so the neighbouring months are a click rather than a trip to the picker.
  // Ahead of this month there is nothing to collect, so the step forward stops there.
  const stepMonth = (months: number) =>
    goToMonth((from) => {
      const stepped = monthDate(from);
      stepped.setMonth(stepped.getMonth() + months);
      return monthOf(stepped);
    });

  const handleGenerateInvoice = async (order: ReconciliationOrder) => {
    setGeneratingOrder(orderKey(order));
    setGenerationError(null);
    setGenerationMessage(null);
    try {
      const result = await generateInvoice(order.order.orderId, order.order.source);
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

  // A field's own name, without the source it sits under. Every place a field is named says the source some other
  // way — the detail view and the picker head their groups with it — and a heading carrying it as well would read
  // as part of the column's name rather than as the account behind it.
  const fieldLabel = (field: string) => intl.formatMessage({ id: `reconciliation-field-${field.replace(/\./g, '-')}` });

  const sourceLabel = (source: ReconciliationFieldSource) => intl.formatMessage({ id: `reconciliation-source-${source}` });

  // Which account stated each field, as the API reports it. A field the API did not report is read as calculated:
  // whatever it is, nobody stated it to this screen, and it is better grouped with the derived than dropped.
  const fieldSource = (field: string): ReconciliationFieldSource =>
    reconciliationOrders?.fields.find((declared) => declared.name === field)?.source ?? 'calculated';

  /**
   * The shown columns in runs of one source. A source split apart by a column of another is two runs rather than
   * one: columns that are not next to each other are not a band, and a heading spanning them would claim the column
   * between them. The table is arranged so its amounts read as the sums they make, which is not the order the
   * sources come in, so a source standing in two places is ordinary rather than exceptional.
   */
  const columnRuns = (): { source: ReconciliationFieldSource; fields: string[] }[] => {
    const built: { source: ReconciliationFieldSource; fields: string[] }[] = [];
    shownColumns.forEach((field) => {
      const last = built.at(-1);
      const source = fieldSource(field);
      if (last?.source === source) {
        last.fields.push(field);
      } else {
        built.push({ source, fields: [field] });
      }
    });
    return built;
  };

  const runs = columnRuns();

  /** The columns a band starts at, which are the ones that draw its edge. The table's first column starts none. */
  const bandStarts = new Set(runs.slice(1).map((run) => run.fields[0]));

  // The detail view reads the fields grouped by the account that stated them, in the order the API declares the
  // sources it actually reported: what the marketplace said and what the gateway said are two claims about one
  // order, and a flat list of them reads as one claim with the sources shuffled into it.
  const fieldGroups = (): { source: ReconciliationFieldSource; fields: string[] }[] => {
    const groups: { source: ReconciliationFieldSource; fields: string[] }[] = [];
    orderFields.forEach((field) => {
      const source = fieldSource(field);
      const group = groups.find((held) => held.source === source);
      if (group) {
        group.fields.push(field);
      } else {
        groups.push({ source, fields: [field] });
      }
    });
    return groups;
  };

  // The backend words nothing, so the tax type arrives as a code and is worded here, as a failure code is. Every
  // other field is already the value it reads as.
  const fieldValue = (order: ReconciliationOrder, field: string) => {
    if (field !== 'order.taxType') {
      return formatFieldValue(order, field);
    }
    return order.order.taxType ? intl.formatMessage({ id: `order-tax-type-${order.order.taxType}` }) : '—';
  };

  // Two fields name something the provider also shows: the order id names the order and the payment method names
  // the payment. Each carries the link to it rather than spending a column on one, and each says where it goes in
  // its accessible label. Every other field, and one with nothing collected to link to, stays the plain value it is.
  const fieldLink = (order: ReconciliationOrder, field: string) => {
    if (field === 'order.orderId') {
      return {
        url: order.order.orderUrl,
        label: intl.formatMessage({ id: 'reconciliation-order-link' }, { source: order.order.source })
      };
    }
    if (field === 'order.paymentMethod') {
      return {
        url: order.gateway.paymentUrl,
        label: intl.formatMessage({ id: 'reconciliation-payment-link' }, { paymentMethod: fieldValue(order, 'order.paymentMethod') })
      };
    }
    return null;
  };

  const linkedFieldValue = (order: ReconciliationOrder, field: string) => {
    const value = fieldValue(order, field);
    const link = fieldLink(order, field);
    if (!link?.url) {
      return value;
    }
    return (
      <Link
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        underline="hover"
        aria-label={link.label}
        // The row opens the detail dialog, so following the link must not open it as well.
        onClick={(event) => event.stopPropagation()}
      >
        {value}
      </Link>
    );
  };

  const failureMessage = (order: ReconciliationOrder, failure: ReconciliationFailure) =>
    intl.formatMessage(
      { id: `reconciliation-failure-${failure.code}` },
      {
        ...Object.fromEntries(failure.fields.map((field) => [placeholderName(field), fieldValue(order, field)])),
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
      { source: order.order.source, orderId: order.order.orderId, level: levelName(orderLevel(order)) }
    );

  const taxTypeName = (taxType: OrderTaxType) => intl.formatMessage({ id: `order-tax-type-${taxType}` });

  // What the month's orders can be narrowed by. Adding a filter is adding an entry here.
  const facets: OrderFacet[] = [
    {
      key: 'source',
      valueOf: (order) => order.order.source,
      // Each marketplace names itself, so its name is already the label.
      label: (value) => value,
      declared: marketplaces,
      // Coloured as the row's own source chip is, so a box and the chips it stands for read as the same marketplace.
      color: sourceColor
    },
    {
      key: 'level',
      valueOf: (order) => orderLevel(order) ?? 'none',
      label: (value) => levelName(value === 'none' ? null : (value as ShownLevel)),
      declared: filterLevels,
      color: (value) => levelColor(value as FilterLevel)
    },
    {
      key: 'taxType',
      valueOf: (order) => order.order.taxType,
      label: (value) => taxTypeName(value as OrderTaxType),
      declared: orderTaxTypes,
      icon: (value) => <OrderTaxTypeIcon taxType={value as OrderTaxType} size={16} />
    },
    {
      key: 'paymentMethod',
      valueOf: (order) => order.order.paymentMethod,
      // Collected as the marketplace worded it, so the wording is already the label.
      label: (value) => value
    }
  ];

  // Each facet reads the parameter it is named for, so a filter added to the list above is carried by the address
  // without a word of its own here. Nothing is filtered out until an address asks for it: the month is collected to
  // be looked at whole first.
  const selection: FilterSelection = Object.fromEntries(facets.map((facet) => [facet.key, searchParams.getAll(facet.key).map(readValue)]));

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

  // Narrowing or colouring the table is not a place to have been, so each rewrites the address rather than leaving an
  // entry behind the Back arrow for every box ticked and every chip clicked. Back is for the month.
  const toggleLevel = (level: FilterLevel) =>
    updateParams((params) => {
      const tinted = tintedIn(params);
      const next = tinted.includes(level) ? tinted.filter((kept) => kept !== level) : [...tinted, level];
      // Written loudest first, so the address reads the same however the chips were clicked to get there.
      params.set(highlightParam, filterLevels.filter((kept) => next.includes(kept)).join(','));
    }, true);

  /** The row's background colour, or null when its level is coloured off. */
  const rowTint = (level: FilterLevel) => (isLevelTinted(level) ? levelColor(level) : null);

  const toggleFilter = (facetKey: string, value: string) =>
    updateParams((params) => {
      const written = writtenValue(value);
      const selected = params.getAll(facetKey);
      const next = selected.includes(written) ? selected.filter((kept) => kept !== written) : [...selected, written];
      params.delete(facetKey);
      next.forEach((kept) => params.append(facetKey, kept));
    }, true);

  const clearFilters = () => updateParams((params) => facets.forEach((facet) => params.delete(facet.key)), true);

  // The month being read is the table's title, walked by the arrows either side of it and picked outright by the
  // title itself, which opens a picker of its own rather than the browser's.
  const monthTitle = (
    <Stack component="span" direction="row" useFlexGap sx={{ gap: 1.5, alignItems: 'center' }}>
      {/* Only while the panel is away, and at the end of the bar the panel comes back to: open, the panel is its own
          close button, and a button here that turned it off would be a second answer to a question it already
          answers. */}
      {!filtersOpen && (
        <Tooltip title={intl.formatMessage({ id: 'reconciliation-filters' })} arrow>
          <IconButton
            variant="light"
            color="secondary"
            aria-label={intl.formatMessage({ id: 'reconciliation-filters' })}
            onClick={() => setFiltersOpen(true)}
            sx={toolButtonSx}
          >
            <FilterSearch size={18} />
          </IconButton>
        </Tooltip>
      )}
      <Stack component="span" direction="row" useFlexGap sx={{ gap: 0.5, alignItems: 'center' }}>
        <Tooltip title={intl.formatMessage({ id: 'reconciliation-month-previous' })} arrow>
          <IconButton
            size="small"
            color="secondary"
            aria-label={intl.formatMessage({ id: 'reconciliation-month-previous' })}
            onClick={() => stepMonth(-1)}
          >
            <ArrowLeft2 size={16} />
          </IconButton>
        </Tooltip>
        <MonthPicker value={selectedMonth} max={currentMonth()} onChange={handleMonthChange} />
        <Tooltip title={intl.formatMessage({ id: 'reconciliation-month-next' })} arrow>
          <span>
            <IconButton
              size="small"
              color="secondary"
              // Nothing has happened yet in a month that has not started.
              disabled={selectedMonth >= currentMonth()}
              aria-label={intl.formatMessage({ id: 'reconciliation-month-next' })}
              onClick={() => stepMonth(1)}
            >
              <ArrowRight2 size={16} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      {/* Level with the month rather than under it, and only once a month has been collected: until then there is
          nothing to have shown a part of. It is the first thing a narrow screen gives up, the month and the buttons
          being the two the bar is for. */}
      {reconciliationOrders && (
        <Typography component="span" variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
          {intl.formatMessage({ id: 'reconciliation-filter-showing' }, { shown: shownOrders.length, total: collectedOrders.length })}
        </Typography>
      )}
    </Stack>
  );

  // The providers keep moving, so the month already on screen is worth asking for again. Collecting queries every one
  // of them, so the button says it is working and refuses a second click until it is done. It is its icon alone, so it
  // says what it is in its tooltip and its label.
  const monthActions = (
    <Stack direction="row" useFlexGap sx={{ gap: 0.5, alignItems: 'center' }}>
      {/* Only while the panel is away, as the filter button is: open, the panel is its own close button. */}
      {!columnsOpen && (
        <Tooltip title={intl.formatMessage({ id: 'reconciliation-columns' })} arrow>
          <IconButton
            variant="light"
            color="secondary"
            aria-label={intl.formatMessage({ id: 'reconciliation-columns' })}
            onClick={() => setColumnsOpen(true)}
            sx={toolButtonSx}
          >
            <Kanban size={18} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip
        title={intl.formatMessage({ id: reconciliationOrdersRefreshing ? 'reconciliation-refreshing' : 'reconciliation-refresh' })}
        arrow
      >
        <span>
          <IconButton
            variant="light"
            color="secondary"
            disabled={reconciliationOrdersRefreshing}
            aria-label={intl.formatMessage({ id: 'reconciliation-refresh' })}
            onClick={() => reloadReconciliationOrders()}
            sx={toolButtonSx}
          >
            {reconciliationOrdersRefreshing ? <CircularProgress size={18} color="inherit" /> : <Refresh size={18} />}
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );

  return (
    <Stack>
      <Box sx={{ display: 'flex' }}>
        <ReconciliationFilterDrawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          filtered={isFiltered}
          onClear={clearFilters}
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

        <Main open={filtersOpen} columns={columnsOpen} container={container}>
          <Stack spacing={2} sx={{ mt: 2.5 }}>
            {generationError && <Alert severity="error">{generationError}</Alert>}
            {generationMessage && <Alert severity="success">{generationMessage}</Alert>}

            {/* The month is what the table is of, so it is the table's own title rather than a bar of its own above
                it. The count beside it and the buttons at its end are what the same one-line bar has room for, and
                the bar stays under the app header so the month can still be changed from the foot of a long one. */}
            <MainCard
              content={false}
              title={monthTitle}
              secondary={monthActions}
              // The bar draws its own bottom edge, the card's divider being a sibling that would scroll out from
              // under it.
              divider={false}
              sx={{
                // The table scrolls with the page, so nothing between it and the page may clip: a scrolling ancestor
                // would catch the sticky head and hold it inside the card instead of under the app header.
                overflow: 'visible',
                // A month long enough to scroll is a month whose picker must still be reachable at the bottom of it,
                // so the bar sticks under the app header and the table's head stops under the bar.
                '& .MuiCardHeader-root': {
                  position: 'sticky',
                  // The same rest the panel beside it comes to, so the two stop level rather than one under the other.
                  top: STICKY_TOP,
                  zIndex: 3,
                  height: TITLE_HEIGHT,
                  py: 0,
                  // A ground of its own, so the rows travel under it rather than through it. It is the card's rounded
                  // top and rounds with it, as the panel beside it rounds: the two stop level and must stop alike.
                  bgcolor: 'background.paper',
                  borderTopLeftRadius: 'inherit',
                  borderTopRightRadius: 'inherit',
                  // Once the card's top has gone, what lies behind the corners those curves cut away is a row, which
                  // shows through as a notch of its colour. So while the bar is stuck its ground is laid in two: the
                  // page's own colour square to the corners, and the paper rounded over it. The paper goes behind the
                  // bar's text and in front of its ground, which is what the negative layer is for. At rest neither is
                  // wanted — behind those corners is the card's own paper, and page colour there greys them.
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
                    // The app header is translucent and blurs whatever passes behind it, which for a table is a smear
                    // of rows rather than nothing at all. The bar carries a plain ground of the page's own colour up
                    // into that band and leaves the blur nothing to find. Measured from the bar rather than from the
                    // top of the screen, so it covers the band whatever height the app header turns out to be, and
                    // only while the bar is stuck, when there is nothing above the card left to cover up.
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
                  '&:last-of-type': { borderBottomRightRadius: CARD_RADIUS }
                }
              }}
            >
              <Box ref={cardTopRef} sx={{ position: 'absolute', top: 0, left: 0, width: '1px', height: '1px' }} />

              {reconciliationOrdersLoading && <Skeleton variant="rounded" height={320} sx={{ m: 2.5 }} />}

              {reconciliationOrdersError && (
                <Alert severity="error" sx={{ m: 2.5 }}>
                  {reconciliationOrdersError.message || intl.formatMessage({ id: 'reconciliation-load-error' })}
                </Alert>
              )}

              {!reconciliationOrdersLoading &&
                !reconciliationOrdersError &&
                reconciliationOrders &&
                (shownOrders.length ? (
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
                        // The head is two rows now, so each stops at its own height: the groups under the title bar
                        // and the columns under the groups. The bottom edge belongs to the row the body meets.
                        '& .MuiTableCell-stickyHeader': {
                          top: STICKY_TOP + TITLE_HEIGHT + GROUP_HEIGHT,
                          bgcolor: 'secondary.lighter',
                          borderBottom: (theme) => `2px solid ${theme.palette.divider}`
                        },
                        '& .MuiTableRow-root:first-of-type .MuiTableCell-stickyHeader': {
                          top: STICKY_TOP + TITLE_HEIGHT,
                          height: GROUP_HEIGHT,
                          borderBottom: 'none'
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
                              {sourceLabel(run.source)}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ width: 92 }}>{intl.formatMessage({ id: 'reconciliation-actions' })}</TableCell>
                          {shownColumns.map((field) => {
                            const { sx, ...dragging } = columnDrag(field);
                            return (
                              <TableCell
                                key={field}
                                align={amountFields.includes(field) ? 'right' : 'left'}
                                // The heading is what a column is moved by, dragged or with the arrow keys, so it
                                // says so rather than reading as a word that happens to answer the keyboard.
                                aria-label={intl.formatMessage({ id: 'reconciliation-column-move' }, { column: fieldLabel(field) })}
                                sx={{ ...(bandStarts.has(field) && bandEdge), ...sx }}
                                {...dragging}
                              >
                                {fieldLabel(field)}
                              </TableCell>
                            );
                          })}
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
                                          { source: order.order.source, orderId: order.order.orderId }
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
                                  {order.order.taxType && (
                                    <Tooltip title={taxTypeName(order.order.taxType)} arrow>
                                      <Box
                                        component="span"
                                        role="img"
                                        aria-label={taxTypeName(order.order.taxType)}
                                        sx={{ display: 'inline-flex' }}
                                      >
                                        <OrderTaxTypeIcon taxType={order.order.taxType} />
                                      </Box>
                                    </Tooltip>
                                  )}
                                </Stack>
                              </TableCell>
                              {shownColumns.map((field) => (
                                <TableCell
                                  key={field}
                                  align={amountFields.includes(field) ? 'right' : 'left'}
                                  sx={{
                                    ...(bandStarts.has(field) && bandEdge),
                                    ...(dateFields.includes(field) && { whiteSpace: 'nowrap' })
                                  }}
                                >
                                  {field === 'order.source' ? (
                                    <Chip
                                      label={order.order.source}
                                      size="small"
                                      color={sourceColor(order.order.source)}
                                      variant="outlined"
                                    />
                                  ) : (
                                    linkedFieldValue(order, field)
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
                      <Button size="small" color="secondary" onClick={clearFilters} sx={{ mt: 1 }}>
                        {intl.formatMessage({ id: 'reconciliation-filter-clear' })}
                      </Button>
                    )}
                  </Box>
                ))}
            </MainCard>
          </Stack>
        </Main>

        <ReconciliationColumnDrawer
          open={columnsOpen}
          onClose={() => setColumnsOpen(false)}
          changed={columnsChanged}
          onReset={resetColumns}
          saved={columnsSaved}
          onSave={saveColumns}
        >
          <ColumnPicker
            groups={fieldGroups().map((group) => ({
              key: group.source,
              label: sourceLabel(group.source),
              columns: group.fields.map((field) => ({ key: field, label: fieldLabel(field) }))
            }))}
            shown={shownColumns}
            onToggle={toggleColumn}
            onToggleGroup={toggleColumnGroup}
            groupLabel={(label) => intl.formatMessage({ id: 'reconciliation-columns-group' }, { source: label })}
          />
        </ReconciliationColumnDrawer>
      </Box>

      <Dialog open={Boolean(selectedOrder)} onClose={closeOrder} fullWidth maxWidth="sm">
        {selectedOrder && (
          <>
            <DialogTitle>
              {intl.formatMessage(
                { id: 'reconciliation-detail-title' },
                { source: selectedOrder.order.source, orderId: selectedOrder.order.orderId }
              )}
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2.5}>
                {fieldGroups().map((group) => (
                  // Each account of the order is titled and ruled off, the way a card titles what it holds: a
                  // heading alone left the groups to be noticed rather than seen, and which account stated a value
                  // is the whole reason these are grouped at all.
                  <Stack key={group.source} spacing={0.5}>
                    <Typography variant="subtitle1">{sourceLabel(group.source)}</Typography>
                    <Divider />
                    {group.fields.map((field) => (
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
                        <Typography>{linkedFieldValue(selectedOrder, field)}</Typography>
                      </Stack>
                    ))}
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
