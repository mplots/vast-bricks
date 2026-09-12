import { parseISO } from 'date-fns';
import type { IntlShape } from 'react-intl';

import type { OperatingPeriod, ProviderAccountItem } from 'types/providerAccount';

const asDay = { day: 'numeric', month: 'short', year: 'numeric' } as const;

/** A period with neither date is no period: nothing is bounded, everything the account holds is in scope. */
export const noOperatingPeriod: OperatingPeriod = { from: null, to: null };

/** An account's period, wherever its provider keeps it: a marketplace config carries one, no other provider's does. */
export function accountOperatingPeriod(account: ProviderAccountItem): OperatingPeriod | null {
  return (account.config as { operatingPeriod?: OperatingPeriod | null }).operatingPeriod ?? null;
}

/**
 * An account's period in a line, as its card states it.
 *
 * <p>An unstated end is not an empty half of a range but a period still running, and an unstated start is one that
 * was already running - so each reads as its own sentence rather than as a range missing a side. Neither stated is
 * stored as no period at all, so the dash is only ever what an unexpected one reads as.
 */
export function operatingPeriodLabel(intl: IntlShape, period: OperatingPeriod): string {
  const from = period.from ? intl.formatDate(parseISO(period.from), asDay) : null;
  const to = period.to ? intl.formatDate(parseISO(period.to), asDay) : null;

  if (from && to) {
    return `${from} – ${to}`;
  }
  if (from) {
    return intl.formatMessage({ id: 'provider-accounts-operating-period-since' }, { date: from });
  }
  if (to) {
    return intl.formatMessage({ id: 'provider-accounts-operating-period-until' }, { date: to });
  }
  return '–';
}
