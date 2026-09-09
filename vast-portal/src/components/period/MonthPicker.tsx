import { useState, type MouseEvent } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowLeft2, ArrowRight2 } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import IconButton from 'components/@extended/IconButton';
import periodButtonSx from 'components/period/periodButton';
import { monthDate, monthOf } from 'utils/month';

interface Props {
  /** The month on screen, as `YYYY-MM`. */
  value: string;
  /** The last month worth offering, as `YYYY-MM`: nothing has happened yet in a month that has not started. */
  max: string;
  onChange: (month: string) => void;
  /** The message naming what this month is of, for screens other than reconciliation's own. */
  labelId?: string;
}

/**
 * The month the reconciliation screen is reading, and the way to pick another one.
 *
 * <p>The month is the table's title, worn the way {@link periodButtonSx} describes. The picker itself is a year
 * walked by arrows over the twelve months of it, which is the shape of the question being asked: a month is picked,
 * never a day.
 *
 * <p>This replaces the browser's own `month` input, which wrote the month in whatever form and font the browser
 * happened to keep, could not be themed with the rest of the screen, and which Safari does not offer a picker for at
 * all.
 */
export default function MonthPicker({ value, max, onChange, labelId = 'reconciliation-month' }: Props) {
  const intl = useIntl();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // The year the grid is showing, which is only the picked month's year until the arrows walk away from it.
  const [shownYear, setShownYear] = useState(() => monthDate(value).getFullYear());

  const open = (event: MouseEvent<HTMLElement>) => {
    setShownYear(monthDate(value).getFullYear());
    setAnchor(event.currentTarget);
  };

  const selected = monthDate(value);
  const maxDate = monthDate(max);
  const label = `${new Intl.DateTimeFormat(intl.locale, { month: 'long' }).format(selected)} ${selected.getFullYear()}`;
  const monthName = new Intl.DateTimeFormat(intl.locale, { month: 'short' });

  return (
    <>
      <Button color="inherit" onClick={open} aria-label={intl.formatMessage({ id: labelId })} sx={periodButtonSx}>
        {label}
      </Button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Stack sx={{ p: 1, gap: 0.5 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', px: 1 }}>
            <IconButton
              size="small"
              color="secondary"
              aria-label={intl.formatMessage({ id: 'reconciliation-year-previous' })}
              onClick={() => setShownYear(shownYear - 1)}
            >
              <ArrowLeft2 size={16} />
            </IconButton>
            <Typography variant="subtitle1">{shownYear}</Typography>
            <IconButton
              size="small"
              color="secondary"
              // Nothing has been collected in a year that has not started.
              disabled={shownYear >= maxDate.getFullYear()}
              aria-label={intl.formatMessage({ id: 'reconciliation-year-next' })}
              onClick={() => setShownYear(shownYear + 1)}
            >
              <ArrowRight2 size={16} />
            </IconButton>
          </Stack>
          {/* A month grid needs none of the date picker's parsing or field machinery. Keeping it here also means the
          popover cannot lose a lazily loaded localization context during a development dependency refresh. */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5, width: 320, p: 1 }}>
            {Array.from({ length: 12 }, (_, month) => {
              const date = new Date(shownYear, month, 1);
              const picked = shownYear === selected.getFullYear() && month === selected.getMonth();
              return (
                <Button
                  key={month}
                  variant={picked ? 'contained' : 'text'}
                  color={picked ? 'primary' : 'inherit'}
                  disabled={date > maxDate}
                  aria-pressed={picked}
                  onClick={() => {
                    onChange(monthOf(date));
                    setAnchor(null);
                  }}
                  sx={{ minWidth: 0 }}
                >
                  {monthName.format(date)}
                </Button>
              );
            })}
          </Box>
        </Stack>
      </Popover>
    </>
  );
}
