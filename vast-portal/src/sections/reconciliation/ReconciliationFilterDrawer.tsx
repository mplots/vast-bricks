import type { ReactNode } from 'react';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { useIntl } from 'react-intl';

import SidePanel, { PanelCloseButton, PanelSection } from 'sections/reconciliation/SidePanel';

export interface ReconciliationFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Whether anything is filtered out, which is all the clear button has to know. */
  filtered: boolean;
  onClear: () => void;
  /** What decides how the rows on screen read. */
  highlights: ReactNode;
  /** What decides which rows are on screen. */
  children: ReactNode;
}

/**
 * The panel a shop puts down the side of its results, holding the highlights that decide how its orders read and the
 * filters that decide which of them are shown. They are its two sections because they are two different acts, and
 * neither is worth a panel of its own; the month being read is the title of the table it is read from.
 */
export default function ReconciliationFilterDrawer({
  open,
  onClose,
  filtered,
  onClear,
  highlights,
  children
}: ReconciliationFilterDrawerProps) {
  const intl = useIntl();

  return (
    <SidePanel anchor="left" open={open} onClose={onClose}>
      <PanelSection
        title={intl.formatMessage({ id: 'reconciliation-highlights' })}
        action={<PanelCloseButton label={intl.formatMessage({ id: 'reconciliation-filters-close' })} onClose={onClose} />}
      >
        {highlights}
      </PanelSection>
      <Divider />
      <PanelSection
        title={intl.formatMessage({ id: 'reconciliation-filters' })}
        action={
          <Button size="small" color="secondary" disabled={!filtered} onClick={onClear}>
            {intl.formatMessage({ id: 'reconciliation-filter-clear' })}
          </Button>
        }
      >
        {children}
      </PanelSection>
    </SidePanel>
  );
}
