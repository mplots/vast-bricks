import { Fragment } from 'react';

import Box from '@mui/material/Box';

export interface HighlightedProps {
  /** The cell's own text, shown whole whether anything was searched for or not. */
  text: string;
  /** The words that column is being searched for, lowercased, as the narrowing states them. */
  terms: string[];
}

/** A term is put into a pattern as text rather than as the expression it could otherwise read as. */
const quoted = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A cell's text with the part that was searched for marked.
 *
 * <p>Marking it is what makes a search worth running against a column of long remittance lines: the reader is looking
 * for the order number inside a sentence a payer wrote, and a row that merely matched somewhere leaves them to find
 * it again by eye. The mark is a `mark` element, so it says the same thing to a reader who cannot see the colour.
 *
 * <p>Every word the field asked for is marked wherever it appears, which is more than the reason the row is here —
 * the words narrow together and one of them alone would not have kept the row — but a reader scanning for two words
 * wants both of them under their eye.
 */
export default function Highlighted({ text, terms }: HighlightedProps) {
  if (terms.length === 0 || !text) {
    return <>{text}</>;
  }

  // Split on the terms rather than searched through: what falls between two matches has to be shown as well, and a
  // capturing group leaves the matches themselves at the odd places of the split.
  const parts = text.split(new RegExp(`(${terms.map(quoted).join('|')})`, 'gi'));

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index % 2 === 1 ? (
            <Box
              component="mark"
              // The row's ground already carries how the entry reconciled nothing and the banding carries the rhythm,
              // so the mark is the one warm colour in the table and reads over both. It keeps the cell's own text
              // colour: the amount column is coloured by direction, and a mark that recoloured it would say the
              // entry moved the other way.
              sx={{ bgcolor: 'warning.lighter', color: 'inherit', borderRadius: 0.5 }}
            >
              {part}
            </Box>
          ) : (
            part
          )}
        </Fragment>
      ))}
    </>
  );
}
