import { useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear } from 'date-fns';
import { ArrowLeft2, ArrowRight2 } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import IconButton from 'components/@extended/IconButton';
import { rangeBandSx, rangeCellSx } from 'components/period/rangeCell';
import { selectRangeDate, type RangeEdge } from 'components/period/rangeSelection';

interface Props {
  /** Whole months or whole years - the day calendar draws the third. */
  unit: 'month' | 'year';
  from: Date | null;
  to: Date | null;
  onFromChange: (date: Date | null) => void;
  onToChange: (date: Date | null) => void;
}

const EARLIEST_YEAR = 1900;
const LATEST_YEAR = 2099;

/** Twelve cells either way: the months of one year, or one page of years. */
const CELLS = 12;

/** Whether a date is exactly the boundary its unit puts there, e.g. the last day of its month. */
const onBoundary = (date: Date, bound: (date: Date) => Date) => format(date, 'yyyy-MM-dd') === format(bound(date), 'yyyy-MM-dd');

/**
 * The unit a range was drawn in, read back off its dates: whole years if it opens on a 1 January and closes on a 31
 * December, whole months if it spans its months end to end, and days otherwise. It is what reopening the picker shows,
 * so a range of months is edited in months rather than in the days it happens to begin and end on.
 */
export function rangeUnitOf(from: Date, to: Date): 'day' | 'month' | 'year' {
  if (onBoundary(from, startOfYear) && onBoundary(to, endOfYear)) return 'year';
  if (onBoundary(from, startOfMonth) && onBoundary(to, endOfMonth)) return 'month';
  return 'day';
}

/**
 * A range picked in whole months or whole years, endpoint by endpoint, the way the day calendar beside it is picked.
 *
 * <p>A quarter, a half-year or three years running is a range somebody states in its own units rather than as the
 * two days it happens to begin and end on. Each cell stands for the whole month or year: the start opens on its
 * first day and the end closes on its last, so what is applied is still a pair of dates.
 */
export default function PeriodRangeGrid({ unit, from, to, onFromChange, onToChange }: Props) {
  const intl = useIntl();
  const [edge, setEdge] = useState<RangeEdge>('to');
  const [hovered, setHovered] = useState<Date | null>(null);
  const [shownYear, setShownYear] = useState(() => (from ?? new Date()).getFullYear());

  const value = (date: Date) => format(date, unit === 'year' ? 'yyyy' : 'yyyy-MM');
  const page = Math.floor(shownYear / CELLS) * CELLS;
  const cells = Array.from({ length: CELLS }, (_, index) =>
    unit === 'year' ? new Date(page + index, 0, 1) : new Date(shownYear, index, 1)
  );

  const selection = { from, to, edge };
  const preview = hovered ? selectRangeDate(selection, hovered, unit) : selection;
  const pick = (date: Date) => {
    const next = selectRangeDate(selection, date, unit);
    onFromChange(next.from);
    onToChange(next.to && (unit === 'year' ? endOfYear(next.to) : endOfMonth(next.to)));
    setEdge(next.edge);
    setHovered(null);
  };

  // A year page moves by twelve and a month grid by one, which is what each of them shows.
  const step = unit === 'year' ? CELLS : 1;
  const shown = unit === 'year' ? `${page} – ${page + CELLS - 1}` : shownYear;

  return (
    <Stack sx={{ gap: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton
          size="small"
          color="secondary"
          disabled={shownYear - step < EARLIEST_YEAR}
          aria-label={intl.formatMessage({ id: unit === 'year' ? 'period-years-previous' : 'period-year-previous' })}
          onClick={() => {
            setHovered(null);
            setShownYear(shownYear - step);
          }}
        >
          <ArrowLeft2 size={16} />
        </IconButton>
        <Typography variant="subtitle1">{shown}</Typography>
        <IconButton
          size="small"
          color="secondary"
          disabled={shownYear + step > LATEST_YEAR}
          aria-label={intl.formatMessage({ id: unit === 'year' ? 'period-years-next' : 'period-year-next' })}
          onClick={() => {
            setHovered(null);
            setShownYear(shownYear + step);
          }}
        >
          <ArrowRight2 size={16} />
        </IconButton>
      </Stack>
      <Box onMouseLeave={() => setHovered(null)} sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.5 }}>
        {cells.map((date) => {
          const cell = value(date);
          const endpoint = (end: Date | null) => end !== null && value(end) === cell;
          const between = (range: { from: Date | null; to: Date | null }) =>
            range.from !== null && range.to !== null && cell >= value(range.from) && cell <= value(range.to);
          const previewStart = endpoint(preview.from);
          const previewEnd = endpoint(preview.to);
          return (
            <Box key={cell} sx={rangeBandSx(between(preview), previewStart, previewEnd)}>
              <Button
                fullWidth
                onMouseEnter={() => setHovered(date)}
                onFocus={() => setHovered(date)}
                onBlur={() => setHovered(null)}
                aria-label={intl.formatDate(date, unit === 'year' ? { year: 'numeric' } : { month: 'long', year: 'numeric' })}
                aria-pressed={endpoint(from) || endpoint(to) || between({ from, to })}
                onClick={() => pick(date)}
                sx={{ ...rangeCellSx(endpoint(from) || endpoint(to), Boolean(hovered) && (previewStart || previewEnd)), py: 1.25 }}
              >
                {unit === 'year' ? cell : intl.formatDate(date, { month: 'short' })}
              </Button>
            </Box>
          );
        })}
      </Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" aria-live="polite" sx={{ flex: 1 }}>
          {intl.formatMessage({ id: !from ? `period-${unit}s-pick-start` : !to ? `period-${unit}s-pick-end` : 'period-adjust-range' })}
        </Typography>
        <Button
          size="small"
          color="secondary"
          disabled={!from && !to}
          sx={{ flexShrink: 0 }}
          onClick={() => {
            onFromChange(null);
            onToChange(null);
            setEdge('to');
            setHovered(null);
          }}
        >
          {intl.formatMessage({ id: 'period-start-over' })}
        </Button>
      </Stack>
    </Stack>
  );
}
