import type { ReactNode } from 'react';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Add } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import IconButton from 'components/@extended/IconButton';
import MainCard from 'components/MainCard';
import SimpleBar from 'components/third-party/SimpleBar';
import { HEADER_HEIGHT } from 'config';
import useConfig from 'hooks/useConfig';

/**
 * Where the panel comes to rest while the page scrolls, and where the table's title bar rests too, so the two of them
 * stop level rather than one under the other. It is the app header's own bottom: a gap below it would be a gap the
 * table's rows scrolled through, the bar being all that stands between them and the header.
 */
export const STICKY_TOP = HEADER_HEIGHT;

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
 *
 * <p>It is persistent where there is room for it and a temporary overlay where there is not, as the template's own
 * product filter is, and it sticks under the app header so a long table scrolls past it rather than away from it.
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
  const { container } = useConfig();
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  const section = (titleId: string, body: ReactNode, action?: ReactNode) => (
    <Stack sx={{ gap: 1.5 }}>
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">{intl.formatMessage({ id: titleId })}</Typography>
        {action}
      </Stack>
      {body}
    </Stack>
  );

  const content = (
    <Stack sx={{ gap: 2.5, p: 3 }}>
      {/* The panel is closed from the panel: it is where a reader looks to be rid of it, and it saves the screen a
          button that only ever said what the panel in front of it was already saying. It rides the first section's
          heading rather than taking a row of its own, and is smaller than the button that opened the panel, being a
          way out of the panel rather than one of its own controls. */}
      {section(
        'reconciliation-highlights',
        highlights,
        <Tooltip title={intl.formatMessage({ id: 'reconciliation-filters-close' })} arrow>
          <IconButton
            variant="light"
            color="secondary"
            size="small"
            aria-label={intl.formatMessage({ id: 'reconciliation-filters-close' })}
            onClick={onClose}
          >
            <Add size={18} style={{ transform: 'rotate(45deg)' }} />
          </IconButton>
        </Tooltip>
      )}
      <Divider />
      {section(
        'reconciliation-filters',
        children,
        <Button size="small" color="secondary" disabled={!filtered} onClick={onClear}>
          {intl.formatMessage({ id: 'reconciliation-filter-clear' })}
        </Button>
      )}
    </Stack>
  );

  return (
    <Drawer
      sx={(theme) => ({
        width: 300,
        ...(container && { [theme.breakpoints.only('lg')]: { width: 260 } }),
        flexShrink: 0,
        zIndex: { xs: 1200, lg: 0 },
        mr: 0,
        ...(open && { [theme.breakpoints.up('md')]: { mr: 2.5 } }),
        '& .MuiDrawer-paper': {
          height: { xs: 1, lg: 'auto' },
          width: 300,
          ...(container && { [theme.breakpoints.only('lg')]: { width: 260 } }),
          boxSizing: 'border-box',
          position: 'relative',
          boxShadow: 'none',
          // A docked drawer draws an edge down its right, which runs straight past the rounded corners of the card
          // inside it and shows as a line either side of them.
          borderRight: 0,
          // A long month scrolls past the panel rather than away from it. The docked drawer stretches to the row's
          // height, which is what gives the sticky paper room to travel.
          ...(!downLG && {
            // The card inside rounds its corners, and the paper's own ground would sit square behind them. The
            // overlay keeps its ground: there the card is borderless and fills it.
            bgcolor: 'transparent',
            marginTop: 2.5,
            position: 'sticky',
            top: STICKY_TOP,
            maxHeight: `calc(100vh - ${STICKY_TOP + 24}px)`,
            overflowY: 'auto'
          })
        }
      })}
      variant={downLG ? 'temporary' : 'persistent'}
      anchor="left"
      open={open}
      ModalProps={{ keepMounted: true }}
      onClose={onClose}
    >
      <MainCard border={!downLG} content={false}>
        {downLG ? <SimpleBar sx={{ height: `calc(100vh - ${HEADER_HEIGHT}px)` }}>{content}</SimpleBar> : content}
      </MainCard>
    </Drawer>
  );
}
