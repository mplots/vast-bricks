import TableCell from '@mui/material/TableCell';
import TableFooter from '@mui/material/TableFooter';
import TableRow from '@mui/material/TableRow';
import { useIntl } from 'react-intl';

import { formatAmount, numericCell } from 'sections/bank-statements/amount';
import type { BankStatementCurrencySummary } from 'types/bankStatement';

interface Props {
  summary: BankStatementCurrencySummary[];
  /** How many columns of the table stand before the amount, and how many after it. */
  before: number;
  after: number;
}

/** The three lines a currency is accounted for in, in the order a bank states them. */
const linesOf = (currency: BankStatementCurrencySummary) => [
  {
    id: 'bank-statement-debit-turnover',
    // The turnovers are stored unsigned, so the sign is put back here from what the line is, the way an entry's row
    // puts it back from the entry's direction.
    amount: `−${formatAmount(Math.abs(currency.debitTurnover))}`,
    colour: 'error.main'
  },
  {
    id: 'bank-statement-credit-turnover',
    amount: `+${formatAmount(Math.abs(currency.creditTurnover))}`,
    colour: 'success.main'
  },
  {
    // The balance is signed already and keeps whatever sign it came with: an overdrawn account is a fact about it
    // rather than a direction of movement. It is what the two above come to, so it is ruled off from them.
    id: 'bank-statement-closing-balance',
    amount: formatAmount(currency.closingBalance),
    colour: 'text.primary',
    sum: true
  }
];

/**
 * What the period came to, held at the foot of the window while the entries scroll under it.
 *
 * <p>Laid out the way a bank lays out the foot of a statement: the figure in the amount column, so it reads down the
 * column it belongs to, and what it is beside it. Three lines per currency — what went out, what came in, and where
 * the account stands — and a whole group per currency rather than one set of totals, each figure carrying its own
 * currency.
 *
 * <p>It stays in view because it is the answer the entries are being read for: a period long enough to scroll is
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
 * in a band that read as neither table nor page; the case is for column headings, and these are three sentences
 * about money.
 */
export default function SummaryFooter({ summary, before, after }: Props) {
  const intl = useIntl();

  return (
    <TableFooter
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 2,
        // The foot starts with one continuous rule, including the empty cells before the amount, so it reads as a
        // separate account of the entries rather than another table row.
        '& .MuiTableRow-root:first-of-type .MuiTableCell-root': {
          borderTop: '1px solid',
          borderTopColor: 'divider'
        },
        // The card cannot clip the sticky foot, so its last row carries the card's lower curves itself.
        '& .MuiTableRow-root:last-of-type .MuiTableCell-root': {
          '&:first-of-type': { borderBottomLeftRadius: 1.5 },
          '&:last-of-type': { borderBottomRightRadius: 1.5 }
        },
        // Every cell carries its own ground so the entries travel under the foot rather than through it, while the
        // footer itself stays clear of the lower corners cut away by its last row. The theme sets a footer cell in
        // small upper case, which is a column heading's voice, and at a column heading's size. These read at the size
        // the entries above them do.
        '& .MuiTableCell-root': { bgcolor: 'background.paper', textTransform: 'none', fontSize: '0.875rem' }
      }}
    >
      {summary.flatMap((currency) =>
        linesOf(currency).map((line) => {
          // The rule is drawn only across the two cells that carry the figure and its name: it rules off a sum, not
          // the width of the table.
          const ruled = line.sum ? { borderTop: '1px solid', borderTopColor: 'divider' } : undefined;

          return (
            <TableRow key={`${currency.currency}:${line.id}`}>
              {/* The columns the amount does not stand in carry the ground and nothing else: no divider of their own,
                  the summary being one statement across them rather than cells of a row. */}
              <TableCell colSpan={before} sx={{ border: 0, '&:after': { display: 'none' } }} />
              <TableCell sx={{ ...numericCell, ...ruled, color: line.colour, fontWeight: line.sum ? 700 : 500 }}>
                {line.amount} {currency.currency}
              </TableCell>
              <TableCell colSpan={after} sx={{ ...ruled, '&:after': { display: 'none' } }}>
                {intl.formatMessage({ id: line.id })}
              </TableCell>
            </TableRow>
          );
        })
      )}
    </TableFooter>
  );
}
