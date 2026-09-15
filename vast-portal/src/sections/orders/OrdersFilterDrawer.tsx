import type { ReactNode } from 'react';

import Button from '@mui/material/Button';
import { useIntl } from 'react-intl';

import SidePanel, { PanelCloseButton, PanelSection } from 'components/SidePanel';

export interface OrdersFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Whether anything is filtered out, which is all the clear button has to know. */
  filtered: boolean;
  onClear: () => void;
  /** What decides which orders are shown. */
  children: ReactNode;
}

/**
 * The panel the orders are narrowed from, down the left as the reconciliation report's is.
 *
 * <p>One section rather than that screen's two: an order is a fact of the store's own rather than an account
 * collected from several places, so there is nothing here to highlight a disagreement between - only which of the
 * orders are shown. The range being read is the title of the table it is read from, as it is there.
 */
export default function OrdersFilterDrawer({ open, onClose, filtered, onClear, children }: OrdersFilterDrawerProps) {
  const intl = useIntl();

  return (
    <SidePanel anchor="left" open={open} onClose={onClose}>
      <PanelSection
        title={intl.formatMessage({ id: 'orders-filters' })}
        action={
          <>
            <Button size="small" color="secondary" disabled={!filtered} onClick={onClear}>
              {intl.formatMessage({ id: 'orders-filter-clear' })}
            </Button>
            <PanelCloseButton label={intl.formatMessage({ id: 'orders-filters-close' })} onClose={onClose} />
          </>
        }
      >
        {children}
      </PanelSection>
    </SidePanel>
  );
}
