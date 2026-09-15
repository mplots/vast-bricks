import { endOfMonth, format, parseISO } from 'date-fns';

import { currentMonth, monthDate, monthOf } from 'utils/month';

/**
 * The span of days a screen that reads a period is reading, held as the single string its API is asked in:
 * `YYYY-MM` for one month, `YYYY` for a whole year. Shared by the bank statement and Stripe transaction screens,
 * which read the same two shapes of period.
 *
 * <p>One string rather than a view beside a value, because the two cannot then disagree: which of the two views is
 * on is readable from the period itself, and switching view is producing the other form of the same span rather than
 * remembering to change a second piece of state alongside it.
 */
export type PeriodView = 'month' | 'year';

/** Which view a period is written in. A year is the shorter of the two forms, which is what tells them apart. */
export const viewOf = (period: string): PeriodView => (period.length === 4 ? 'year' : 'month');

/** The year of a period, whichever form it is in. */
export const yearOf = (period: string) => period.slice(0, 4);

/** The year now, which is the last one worth offering: nothing has happened yet in a year that has not started. */
export const currentYear = () => String(new Date().getFullYear());

/** The last period worth offering in a view, for the same reason. */
export const currentPeriod = (view: PeriodView) => (view === 'year' ? currentYear() : currentMonth());

/**
 * The same span read in the other view.
 *
 * <p>A month widens to the year holding it. A year narrows to its last month that has actually happened — December
 * of a year gone by, this month of the year being lived through — which is where a reader who has been looking at a
 * whole year wants to land rather than back in January.
 */
export const periodIn = (period: string, view: PeriodView) => {
  if (view === 'year') return yearOf(period);
  const december = `${yearOf(period)}-12`;
  return december > currentMonth() ? currentMonth() : december;
};

/** The period `steps` periods of its own kind away: a month steps by months, a year by years. */
export const steppedPeriod = (period: string, steps: number) => {
  if (viewOf(period) === 'year') return String(Number(yearOf(period)) + steps);
  const stepped = monthDate(period);
  stepped.setMonth(stepped.getMonth() + steps);
  return monthOf(stepped);
};

/**
 * Which shape a span was drawn in: a whole month, a whole year, or the days a reader chose for themselves. The third
 * is what the shared picker adds over the two above, and screens read beside the reconciliation report offer it.
 */
export type PeriodRangeView = PeriodView | 'range';

/**
 * A span of days as the shared picker states one: both ends included, and how it was drawn.
 *
 * <p>A pair of days rather than the single string above, because a range is not writable as one — and the view is
 * carried beside them rather than read back off them, since a range a reader happened to draw around a whole month
 * is still a range they drew and reopens as one.
 */
export type PeriodRange = { from: string; to: string; view: PeriodRangeView };

/** A month as the span of days it is. */
export const monthRange = (month: string): PeriodRange => {
  const firstDay = `${month}-01`;
  return { from: firstDay, to: format(endOfMonth(parseISO(firstDay)), 'yyyy-MM-dd'), view: 'month' };
};

/** Where a screen that reads a period opens when nobody tells it otherwise: this month. */
export const currentMonthRange = (): PeriodRange => monthRange(currentMonth());
