/**
 * Where a marketplace shows one of the store's orders.
 *
 * <p>Derived from the order id and nothing else, which is why it is the portal's rather than the API's: an address
 * that follows from a field already on the row is not a fact the backend has to state, store, or send down with
 * every order. The screens that show an order share this one copy of it, so the two cannot drift apart.
 *
 * <p>The marketplace is named in either spelling the API uses - the orders screen states the code the order was
 * stored under, reconciliation the marketplace's own name - because both are names of the same shop.
 */

const marketplaces: Record<string, (orderId: string) => string> = {
  // The BrickLink order view, asked to show the checklist, the weight and what remains, as the store opens it.
  BRICKLINK: (orderId) => `https://www.bricklink.com/orderDetail.asp?ID=${orderId}&viewChk=Y&viewWeight=Y&viewRemain=Y`,
  BRICKOWL: (orderId) => `https://www.brickowl.com/mystore/orders/history/${orderId}`
};

/** Where this order is shown, or null where there is no id to address or no marketplace of that name. */
export function orderUrl(source: string | null | undefined, orderId: string | null | undefined): string | null {
  const address = source ? marketplaces[source.toUpperCase()] : undefined;
  return address && orderId ? address(encodeURIComponent(orderId)) : null;
}
