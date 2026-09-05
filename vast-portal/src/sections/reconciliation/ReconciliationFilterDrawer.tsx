import type { ReactNode } from 'react';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useIntl } from 'react-intl';

import MainCard from 'components/MainCard';
import SimpleBar from 'components/third-party/SimpleBar';
import { HEADER_HEIGHT } from 'config';
import useConfig from 'hooks/useConfig';

export interface ReconciliationFilterDrawerProps {
  /** Where the panel comes to rest while the page scrolls: under whatever is sticking above it. */
  stickyTop: number;
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
 * neither is worth a panel of its own; the month being read belongs to the header bar above both.
 *
 * <p>It is persistent where there is room for it and a temporary overlay where there is not, as the template's own
 * product filter is, and it sticks to the top of the screen so a long table scrolls past it rather than away from it.
 */
export default function ReconciliationFilterDrawer({
  stickyTop,
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
      {section('reconciliation-highlights', highlights)}
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
          // A long month scrolls past the panel rather than away from it. The docked drawer stretches to the row's
          // height, which is what gives the sticky paper room to travel.
          ...(!downLG && {
            // Level with the table beside it, which starts below the header card the two of them sit under.
            marginTop: 2.5,
            position: 'sticky',
            top: stickyTop,
            maxHeight: `calc(100vh - ${stickyTop + 24}px)`,
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
