import { endOfMonth, format, parseISO } from 'date-fns';

import DatePeriodPicker from 'components/period/DatePeriodPicker';
import { viewOf } from 'utils/period';

interface Props {
  value: string;
  allowYear?: boolean;
  onChange: (period: string) => void;
}

/** The shared header selector for screens whose APIs accept whole months or years. */
export default function PeriodHeaderPicker({ value, onChange, allowYear = true }: Props) {
  const view = viewOf(value);
  const from = view === 'year' ? `${value}-01-01` : `${value}-01`;
  const to = view === 'year' ? `${value}-12-31` : format(endOfMonth(parseISO(from)), 'yyyy-MM-dd');
  return (
    <DatePeriodPicker
      allowYear={allowYear}
      from={from}
      to={to}
      view={view}
      onApply={(start, _end, selected) => onChange(start.slice(0, selected === 'year' ? 4 : 7))}
    />
  );
}
