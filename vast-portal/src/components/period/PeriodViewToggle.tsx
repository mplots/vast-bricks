import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useIntl } from 'react-intl';

import { periodIn, viewOf, type PeriodView } from 'utils/period';

interface Props {
  /** The period on screen: `YYYY-MM` in month view, `YYYY` in year view. */
  value: string;
  onChange: (period: string) => void;
}

/**
 * Which of the two kinds of period is being read, asked beside the period rather than inside the picker: it is a
 * question about how the table is read, not about which period is being read, so it does not belong inside the thing
 * that picks one.
 *
 * <p>Two buttons with the view already on screen disabled rather than merely unselected, there being nothing to ask
 * for by pressing it, which is the pattern the legacy portal uses wherever it offers a period of its own.
 *
 * <p>Switching reads the same span in the other view rather than starting the reader somewhere they did not ask for:
 * a month widens to its year, and a year narrows to its last month that has actually happened.
 */
export default function PeriodViewToggle({ value, onChange }: Props) {
  const intl = useIntl();
  const view = viewOf(value);

  return (
    <ToggleButtonGroup
      exclusive
      value={view}
      onChange={(_event, picked: PeriodView | null) => {
        if (picked) onChange(periodIn(value, picked));
      }}
      aria-label={intl.formatMessage({ id: 'period-view' })}
    >
      <ToggleButton disabled={view === 'month'} value="month" sx={{ px: 2, py: 0.5, textTransform: 'none' }}>
        {intl.formatMessage({ id: 'period-view-month' })}
      </ToggleButton>
      <ToggleButton disabled={view === 'year'} value="year" sx={{ px: 2, py: 0.5, textTransform: 'none' }}>
        {intl.formatMessage({ id: 'period-view-year' })}
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
