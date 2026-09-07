import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import { ArrowLeft2, ArrowRight2 } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import IconButton from 'components/@extended/IconButton';
import YearPicker from 'sections/bank-statements/YearPicker';
import { currentPeriod, steppedPeriod, viewOf } from 'sections/bank-statements/period';
import MonthPicker from 'sections/reconciliation/MonthPicker';

interface Props {
  /** The period on screen: `YYYY-MM` in month view, `YYYY` in year view. */
  value: string;
  onChange: (period: string) => void;
}

/**
 * The period the bank statement screen is reading, with its neighbours a click away either side.
 *
 * <p>The neighbours are arrows rather than a trip to the picker because a statement is read a period at a time and
 * the period before is the one asked for next more often than any other — too often to be worth opening anything
 * for. Which picker the middle opens is the only thing the view changes here: a month view steps and picks months, a
 * year view years, and the step forward stops at the period being lived through, nothing having happened yet in one
 * that has not started.
 *
 * <p>Which of the two views is on is asked elsewhere, in the title bar beside this. It is a question about how the
 * table is read rather than about which period is being read, so it does not belong inside the thing that picks one.
 */
export default function PeriodPicker({ value, onChange }: Props) {
  const intl = useIntl();
  const view = viewOf(value);
  const max = currentPeriod(view);
  const label = (of: 'previous' | 'next') => intl.formatMessage({ id: `bank-statement-${view}-${of}` });

  return (
    <Stack component="span" direction="row" useFlexGap sx={{ gap: 0.5, alignItems: 'center' }}>
      <Tooltip title={label('previous')} arrow>
        <IconButton size="small" color="secondary" aria-label={label('previous')} onClick={() => onChange(steppedPeriod(value, -1))}>
          <ArrowLeft2 size={16} />
        </IconButton>
      </Tooltip>
      {view === 'year' ? (
        <YearPicker value={value} max={max} onChange={onChange} />
      ) : (
        <MonthPicker value={value} max={max} onChange={onChange} labelId="bank-statement-month" />
      )}
      <Tooltip title={label('next')} arrow>
        {/* Wrapped, a disabled button dispatching no events of its own for the tooltip to listen for. */}
        <span>
          <IconButton
            size="small"
            color="secondary"
            disabled={value >= max}
            aria-label={label('next')}
            onClick={() => onChange(steppedPeriod(value, 1))}
          >
            <ArrowRight2 size={16} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
