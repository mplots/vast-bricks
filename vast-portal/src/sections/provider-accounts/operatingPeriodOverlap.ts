import type { OperatingPeriod } from 'types/providerAccount';

/** An unstated bound reaches as far as it means to, so a period is always a pair of comparable ISO dates. */
const SINCE_FOREVER = '0000-01-01';
const ONGOING = '9999-12-31';

const bounds = (period: OperatingPeriod, index: number) => ({
  index,
  from: period.from ?? SINCE_FOREVER,
  to: period.to ?? ONGOING
});

/**
 * Which periods clash with another, by their position in the list.
 *
 * <p>The same rule the server states, said here as well so the screen can refuse an overlap while it is being drawn
 * rather than after it is sent. Sorted by start, a period clashes when it begins on or before the furthest end
 * reached so far - carrying that reach forward rather than only comparing neighbours, so a long period is still
 * found to swallow a short one two rows down.
 */
export function overlappingPeriodIndexes(periods: OperatingPeriod[]): Set<number> {
  const sorted = periods
    .map(bounds)
    // A row with neither date is not a period yet but a row waiting to be filled in, and it is about to be given
    // dates that fit. Reading it as one running from forever to forever would clash it with every row on the screen.
    .filter((period) => period.from !== SINCE_FOREVER || period.to !== ONGOING)
    .sort((one, other) => (one.from === other.from ? one.to.localeCompare(other.to) : one.from.localeCompare(other.from)));

  if (sorted.length === 0) {
    return new Set();
  }

  const clashing = new Set<number>();
  let reach = sorted[0];
  for (const period of sorted.slice(1)) {
    if (period.from <= reach.to) {
      clashing.add(reach.index);
      clashing.add(period.index);
    }
    if (period.to > reach.to) {
      reach = period;
    }
  }
  return clashing;
}

/** Whether any period clashes: what a dialog asks before it lets its save through. The pickers keep a row inside
 * the gap its neighbours leave, so this only ever catches a date typed rather than picked. */
export function hasOverlappingPeriods(periods: OperatingPeriod[] | undefined): boolean {
  return overlappingPeriodIndexes(periods ?? []).size > 0;
}
