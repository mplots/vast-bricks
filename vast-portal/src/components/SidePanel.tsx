import type { ReactNode } from 'react';

import { styled } from '@mui/material/styles';
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

/**
 * Where the sticky things of a screen come to rest, as a value a container can move.
 *
 * <p>A screen's own bar, its table's head and the panel beside it all stop under the app header, which is right for
 * the page being the one thing that scrolls. Put that screen in a pane that scrolls on its own — the two halves of
 * the bank matching split — and the app header is no longer above it: the pane's own top is, and the same things
 * have to stop at nought instead.
 *
 * <p>So the offset is read from a custom property rather than baked in, and a pane sets that property to zero. Every
 * screen keeps one rule for where its head rests, and neither the screens nor the table look they share need to know
 * they are in a pane at all.
 */
export const stickyTopVar = '--vast-sticky-top';

export const stickyTop = (offset = 0) => `calc(var(${stickyTopVar}, ${STICKY_TOP}px) + ${offset}px)`;

/**
 * The gap a screen leaves above its own card, as a value a container can move — the same idea as the sticky origin
 * and needed for the same reason.
 *
 * <p>On the page that gap is the room between the breadcrumb and the card. In a pane that scrolls, it is room the
 * card's own bar would jump over the moment a reader scrolled: the bar comes to rest at the pane's top, and a card
 * standing twenty pixels below it has twenty pixels to travel before it settles. So a pane sets the gap to nothing
 * and the bar is where it will stay from the first row onward.
 */
export const paneGapVar = '--vast-pane-gap';

export const PANE_GAP = 20;

export const paneGap = `var(${paneGapVar}, ${PANE_GAP}px)`;

/**
 * The table beside a panel on one side of it, sliding over where the panel was when it is closed.
 *
 * <p>A docked drawer holds its width whether it is open or shut, so the table takes that width back with a negative
 * margin rather than the panel giving it up: the panel slides out of its own place and the table follows it across.
 *
 * <p>For the screens with one panel — the bank statement's entries and the Stripe account's transactions. The
 * reconciliation screen has a panel either side of its orders and asks the same question about both margins, so it
 * keeps a main of its own.
 */
export const PanelMain = styled('main', { shouldForwardProp: (prop: string) => prop !== 'open' && prop !== 'container' })<{
  open: boolean;
  container: boolean;
}>(({ theme }) => ({
  flexGrow: 1,
  minWidth: 0,
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.shorter
  }),
  marginLeft: -300,
  // Below the breakpoint the panel is a temporary overlay, which takes no width out of the page at all.
  [theme.breakpoints.down('lg')]: { marginLeft: 0 },
  variants: [
    { props: ({ container }) => container, style: { [theme.breakpoints.only('lg')]: { marginLeft: 0 } } },
    { props: ({ container, open }) => container && !open, style: { [theme.breakpoints.only('lg')]: { marginLeft: -260 } } },
    {
      props: ({ open }) => open,
      style: {
        transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.shorter
        }),
        marginLeft: 0
      }
    }
  ]
}));

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
            marginTop: paneGap,
            position: 'sticky',
            top: stickyTop(),
            maxHeight: `calc(100vh - ${stickyTop(24)})`,
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
