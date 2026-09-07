import TableCell from '@mui/material/TableCell';
import TableFooter from '@mui/material/TableFooter';
import TableRow from '@mui/material/TableRow';

import { numericCell } from 'utils/amount';

/** One line of a summary: a figure in the amount column, and what it is beside it. */
export interface SummaryLine {
  key: string;
  /** What the figure is, in the reader's own language: the screen words it, this only lays it out. */
  label: string;
  /** The figure as it reads, sign and currency included. */
  amount: string;
  /** What the figure is coloured by, where the screen colours it: a direction, or nothing. */
  colour?: string;
  /** Whether this line sums the ones above it, and is therefore ruled off from them. */
  sum?: boolean;
}

interface Props {
  /** Every line of the summary, in the order they read, groups of one currency after another. */
  lines: SummaryLine[];
  /** How many columns of the table stand before the amount, and how many after it. */
  before: number;
  after: number;
}

/**
 * What the period came to, held at the foot of the window while the rows scroll under it.
 *
 * <p>Laid out the way a bank lays out the foot of a statement: the figure in the amount column, so it reads down the
 * column it belongs to, and what it is beside it. One group of lines per currency rather than one set of totals,
 * each figure carrying its own currency, because an account moving in two currencies has two accounts of itself and
 * adding them would state a sum nobody stated.
 *
 * <p>Which lines those are is the screen's: a bank statement's period comes to what went out, what came in and
 * where the account stands, and a Stripe ledger's to those plus the fees Stripe took out of them. This lays them
 * out and holds them still.
 *
 * <p>It stays in view because it is the answer the rows are being read for: a period long enough to scroll is
 * exactly the period whose total cannot be arrived at by looking.
 *
 * <p>The whole foot is what comes to rest, as one element, and not its cells one by one. Sticking them one by one
 * was tried and broke the lines in half: the theme gives a cell `position: relative` to hang a column divider off,
 * under a selector that beats a plain `sx`, and it exempts the last cell of a row — so the name of a line, being
 * last, came to rest while the figure beside it went on scrolling. Out-specifying the theme is possible, as the head
 * above does, but a foot has a second reason not to. A cell resting against the bottom is placed by its own bottom
 * edge, and the head is placed by its top: cells of one line share a top edge, never necessarily a bottom one. So
 * the foot is stuck as the one element it already is, which has neither problem in it — the lines are held together
 * by the table, as they are when nothing is scrolling.
 *
 * <p>It keeps the table's own background rather than the tinted one a footer wears by default, and drops the small
 * upper case a footer is otherwise set in. The tint is close enough to the page behind the card that the figures sat
 * in a band that read as neither table nor page; the case is for column headings, and these are sentences about
 * money.
 *
 * <p>That ground is carried by the cells and not by the foot itself, and the foot is stripped of the edges the theme
 * draws on it. Both are squares the full width of the table: a ground painted on the foot fills in the corners the
 * last line rounds, and the theme's own bottom edge rules straight across them, so the card came out square-cornered
 * under a foot that had asked to be round. What is rounded is now the only thing painted.
 */
export default function TableSummaryFooter({ lines, before, after }: Props) {
  return (
    <TableFooter
      sx={(theme) => ({
        position: 'sticky',
        bottom: 0,
        zIndex: 2,
        // The theme grounds and edges the foot as a whole. Both are squares across the full width, so both square
        // the corners the last line below rounds; the ground moves onto the cells and the edges are drawn there too.
        bgcolor: 'transparent',
        border: 0,
        // The theme sets a footer cell in small upper case, which is a column heading's voice, and at a column
        // heading's size. These read at the size the entries above them do.
        '& .MuiTableCell-root': {
          textTransform: 'none',
          fontSize: '0.875rem',
          // Its own ground, so the rows travel under the foot rather than through it, carried cell by cell so the
          // rounded corners of the last line are what the reader sees.
          bgcolor: 'background.paper',
          // No column dividers anywhere in the foot, and no line under each of its lines: the summary is one
          // statement across the width rather than cells of a row, and the only rules it keeps are the heavy one
          // above it and the one a sum is ruled off by.
          borderBottom: 0,
          '&:after': { display: 'none' }
        },
        // Where the rows stop, said once across the whole width, and one of the two heavy rules the table keeps:
        // under the head and above the summary. Drawn on the cells of the first line rather than on the foot, whose
        // own edge would rule straight across the rounded corners below.
        '& tr:first-of-type .MuiTableCell-root': { borderTop: `2px solid ${theme.palette.divider}` },
        // The card cannot clip what overflows it, the stuck head and foot being the reason, so the last line rounds
        // the card's own bottom corners rather than filling them square. Taken from the shape the card rounds itself
        // to rather than stated again here, so the two cannot drift apart.
        '& tr:last-of-type .MuiTableCell-root': {
          '&:first-of-type': { borderBottomLeftRadius: Number(theme.shape.borderRadius) * 1.5 },
          '&:last-of-type': { borderBottomRightRadius: Number(theme.shape.borderRadius) * 1.5 }
        }
      })}
    >
      {lines.map((line) => {
        // The rule is drawn only across the two cells that carry the figure and its name: it rules off a sum, not
        // the width of the table.
        const ruled = line.sum ? { borderTop: '1px solid', borderTopColor: 'divider' } : undefined;

        return (
          <TableRow key={line.key}>
            {/* The columns the amount does not stand in carry the ground and nothing else. */}
            <TableCell colSpan={before} sx={{ border: 0 }} />
            <TableCell sx={{ ...numericCell, ...ruled, color: line.colour ?? 'text.primary', fontWeight: line.sum ? 700 : 500 }}>
              {line.amount}
            </TableCell>
            <TableCell colSpan={after} sx={ruled}>
              {line.label}
            </TableCell>
          </TableRow>
        );
      })}
    </TableFooter>
  );
}
