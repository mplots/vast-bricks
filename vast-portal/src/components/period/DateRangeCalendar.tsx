import { useRef, useState, type KeyboardEvent } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { addDays, addMonths, format, isSameDay, isSameMonth, isValid, startOfMonth, startOfWeek } from 'date-fns';
import { enUS, lv } from 'date-fns/locale';
import { ArrowLeft2, ArrowRight2 } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import IconButton from 'components/@extended/IconButton';
import { selectRangeDate, type RangeEdge } from 'components/period/rangeSelection';

interface Props {
  from: Date | null;
  to: Date | null;
  onFromChange: (date: Date | null) => void;
  onToChange: (date: Date | null) => void;
}

/** One calendar for both ends: choose a start, then an end, with the whole interval visible. */
export default function DateRangeCalendar({ from, to, onFromChange, onToChange }: Props) {
  const intl = useIntl();
  const [edge, setEdge] = useState<RangeEdge>('to');
  const [hovered, setHovered] = useState<Date | null>(null);
  const [focused, setFocused] = useState(() => from ?? new Date());
  const dayButtons = useRef(new Map<string, HTMLButtonElement>());
  const [month, setMonth] = useState(() => startOfMonth(from ?? new Date()));
  const locale = intl.locale === 'lv' ? lv : enUS;
  const first = startOfWeek(startOfMonth(month), { locale });
  const days = Array.from({ length: 42 }, (_, index) => addDays(first, index));
  const dateValue = (date: Date | null) => (date && isValid(date) ? format(date, 'yyyy-MM-dd') : '');

  const selection = { from, to, edge };
  const preview = hovered ? selectRangeDate(selection, hovered) : selection;
  const pick = (date: Date) => {
    const next = selectRangeDate(selection, date);
    onFromChange(next.from);
    onToChange(next.to);
    setEdge(next.edge);
    setHovered(null);
    setFocused(date);
    setMonth(startOfMonth(date));
  };
  const moveMonth = (amount: number) => {
    setHovered(null);
    setMonth(addMonths(month, amount));
  };
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    let next: Date;
    switch (event.key) {
      case 'ArrowLeft':
        next = addDays(date, -1);
        break;
      case 'ArrowRight':
        next = addDays(date, 1);
        break;
      case 'ArrowUp':
        next = addDays(date, -7);
        break;
      case 'ArrowDown':
        next = addDays(date, 7);
        break;
      case 'PageUp':
        next = addMonths(date, event.shiftKey ? -12 : -1);
        break;
      case 'PageDown':
        next = addMonths(date, event.shiftKey ? 12 : 1);
        break;
      case 'Home':
        next = startOfWeek(date, { locale });
        break;
      case 'End':
        next = addDays(startOfWeek(date, { locale }), 6);
        break;
      default:
        return;
    }
    event.preventDefault();
    if (next.getFullYear() < 1900 || next.getFullYear() > 2099) return;
    setFocused(next);
    setMonth(startOfMonth(next));
    requestAnimationFrame(() => dayButtons.current.get(dateValue(next))?.focus());
  };
  const tabDate = isSameMonth(focused, month) ? focused : month;

  return (
    <Stack sx={{ gap: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton
          size="small"
          color="secondary"
          disabled={month <= new Date(1900, 0, 1)}
          aria-label={intl.formatMessage({ id: 'period-month-previous' })}
          onClick={() => moveMonth(-1)}
        >
          <ArrowLeft2 size={16} />
        </IconButton>
        <Typography variant="subtitle1">{intl.formatDate(month, { month: 'long', year: 'numeric' })}</Typography>
        <IconButton
          size="small"
          color="secondary"
          disabled={month >= new Date(2099, 11, 1)}
          aria-label={intl.formatMessage({ id: 'period-month-next' })}
          onClick={() => moveMonth(1)}
        >
          <ArrowRight2 size={16} />
        </IconButton>
      </Stack>
      <Box onMouseLeave={() => setHovered(null)} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', rowGap: 0.5 }}>
        {days.slice(0, 7).map((date) => (
          <Typography key={date.toISOString()} variant="caption" color="text.secondary" sx={{ textAlign: 'center', pb: 0.5 }}>
            {intl.formatDate(date, { weekday: 'narrow' })}
          </Typography>
        ))}
        {days.map((date) => {
          const start = from !== null && isSameDay(date, from);
          const end = to !== null && isSameDay(date, to);
          const previewStart = preview.from !== null && isSameDay(date, preview.from);
          const previewEnd = preview.to !== null && isSameDay(date, preview.to);
          const inside =
            preview.from !== null &&
            preview.to !== null &&
            dateValue(date) >= dateValue(preview.from) &&
            dateValue(date) <= dateValue(preview.to);
          const selected = from !== null && to !== null && dateValue(date) >= dateValue(from) && dateValue(date) <= dateValue(to);
          return (
            <Box
              key={date.toISOString()}
              sx={{
                bgcolor: inside ? 'primary.lighter' : 'transparent',
                borderTopLeftRadius: previewStart ? 8 : 0,
                borderBottomLeftRadius: previewStart ? 8 : 0,
                borderTopRightRadius: previewEnd ? 8 : 0,
                borderBottomRightRadius: previewEnd ? 8 : 0
              }}
            >
              <Button
                fullWidth
                ref={(button) => {
                  if (button) dayButtons.current.set(dateValue(date), button);
                  else dayButtons.current.delete(dateValue(date));
                }}
                tabIndex={isSameDay(date, tabDate) ? 0 : -1}
                onKeyDown={(event) => moveFocus(event, date)}
                onFocus={() => {
                  setFocused(date);
                  setHovered(date);
                }}
                onBlur={() => setHovered(null)}
                onMouseEnter={() => setHovered(date)}
                aria-label={intl.formatDate(date, { dateStyle: 'full' })}
                aria-pressed={start || end || selected}
                disabled={date.getFullYear() < 1900 || date.getFullYear() > 2099}
                onClick={() => pick(date)}
                sx={{
                  minWidth: 0,
                  height: 36,
                  p: 0,
                  borderRadius: 1,
                  bgcolor: start || end ? 'primary.main' : 'transparent',
                  color: start || end ? 'primary.contrastText' : isSameMonth(date, month) ? 'text.primary' : 'text.disabled',
                  outline: hovered && (previewStart || previewEnd) ? '2px solid' : undefined,
                  outlineColor: 'primary.main',
                  outlineOffset: -2,
                  '&:hover': { bgcolor: start || end ? 'primary.dark' : 'primary.lighter' }
                }}
              >
                {date.getDate()}
              </Button>
            </Box>
          );
        })}
      </Box>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" aria-live="polite" sx={{ flex: 1 }}>
          {intl.formatMessage({ id: !from ? 'period-pick-start' : !to ? 'period-pick-end' : 'period-adjust-range' })}
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
