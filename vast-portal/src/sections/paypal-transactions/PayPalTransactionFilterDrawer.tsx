import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useIntl } from 'react-intl';

import FilterFacets, { type FilterFacet } from 'components/FilterFacets';
import SidePanel, { PanelCloseButton, PanelSection } from 'components/SidePanel';
import { transactionNarrowable } from 'sections/paypal-transactions/narrowing';
import { facetOptions, isNarrowed, type Narrowing } from 'utils/narrowing';
import { wordedOr } from 'utils/wording';
import type { PayPalTransaction } from 'types/payPalTransaction';

export interface PayPalTransactionFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The period's whole transactions, which is what the counts are of. */
  transactions: PayPalTransaction[];
  narrowing: Narrowing;
  onToggle: (facetKey: string, value: string) => void;
  onClear: () => void;
}

/**
 * The panel the PayPal transaction screen puts down the side of its ledger, holding the facets that narrow it.
 *
 * <p>It is the facets alone, as the bank statement and Stripe transaction screens' are. Searching a column is done
 * in the search row of the table's own head, under the column being searched, which is where the text a reader is
 * matching against actually is; nothing on this screen decides how the transactions read, so there is no second
 * section either.
 *
 * <p>The clear button is over the whole narrowing rather than over the facets alone: it empties the search row too,
 * which is why it is enabled by anything at all being narrowed.
 */
export default function PayPalTransactionFilterDrawer({
  open,
  onClose,
  transactions,
  narrowing,
  onToggle,
  onClear
}: PayPalTransactionFilterDrawerProps) {
  const intl = useIntl();

  // The options, their counts and which facets are worth offering all come from the shared narrowing: this screen
  // states what its transactions answer, and words the codes PayPal states instead of words — falling back to the
  // code itself, so an option never goes blank on a code the catalog has not met.
  const facets: FilterFacet[] = facetOptions(transactions, transactionNarrowable, narrowing, (facet, value) =>
    facet.labelId ? wordedOr(intl, facet.labelId(value), value) : value
  ).map((facet) => ({ ...facet, label: intl.formatMessage({ id: `paypal-transaction-filter-${facet.key}` }) }));

  return (
    <SidePanel anchor="left" open={open} onClose={onClose}>
      <PanelSection
        title={intl.formatMessage({ id: 'paypal-transaction-filters' })}
        action={
          <Stack direction="row" useFlexGap sx={{ gap: 0.5, alignItems: 'center' }}>
            <Button size="small" color="secondary" disabled={!isNarrowed(transactionNarrowable, narrowing)} onClick={onClear}>
              {intl.formatMessage({ id: 'paypal-transaction-filter-clear' })}
            </Button>
            <PanelCloseButton label={intl.formatMessage({ id: 'paypal-transaction-filters-close' })} onClose={onClose} />
          </Stack>
        }
      >
        <FilterFacets facets={facets} selection={narrowing.selection} onToggle={onToggle} />
      </PanelSection>
    </SidePanel>
  );
}
