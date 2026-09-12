import { parseISO } from 'date-fns';
import type { IntlShape } from 'react-intl';

import type { OperatingPeriod } from 'types/providerAccount';

const asDay = { day: 'numeric', month: 'short', year: 'numeric' } as const;

/**
 * One period in a line, as an account's card states it.
 *
 * <p>An unstated end is not an empty half of a range but a period still running, and an unstated start is one that
 * was already running - so each reads as its own sentence rather than as a range missing a side. Neither stated is
 * refused before it can be stored, so it is only the dash that says nothing was.
 */
export function operatingPeriodLabel(intl: IntlShape, period: OperatingPeriod): string {
  const from = period.from ? intl.formatDate(parseISO(period.from), asDay) : null;
  const to = period.to ? intl.formatDate(parseISO(period.to), asDay) : null;

  if (from && to) {
    return `${from} – ${to}`;
  }
  if (from) {
    return intl.formatMessage({ id: 'provider-accounts-operating-periods-since' }, { date: from });
  }
  if (to) {
    return intl.formatMessage({ id: 'provider-accounts-operating-periods-until' }, { date: to });
  }
  return '–';
}
