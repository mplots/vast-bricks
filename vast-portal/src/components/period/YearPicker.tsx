import { useState, type MouseEvent } from 'react';

import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import { YearCalendar } from '@mui/x-date-pickers/YearCalendar';
import { useIntl } from 'react-intl';

import periodButtonSx from 'components/period/periodButton';

interface Props {
  /** The year on screen, as `YYYY`. */
  value: string;
  /** The last year worth offering, as `YYYY`: nothing has happened yet in a year that has not started. */
  max: string;
  onChange: (year: string) => void;
  /** The message naming what this year is of. */
  labelId: string;
}

/**
 * The year the screen is reading, and the way to pick another one.
 *
 * <p>Worn the way {@link periodButtonSx} describes, as the month is on the screens that read one. The grid of years
 * needs no arrows of its own, `YearCalendar` scrolling as far back as the account goes.
 */
export default function YearPicker({ value, max, onChange, labelId }: Props) {
  const intl = useIntl();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Button
        color="inherit"
        onClick={(event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget)}
        aria-label={intl.formatMessage({ id: labelId })}
        sx={periodButtonSx}
      >
        {value}
      </Button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Stack sx={{ p: 1 }}>
          <YearCalendar
            value={new Date(Number(value), 0, 1)}
            maxDate={new Date(Number(max), 11, 31)}
            onChange={(picked) => {
              onChange(String((picked as Date).getFullYear()));
              setAnchor(null);
            }}
          />
        </Stack>
      </Popover>
    </>
  );
}
