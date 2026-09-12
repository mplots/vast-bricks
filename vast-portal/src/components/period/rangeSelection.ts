import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  startOfDay,
  startOfMonth,
  startOfYear
} from 'date-fns';

export type RangeEdge = 'from' | 'to';

/** What a range is drawn in: whole days, whole months or whole years. */
export type RangeUnit = 'day' | 'month' | 'year';

export interface RangeSelection {
  from: Date | null;
  to: Date | null;
  edge: RangeEdge;
}

/** A range in months is a range of month starts, so every unit reduces its dates to the one thing being compared. */
const startOfUnit: Record<RangeUnit, (date: Date) => Date> = { day: startOfDay, month: startOfMonth, year: startOfYear };

const distance: Record<RangeUnit, (later: Date, earlier: Date) => number> = {
  day: differenceInCalendarDays,
  month: differenceInCalendarMonths,
  year: differenceInCalendarYears
};

/**
 * Completed ranges are edited at their nearest endpoint. Only an explicit reset starts a new range.
 *
 * <p>The unit is what "nearest" is counted in and what a returned date is the start of: a month range answers the
 * first of the month, and the caller closes the far end at the end of its own unit.
 */
export function selectRangeDate(selection: RangeSelection, picked: Date, unit: RangeUnit = 'day'): RangeSelection {
  const toUnit = startOfUnit[unit];
  const date = toUnit(picked);
  const from = selection.from && toUnit(selection.from);
  const to = selection.to && toUnit(selection.to);
  if (!from) return { from: date, to: null, edge: 'to' };
  if (!to) {
    return date < from ? { from: date, to: from, edge: 'from' } : { from, to: date, edge: 'to' };
  }

  const fromDistance = Math.abs(distance[unit](date, from));
  const toDistance = Math.abs(distance[unit](date, to));
  const edge = fromDistance === toDistance ? selection.edge : fromDistance < toDistance ? 'from' : 'to';
  const moved = edge === 'from' ? { from: date, to } : { from, to: date };

  // An end dragged past the other end is a range turned around, not an empty one - which is the whole of what a
  // one-unit range offers, since both of its ends are equally near and the same edge keeps being the one that moves.
  return moved.from > moved.to ? { from: moved.to, to: moved.from, edge: edge === 'from' ? 'to' : 'from' } : { ...moved, edge };
}
