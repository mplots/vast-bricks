/**
 * Which columns the reconciliation table can read, which of them it opens with, and how a choice of them is written
 * down. The screen holds none of that itself: a choice travels in the address and in the browser's own storage, and
 * both of those are text that has to be read back defensively, which is a thing to state once and in one place.
 */

// Order property names, matching the backend ReconciliationOrderField enum.
export const orderFields = [
  'source',
  'orderId',
  'orderDate',
  'buyer',
  'buyerUsername',
  'paymentMethod',
  'taxType',
  'facilitatorTax',
  'subTotal',
  'grandTotal',
  'paidAmount',
  'paidFacilitatorTax',
  'targetInvoice'
] as const;
// Fields shown as table columns; the detail view shows all of them.
// The tax type is absent: it rides in the actions cell as an icon rather than spending a column on a word. The
// facilitator tax is here all the same, being an amount to account for rather than a classification, and the target
// invoice follows the two it is derived from so the columns read as the subtraction they are. What the payment shows
// the marketplace took follows what the payment paid, so the provider's two amounts read together rather than
// interrupting that subtraction.
export const columnFields: string[] = [
  'source',
  'orderId',
  'orderDate',
  'buyer',
  'paymentMethod',
  'grandTotal',
  'facilitatorTax',
  'targetInvoice',
  'paidAmount',
  'paidFacilitatorTax'
];

/** Every column the table can be asked to show: whatever the detail view can state, a column can state too. */
export const choosableFields: string[] = [...orderFields];

/**
 * The parameter the columns ride in, holding them as one comma-separated list in the order they are read: a field
 * name is a word of this screen's own rather than a marketplace's, so the separator is safe here, and an empty list
 * is how an address says that the table is down to its actions alone — which repeated entries could not say at all.
 */
export const columnParam = 'columns';

/**
 * The columns an address asks for, in the order it asks for them, or null where it asks for none at all: a name that
 * is not a field is not one, and a name asked for twice is one column rather than two.
 */
export const columnsIn = (params: URLSearchParams) => {
  const asked = params.get(columnParam);
  if (asked === null) {
    return null;
  }
  const named = asked.split(',').filter((name) => choosableFields.includes(name));
  return named.filter((name, index) => named.indexOf(name) === index);
};

/**
 * `shown` with every other column put back where `base` had it, so the picker states the whole table and not only
 * the part of it on screen. A column is put back after the last column ahead of it in `base` that survived, which is
 * what lets a column be hidden and shown again without moving. Anything neither list knows — a field the API has
 * gained since a preference was stored — comes last rather than being lost.
 */
export const fullOrder = (shown: string[], base: string[]) => {
  const known = [...base.filter((field) => choosableFields.includes(field))];
  choosableFields.forEach((field) => !known.includes(field) && known.push(field));
  const order = [...shown];
  known.forEach((field) => {
    if (order.includes(field)) {
      return;
    }
    const before = known
      .slice(0, known.indexOf(field))
      .reverse()
      .find((earlier) => order.includes(earlier));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, field);
  });
  return order;
};

/** The columns the screen opens with: the ones it shows, and behind them the ones it does not, in field order. */
export const defaultOrder = fullOrder(columnFields, choosableFields);

/**
 * How the reader's own arrangement is remembered: the whole order, hidden columns included, and which of it is
 * shown. The address carries only what is shown — that is what a link is for — so the order of the rest is the one
 * thing only the browser can remember, and it is what brings a column back where it was left rather than at the end.
 */
export type StoredColumns = { order: string[]; shown: string[] };

export const storedColumnsKey = 'vast-reconciliation-columns';

export const defaultColumns: StoredColumns = { order: defaultOrder, shown: columnFields };

/** What was remembered, read defensively: storage outlives the fields, and a shape it no longer fits is no shape. */
export const readStored = (stored: StoredColumns): StoredColumns => ({
  order: Array.isArray(stored?.order) ? fullOrder([], stored.order) : defaultOrder,
  shown: Array.isArray(stored?.shown) ? stored.shown.filter((field) => choosableFields.includes(field)) : columnFields
});
