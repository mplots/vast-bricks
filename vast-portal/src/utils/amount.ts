/** How the bank statement screen writes a money column, shared by its rows and its summary. */

export const numericCell = { textAlign: 'right', whiteSpace: 'nowrap' } as const;

/**
 * A figure with the sign it carries written out, so a column of them reads without being squinted at.
 *
 * <p>Shared by the two provider ledgers, which state a fee as a signed amount of its own: a refund gives part of one
 * back, which a figure always read as a deduction could not say.
 */
export const signedAmount = (value: number) => `${value < 0 ? '−' : '+'}${formatAmount(Math.abs(value))}`;

/** Two decimals always, grouped the way the reader's own locale groups thousands. */
export const formatAmount = (value: number) =>
  Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
