import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isValid, parseISO } from 'date-fns';
import { useIntl } from 'react-intl';

import type { OperatingPeriod } from 'types/providerAccount';

type Props = {
  value: OperatingPeriod;
  onChange: (period: OperatingPeriod) => void;
};

/** The picker hands back whatever has been typed so far, so a date only counts once it is a real one. */
const toIsoDate = (picked: Date | null) => (picked && isValid(picked) ? format(picked, 'yyyy-MM-dd') : null);

/**
 * The one stretch of a marketplace account's data that counts, as its form states it.
 *
 * <p>Two dates rather than a range, because either end may be left unstated - a store that was already selling before
 * its records begin, or one still selling - and an empty field says that on its own. Each picker bounds the other, so
 * a period cannot be dated backwards to begin with.
 */
export default function OperatingPeriodFields({ value, onChange }: Props) {
  const intl = useIntl();

  const datePicker = (bound: 'from' | 'to') => (
    <DatePicker
      label={intl.formatMessage({ id: `provider-accounts-operating-period-${bound}` })}
      value={value[bound] ? parseISO(value[bound]!) : null}
      onChange={(picked) => onChange({ ...value, [bound]: toIsoDate(picked) })}
      minDate={bound === 'to' && value.from ? parseISO(value.from) : undefined}
      maxDate={bound === 'from' && value.to ? parseISO(value.to) : undefined}
      slotProps={{ field: { clearable: true }, textField: { size: 'small', sx: { width: 190 } } }}
    />
  );

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{intl.formatMessage({ id: 'provider-accounts-operating-period' })}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {intl.formatMessage({ id: 'provider-accounts-operating-period-hint' })}
      </Typography>
      <Stack direction="row" spacing={1}>
        {datePicker('from')}
        {datePicker('to')}
      </Stack>
    </Stack>
  );
}
