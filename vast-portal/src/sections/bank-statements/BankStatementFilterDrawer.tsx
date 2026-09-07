import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useIntl } from 'react-intl';

import FilterFacets, { type FilterFacet } from 'components/FilterFacets';
import SidePanel, { PanelCloseButton, PanelSection } from 'components/SidePanel';
import { entryFacets, isNarrowed, matches, matchesSearch, type EntryNarrowing } from 'sections/bank-statements/narrowing';
import type { BankStatementEntry } from 'types/bankStatement';

export interface BankStatementFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The period's whole entries, which is what the counts are of. */
  entries: BankStatementEntry[];
  narrowing: EntryNarrowing;
  onToggle: (facetKey: string, value: string) => void;
  onClear: () => void;
}

/**
 * The panel the bank statement screen puts down the side of its entries, holding the facets that narrow them.
 *
 * <p>It is the facets alone. Searching a column is done in the search row of the table's own head, under the column
 * being searched, which is where the text a reader is matching against actually is; nothing on this screen decides
 * how the entries read, so unlike the reconciliation panel beside it there is no second section either. The period
 * being read stays the title of the table it is read from.
 *
 * <p>The clear button is over the whole narrowing rather than over the facets alone: it empties the search row too,
 * which is why it is enabled by anything at all being narrowed.
 */
export default function BankStatementFilterDrawer({
  open,
  onClose,
  entries,
  narrowing,
  onToggle,
  onClear
}: BankStatementFilterDrawerProps) {
  const intl = useIntl();
  const { selection, search } = narrowing;

  const facets: FilterFacet[] = entryFacets
    .map((facet) => {
      // Counted against what the rest of the narrowing already lets through — the other facets and the search alike
      // — so a count states what ticking it would leave.
      const scoped = entries.filter(
        (entry) => matchesSearch(entry, search) && entryFacets.every((other) => other.key === facet.key || matches(entry, other, selection))
      );

      // Every value the period holds keeps its box, at nought where the rest of the narrowing has emptied it: a group
      // that shed options as it was narrowed would move under the pointer that was narrowing it.
      const counts = new Map<string, number>();
      entries.forEach((entry) => counts.set(facet.valueOf(entry), 0));
      scoped.forEach((entry) => counts.set(facet.valueOf(entry), (counts.get(facet.valueOf(entry)) ?? 0) + 1));

      const options = [...counts.entries()]
        .sort(([left], [right]) => {
          const declared = facet.declared;
          if (!declared) return left.localeCompare(right);
          // A value the facet names reads where it named it; anything else follows, in its own order.
          const places = [declared.indexOf(left), declared.indexOf(right)];
          const [leftPlace, rightPlace] = places.map((place) => (place < 0 ? declared.length : place));
          return leftPlace === rightPlace ? left.localeCompare(right) : leftPlace - rightPlace;
        })
        .map(([value, count]) => ({
          value,
          label: facet.labelId ? intl.formatMessage({ id: facet.labelId(value) }) : value,
          count
        }));

      return { key: facet.key, label: intl.formatMessage({ id: `bank-statement-filter-${facet.key}` }), options };
    })
    // A facet the whole period answers the same way narrows nothing, so it is not offered at all.
    .filter((facet) => facet.options.length > 1);

  return (
    <SidePanel anchor="left" open={open} onClose={onClose}>
      <PanelSection
        title={intl.formatMessage({ id: 'bank-statement-filters' })}
        action={
          <Stack direction="row" useFlexGap sx={{ gap: 0.5, alignItems: 'center' }}>
            <Button size="small" color="secondary" disabled={!isNarrowed(narrowing)} onClick={onClear}>
              {intl.formatMessage({ id: 'bank-statement-filter-clear' })}
            </Button>
            <PanelCloseButton label={intl.formatMessage({ id: 'bank-statement-filters-close' })} onClose={onClose} />
          </Stack>
        }
      >
        <FilterFacets facets={facets} selection={selection} onToggle={onToggle} />
      </PanelSection>
    </SidePanel>
  );
}
