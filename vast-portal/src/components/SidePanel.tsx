import type { ReactNode } from 'react';

import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Add } from 'iconsax-reactjs';

import IconButton from 'components/@extended/IconButton';
import MainCard from 'components/MainCard';
import SimpleBar from 'components/third-party/SimpleBar';
import { HEADER_HEIGHT } from 'config';
import useConfig from 'hooks/useConfig';

/**
 * Where a panel comes to rest while the page scrolls, and where the table's title bar rests too, so the two of them
 * stop level rather than one under the other. It is the app header's own bottom: a gap below it would be a gap the
 * table's rows scrolled through, the bar being all that stands between them and the header.
 */
export const STICKY_TOP = HEADER_HEIGHT;

export interface SidePanelProps {
  /**
   * The side the panel is docked to. The table sits between the two of them, so a panel on the left keeps its gap on
   * its right and a panel on the right keeps its gap on its left.
   */
  anchor: 'left' | 'right';
  open: boolean;
  onClose: () => void;
  /** The sections stacked down the panel. */
  children: ReactNode;
}

export interface PanelSectionProps {
  title: string;
  /** What rides the heading rather than taking a row of its own: the way out of the panel, or a section's own button. */
  action?: ReactNode;
  children: ReactNode;
}

/** One headed group in a panel, with room beside the heading for the one button that group is worth. */
export function PanelSection({ title, action, children }: PanelSectionProps) {
  return (
    <Stack sx={{ gap: 1.5 }}>
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">{title}</Typography>
        {action}
      </Stack>
      {children}
    </Stack>
  );
}

export interface PanelCloseButtonProps {
  label: string;
  onClose: () => void;
}

/**
 * The way out of a panel, from inside it: it is where a reader looks to be rid of the panel, and it saves the screen
 * a button that only ever said what the panel in front of it was already saying. It rides the first section's
 * heading rather than taking a row of its own, and is smaller than the button that opened the panel, being a way out
 * of the panel rather than one of its own controls.
 */
export function PanelCloseButton({ label, onClose }: PanelCloseButtonProps) {
  return (
    <Tooltip title={label} arrow>
      <IconButton variant="light" color="secondary" size="small" aria-label={label} onClick={onClose}>
        <Add size={18} style={{ transform: 'rotate(45deg)' }} />
      </IconButton>
    </Tooltip>
  );
}

/**
 * A panel the screen puts down one side of its table. It is persistent where there is room for it and a temporary
 * overlay where there is not, as the template's own product filter is, and it sticks under the app header so a long
 * table scrolls past it rather than away from it.
 *
 * <p>It knows nothing about what it holds: what the sections are, and which of them carries the way out, is the
 * caller's, so a second panel on the other side is this shell again rather than a copy of it.
 */
export default function SidePanel({ anchor, open, onClose, children }: SidePanelProps) {
  const { container } = useConfig();
  const downLG = useMediaQuery((theme) => theme.breakpoints.down('lg'));

  // The gap belongs between the panel and the table, which is the side the table is on.
  const gap = anchor === 'left' ? 'marginRight' : 'marginLeft';
  // A docked drawer draws an edge down the side it faces the table across, which runs straight past the rounded
  // corners of the card inside it and shows as a line either side of them.
  const edge = anchor === 'left' ? 'borderRight' : 'borderLeft';

  const content = <Stack sx={{ gap: 2.5, p: 3 }}>{children}</Stack>;

  return (
    <Drawer
      sx={(theme) => ({
        width: 300,
        ...(container && { [theme.breakpoints.only('lg')]: { width: 260 } }),
        flexShrink: 0,
        zIndex: { xs: 1200, lg: 0 },
        // A shut panel is slid out past the side it is docked to, and the one on the right lands past the right edge
        // of the page, where it goes on counting towards how wide the page is and puts a scrollbar under a table that
        // fits. Kept inside the width the panel holds either way. Clipped rather than hidden: `overflow: hidden`
        // would make this a scrolling box, and the sticky paper would come to rest inside it rather than under the
        // app header. The overlay is fixed and adds no width, so it is only the docked panel that needs it.
        ...(!downLG && { overflowX: 'clip' }),
        [gap]: 0,
        ...(open && { [theme.breakpoints.up('md')]: { [gap]: 2.5 } }),
        '& .MuiDrawer-paper': {
          height: { xs: 1, lg: 'auto' },
          width: 300,
          ...(container && { [theme.breakpoints.only('lg')]: { width: 260 } }),
          boxSizing: 'border-box',
          position: 'relative',
          boxShadow: 'none',
          [edge]: 0,
          // A long table scrolls past the panel rather than away from it. The docked drawer stretches to the row's
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
      anchor={anchor}
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
