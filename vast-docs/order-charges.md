# Order charges feature requirements

A charge is an amount taken on an order by someone other than the store: a tax
authority, a marketplace's own commission, or a payment gateway's own
processing fee. Which of these apply to an order and how much they come to are
properties of the order itself rather than of any one screen, so they live
together in one shared feature, `com.vastbricks.api.charges`, rather than
inside reconciliation or the orders screen: those are its callers, not its
owner. What the classes hold in common is that each is calculated from a
provider's own published terms rather than read off what it happened to
deduct, and each adds a provider by adding one more overload rather than
changing a caller.

The package holds three families of charge today: tax, the marketplace's own
fee, and the payment gateway's own fee. The first two take the marketplace
order a caller already holds and return a vocabulary value or an amount; the
third takes no order at all, only the payment method and grand total every
order already states, because Stripe and PayPal charge on the amount taken
rather than on anything particular to a marketplace's own order shape.

## Tax

An order's tax type is how it is treated for tax, which is what decides how it
is accounted for.

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
- The classification is a logic test addressing it through the test-only
  `/api/test/order-tax-type/<marketplace>` controller, and the facilitator tax
  through `/api/test/facilitator-tax/<marketplace>` beside it. One mapping per
  marketplace takes exactly the fields that marketplace states, and a parameter
  left out is a field it did not report, so a scenario is one marketplace's tax
  fields and the type they come to. It is not tested through the reconciliation
  order scenarios: those cover that the mapping stage collects the type onto an
  order, not what the type is.

## Marketplace fee

An order's marketplace fee is what this store calculates BrickLink's or
BrickOwl's own commission on the order as, from each marketplace's published
rate schedule rather than from a figure either one states on the order itself.

- The public API is one type, `MarketplaceFees`. Its main overloads are shaped
  exactly as `OrderTaxTypes` and `FacilitatorTaxes` are: `of(BrickStoreOrder)`
  and `of(BrickOwlOrder)` each take the marketplace order a caller already
  holds and return an amount. Adding a marketplace is one more overload;
  callers speaking the shared vocabulary do not change.
- The calculation is never stored. What a row keeps is the raw amounts it
  needs to answer the question again, and the answer itself is worked out
  every time it is asked for, the same way a reconciliation rule is: a stored
  figure would go stale the moment a rate schedule changed, silently
  disagreeing with a fresh calculation of the same order.
- Neither marketplace's own reported figure is read for the calculation.
  BrickLink states no per-order fee anywhere its accounting export or API
  record reaches, so there is nothing to read. BrickOwl does report one, as
  `brickowl_fee`, but reading it would answer a different question: this
  feature calculates the fee independently so the two can be checked against
  each other, which is what a reported figure standing in for the calculation
  would rule out.
- BrickLink's commission is tiered, applied per order to the grand total -
  items and shipping together, `BASEGRANDTOTAL`: 3% of the first $500, 2% of
  the next $500, and 1% of anything past $1,000 - matching
  <https://www.bricklink.com/help.asp?helpID=38>, which states it as "the
  final dollar amount for each individual order that a seller receives." A
  VAT-registered store is billed on the net-of-VAT amount there instead;
  `VATCHARGES` is not subtracted here, which is the known gap between this
  figure and BrickLink's own bill for such a store.
- BrickOwl's commission is flat, 2.65% of `base_order_total` less `ship_total`
  less what <https://www.brickowl.com/help/store-fees> calls "non-import
  taxes" - matching its own wording, "the order total minus shipping minus
  non-import taxes." Which part of `tax_amount` is non-import is read off
  `OrderTaxTypes`, the tax family beside it in this same package: the
  facilitator tax BrickOwl collects on an `export-taxable` order is
  import-related and stays in the base, where the VAT a `domestic` or
  `european-union` order carries under the store's own registration is not and
  is subtracted alongside shipping. An `export` order carries no tax at all, so
  nothing is subtracted for it either way.
- Neither formula converts currency. Each is applied to the fields a
  marketplace states its own totals in, exactly as `order.grandTotal` and the
  rest of an order's amounts already are elsewhere without being reconciled
  against each other's currency - the known limitation `OrderFields` already
  documents for mixing a marketplace's base-currency and payment-currency
  fields applies here too, rather than being solved anew for this feature.
- An order stating no total to apply a rate to has no marketplace fee rather
  than a zero, as every other amount derived here does; one whose shipping and
  taxes exceed its total has a marketplace fee of zero rather than a negative
  one, there being no such thing as a marketplace paying a store to sell.
- The reconciliation report holds the marketplace's own order at the point it
  maps it, so it calls `of(BrickStoreOrder)` / `of(BrickOwlOrder)` there and
  carries the answer forward on `ReconciledOrder` until a read exposes it,
  under `calculated.marketplaceFee` - a calculated fact, not one either
  marketplace stated, and grouped exactly as `calculated.targetInvoice` is.
- The orders screen holds no marketplace order at all, only the row the import
  job last stored, so it cannot call those two overloads: neither carries the
  tax scheme or raw tax amount a stored row needs to tell BrickOwl's import tax
  apart from VAT charged under the store's own registration. `brickLinkOf` and
  `brickOwlOf` are the two additional overloads this leans on instead, taking
  the plain amounts a stored row already has - BrickLink's exactly, and
  BrickOwl's without the tax exclusion, which is the one known gap between
  what this screen calculates and what reconciliation calculates live for a
  BrickOwl order taxed under its own registration. The same gap in kind
  `OrderService` already documents for approximating the target invoice from
  stored amounts.
- Collected as `order.marketplaceFee` wherever `order.facilitatorTax` is: the
  reconciliation report's own order fields, and the orders screen's stored
  copy of them, `orders.marketplace_fee`. It is the marketplace's own reported
  figure - BrickOwl's `brickowl_fee`, or `null` for BrickLink, which reports
  none - never the calculation. The calculation rides beside it under
  `calculated.marketplaceFee` on both screens, so a reader compares the two by
  eye, there being only one calculation and one reported figure, and only for
  one of the two marketplaces. Because the reported figure only ever exists
  for BrickOwl, it is left out of a screen's footer total, which would
  otherwise read as a total of all shown orders while silently skipping every
  BrickLink one; the calculated figure answers for both marketplaces and is
  what a footer sums instead.
- Reconciliation does hold the two against each other with a rule of its own -
  see "Reconciliation" for `marketplace-fee-mismatch` and
  `payment-fee-mismatch` - which is reconciliation's business rather than this
  feature's: this package only calculates the figure, and what a rule does
  with two figures once both are collected belongs to whoever collects them.
  The orders screen runs no rules over what it holds at all, so the two
  figures sit beside each other there for a reader to compare without one.
- The live calculation is a logic test addressing it through the test-only
  `/api/test/marketplace-fee/<marketplace>` controller, beside the tax
  family's own test-only endpoints. One mapping per marketplace takes exactly
  the fields that marketplace states, and a parameter left out is a field it
  did not report. It is not tested through the reconciliation or orders
  scenarios: those cover that the mapping stage collects the fee onto an
  order, not what the fee is.
- `vast-portal` words this fee "Order fee" wherever it appears - the vocabulary
  read off BrickLink's or BrickOwl's own order, as opposed to the payment
  fee's "Payment fee" read off the gateway's - rather than "marketplace fee",
  which is this feature's own name for it.

## Payment fee

An order's payment fee is what this store calculates Stripe's or PayPal's own
charge for taking the payment as, from each provider's published rate rather
than from a figure a payment states.

- The public API is one type, `PaymentFees`, with a single `of` overload:
  `of(String paymentMethod, BigDecimal grandTotal, String country)`. Unlike
  `OrderTaxTypes`, `FacilitatorTaxes`, and `MarketplaceFees`, it takes no
  marketplace order: Stripe and PayPal charge on the amount actually taken,
  from where it came from, rather than on anything a marketplace's own order
  shape states, and all three - which of the two took it, how much, and where
  the order was shipped - are already collected onto every order, live or
  stored, as `paymentMethod`, `grandTotal` and `country`. There is
  consequently no second overload for a caller holding only a stored row
  either - the gap `MarketplaceFees.brickLinkOf` / `brickOwlOf` exist to cover
  does not arise here.
- The calculation is never stored, for the same reason the marketplace fee's
  is not: a stored figure would go stale the moment a rate changed, silently
  disagreeing with a fresh calculation of the same order.
- Which payment method a caller passes is `order.paymentMethod` as
  `com.vastbricks.api.reconciliation.ReconciliationPaymentMethod` already
  normalizes it: `Stripe`, `PayPal`, or anything else a marketplace worded a
  payment as. Only the first two carry a published rate to calculate from; any
  other payment method - `Bank Transfer`, or a marketplace's own wording
  nothing normalizes - has no payment fee rather than a zero, there being no
  such rate to apply.
- Both providers price a payment by where it came from as well as by which of
  them took it, so the calculation takes the order's country as a third input
  alongside the payment method and the grand total, resolved through the
  shared `country` feature exactly as `order.country` already is; see
  "Country feature requirements". Three tiers, the same shape for both
  providers: this store's own EEA, the United Kingdom, which both price apart
  from the rest of the EEA even though it sits right beside it, and everywhere
  else.
    - Stripe (<https://stripe.com/pricing>, published for a Latvia-based
      account): 1.5% + EUR 0.25 for an EEA-issued card, 2.5% + EUR 0.25 for a
      UK-issued one, 3.15% + EUR 0.25 for anywhere else.
    - PayPal (<https://www.paypal.com/ee/business/paypal-business-fees>): its
      domestic EEA-to-EEA commercial rate, 3.4%, plus its own published
      cross-border surcharge for a non-EEA buyer - 1.29% for the UK, 1.99% for
      everywhere else - all with its EUR 0.35 fixed fee. So a UK buyer is
      4.69% + EUR 0.35 and any other non-EEA buyer is 5.39% + EUR 0.35.
  A country neither table places - `null`, most often, since a caller like
  BrickLink's own export leaves it there whenever nothing resolves - is priced
  as EEA rather than as international: most of this store's own orders are,
  and defaulting to the rate none of them are would read every unresolved
  order as foreign instead of merely unclassified.
  Neither formula's fixed fee is converted for the currency the amount happens
  to be in, which is a known gap between this figure and what either provider
  actually bills, in the same spirit as the gap `MarketplaceFees` already
  documents for not converting currency either. Neither is either provider's
  own volume discount or negotiated rate, which this has no way to know at
  all.
- Applied to the grand total: the amount actually charged to the card or
  PayPal account, in whatever currency it is stated in - the store's own base
  currency for `order.grandTotal`, which for a Latvia-based store is normally
  EUR, so the EUR-denominated fixed fees above are added to an amount already
  in the same currency more often than not.
- Reconciliation already collects a live, reported figure for the same thing,
  `gateway.feeAmount` - what the provider's own balance transaction or
  transaction record actually shows it took. The calculation is not a
  substitute for that figure and does not replace it: it rides beside it as
  `calculated.paymentFee`, computed generically inside
  `ReconciledOrder.getCalculated()` from the payment method, grand total and
  country `OrderFields` already carries, rather than at mapping time from a
  raw provider record the way the marketplace fee has to be. A reader compares
  the two by eye, exactly as the marketplace's own reported fee and its
  calculation are compared - and, as with that pair, reconciliation also runs
  a rule of its own holding them against each other; see "Reconciliation" for
  `payment-fee-mismatch`.
- The orders screen has no gateway data at all - it never calls Stripe or
  PayPal - so `calculated.paymentFee` is the only account of a payment fee it
  can show, calculated from the same stored `paymentMethod`, `grandTotal` and
  `country` the marketplace fee's own stored-row overloads already read.
- The live calculation is a logic test addressing it through the test-only
  `/api/test/payment-fee` controller, beside the rest of this package's own
  test-only endpoints - one endpoint rather than one per provider, because,
  unlike a marketplace order, a payment method and a grand total are stated
  the same way whichever provider a scenario is naming.
