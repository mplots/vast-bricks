/**
 * The reconciliation screen reads a month at a time, and holds the one it is reading as the `YYYY-MM` the providers
 * are asked in. Calendars deal in dates, so these two are the crossing between the two forms.
 */

/** The `YYYY-MM` a date falls in. */
export const monthOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** The first of a `YYYY-MM`, which is the date a calendar wants in exchange. */
export const monthDate = (month: string) => {
  const [year, ordinal] = month.split('-').map(Number);
  return new Date(year, ordinal - 1, 1);
};

/** The month now, which is the last one worth offering: nothing has happened yet in a month that has not started. */
export const currentMonth = () => monthOf(new Date());
