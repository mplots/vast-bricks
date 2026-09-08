/**
 * Which columns the reconciliation table can read, which of them it opens with, and how a choice of them is written
 * down. The screen holds none of that itself: a choice travels in the address and in the browser's own storage, and
 * both of those are text that has to be read back defensively, which is a thing to state once and in one place.
 */

// Field paths, matching the backend ReconciliationOrderField enum: `<source>.<field>`, the path the value actually
// sits at in an order. The source is the segment before the dot rather than a prefix on the name, which is what lets
// two sources state one field — a facilitator tax, a refund — without either being renamed around the other.
//
// The list is kept here as well as reported by the API because it is the arrangement the screen opens with, and the
// address is read back before any month has been fetched. What the API reports is what a field's source is; a field it
// has gained since this list was written is still choosable, and lands last.
export const orderFields = [
  'order.source',
  'order.orderId',
  'order.orderDate',
  'order.buyer',
  'order.buyerUsername',
  'order.paymentMethod',
  'order.taxType',
  'order.facilitatorTax',
  'order.subTotal',
  'order.shippingCost',
  'order.grandTotal',
  'order.refundedAmount',
  'gateway.paidAmount',
  'gateway.facilitatorTax',
  'gateway.refundedAmount',
  'shipment.totalAmount',
  'calculated.targetInvoice'
] as const;
// Fields shown as table columns; the detail view shows all of them.
// The tax type is absent: it rides in the actions cell as an icon rather than spending a column on a word. The
// facilitator tax is here all the same, being an amount to account for rather than a classification, and the target
// invoice follows the amounts it is derived from so the columns read as the subtraction they are — the gateway's
// refund among them, even though most orders have none, because a target invoice cut by a refund the reader cannot
// see reads as a wrong one.
//
// The two refunds stand next to each other rather than each beside its own source's amounts. They are the two
// accounts of one refund that a rule holds against each other, so a disagreement between them is a thing to see at a
// glance instead of a failure to go looking for; only the gateway's takes part in the subtraction that follows.
//
// What the payment paid and what it shows the marketplace took come last together, so they read as one account of
// the payment rather than interrupting that subtraction.
export const columnFields: string[] = [
  'order.source',
  'order.orderId',
  'order.orderDate',
  'order.buyer',
  'order.paymentMethod',
  'order.grandTotal',
  'order.facilitatorTax',
  'order.refundedAmount',
  'gateway.refundedAmount',
  'calculated.targetInvoice',
  'gateway.paidAmount',
  'gateway.facilitatorTax',
  // What the post office charged comes after the payment's own account of the order: it is a third account of the
  // same order rather than part of the subtraction the amounts before it make.
  'shipment.totalAmount'
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
