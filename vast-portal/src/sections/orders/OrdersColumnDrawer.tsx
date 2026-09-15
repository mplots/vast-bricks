import type { ReactNode } from 'react';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useIntl } from 'react-intl';

import SidePanel, { PanelCloseButton, PanelSection } from 'components/SidePanel';

export interface OrdersColumnDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Whether the columns are anything other than the ones the screen opens with. */
  changed: boolean;
  onReset: () => void;
  /** Whether the columns on screen are already the ones this browser remembers. */
  saved: boolean;
  onSave: () => void;
  children: ReactNode;
}

/**
 * The panel the table's columns are picked from, down the side the filters are not on - the same arrangement the
 * reconciliation report uses, and for the same reason: which columns are read is a different question from which
 * orders are, and asking both from one panel would leave a reader hunting through the filters for a column.
 *
 * <p>Arranging the table changes the table and the address at once; remembering the arrangement is a separate act
 * with a button of its own, so a table pulled apart to answer one question does not become the one this browser
 * opens with.
 */
export default function OrdersColumnDrawer({ open, onClose, changed, onReset, saved, onSave, children }: OrdersColumnDrawerProps) {
  const intl = useIntl();

  return (
    <SidePanel anchor="right" open={open} onClose={onClose}>
      <PanelSection
        title={intl.formatMessage({ id: 'orders-columns' })}
        action={<PanelCloseButton label={intl.formatMessage({ id: 'orders-columns-close' })} onClose={onClose} />}
      >
        <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button size="small" variant="contained" disabled={saved} onClick={onSave}>
            {intl.formatMessage({ id: saved ? 'orders-columns-saved' : 'orders-columns-save' })}
          </Button>
          <Button size="small" color="secondary" disabled={!changed} onClick={onReset}>
            {intl.formatMessage({ id: 'orders-columns-reset' })}
          </Button>
        </Stack>
        {children}
      </PanelSection>
    </SidePanel>
  );
}
