# Order tax type feature requirements

An order's tax type is how it is treated for tax, which is what decides how it
is accounted for. It is a property of the order rather than of any one screen,
so it is a shared feature in `com.vastbricks.api.tax` and not part of
reconciliation: the reconciliation screen is its first caller, not its owner.

- The public API is three types: `OrderTaxType`, the vocabulary; `OrderTaxTypes`,
  which derives it from a marketplace's own order; and `FacilitatorTaxes`, which
  derives what the marketplace collected as tax facilitator from the same order.
  A caller passes the marketplace order it already holds and gets the shared
  type or the amount back.
- Adding a marketplace is one more `OrderTaxTypes.of` and `FacilitatorTaxes.of`
  method. Callers do not change, because they already speak `OrderTaxType`.
- The four types are `domestic` (sold within Latvia with Latvian VAT charged),
  `european-union` (sold into another member state with VAT charged), `export`
  (sold outside the EU with no tax charged), and `export-taxable` (sold outside
  the EU but taxed all the same, normally by the marketplace).
- The type carries no display text, as a reconciliation failure carries none.
  The API returns the code and `vast-portal` words it through the
  `order-tax-type-<code>` messages in `en.json` and `lv.json`. The portal's own
  vocabulary lives in `types/tax.ts` and its icon in the shared
  `OrderTaxTypeIcon` component, so a screen that shows a tax type neither
  redeclares it nor draws it again.
- The conditions overlap, so the checks are ordered and the first match wins: a
  Latvian order and a marketplace-taxed export both carry a tax scheme, and an
  untaxed export is an EU order whose rate happens to be zero. An order that
  matches none of them has no type rather than a guessed one.
- BrickOwl states a tax scheme, a rate, and the country it billed. A scheme with
  a rate is `domestic` when `billing_country_code` is `LV` and `export-taxable`
  otherwise; with no scheme, a rate of zero is `export` and any other rate is
  `european-union`. No rate at all leaves the order untyped.
- BrickLink names no tax scheme, so what it charged stands in for one.
  `VATCHARGES` is the VAT collected under the store's own registration: any
  charge is `domestic` when `LOCATION` names Latvia and `european-union`
  otherwise. No such charge leaves an order that carries the marketplace's own
  `ORDERSALESTAX` or `ORDERVAT` as `export-taxable`, and one that carries
  neither as `export`. The export writes both of those as `0.00` rather than
  omitting them, so it is a charge of zero, not a missing field, that says no tax
  was taken; an order with no `VATCHARGES` element at all is untyped.
- The facilitator tax is the tax charged under the marketplace's own
  registration rather than the store's, so only an `export-taxable` order
  carries one: the type decides whether there is an amount at all. BrickOwl
  states it as `tax_amount`. BrickLink splits it between `ORDERSALESTAX` and
  `ORDERVAT`, one per jurisdiction it charges under, so its facilitator tax is
  their sum. An order of any other type has no facilitator tax rather than a
  zero, because nothing collected under a facilitator's registration is a
  different fact from a facilitator collecting nothing.
- The feature has no endpoint of its own, so the classification is a logic test
  addressing it through the test-only `/api/test/order-tax-type/<marketplace>`
  controller, and the facilitator tax through
  `/api/test/facilitator-tax/<marketplace>` beside it. One mapping per marketplace takes exactly the fields that
  marketplace states, and a parameter left out is a field it did not report, so
  a scenario is one marketplace's tax fields and the type they come to. It is
  not tested through the reconciliation order scenarios: those cover that the
  mapping stage collects the type onto an order, not what the type is.

