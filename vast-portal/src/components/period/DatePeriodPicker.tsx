import { useEffect, useId, useState } from 'react';

import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import { ArrowDown2, ArrowLeft2, ArrowRight2, Calendar, CloseCircle } from 'iconsax-reactjs';
import IconButton from 'components/@extended/IconButton';
import periodButtonSx from 'components/period/periodButton';
import { currentPeriod, steppedPeriod } from 'utils/period';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import DateRangeCalendar from 'components/period/DateRangeCalendar';
import PeriodRangeGrid, { rangeUnitOf } from 'components/period/PeriodRangeGrid';
import type { RangeUnit } from 'components/period/rangeSelection';
import { endOfMonth, endOfYear, format, isValid, parseISO, startOfMonth, startOfYear, subMonths, subYears } from 'date-fns';
import { useIntl } from 'react-intl';

interface Props {
  from: string;
  to: string;
  allowRange?: boolean;
  allowYear?: boolean;
  view: 'month' | 'year' | 'range';
  onApply: (from: string, to: string, view: 'month' | 'year' | 'range') => void;
}

/** Edit both bounds before fetching providers again; a range may span any number of months. */
export default function DatePeriodPicker({ from, to, view, onApply, allowRange = false, allowYear = true }: Props) {
  const intl = useIntl();
  const panelId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [draftView, setDraftView] = useState(view);
  const [shownYear, setShownYear] = useState(() => parseISO(from).getFullYear());
  const [draftFrom, setDraftFrom] = useState<Date | null>(() => parseISO(from));
  const [draftTo, setDraftTo] = useState<Date | null>(() => parseISO(to));
  // Which units a custom range is drawn in. Read off the applied range, so one drawn in months reopens in months.
  const [rangeUnit, setRangeUnit] = useState<RangeUnit>(() => rangeUnitOf(parseISO(from), parseISO(to)));

  useEffect(() => {
    setShownYear(parseISO(from).getFullYear());
    setDraftView(view);
    setDraftFrom(parseISO(from));
    setDraftTo(parseISO(to));
    setRangeUnit(rangeUnitOf(parseISO(from), parseISO(to)));
  }, [from, to, view]);

  const selectPeriod = (period: string) => {
    const date = parseISO(period.length === 4 ? `${period}-01-01` : `${period}-01`);
    setDraftFrom(period.length === 4 ? startOfYear(date) : startOfMonth(date));
    setDraftTo(period.length === 4 ? endOfYear(date) : endOfMonth(date));
  };

  // The four spans a reader reaches for most: this and the one before it, in each of the two units on offer here.
  // Years are left out where the screen does not offer a year view at all, rather than applying one it cannot show.
  const now = new Date();
  const quickPeriods = [
    { key: 'this-month', from: startOfMonth(now), to: endOfMonth(now), view: 'month' as const },
    { key: 'last-month', from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)), view: 'month' as const },
    ...(allowYear
      ? [
          { key: 'this-year', from: startOfYear(now), to: endOfYear(now), view: 'year' as const },
          { key: 'last-year', from: startOfYear(subYears(now, 1)), to: endOfYear(subYears(now, 1)), view: 'year' as const }
        ]
      : [])
  ];

  // Applied on the spot rather than only drafted: a quick period is the one thing here already whole and valid the
  // moment it is picked, so waiting for a second click on Apply would make the shortcut slower than using it.
  const applyQuickPeriod = (period: (typeof quickPeriods)[number]) => {
    onApply(format(period.from, 'yyyy-MM-dd'), format(period.to, 'yyyy-MM-dd'), period.view);
    setAnchor(null);
  };

  const selectedQuickKey = quickPeriods.find(
    (period) => view === period.view && from === format(period.from, 'yyyy-MM-dd') && to === format(period.to, 'yyyy-MM-dd')
  )?.key;

  const valid =
    draftFrom !== null &&
    draftTo !== null &&
    isValid(draftFrom) &&
    isValid(draftTo) &&
    draftFrom <= draftTo &&
    draftFrom.getFullYear() >= 1900 &&
    draftTo.getFullYear() <= 2099;

  // Which end a half-drawn range is still waiting for, said in the units it is being drawn in.
  const pickHint = (bound: 'start' | 'end') => (rangeUnit === 'day' ? `period-pick-${bound}` : `period-${rangeUnit}s-pick-${bound}`);

  const selectedDate = draftFrom && isValid(draftFrom) ? draftFrom : parseISO(from);
  const currentYear = new Date().getFullYear();
  const yearPage = Math.floor(shownYear / 12) * 12;
  const choices =
    draftView === 'year'
      ? Array.from({ length: 12 }, (_, index) => new Date(yearPage + index, 0, 1))
      : Array.from({ length: 12 }, (_, index) => new Date(shownYear, index, 1));

  const selectedPeriod = view === 'year' ? from.slice(0, 4) : from.slice(0, 7);
  const title =
    view === 'range'
      ? `${intl.formatDate(parseISO(from))} – ${intl.formatDate(parseISO(to))}`
      : view === 'year'
        ? selectedPeriod
        : intl.formatDate(parseISO(from), { month: 'long', year: 'numeric' });
  const step = (amount: number) => {
    if (view === 'range') return;
    const next = steppedPeriod(selectedPeriod, amount);
    const date = parseISO(view === 'year' ? `${next}-01-01` : `${next}-01`);
    onApply(format(date, 'yyyy-MM-dd'), format(view === 'year' ? endOfYear(date) : endOfMonth(date), 'yyyy-MM-dd'), view);
  };

  return (
    <>
      <Stack component="span" direction="row" sx={{ alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        {view !== 'range' && (
          <Tooltip title={intl.formatMessage({ id: `period-${view}-previous` })}>
            <IconButton
              size="small"
              color="secondary"
              aria-label={intl.formatMessage({ id: `period-${view}-previous` })}
              onClick={() => step(-1)}
            >
              <ArrowLeft2 size={16} />
            </IconButton>
          </Tooltip>
        )}
        <Button
          color="inherit"
          endIcon={<ArrowDown2 size={14} />}
          aria-expanded={Boolean(anchor)}
          aria-controls={anchor ? panelId : undefined}
          aria-haspopup="dialog"
          sx={periodButtonSx}
          onClick={(event) => {
            setShownYear(parseISO(from).getFullYear());
            setDraftView(view);
            setDraftFrom(parseISO(from));
            setDraftTo(parseISO(to));
            setRangeUnit(rangeUnitOf(parseISO(from), parseISO(to)));
            setAnchor(event.currentTarget);
          }}
        >
          {title}
        </Button>
        {view !== 'range' && (
          <Tooltip title={intl.formatMessage({ id: `period-${view}-next` })}>
            <span>
              <IconButton
                size="small"
                color="secondary"
                disabled={selectedPeriod >= currentPeriod(view)}
                aria-label={intl.formatMessage({ id: `period-${view}-next` })}
                onClick={() => step(1)}
              >
                <ArrowRight2 size={16} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Stack>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { mt: 1, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' } } }}
      >
        <Stack id={panelId} role="dialog" aria-labelledby={`${panelId}-title`} sx={{ width: 388, maxWidth: 'calc(100vw - 32px)' }}>
          <Stack direction="row" sx={{ px: 2.5, pt: 2.5, pb: 2, alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ display: 'flex', p: 1, borderRadius: 1.5, bgcolor: 'primary.lighter', color: 'primary.main' }}>
              <Calendar size={20} />
            </Box>
            <Typography id={`${panelId}-title`} variant="h5" sx={{ flex: 1 }}>
              {intl.formatMessage({ id: 'period-choose' })}
            </Typography>
            <IconButton
              size="small"
              color="secondary"
              onClick={() => setAnchor(null)}
              aria-label={intl.formatMessage({ id: 'period-close' })}
            >
              <CloseCircle size={20} />
            </IconButton>
          </Stack>
          <Box sx={{ px: 2.5 }}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              sx={{
                p: 0.5,
                bgcolor: 'secondary.lighter',
                borderRadius: 1.5,
                '& .MuiToggleButtonGroup-grouped': {
                  border: 0,
                  borderRadius: '8px !important',
                  m: 0,
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    bgcolor: 'background.paper',
                    color: 'primary.main',
                    boxShadow: '0 1px 4px rgb(0 0 0 / 8%)',
                    '&:hover': { bgcolor: 'background.paper' }
                  }
                }
              }}
              value={draftView}
              aria-label={intl.formatMessage({ id: 'period-view' })}
              onChange={(_event, picked: Props['view'] | null) => {
                if (!picked) return;
                setDraftView(picked);
                if (picked !== 'range') {
                  const date = draftFrom && isValid(draftFrom) ? draftFrom : parseISO(from);
                  setShownYear(date.getFullYear());
                  selectPeriod(format(date, picked === 'year' ? 'yyyy' : 'yyyy-MM'));
                }
              }}
            >
              {['month', ...(allowYear ? ['year'] : []), ...(allowRange ? ['range'] : [])].map((option) => (
                <ToggleButton key={option} value={option} sx={{ px: 1, py: 0.75, textTransform: 'none' }}>
                  {intl.formatMessage({ id: option === 'range' ? 'period-range' : `period-view-${option}` })}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          {/* Set apart from the Month/Year/Range switch above: that chooses how to browse, this jumps straight to an
              answer and throws away whatever was being browsed or drawn — a tinted strip and a filled chip are what
              say "this replaces your selection" rather than "this is one more way to narrow it". Never more than
              four of these, so they are kept to one line rather than left to wrap onto a second. */}
          <Stack
            direction="row"
            sx={{
              mx: 2.5,
              mt: 1.5,
              py: 0.75,
              px: 1,
              gap: 0.5,
              justifyContent: 'center',
              flexWrap: 'nowrap',
              bgcolor: 'primary.lighter',
              borderRadius: 1.5
            }}
          >
            {quickPeriods.map((period) => {
              const selected = period.key === selectedQuickKey;
              return (
                <Chip
                  key={period.key}
                  size="small"
                  clickable
                  color="primary"
                  variant={selected ? 'filled' : 'outlined'}
                  label={intl.formatMessage({ id: `period-quick-${period.key}` })}
                  onClick={() => applyQuickPeriod(period)}
                  sx={{
                    bgcolor: selected ? undefined : 'background.paper',
                    '& .MuiChip-label': { px: 1, fontSize: '0.75rem' }
                  }}
                />
              );
            })}
          </Stack>
          <Stack sx={{ p: 2.5, gap: 2, minHeight: 264 }}>
            {draftView === 'range' && (
              <Stack direction="row" sx={{ justifyContent: 'center' }}>
                {/* Named for a screen reader only: three buttons reading Days, Months and Years say what they are. */}
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={rangeUnit}
                  aria-label={intl.formatMessage({ id: 'period-range-unit' })}
                  onChange={(_event, picked: RangeUnit | null) => {
                    if (!picked || picked === rangeUnit) return;
                    setRangeUnit(picked);
                    // The range keeps the days it has: a month grid reads them as the months they fall in, and
                    // applying widens them to whole ones, so switching never quietly moves either end.
                    if (picked !== 'day' && draftFrom && draftTo && isValid(draftFrom) && isValid(draftTo)) {
                      setDraftFrom(picked === 'year' ? startOfYear(draftFrom) : startOfMonth(draftFrom));
                      setDraftTo(picked === 'year' ? endOfYear(draftTo) : endOfMonth(draftTo));
                    }
                  }}
                >
                  {(['day', 'month', 'year'] as const).map((unit) => (
                    <ToggleButton key={unit} value={unit} sx={{ px: 1.25, py: 0.25, textTransform: 'none' }}>
                      {intl.formatMessage({ id: `period-range-unit-${unit}` })}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Stack>
            )}
            {draftView !== 'range' ? (
              <>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <IconButton
                    size="small"
                    color="secondary"
                    disabled={draftView === 'year' ? yearPage <= 1900 : shownYear <= 1900}
                    aria-label={intl.formatMessage({ id: draftView === 'year' ? 'period-years-previous' : 'period-year-previous' })}
                    onClick={() => setShownYear(shownYear - (draftView === 'year' ? 12 : 1))}
                  >
                    <ArrowLeft2 size={16} />
                  </IconButton>
                  <Typography variant="subtitle1">{draftView === 'year' ? `${yearPage} – ${yearPage + 11}` : shownYear}</Typography>
                  <IconButton
                    size="small"
                    color="secondary"
                    disabled={draftView === 'year' ? yearPage + 12 > currentYear : shownYear >= currentYear}
                    aria-label={intl.formatMessage({ id: draftView === 'year' ? 'period-years-next' : 'period-year-next' })}
                    onClick={() => setShownYear(shownYear + (draftView === 'year' ? 12 : 1))}
                  >
                    <ArrowRight2 size={16} />
                  </IconButton>
                </Stack>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                  {choices.map((date) => {
                    const period = format(date, draftView === 'year' ? 'yyyy' : 'yyyy-MM');
                    const picked = period === format(selectedDate, draftView === 'year' ? 'yyyy' : 'yyyy-MM');
                    return (
                      <Button
                        key={period}
                        aria-pressed={picked}
                        disabled={date.getFullYear() < 1900 || period > currentPeriod(draftView === 'year' ? 'year' : 'month')}
                        onClick={() => selectPeriod(period)}
                        sx={{
                          py: 1.25,
                          minWidth: 0,
                          borderRadius: 1.5,
                          textTransform: 'none',
                          border: '1px solid',
                          borderColor: picked ? 'primary.main' : 'divider',
                          bgcolor: picked ? 'primary.lighter' : 'transparent',
                          color: picked ? 'primary.main' : 'text.primary',
                          fontWeight: picked ? 600 : 400,
                          '&:hover': { bgcolor: 'primary.lighter', borderColor: 'primary.main' }
                        }}
                      >
                        {draftView === 'year' ? period : intl.formatDate(date, { month: 'short' })}
                      </Button>
                    );
                  })}
                </Box>
              </>
            ) : rangeUnit === 'day' ? (
              <DateRangeCalendar from={draftFrom} to={draftTo} onFromChange={setDraftFrom} onToChange={setDraftTo} />
            ) : (
              <PeriodRangeGrid
                key={rangeUnit}
                unit={rangeUnit}
                from={draftFrom}
                to={draftTo}
                onFromChange={setDraftFrom}
                onToChange={setDraftTo}
              />
            )}
          </Stack>
          <Divider />
          <Stack sx={{ p: 2.5, pt: 2, gap: 1.5, bgcolor: 'secondary.lighter' }}>
            <Stack sx={{ gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {intl.formatMessage({ id: 'period-selected' })}
              </Typography>
              <Typography variant="subtitle2">
                {valid
                  ? `${intl.formatDate(draftFrom, { day: 'numeric', month: 'short', year: 'numeric' })} – ${intl.formatDate(draftTo, { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : draftView === 'range' && draftFrom && !draftTo
                    ? `${intl.formatDate(draftFrom, { day: 'numeric', month: 'short', year: 'numeric' })} – ${intl.formatMessage({ id: pickHint('end') })}`
                    : intl.formatMessage({ id: draftView === 'range' && !draftFrom ? pickHint('start') : 'period-select-valid' })}
              </Typography>
            </Stack>
            <Button
              variant="contained"
              disabled={!valid}
              onClick={() => {
                if (valid) {
                  onApply(format(draftFrom, 'yyyy-MM-dd'), format(draftTo, 'yyyy-MM-dd'), draftView);
                  setAnchor(null);
                }
              }}
            >
              {intl.formatMessage({ id: 'period-apply' })}
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
}
