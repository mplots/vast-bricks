import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import Tooltip from '@mui/material/Tooltip';
import { Link21, LinkSquare } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { PANE_GAP, paneGapVar, stickyTopVar } from 'components/SidePanel';
import { useBankMatching } from 'contexts/BankMatchingContext';
import useLocalStorage from 'hooks/useLocalStorage';

/**
 * The two screens read side by side, and the one act that spans them.
 *
 * <p>They are the screens themselves rather than lists written again for this: an order is read here with the same
 * columns, filters and failures it is read with anywhere, and an entry with its own search and its own period.
 *
 * <p>What the split adds is the line between them. It is the handle the panes are resized by, and it carries the
 * button that ties the two picked rows together — on the line because that is where the two sides meet and where a
 * reader's eye already is, having just picked a row on either side of it. A bar across the foot said the same thing
 * and spent a strip of every screen saying it, most of the time with nothing picked and nothing to say.
 */

/** Where the divider was left, kept per browser: a share of the split's width rather than a width in pixels. */
const shareKey = 'vast-bank-matching-share';

/** Neither pane is dragged away to nothing. */
const minimumShare = 0.2;

/** One link on screen: where its two ends are, and what it would take to untie it. */
type DrawnLink = {
  key: string;
  /** The order and the entry it joins, so a row under the pointer can say which links are its own. */
  orderId: string;
  reference: string;
  entryId: number;
  /** Whether a person wrote the mapping that tied it. An automatic match has nothing to clear and is not untied. */
  mapped: boolean;
  /** Whether an end of it is scrolled out of its pane, in which case the line points that way rather than joining. */
  offScreen: boolean;
  /** Whether one of its ends is the row a reader has picked, which is the other way to take hold of a link. */
  picked: boolean;
  /** Whether it is a link about to be made rather than one that exists, which is drawn dotted and unties nothing. */
  proposed?: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/** What a click may land on and leave the picks standing; see `noteClick`. */
const kept = [
  '[data-vast-order]',
  '[data-vast-entry]',
  '[role="separator"]',
  'button',
  'a',
  'input',
  'label',
  '[role="button"]',
  '.MuiDrawer-root',
  '.MuiPopover-root'
].join(', ');

/** How wide the line between the panes is, and therefore the column it sits in. */
const DIVIDER = 20;

/**
 * Where the divider stands, as a share of the width the two panes have between them.
 *
 * <p>A custom property rather than a number in the styles, because a drag sets it on every step of the pointer: as
 * a style it is a new class generated and injected for every pixel dragged, and as a value React re-renders both
 * screens for. Set on the element, it moves the columns and nothing else happens at all.
 */
const shareVar = '--vast-share';

/** The card's own top border, which everything inside it rests below. */
const CARD_BORDER = 1;

/**
 * How long the entries take to come and go. The panel this screen already opens beside its orders is the shape of
 * it — the same easing, a step slower, a whole half of the screen being more to take in than a panel.
 */
const SLIDE_MS = 300;

/** Room left above or below a row brought into view, so it does not land against the pane's own edge. */
const INTO_VIEW_MARGIN = 24;

/** How far off a pane's edge a line stops when the row it runs to is scrolled past it. */
const EDGE_MARGIN = 6;

const middleOf = (row: HTMLElement) => {
  const bounds = row.getBoundingClientRect();
  return bounds.top + bounds.height / 2;
};

/**
 * Scrolls a pane to bring one of its rows level with a row in the other pane, or merely into view where there is no
 * other row to be level with. It scrolls that pane and nothing else.
 *
 * <p>The row's own {@code scrollIntoView} would do the second of those, and would also scroll every scrollable
 * ancestor it has — the document among them. The page is held still while the split is open, and a page held still
 * by hand is one that still answers a script: it would have moved under the reader with the app header on it.
 *
 * <p>It moves the pane outright rather than gliding: this is where a row is rather than something happening to it,
 * and the line drawn between the two ends is what the reader is waiting on. A glide also stops progressing in a tab
 * nobody is looking at, which would leave the two ends unpaired until the tab came back.
 */
function levelWith(pane: HTMLElement, row: HTMLElement, target: number | null) {
  const within = pane.getBoundingClientRect();
  const bounds = row.getBoundingClientRect();

  if (target !== null) {
    // As far as the pane will go: at the ends of a period it stops short, and the line drawn is the slope that is
    // left rather than nothing at all.
    const wanted = Math.min(Math.max(target, within.top + INTO_VIEW_MARGIN), within.bottom - INTO_VIEW_MARGIN);
    pane.scrollTop += middleOf(row) - wanted;
    return;
  }

  const above = within.top + INTO_VIEW_MARGIN - bounds.top;
  const below = bounds.bottom - (within.bottom - INTO_VIEW_MARGIN);
  if (above > 0) {
    pane.scrollTop -= above;
  } else if (below > 0) {
    pane.scrollTop += below;
  }
}

export default function BankMatchingSplit({
  open,
  orders,
  entries
}: {
  /** Whether the address asks for the split. False while it is closing, which is what it animates through. */
  open: boolean;
  orders: ReactNode;
  entries: ReactNode;
}) {
  const intl = useIntl();
  const matching = useBankMatching();
  const { order, entry } = matching;

  const splitRef = useRef<HTMLDivElement>(null);
  const ordersPane = useRef<HTMLDivElement>(null);
  const entriesPane = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState<DrawnLink[]>([]);
  // Which drawn link a reader has taken hold of, by the pair it joins. Untying is offered on that one alone: a
  // screenful of lines each carrying a button of its own would be a screenful of buttons.
  const [held, setHeld] = useState<string | null>(null);
  // Which rows the pointer is over, by what they name: a link is drawn for a row a reader is looking at as well as
  // for one they have picked.
  const [hovered, setHovered] = useState<{ order?: string; entry?: string }>({});
  // Where the divider was left, remembered in this browser: a reader who widens the entries to read a payer's own
  // words expects them still wide the next time they come to match a month.
  const [remembered, remember] = useLocalStorage(shareKey, 0.5);
  const [share, setShare] = useState(remembered);
  const [dragging, setDragging] = useState(false);
  const [paneHeight, setPaneHeight] = useState(0);
  // What is on screen, a frame behind what the address asks for: the entries have to be laid out closed before they
  // can be seen opening, and have to stay laid out while they close.
  const [shown, setShown] = useState(false);

  // The link the untie button belongs to: the line a reader took hold of, or — having picked a row that is one end
  // of a link — that link, which is the same question asked from the table rather than from the line.
  const holding = drawn.find((link) => link.key === held) ?? drawn.find((link) => link.picked) ?? null;

  /**
   * The links worth drawing this moment: the ones a reader has picked a row of, is pointing at a row of, has taken
   * hold of, or is about to make.
   *
   * <p>Not all of them at once. A month of transfers is a month of lines across the middle of the screen, and a
   * drawing that never changes is one nobody reads: what a reader wants is the links of the row in front of them.
   */
  const shownLinks = (matching.panelOut || dragging ? [] : drawn).filter(
    (link) =>
      link.picked ||
      link.proposed ||
      link.key === held ||
      (hovered.order !== undefined && hovered.order === link.orderId) ||
      (hovered.entry !== undefined && hovered.entry === link.reference)
  );

  useEffect(() => {
    // A timer rather than an animation frame: frames stop being handed out to a tab nobody is looking at, and a
    // split that only opened once the tab was looked at would be a split that never opened.
    const started = setTimeout(() => setShown(open), 16);
    return () => clearTimeout(started);
  }, [open]);

  // The entries stay mounted while they leave, an unmounted pane not being something anyone can watch go.
  const [rendered, setRendered] = useState(open);

  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    const gone = setTimeout(() => setRendered(false), SLIDE_MS);
    return () => clearTimeout(gone);
  }, [open]);

  /**
   * The page itself does not scroll while the split is open: the panes do, and a page that scrolled behind them
   * would carry both out of the window at once — which is the one thing two lists read against each other must not
   * do. It is the document that is held rather than anything of this screen's, the page being what would scroll.
   */
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    const { scrollbarGutter } = document.documentElement.style;
    // What the page's own scrollbar was taking. Holding the page still takes that bar away, and the app header is
    // laid out against the window, so without the width being kept the header would shift sideways the moment the
    // split opened and shift back when it closed. Kept only where there was a bar to keep.
    const bar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (bar > 0) {
      document.documentElement.style.scrollbarGutter = 'stable';
    }
    return () => {
      document.body.style.overflow = overflow;
      document.documentElement.style.scrollbarGutter = scrollbarGutter;
    };
  }, [open]);

  // What is left of the window under the split's own top, to the very bottom of it: the panes fill the window, so
  // the line between them runs the whole way down and nothing is left under them for the page to scroll. Measured
  // rather than assumed — what stands above is a header, a breadcrumb and whatever the theme spaces them by.
  useLayoutEffect(() => {
    const split = splitRef.current;
    if (!split) return;

    const measure = () => setPaneHeight(Math.max(320, window.innerHeight - split.getBoundingClientRect().top));
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Where the pointer has taken the divider, which is written straight onto the element. It is read back when the
  // drag ends, and that is the only moment any of it becomes state.
  const dragged = useRef(share);

  const setFromPointer = useCallback((clientX: number) => {
    const split = splitRef.current;
    if (!split) return;
    const { left, width } = split.getBoundingClientRect();
    // Neither pane is dragged away to nothing: a pane too narrow to read is a pane a reader has to drag back.
    dragged.current = Math.min(1 - minimumShare, Math.max(minimumShare, (clientX - left) / width));
    split.style.setProperty(shareVar, String(dragged.current));
  }, []);

  const startDrag = (event: React.PointerEvent) => {
    event.preventDefault();
    setDragging(true);
    setFromPointer(event.clientX);
  };

  // On the window rather than the handle, so a pointer that outruns the divider mid-drag keeps dragging it.
  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => setFromPointer(event.clientX);
    // Where it was left is written down once, at the end: a write to this browser's storage on every step of a
    // pointer is what turns a drag into a stutter.
    const stop = () => {
      setDragging(false);
      setShare(dragged.current);
      remember(dragged.current);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    // A pointer that is taken away rather than lifted — cancelled by the browser, or the window losing focus
    // mid-drag — ends the drag too. Left dragging, the split would go on following a pointer nobody is holding and
    // would draw no lines at all until it was dragged again.
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
    };
  }, [dragging, setFromPointer, remember]);

  /**
   * Brings the other end of a picked link level with the row that was picked, in its own pane and nothing else's.
   *
   * <p>Every link is drawn whether or not anything is picked, so this is not what shows a reader the link — it is
   * what makes the one they just asked about read straight across instead of running down the table, and what
   * brings it back into view when it had scrolled out of the pane entirely.
   */
  useEffect(() => {
    const level = () => {
      const panes = [ordersPane.current, entriesPane.current];
      panes.forEach((pane, side) => {
        const counterpart = pane?.querySelector<HTMLElement>('[data-vast-link="counterpart"]');
        if (!pane || !counterpart) return;
        const picked = panes[1 - side]?.querySelector<HTMLElement>('[data-vast-link="picked"]');
        levelWith(pane, counterpart, picked ? middleOf(picked) : null);
      });
    };

    // Twice: a table still settling — a month arriving, a font swapping, the pane still opening — states a row's
    // place wrongly, and a pane scrolled to a wrong place stays there. The second pass reads the layout that
    // settled, and asks for no move at all where the first one landed right.
    level();
    const again = setTimeout(level, SLIDE_MS);
    return () => clearTimeout(again);
  }, [order, entry]);

  /**
   * Every link on screen, so a line can be drawn along each of them.
   *
   * <p>All of them rather than only the pair a reader picked: which orders the bank has paid is what the split is
   * open to see, and a link a reader has to click to be shown is a link they have to already suspect. They are read
   * off the rows themselves — an order states the entries that settled it, an entry states its own reference — so
   * the split pairs up what the two tables are showing without holding a list of its own.
   *
   * <p>Re-measured whenever a pane scrolls, because the ends are rows and rows move. An end scrolled out of its pane
   * is no end to draw to, so that link is simply not drawn until it comes back.
   */
  useEffect(() => {
    const measure = () => {
      const split = splitRef.current;
      const left = ordersPane.current;
      const right = entriesPane.current;
      if (!split || !left || !right) return;

      // Not while the divider is moving: the lines would be measured against panes that are still changing width,
      // and measuring on every step of a drag is what a drag can least afford.
      if (dragging) return;

      const box = split.getBoundingClientRect();
      // An end scrolled out of its pane is drawn against the pane's own edge rather than dropped: a link nobody can
      // see is a link nobody knows is there, and the reader is being shown which orders the bank has paid. Such a
      // line is faded, so it reads as pointing off the screen rather than as joining the row it happens to touch.
      const within = (pane: HTMLElement, row: HTMLElement) => {
        const bounds = row.getBoundingClientRect();
        const visible = pane.getBoundingClientRect();
        const middle = bounds.top + bounds.height / 2;
        return {
          left: Math.max(bounds.left, visible.left),
          right: Math.min(bounds.right, visible.right),
          y: Math.min(Math.max(middle, visible.top + EDGE_MARGIN), visible.bottom - EDGE_MARGIN),
          offScreen: middle < visible.top || middle > visible.bottom
        };
      };

      const entries = new Map(
        [...right.querySelectorAll<HTMLElement>('[data-vast-entry]')].map((row) => [row.dataset.vastEntry ?? '', row])
      );

      const lines: DrawnLink[] = [];
      left.querySelectorAll<HTMLElement>('[data-vast-entries]').forEach((orderRow) => {
        const from = within(left, orderRow);
        (orderRow.dataset.vastEntries ?? '').split(' ').forEach((reference) => {
          const entryRow = entries.get(reference);
          if (!entryRow) return;
          const to = within(right, entryRow);
          lines.push({
            key: `${orderRow.dataset.vastOrder}/${reference}`,
            orderId: orderRow.dataset.vastOrder ?? '',
            reference,
            entryId: Number(entryRow.dataset.vastEntryId),
            // Only a link a person wrote can be untied: an automatic match is what the payer's own words say, and
            // there is nothing on the entry to clear.
            mapped: entryRow.dataset.vastMapped === 'true',
            offScreen: from.offScreen || to.offScreen,
            picked: orderRow.dataset.vastLink != null || entryRow.dataset.vastLink != null,
            x1: from.right - box.left,
            y1: from.y - box.top,
            x2: to.left - box.left,
            y2: to.y - box.top
          });
        });
      });
      // And the link about to be made, dotted: two rows picked on either side are a link a reader is proposing, and
      // the circle offering to tie them says so at the divider while this says so between the rows themselves.
      const pickedOrder = left.querySelector<HTMLElement>('[data-vast-link="picked"]');
      const pickedEntry = right.querySelector<HTMLElement>('[data-vast-link="picked"]');
      if (pickedOrder && pickedEntry) {
        const already = `${pickedOrder.dataset.vastOrder}/${pickedEntry.dataset.vastEntry}`;
        if (!lines.some((line) => line.key === already)) {
          const from = within(left, pickedOrder);
          const to = within(right, pickedEntry);
          lines.push({
            key: 'proposed',
            orderId: pickedOrder.dataset.vastOrder ?? '',
            reference: pickedEntry.dataset.vastEntry ?? '',
            entryId: Number(pickedEntry.dataset.vastEntryId),
            mapped: false,
            proposed: true,
            offScreen: from.offScreen || to.offScreen,
            picked: false,
            x1: from.right - box.left,
            y1: from.y - box.top,
            x2: to.left - box.left,
            y2: to.y - box.top
          });
        }
      }

      setDrawn(lines);
    };

    measure();
    const panes = [ordersPane.current, entriesPane.current].filter((pane): pane is HTMLDivElement => pane !== null);
    panes.forEach((pane) => pane.addEventListener('scroll', measure, { passive: true }));
    // And whenever a pane changes shape rather than at a moment guessed to be after it stopped: the panes open by
    // animating their own width, and a line measured while that was happening is a line drawn to where the rows
    // were passing through. Watched, the lines simply follow it.
    const resized = new ResizeObserver(measure);
    panes.forEach((pane) => resized.observe(pane));
    // And once more when the opening is over. The observer above is the honest answer and is what follows a drag,
    // but its callbacks arrive with the frames, and a tab nobody is looking at is given none — which would leave
    // the lines drawn where the panes were as they opened.
    const settled = setTimeout(measure, SLIDE_MS + 120);
    return () => {
      clearTimeout(settled);
      resized.disconnect();
      panes.forEach((pane) => pane.removeEventListener('scroll', measure));
    };
  }, [order, entry, share, paneHeight, shown, dragging, matching.linking]);

  /**
   * A click that lands on neither table's rows puts both picks down.
   *
   * <p>Picking is how a reader points at two rows, so pointing somewhere else is how they stop. Without it a pick
   * made and then thought better of has to be clicked off the row it was made on, which is a thing to remember
   * rather than a thing to do.
   *
   * <p>The line and the buttons standing on it are not "outside": a reader reaching for the button that ties the
   * two rows they picked would be putting those very picks down on the way to it.
   */
  // A click on the ground around the tables puts both picks down, which is how a reader says they are done with a
  // pair. A control is not that ground: closing the filter panel, or pressing anything either screen carries, is a
  // reader working with what they picked rather than pointing away from it.
  const noteClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest(kept)) return;
    matching.selectOrder(null);
    matching.selectEntry(null);
    setHeld(null);
  };

  const noteHover = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    setHovered({
      order: target.closest<HTMLElement>('[data-vast-order]')?.dataset.vastOrder,
      entry: target.closest<HTMLElement>('[data-vast-entry]')?.dataset.vastEntry
    });
  };

  const nudge = (event: React.KeyboardEvent) => {
    const step = event.key === 'ArrowLeft' ? -0.02 : event.key === 'ArrowRight' ? 0.02 : 0;
    if (!step) return;
    event.preventDefault();
    const stepped = Math.min(1 - minimumShare, Math.max(minimumShare, share + step));
    dragged.current = stepped;
    setShare(stepped);
    remember(stepped);
  };

  // The divider's own circle ties the two picked rows together, and does nothing else: untying belongs to the link
  // being untied, which is the line drawn for it. Nothing picked is nothing to do, and the line is left a line.
  // The link a reader is proposing, which is the one the tie button stands on.
  const proposed = drawn.find((link) => link.proposed) ?? null;

  return (
    <Box
      ref={splitRef}
      // Noted here rather than on every row of two tables: one listener for a screenful of rows, and neither screen
      // has to know that a pointer over one of its rows means anything.
      onMouseOver={noteHover}
      onMouseLeave={() => setHovered({})}
      onClick={noteClick}
      sx={(theme) => ({
        display: 'grid',
        // The drawn link lies over the panes, so it is placed against this.
        position: 'relative',
        '--vast-link-stroke': theme.palette.secondary.main,
        // The gap a screen leaves above its own card, held above the panes rather than inside them. Inside, the card
        // stands below the pane's top and its bar has that much to jump the moment it comes to rest; above, the card
        // is flush with the pane and stands exactly where it stands on the whole screen, so opening the split moves
        // nothing.
        // Held above the panes only while they are panes: closed, the orders keep the gap their own screen leaves.
        mt: shown ? `${PANE_GAP}px` : 0,
        // Stacked until there is width for two tables side by side: a pane narrower than its own columns would be a
        // screen neither of them fits in. Stacked, the page scrolls them both, the app header is above them again,
        // and everything below is left alone.
        gridTemplateColumns: '1fr',
        // Each pane keeps its own stacking to itself. Without it a screen's sticky bar and table head — which sit
        // above their own rows by number — are numbered against the line between the panes as well, and the button
        // standing on that line ends up under the table it is joining.
        '& > .vast-pane': { minWidth: 0, isolation: 'isolate' },
        // Every end of a link is marked the same way, dotted, on whichever side it is and whichever end a reader
        // picked. It is stated here because it is a fact about the two tables together rather than about either of
        // them, and because a row marked one way on one side and another on the other reads as two different things.
        '& [data-vast-link]': { outline: `2px dashed ${theme.palette.secondary.main}`, outlineOffset: '-2px' },
        // Everything the split is once the panes are side by side, stated in one block: a second block of the same
        // media query would collide with this one rather than adding to it, and the columns would be the half of it
        // that went missing.
        ...(shown && {
          [theme.breakpoints.up('lg')]: {
            // At whatever share of the width the divider was left at, and closed up to nothing while the entries
            // come and go. A transition rather than a keyframe, so the same rule takes them both ways.
            [shareVar]: share,
            gridTemplateColumns: shown ? `calc((100% - ${DIVIDER}px) * var(${shareVar})) ${DIVIDER}px 1fr` : '100% 0px 0fr',
            // None at all while the divider is being dragged: a transition there is the columns easing after the
            // pointer rather than following it, which is the whole of what makes a drag feel late.
            transition: dragging
              ? 'none'
              : theme.transitions.create('grid-template-columns', {
                  easing: shown ? theme.transitions.easing.easeOut : theme.transitions.easing.sharp,
                  duration: SLIDE_MS
                }),
            height: paneHeight ? `${paneHeight}px` : 'auto',
            '& > .vast-pane': {
              // Each pane scrolls on its own, so one side can be walked down while the other stays where it was, which
              // is the whole of reading two lists against each other.
              overflow: 'auto',
              // A pane is what its screen sticks against now, so the app header's height is no longer the offset: the
              // bar, the table head and the panel all come to rest at the pane's own top. Neither screen knows it is
              // in a pane; this is the whole of what tells them.
              // The card's own top border, which its bar sits below: resting there and coming to rest at nought is a
              // one-pixel jump on the first scroll, which is a jump all the same.
              [stickyTopVar]: `${CARD_BORDER}px`,
              // And no gap inside the pane, that gap now standing above the split.
              [paneGapVar]: '0px',
              // The card is taller than the pane and the pane is what clips it, so the pane carries the shape the card
              // would have rounded itself to. Without it the entries end in a square cut across the foot of the window.
              borderBottomLeftRadius: `${Number(theme.shape.borderRadius) * 1.5}px`,
              borderBottomRightRadius: `${Number(theme.shape.borderRadius) * 1.5}px`,
              // No scrollbars at all. Two panes side by side are two more bars than a screen should carry, and they
              // frame every table in grey down the very edges the lines between the panes are drawn across. The panes
              // still scroll — by wheel, by touch, and by being asked to bring a row into view.
              scrollbarWidth: 'none' as const,
              '&::-webkit-scrollbar': { display: 'none' }
            }
          }
        })
      })}
    >
      <Box className="vast-pane" ref={ordersPane}>
        {orders}
      </Box>

      {/* Everything the split adds. The orders above are the same mounted screen whether the split is open or not:
          left to be unmounted and put back, the panel beside them would come back already open, having never had a
          shut state to open from. */}
      {rendered && (
        <>
          {/* The line between the panes: the handle they are resized by, and the place the two sides are tied together.
          A reader drags where the panes meet, which is where a hand goes; it answers the arrow keys as well, a split
          that could only be set with a mouse being one not everyone can set. */}
          <Box
            role="separator"
            aria-orientation="vertical"
            aria-label={intl.formatMessage({ id: 'reconciliation-match-resize' })}
            aria-valuenow={Math.round(share * 100)}
            aria-valuemin={Math.round(minimumShare * 100)}
            aria-valuemax={Math.round((1 - minimumShare) * 100)}
            tabIndex={0}
            onPointerDown={startDrag}
            onKeyDown={nudge}
            sx={{
              display: { xs: 'none', lg: 'flex' },
              position: 'relative',
              zIndex: 2,
              opacity: shown ? 1 : 0,
              // Nothing clipped here: the circle standing on this line is wider than the line, and a hidden overflow
              // takes the sides off it — which is a circle with its left and right thirds cut away, reading as a
              // pill stuck between the tables rather than a button sitting on the line.
              overflow: 'visible',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              cursor: 'col-resize',
              // The grip is a drawn line rather than the whole width tinted: what is grabbable is wider than what is
              // seen, so the line stays a line and the hand still finds it.
              '&:before': {
                content: '""',
                width: '2px',
                height: '100%',
                borderRadius: 1,
                bgcolor: dragging ? 'secondary.main' : 'divider',
                transition: 'background-color 120ms'
              },
              // The line answers a hand on the line. A hand on the button standing on it is reaching for the
              // button, not for the divider, so the line stays as it was.
              '&:hover:not(:has(button:hover)):before, &:focus-visible:before': { bgcolor: 'secondary.main' }
            }}
          >
            {/* The line says it can be moved rather than leaving a reader to discover it: a grip stands in the middle
            of it, which is where a hand reaches for a divider, and it is what the pointer changes shape over. It
            stays there while a link is being offered: the circle that ties one now stands where that link runs
            rather than in the middle, so the two no longer share a spot for one to give up. */}
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                px: '5px',
                py: '10px',
                borderRadius: 4,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                color: 'text.secondary',
                zIndex: 2,
                '& span': { width: 3, height: 3, borderRadius: '50%', bgcolor: 'currentColor' }
              }}
            >
              <span />
              <span />
              <span />
            </Box>
          </Box>

          <Box
            className="vast-pane"
            ref={entriesPane}
            sx={(theme) => ({
              // The entries come in from the side they stand on and leave the same way, so the split reads as the orders
              // being joined by them rather than as a screen replaced by another. The fade is what covers the table
              // reflowing as the column it is in closes up.
              opacity: shown ? 1 : 0,
              transition: theme.transitions.create(['opacity'], {
                easing: shown ? theme.transitions.easing.easeOut : theme.transitions.easing.sharp,
                duration: SLIDE_MS
              }),
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' }
            })}
          >
            {entries}
          </Box>
        </>
      )}

      {/* The links themselves, drawn between the rows that are their ends: a curve across the gap rather than two
          outlines a reader has to pair up by eye. Each one can be taken hold of — the line is wider to the pointer
          than to the eye — and the one held is what the untie button belongs to. */}
      {rendered && shownLinks.length > 0 && (
        <Box
          component="svg"
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, overflow: 'visible' }}
        >
          {shownLinks.map((link) => {
            const curve = `M ${link.x1} ${link.y1} C ${link.x1 + (link.x2 - link.x1) / 2} ${link.y1}, ${link.x2 - (link.x2 - link.x1) / 2} ${link.y2}, ${link.x2} ${link.y2}`;
            const taken = link.key === held;
            return (
              <g key={link.key}>
                <path
                  d={curve}
                  fill="none"
                  strokeWidth={taken ? 3 : 2}
                  strokeLinecap="round"
                  // A link about to be made is dotted, which is what tells it from the ones that exist; a link with
                  // an end scrolled out of its pane is faded, so it reads as pointing off the screen rather than as
                  // joining the row it happens to touch.
                  strokeDasharray={link.proposed ? '2 6' : undefined}
                  opacity={link.offScreen ? 0.35 : 1}
                  style={{ stroke: 'var(--vast-link-stroke)' }}
                />
                <circle cx={link.x1} cy={link.y1} r={3} opacity={link.offScreen ? 0.35 : 1} style={{ fill: 'var(--vast-link-stroke)' }} />
                <circle cx={link.x2} cy={link.y2} r={3} opacity={link.offScreen ? 0.35 : 1} style={{ fill: 'var(--vast-link-stroke)' }} />
                {/* What the pointer actually meets: a line two pixels wide is a line nobody can hit. */}
                <path
                  d={curve}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onClick={() => setHeld(taken ? null : link.key)}
                />
              </g>
            );
          })}
        </Box>
      )}

      {/* Tying, offered on the link it would make. It crosses the divider, because that is where the two sides meet,
          but at the height the link itself runs at: a reader who has just picked two rows is looking at those rows,
          and a circle pinned to the middle of the window is a circle nowhere near the pair it ties. */}
      {rendered && !matching.panelOut && proposed && (
        <Tooltip title={intl.formatMessage({ id: 'reconciliation-match-link' })} arrow>
          <Fab
            size="small"
            color="primary"
            aria-label={intl.formatMessage({ id: 'reconciliation-match-link' })}
            disabled={matching.linking}
            onClick={() => matching.link()}
            sx={{
              position: 'absolute',
              left: (proposed.x1 + proposed.x2) / 2,
              top: (proposed.y1 + proposed.y2) / 2,
              transform: 'translate(-50%, -50%)',
              zIndex: 3,
              boxShadow: 3
            }}
          >
            {matching.linking ? <CircularProgress size={18} color="inherit" /> : <Link21 size={20} />}
          </Fab>
        </Tooltip>
      )}

      {/* Untying, offered on the link a reader is holding and only where a person wrote it: an automatic match is
          what the payer's own words say, and there is nothing on the entry to clear. */}
      {rendered && !matching.panelOut && holding?.mapped && (
        <Tooltip title={intl.formatMessage({ id: 'reconciliation-match-unlink' })} arrow>
          <Fab
            size="small"
            color="error"
            aria-label={intl.formatMessage({ id: 'reconciliation-match-unlink' })}
            disabled={matching.linking}
            onClick={() => matching.unlink(holding.entryId).then(() => setHeld(null))}
            sx={{
              position: 'absolute',
              // Halfway along the line it belongs to, so it is plainly that link's button and no other's.
              left: (holding.x1 + holding.x2) / 2,
              top: (holding.y1 + holding.y2) / 2,
              transform: 'translate(-50%, -50%)',
              zIndex: 3,
              boxShadow: 3
            }}
          >
            {matching.linking ? <CircularProgress size={18} color="inherit" /> : <LinkSquare size={20} />}
          </Fab>
        </Tooltip>
      )}
    </Box>
  );
}
