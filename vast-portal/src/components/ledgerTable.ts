import type { Theme } from '@mui/material/styles';

import { stickyTop } from 'components/SidePanel';

/**
 * How a ledger table is worn: the bank statement's entries and the Stripe account's transactions.
 *
 * <p>Both read a period at a time, dozens or hundreds of rows long, with a head naming the columns and a foot
 * totalling them, and both keep those two in view while the middle is read. It is one style rather than two because
 * a reader meets them on neighbouring screens, and because the rules below are delicate enough that two copies would
 * drift.
 *
 * <p>The page is the one thing that scrolls. A window of its own for the rows would have given the head and the foot
 * something nearer to hold on to, but it would also have given the screen a second scrollbar beside the page's, and a
 * reader scrolling a table should not have to notice which of two bars they are pushing. So the head stops under the
 * app header and the foot stops at the bottom of the window, which means nothing between the table and the page may
 * clip: a scrolling ancestor would catch them both and hold them inside the card.
 *
 * <p>A line is spent only where the table changes. A rule under every row, a divider between every heading and a
 * line under every field all read at one weight — a grid, in which the two rules that actually say something are
 * lost. So the rows are separated by a banded ground rather than by a line each, the head hangs no column dividers,
 * and what is left is the heavy rule under the head and the heavy rule above the summary.
 *
 * @param headingHeight how tall the heading row came out, measured rather than assumed: a heading wraps onto a
 *   second line on a narrow screen, and a second head row stopping at an assumed height would land over it
 * @param minWidth the width below which the columns stop fitting and the page scrolls sideways instead
 * @param titleHeight how far under the sticky origin the head comes to rest, for a screen whose own title bar sticks
 *   above it. Nought for one whose bar scrolls away.
 */
const ledgerTableSx =
  (headingHeight: number, minWidth: number, titleHeight = 0) =>
  (theme: Theme) => ({
    minWidth,
    // Laid out to the stated column shares rather than to what is in the cells, so nothing moves sideways when a
    // second head row opens or another period is read.
    tableLayout: 'fixed' as const,
    // The theme gives every head cell but the last `position: relative`, to hang the column divider off, and that
    // beats the `sticky` the stickyHeader prop asks for. Asked for again here, where it out-specifies the theme, so
    // the head stays put.
    '& .MuiTableCell-stickyHeader:not(:last-of-type)': { position: 'sticky' },
    // The page is what scrolls, so the head stops under the app header rather than at nought, and it keeps the ground
    // the row it sits in would otherwise have carried behind it.
    '& .MuiTableCell-stickyHeader': { top: stickyTop(titleHeight), bgcolor: 'secondary.lighter' },
    // A second head row rests under the headings rather than beside them, at the height they came out at, so the two
    // stack up under the app header instead of over each other. It carries the card's own ground rather than the
    // head's tint: the tint is what says a row is headings, and fields to type in sitting on it read as headings that
    // happen to be editable. The two grounds are also what tell the reader where the head's naming stops and its
    // asking starts, which saves the row a line of its own.
    '& thead tr:nth-of-type(2) .MuiTableCell-stickyHeader': {
      top: stickyTop(titleHeight + headingHeight),
      bgcolor: 'background.paper'
    },
    // The rule under the head goes under the last row of it, whichever of the two that is: a rule under the headings
    // as well would make a second head row a band of its own rather than part of the head it belongs to.
    '& thead tr:last-of-type .MuiTableCell-root': { borderBottom: `2px solid ${theme.palette.divider}` },
    // The head hangs a divider off every column but the last. They crossed the line under every row and made a grid of
    // the period; the head is grounded and ruled off already, which is enough to read it as the head.
    '& .MuiTableCell-stickyHeader:after': { display: 'none' },
    // A row is separated from the next by its ground rather than by a line of its own, and text that cannot be broken
    // at a space — an IBAN, a reference, a remittance line a payer ran together — is broken anyway rather than allowed
    // to spill across the column beside it.
    '& tbody .MuiTableCell-root': { borderBottom: 0, overflowWrap: 'anywhere' as const },
    '& tbody .MuiTableRow-root:nth-of-type(even)': { bgcolor: 'secondary.lighter' },
    // The banded ground is the theme's own hover colour, so the row under the pointer answers in a different one
    // rather than in the one every other row already wears.
    '& tbody .MuiTableRow-root:hover': { bgcolor: 'primary.lighter' }
  });

export default ledgerTableSx;
