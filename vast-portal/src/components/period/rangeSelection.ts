import { differenceInCalendarDays, startOfDay } from 'date-fns';

export type RangeEdge = 'from' | 'to';

export interface RangeSelection {
  from: Date | null;
  to: Date | null;
  edge: RangeEdge;
}

/** Completed ranges are edited at their nearest endpoint. Only an explicit reset starts a new range. */
export function selectRangeDate(selection: RangeSelection, picked: Date): RangeSelection {
  const date = startOfDay(picked);
  const from = selection.from && startOfDay(selection.from);
  const to = selection.to && startOfDay(selection.to);
  if (!from) return { from: date, to: null, edge: 'to' };
  if (!to) {
    return date < from ? { from: date, to: from, edge: 'from' } : { from, to: date, edge: 'to' };
  }

  const fromDistance = Math.abs(differenceInCalendarDays(date, from));
  const toDistance = Math.abs(differenceInCalendarDays(date, to));
  const edge = fromDistance === toDistance ? selection.edge : fromDistance < toDistance ? 'from' : 'to';
  return edge === 'from' ? { from: date, to, edge } : { from, to: date, edge };
}
