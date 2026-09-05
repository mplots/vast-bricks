import { useState, type MouseEvent } from 'react';

import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { MonthCalendar } from '@mui/x-date-pickers/MonthCalendar';
import { ArrowLeft2, ArrowRight2 } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import IconButton from 'components/@extended/IconButton';
import { monthDate, monthOf } from 'sections/reconciliation/month';

interface Props {
  /** The month on screen, as `YYYY-MM`. */
  value: string;
  /** The last month worth offering, as `YYYY-MM`: nothing has happened yet in a month that has not started. */
  max: string;
  onChange: (month: string) => void;
}

/**
 * The month the reconciliation screen is reading, and the way to pick another one.
 *
 * <p>The month is the table's title, so it is worn as the title's own type rather than as a form field, and the whole
 * of it is the button that opens the picker. The picker itself is a year walked by arrows over the twelve months of
 * it, which is the shape of the question being asked: a month is picked, never a day.
 *
 * <p>This replaces the browser's own `month` input, which wrote the month in whatever form and font the browser
 * happened to keep, could not be themed with the rest of the screen, and which Safari does not offer a picker for at
 * all.
 */
export default function MonthPicker({ value, max, onChange }: Props) {
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
  // The grid answers for whichever year is being shown, so the picked month is only marked while that is its own year.
  const shown = new Date(shownYear, selected.getMonth(), 1);
  const label = `${new Intl.DateTimeFormat(intl.locale, { month: 'long' }).format(selected)} ${selected.getFullYear()}`;

  return (
    <>
      <Button
        color="inherit"
        onClick={open}
        aria-label={intl.formatMessage({ id: 'reconciliation-month' })}
        sx={{
          typography: 'h5',
          px: 0.75,
          py: 0,
          minWidth: 0,
          textTransform: 'none',
          '&:hover, &[aria-expanded="true"]': { bgcolor: 'secondary.lighter' }
        }}
      >
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
          <MonthCalendar
            value={shown}
            maxDate={maxDate}
            onChange={(picked) => {
              onChange(monthOf(picked as Date));
              setAnchor(null);
            }}
          />
        </Stack>
      </Popover>
    </>
  );
}
