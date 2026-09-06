import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useIntl } from 'react-intl';

import SidePanel, { PanelCloseButton, PanelSection } from 'sections/reconciliation/SidePanel';
import type { ReactNode } from 'react';

export interface ReconciliationColumnDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Whether the columns are anything other than the ones the screen opens with. */
  changed: boolean;
  onReset: () => void;
  /** Whether the columns on screen are already the ones this browser remembers. */
  saved: boolean;
  onSave: () => void;
  /** The columns the table can show, picked and ordered. */
  children: ReactNode;
}

/**
 * The panel the table's columns are picked from, down the side the filters are not on: which columns are read is a
 * different question from which orders are, and asking both from one panel would leave a reader hunting through the
 * filters for a column. It stays shut until it is asked for — a month is read rather than arranged, most days.
 *
 * <p>Arranging the table changes the table and the address at once; remembering the arrangement is a separate act
 * with a button of its own, so a table pulled apart to answer one question does not become the table this browser
 * opens with.
 */
export default function ReconciliationColumnDrawer({
  open,
  onClose,
  changed,
  onReset,
  saved,
  onSave,
  children
}: ReconciliationColumnDrawerProps) {
  const intl = useIntl();

  return (
    <SidePanel anchor="right" open={open} onClose={onClose}>
      <PanelSection
        title={intl.formatMessage({ id: 'reconciliation-columns' })}
        action={<PanelCloseButton label={intl.formatMessage({ id: 'reconciliation-columns-close' })} onClose={onClose} />}
      >
        <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* What makes this arrangement the one this browser opens with. Once saved it has nothing left to do, and
              says so by going quiet: the word on it is the only report there is that the arrangement was kept. */}
          <Button size="small" variant="contained" disabled={saved} onClick={onSave}>
            {intl.formatMessage({ id: saved ? 'reconciliation-columns-saved' : 'reconciliation-columns-save' })}
          </Button>
          {/* The way back to the columns the screen opens with, which a table dragged into a shape that no longer
              reads has no other route to. */}
          <Button size="small" color="secondary" disabled={!changed} onClick={onReset}>
            {intl.formatMessage({ id: 'reconciliation-columns-reset' })}
          </Button>
        </Stack>
        {children}
      </PanelSection>
    </SidePanel>
  );
}
