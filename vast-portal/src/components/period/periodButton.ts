/**
 * The look a period wears when it is the title of a table: the reconciliation screen's month, and the bank statement
 * and Stripe transaction screens' month or year.
 *
 * <p>The period is the table's title, so it is worn as the title's own type rather than as a form field, and the
 * whole of it is the button that opens the picker. Shared because the two screens ask the same question in the same
 * place, and a title bar with two differently sized titles in it would read as two different kinds of thing.
 */
const periodButtonSx = {
  typography: 'h5',
  px: 0.75,
  py: 0,
  minWidth: 0,
  textTransform: 'none',
  '&:hover, &[aria-expanded="true"]': { bgcolor: 'secondary.lighter' }
} as const;

export default periodButtonSx;
