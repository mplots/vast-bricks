import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useIntl } from 'react-intl';

import FilterFacets, { type FilterFacet } from 'components/FilterFacets';
import SidePanel, { PanelCloseButton, PanelSection } from 'components/SidePanel';
import { transactionNarrowable } from 'sections/stripe-transactions/narrowing';
import { facetOptions, isNarrowed, type Narrowing } from 'utils/narrowing';
import type { StripeTransaction } from 'types/stripeTransaction';

export interface StripeTransactionFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The period's whole transactions, which is what the counts are of. */
  transactions: StripeTransaction[];
  narrowing: Narrowing;
  onToggle: (facetKey: string, value: string) => void;
  onClear: () => void;
}

/**
 * The panel the Stripe transaction screen puts down the side of its ledger, holding the facets that narrow it.
 *
 * <p>It is the facets alone, as the bank statement screen's is. Searching a column is done in the search row of the
 * table's own head, under the column being searched, which is where the text a reader is matching against actually
 * is; nothing on this screen decides how the transactions read, so there is no second section either.
 *
 * <p>The clear button is over the whole narrowing rather than over the facets alone: it empties the search row too,
 * which is why it is enabled by anything at all being narrowed.
 */
export default function StripeTransactionFilterDrawer({
  open,
  onClose,
  transactions,
  narrowing,
  onToggle,
  onClear
}: StripeTransactionFilterDrawerProps) {
  const intl = useIntl();

  // The options, their counts and which facets are worth offering all come from the shared narrowing: this screen
  // states what its transactions answer, and words only the answers that are the screen's own vocabulary rather
  // than Stripe's.
  const facets: FilterFacet[] = facetOptions(transactions, transactionNarrowable, narrowing, (facet, value) =>
    facet.labelId ? intl.formatMessage({ id: facet.labelId(value) }) : value
  ).map((facet) => ({ ...facet, label: intl.formatMessage({ id: `stripe-transaction-filter-${facet.key}` }) }));

  return (
    <SidePanel anchor="left" open={open} onClose={onClose}>
      <PanelSection
        title={intl.formatMessage({ id: 'stripe-transaction-filters' })}
        action={
          <Stack direction="row" useFlexGap sx={{ gap: 0.5, alignItems: 'center' }}>
            <Button size="small" color="secondary" disabled={!isNarrowed(transactionNarrowable, narrowing)} onClick={onClear}>
              {intl.formatMessage({ id: 'stripe-transaction-filter-clear' })}
            </Button>
            <PanelCloseButton label={intl.formatMessage({ id: 'stripe-transaction-filters-close' })} onClose={onClose} />
          </Stack>
        }
      >
        <FilterFacets facets={facets} selection={narrowing.selection} onToggle={onToggle} />
      </PanelSection>
    </SidePanel>
  );
}
