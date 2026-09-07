/** How the bank statement screen writes a money column, shared by its rows and its summary. */

export const numericCell = { textAlign: 'right', whiteSpace: 'nowrap' } as const;

/** Two decimals always, grouped the way the reader's own locale groups thousands. */
export const formatAmount = (value: number) =>
  Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
