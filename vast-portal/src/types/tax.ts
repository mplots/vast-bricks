/**
 * How an order is treated for tax. The backend words nothing, so this is the code it returns; the portal words it
 * through the `order-tax-type-<code>` messages. It is not reconciliation's own vocabulary: the reconciliation screen
 * is its first reader, not its owner.
 */
export type OrderTaxType = 'domestic' | 'european-union' | 'export' | 'export-taxable';

/** Every type, in the order the screen lists them: nearest to home first. */
export const orderTaxTypes: OrderTaxType[] = ['domestic', 'european-union', 'export', 'export-taxable'];
