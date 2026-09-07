import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useIntl } from 'react-intl';

import FilterFacets, { type FilterFacet } from 'components/FilterFacets';
import SidePanel, { PanelCloseButton, PanelSection } from 'components/SidePanel';
import { entryNarrowable } from 'sections/bank-statements/narrowing';
import { facetOptions, isNarrowed, type Narrowing } from 'utils/narrowing';
import type { BankStatementEntry } from 'types/bankStatement';

export interface BankStatementFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The period's whole entries, which is what the counts are of. */
  entries: BankStatementEntry[];
  narrowing: Narrowing;
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

  // The options, their counts and which facets are worth offering all come from the shared narrowing: this screen
  // states what its entries answer, and words the answers that are the screen's own vocabulary rather than the
  // bank's.
  const facets: FilterFacet[] = facetOptions(entries, entryNarrowable, narrowing, (facet, value) =>
    facet.labelId ? intl.formatMessage({ id: facet.labelId(value) }) : value
  ).map((facet) => ({ ...facet, label: intl.formatMessage({ id: `bank-statement-filter-${facet.key}` }) }));

  return (
    <SidePanel anchor="left" open={open} onClose={onClose}>
      <PanelSection
        title={intl.formatMessage({ id: 'bank-statement-filters' })}
        action={
          <Stack direction="row" useFlexGap sx={{ gap: 0.5, alignItems: 'center' }}>
            <Button size="small" color="secondary" disabled={!isNarrowed(entryNarrowable, narrowing)} onClick={onClear}>
              {intl.formatMessage({ id: 'bank-statement-filter-clear' })}
            </Button>
            <PanelCloseButton label={intl.formatMessage({ id: 'bank-statement-filters-close' })} onClose={onClose} />
          </Stack>
        }
      >
        <FilterFacets facets={facets} selection={narrowing.selection} onToggle={onToggle} />
      </PanelSection>
    </SidePanel>
  );
}
