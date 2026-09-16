# Reconciliation feature requirements

Reconciliation is a planned large migration feature intended to replace a
substantial amount of legacy functionality incrementally. The requirements in
this section are the source of truth whenever work is requested for the
reconciliation feature. Add detailed reconciliation rules and processing steps
here as they are provided; do not invent unspecified behavior prematurely.

### User experience and scope

- The end result is a unified reconciliation screen in `vast-portal` that shows
  all relevant orders, similarly to the current Orders screen.
- The reconciliation screen must coexist with the current Orders screen during
  migration. In the long term, it is intended to replace the current screen.
- The screen takes inclusive From/To order dates and asks the backend to collect
  and reconcile that whole range, including ranges spanning months. The selector
  offers Month, Year, and Custom range: a month covers its first through last day,
  and a year covers January 1 through December 31. Apply submits both dates together;
  the range travels in the URL and is separate from the local row filters.
- Period selection stays in the report header. The period title opens a compact
  popover with month/year/custom-range choices and Apply; month/year arrows stay
  beside the title. Reconciliation, bank statements, Stripe, PayPal, Accounting,
  and Archives share this header control. Each screen offers only the period
  shapes its backend supports; Accounting and Archives remain month-only.
- Custom ranges are drawn in days, whole months or whole years, whichever the
  range is actually stated in: a quarter is two clicks on a grid of months
  rather than a search for the last day of one. Months and years open on the
  same grid as the single-period views and pick the same way the day calendar
  does; a month range opens on the first of its start month and closes on the
  last of its end month, a year range on 1 January and 31 December, so what is
  applied is still a pair of dates. Reopening the picker shows the units the
  applied range was drawn in, and switching units widens the range it already
  has rather than clearing it.
- However they are drawn, both ends are edited the same way. Once both are set,
  clicking near an endpoint adjusts that endpoint and preserves the other;
  midpoint ties keep editing the last-adjusted endpoint, and an end dragged past
  the other turns the range around rather than emptying it. Hovering previews the
  same change that a click commits. Navigating preserves the selection, and Start
  over is the explicit way to clear it and pick a fresh range. A pending end date
  leaves the chosen start visible in the summary. In the day calendar, keyboard
  arrows move by day/week, Page Up/Down by month (with Shift, by year), and
  Home/End within the week.
- Every reconciliation source receives the selected date range. BrickLink exports
  use its bounds, and BrickOwl filters its list before requesting order details.
  Payment windows retain seven days of padding at both ends, and bank transfers
  retain seven days before and ninety days after the selected range. The API
  continues accepting `month` for existing callers, or `from` and `to` together;
  missing, invalid, reversed, or mixed inputs are rejected.
- A tenant's BrickLink and BrickOwl provider accounts each state an operating
  period, and it narrows that range further for that store's order source only:
  an order dated outside the period did not happen for this tenant, regardless
  of what the other store's period says. Either end left unstated leaves that
  side unbounded, and an account stating no period at all - or a tenant holding
  no account with that store - restricts nothing. A selected range entirely
  outside one store's operating period returns no orders from that source,
  rather than asking its provider about a period that could not contain any.
  Two tenants sharing one store's login are told apart by exactly this: the
  same credentials under periods that do not overlap.
- The purpose of the screen is to identify discrepancies for an order across
  the systems involved in commerce, payment, shipping, accounting, and store
  synchronization.
- An order whose reconciliation fails is marked by tinting its row the color of
  the loudest level among its failures; an order with nothing to show is tinted
  green, so every row states its verdict. A dot in the actions column said the
  same thing first and proved too quiet to find a failed order by while scanning
  a month, so the row carries the verdict alone now.
- A failure level is two separate controls, and they must not be confused for one
  another: coloring decides how the rows on screen read, and filtering decides
  which rows are there. Both exist, in different places.
- Selecting an order shows all available details, including why its
  reconciliation failed.
- The reconciliation table footer sums every money and count column in the
  frontend over the orders currently shown after filtering. Totals follow the
  visible column order, add money in cents and counts as whole numbers, and
  leave a wholly unreported column absent.
- The selected reconciliation report can be downloaded as CSV. The download
  uses the selected date range and all frontend row filters, with the visible
  columns in their selected order. Headers identify each field's source;
  numeric values remain numeric and missing values are empty cells.
- The table's columns are chosen and ordered by the reader, from a panel down
  the right of the table that stays shut until it is asked for. Every collected
  order field can be a column; the screen opens with the subset it has always
  shown. Columns are dragged into the order they are read in, and a hidden
  column keeps its place in the panel so showing it again brings it back where
  it was rather than at the end.
- A column is also dragged by its own heading in the table, which is where a
  reader's hand goes first: the panel chooses what is read, the headings arrange
  what already is, and both settle the same order. The heading being dropped on
  marks the edge the column would land against rather than the table reordering
  itself under the pointer, a month being too many rows to shuffle at each
  twitch of a drag. Dragging a heading is a shortcut, not the only way: the
  panel's handles answer the arrow keys, so the order is reachable without a
  mouse.
- The chosen columns ride in the address, as the filters and the coloring do, so
  a link hands the table over arranged as it was left. The address carries the
  shown columns only, in the order they are read.
- Remembering an arrangement is a separate act with a button of its own: the
  panel's save button stores it in this browser, hidden columns and their places
  included, and an address that names no columns falls back to what was saved.
  Arranging the table never writes that store on its own, so a table pulled
  apart to answer one question does not become the table the browser opens with.
- The screen is read-only except in one place: an order the bank paid that no entry names can be tied to the entry
  that paid it, from the split the screen opens beside the bank statement. See "Matching a bank transfer by hand".
- Only the failed state is currently required. Do not introduce additional
  reconciliation states until their requirements are provided.

### Data collection and reconciliation

- Item count and lot count are collected directly from the marketplace order:
  BrickLink's `ORDERITEMS` and `ORDERLOTS`, and BrickOwl's `total_quantity`
  and `total_lots`. They are exposed as `order.itemCount` and `order.lotCount`,
  shown as whole-number columns and in order details. Missing counts remain
  absent rather than being inferred from item lines; a reported zero stays zero.

- The screen is backed entirely by live provider data. Reconciliation records,
  provider responses, and reconciliation results are not stored in the Vast
  database.
- The reconciliation order list currently collects received BrickLink orders
  from the BrickStore XML export and BrickOwl orders from the BrickOwl API for
  the selected month. Each collected order carries its marketplace source
  (`BrickLink` or `BrickOwl`), order ID, order date, buyer, buyer username,
  payment method, payment currency, tax type, facilitator tax, sub-total, grand
  total, refunded amount, shipping charged, gateway paid amount, gateway fee,
  gateway facilitator tax, gateway refunded amount, shipping cost, and target
  invoice, together with its
  rule failures and the links to the order
  and its payment, each exposed beside the field it rides on. Add further fields
  and providers incrementally as their processing requirements are supplied.
- The accounting source collects the invoice that was actually written for the
  order: its sub-total, the VAT it charges and the grand total it comes to. All
  three come from one Manakabata invoice, so they are collected together or not
  at all — an order with a sub-total and no grand total would be an invoice that
  stated one and not the other, which is a different fact from no invoice having
  been matched. An order no invoice was matched to carries none of the three,
  which is itself the fact that it has not been invoiced.
- An accounting invoice names no order of its own, so it is matched on the note
  the `invoice` feature writes it with, `<marketplace>:<orderId>`, and the
  legacy `<Marketplace> order <orderId>` wording is read as well. The first
  invoice of an order wins. That note is the whole of the join between the two
  features, which is why the `invoice` feature must go on writing it.
- Manakabata's list endpoint offers no filter beyond the page size, and an order
  may be invoiced outside the month it was placed in, so the whole invoice list
  is fetched and the mapper searches it for the month's orders. The source
  therefore ignores the month it is given.
- No rule compares the invoice against the order yet. The three fields are
  collected so a rule can be added later without touching the sourcing or the
  screen; they are choosable columns rather than shown ones until something
  compares them.
- Every field belongs to one of five sources, and reconciliation is the business
  of holding those accounts of one order against each other: `order` is what the
  marketplace reported about the order itself, `gateway` what the payment
  provider reports about the payment matched to it, `shipment` what the shipping
  provider reports about the shipment sent for it, `accounting` what the
  accounting system holds for it, and `calculated` what is derived from the rest
  rather than stated by anyone.
- The source is structural, not a naming convention. An order carries one group
  per source — `order`, `gateway`, `shipment`, `accounting`, `calculated` — and
  a field is addressed
  as `<source>.<field>`, the path it actually sits at. Do not prefix a field
  name with its source: the path already says it, and a prefix says it twice
  while stuttering on the fields that need it least (`orderOrderId`) and
  confusing the ones that read as something else (`orderSource`). The older
  `paid` prefix for gateway fields is likewise gone; it read as an amount paid,
  so it could not word a gateway field that was not one.
- Because the source is the path and not the name, two sources may state the
  same field without either being renamed around the other:
  `order.refundedAmount` and `gateway.refundedAmount` are one quantity claimed
  twice, which is exactly what the rule comparing them is for. Reach for that
  whenever a second source reports something the first already does, rather than
  inventing a second name for it.
- A source nothing is collected from yet carries no group. Every declared source
  now has one.
- Each field declares its source on `ReconciliationOrderField`, and the orders
  response reports the whole roster as `fields`, every field named by its path
  and attributed to its source. It rides with the orders rather than in an
  endpoint of its own, so a client can never show a month's orders against a
  roster fetched before them. A client groups and labels from the roster instead
  of keeping a list of sources of its own, and reads a value by walking the
  path.
- A failure cites field paths, and the portal words a failure by interpolating
  them. An ICU argument name carries no dot, so the placeholder is the path with
  its segments joined up: `order.refundedAmount` is `{orderRefundedAmount}`.
- The grand total is the order total in the store's base currency with shipping
  and additional charges included: BrickLink's `BASEGRANDTOTAL` and BrickOwl's
  `base_order_total`. No rule compares it yet.
- The payment method is collected from BrickLink's `PAYMENTTYPE` and BrickOwl's
  `payment_method_type`. The marketplaces word one payment provider differently
  — BrickLink for a person (`Credit/Debit (Powered by Stripe)`, `PayPal
  (Onsite)`), BrickOwl as a code (`stripe`, `paypal`) — so the mapping unifies
  them to one name per provider: `PayPal` and `Stripe`. Matching is on the
  marketplace wording containing the provider's name, case-insensitively. A bank
  transfer is unified the same way and for the same reason, though no provider
  stands behind it: BrickLink's `Bank Transfer` and BrickOwl's `bank` both
  collect as `Bank Transfer`.
- A payment method no provider is known for is collected as the marketplace
  worded it, trimmed, rather than dropped or lumped into an "other" name: the
  screen must still show how the order was paid. A missing or blank method is
  collected as no method at all.
- Unifying happens in the mapping stage, once, for the same reason amounts are
  normalized there: every rule and the screen then see one name per provider and
  never match on a marketplace's wording. Adding a name is a change to
  `ReconciliationPaymentMethod`, which the category packages see alongside
  `ReconciliationAmount`. Its fragments do not overlap, so the mapping needs no
  order to be unambiguous.
- The order currency is the currency the buyer paid in: BrickLink's
  `PAYCURRENCYCODE` and BrickOwl's `payment_currency`. It is trimmed and
  normalized to an uppercase ISO 4217 code in the mapping stage, exposed as
  `order.currency`, shown as a report column, and available as a UI filter.
- The tax type is how the order is treated for tax. It is not reconciliation's
  own vocabulary, so it lives in the shared `tax` feature and is only collected
  here; see "Order tax type feature requirements". The mapping stage derives it
  once from the marketplace order, as it normalizes amounts and payment methods
  there.
- The facilitator tax is what the marketplace collected on the order under its
  own tax registration. It belongs to the same shared `tax` feature as the tax
  type, is derived in the mapping stage beside it, and is normalized like every
  other collected amount. It is shown as its own column, unlike the tax type,
  because it is an amount to be accounted for rather than a classification an
  icon can carry.
- The paid facilitator tax is what the payment provider shows the marketplace
  took out of the payment as facilitator, and is collected beside the paid
  amount by the same payment mappers, for every marketplace and provider
  combination. Stripe states it as the application fee its `fee_details` list
  under the marketplace's Connect application: the buyer pays the tax into the
  store's own balance with the rest of the order, and the marketplace, which
  owes it under its own registration, deducts it again. Stripe's own processing
  fee sits in the same list as a `stripe_fee` and is not the marketplace's, so
  only the application fee entries are read, summed as Stripe lists each fee
  separately. PayPal states it as a partner fee: a transaction of its own,
  event code `T0113`, naming in `paypal_reference_id` the payment it was
  deducted from. The payment's own `sales_tax_amount` is not it — that is the
  tax the buyer paid, which a store charging under its own registration reports
  there just as a facilitator does, so reading it as the facilitator's would
  count every domestic and EU order's VAT as tax the marketplace took. Only the
  taking back tells the two apart, and only a facilitator raises a fee for it.
  A partner fee is a debit, stated negative, and fees naming one payment are
  summed. A payment that states neither took no facilitator tax, which is a
  different fact from taking zero, so the field is left absent rather than
  zeroed.
- PayPal counts a marketplace's own commission under the same event code as the
  tax it took, so a partner fee is the facilitator tax only while the
  marketplaces bill their selling fees separately, as both do today. A
  commission bundled into one would make the two sides of the tax disagree,
  which the reconciliation rule already reports.
- A partner fee is balance-affecting, so it arrives with the payments already;
  the mapping stage indexes the month's fees by the payment each names and no
  source or client knows about them.
- The order link is where the marketplace shows the order, derived in the
  mapping stage from the id the order was collected under: BrickLink's order
  detail view, asked to show the checklist, the weight and what remains as the
  store opens it, and BrickOwl's own store order view. Unlike a payment link it
  needs no configuration and no reference the mapping had to keep, so it is a
  plain derivation rather than a component.
- The payment link is where the provider shows the payment that was matched to
  the order, collected beside the paid amount by the same mappers. Stripe
  addresses a payment by the payment intent behind the charge, so the balance
  transaction list expands its charge rather than fetching one per payment, and
  falls back to the charge itself for a payment made without an intent. Stripe
  also needs the account the payment was taken under, which a balance
  transaction does not name; it is configured as `VAST_STRIPE_ACCOUNT_ID` and,
  unset, leaves Stripe-paid orders without a link rather than with one that
  lands wherever the reader is signed in. PayPal addresses a transaction by id
  alone. The address is built in the backend, where the provider reference and
  the account setting are: a link is not wording, so this does not put
  user-facing text there.
- Neither link spends a column of its own. Each rides on the field that names
  what it opens — the order id opens the order, the payment method opens the
  payment — in the table and in the detail view alike, and says where it goes in
  its accessible label. A field with nothing collected to link to stays the
  plain value it was. The row opens the detail dialog, so a link stops its click
  from reaching the row.
- A rule compares the two once a payment has been matched to the order: what the
  marketplace reported collecting must be what the payment shows it took, and a
  disagreement is an `error`, being tax one side or the other will report
  wrongly. Neither side collecting is the two agreeing; one side collecting
  where the other did not is a disagreement rather than missing data. An order
  no payment was matched to is left to the rule that requires one.
- The target invoice is what the accounting invoice for the order has to come
  to: the grand total less the facilitator tax, because that tax was charged
  under the marketplace's registration and is not the store's to invoice, and
  less the gateway refunded amount, which the store no longer holds to invoice
  for. The refund it subtracts is the provider's, not the marketplace's: what
  may still be invoiced turns on money having actually gone back, and the
  provider is the side that moved it, while the marketplace's own account of the
  refund is collected to be compared against that one rather than calculated
  from. An order no facilitator collected on is targeted at its whole grand
  total, one
  nothing was refunded on at the whole of what is left, and one with no grand
  total has no target at all. Nor has an order the marketplace says was refunded
  its whole grand total and that no payment was matched to: with no payment
  collected there is no account of the money the refund could come out of, so
  such an order has no target rather than a target of nothing. A partial
  marketplace refund on an order with no payment is not subtracted; only the
  gateway's refund is. A refund reaching past what was the store's to
  invoice leaves nothing to invoice rather than a negative invoice: the two
  subtractions do not come out of the same pocket, since the marketplace keeps
  the facilitator tax it took whether or not the buyer was refunded, and no
  invoice can be written for less than nothing. It is derived from collected
  fields of the same order rather than collected itself, so it is computed on
  `ReconciledOrder` instead of in each order mapper, and is exposed after the
  collected fields. It is shown as its own column, next to the ones it is
  derived from. No rule compares it against anything yet: what the order was
  actually invoiced for is not collected.
- Payments are collected from Stripe and from PayPal alongside the marketplace
  orders: Stripe's balance transactions and PayPal's transaction search, each for
  the month. Both providers date their transactions in UTC, so the month is asked
  for as a UTC window from the first day at 00:00:00 to the last day at 23:59:59,
  both ends included, padded by seven days at each end. Stripe's cursor paging is
  followed 100 transactions at a time and PayPal's page numbering 500 at a time.
  The window belongs to the source, the only class given the month; the paging
  belongs to the client, being each provider's own protocol.
- The window is padded because a payment is not dated where its order is. Stripe
  dates a balance transaction at the capture of its charge, which a marketplace
  may take days after the buyer authorized it, so an order of the last of the
  month is commonly paid on the first of the next; the marketplaces date an order
  in a zone of their own, which moves an order across midnight either way. An
  exact month left such an order looking unpaid in its own month while its
  payment was fetched in a month holding no order to attach it to. Seven days is
  the longest Stripe leaves an authorization capturable, and both providers are
  asked for the same window so they answer for one period. The pad costs nothing
  but the fetching: a payment is matched to an order by what it names, never by
  its date, so a transaction belonging to another month's order matches nothing
  and is ignored.
- PayPal searches no more than 31 days in one request, so its client covers a
  longer window a segment at a time. The segments are consecutive and overlap
  nowhere, because PayPal reports both ends of a range and a transaction reported
  twice would be read as two payments. How far a request may reach is PayPal's
  protocol, so the segmenting belongs to the client, next to its paging, and the
  source states one window for both providers.
- PayPal also refuses a range reaching into the future, which the padded window
  does for the month being lived through, so its client searches no further than
  a minute short of now. The minute is for clock skew, PayPal deciding what the
  future is by a clock of its own; a payment taken inside it is collected by the
  next run. A window lying wholly ahead of now is not asked for at all, so a
  month that has not happened reconciles to no payments rather than to a failed
  request. Stripe accepts a period reaching past now and is asked for the whole
  window, so the current month is padded for it as any other month is.
- PayPal reads a searched date to the second and rejects one carrying a
  fraction, which is exactly what the clock closing a window at now reports, so
  its client drops the fraction as it writes the request.
- Only a transaction that is a buyer paying for an order is mapped onto one:
  Stripe's `charge` and `payment` types, and PayPal's `T0006` event code. Both
  providers report the marketplaces' seller fees, currency conversions, refunds
  and, for PayPal, bank withdrawals in the same list; those are sourced and left
  unmapped, because a source decides nothing and what a transaction means is a
  mapping decision. A refund transaction is no exception: what came back out of
  a payment is read from the payment itself, as the refunded amount below,
  rather than by finding the refund transactions that reverse it.
- The paid amount is what the payment provider took for the order, gross of its
  own fees: Stripe's balance transaction `amount` in minor units divided by 100,
  and PayPal's `transaction_amount`, both normalized like every other collected
  amount. The provider's net is not collected, its fee is the field below. A
  refund does not reduce the paid amount: the payment did take what it took, and
  what came back afterwards is the refunded amount rather than a shortfall in
  what was paid.
- The gateway fee is what the provider charged for taking that payment, as a
  positive amount: everything Stripe deducted from the balance transaction
  except the marketplace's `application_fee` — the processing fee and the VAT
  some countries charge on it — and PayPal's `fee_amount`, which PayPal states
  as the deduction it is and which is reported as what was taken. Reading
  Stripe's as the rest of the fee rather than as `stripe_fee` alone keeps a fee
  type Stripe adds later inside the total rather than silently outside it.
  Nothing was charged where nothing was taken, so an order with no payment
  matched to it carries no fee rather than a zero.
- The fee is the store's own cost of being paid. It is not deducted from the
  target invoice, which is what the buyer is invoiced for: the buyer paid the
  grand total whatever the provider charged the store to receive it. It is
  reported apart from the facilitator tax for the same reason — both are taken
  out of one payment, but one is the provider's charge and the other is the
  marketplace's tax going back to whoever owes it.
- The refunded amount is what the marketplace reports was refunded to the buyer
  on the order, as a positive amount, or nothing where it reports none. The
  BrickLink export names no refund at all, so it is read off the order detail
  page instead, one page per order the export reports as `Cancelled`. The pages
  are addressed by ids the export had to name first, so they are fetched by the
  order source itself, all of them started before the first is joined, as the
  BrickOwl detail batches are. Only a cancelled order is asked about, a page per
  order being two hundred fetches a month against the handful of orders a refund
  plausibly belongs to, so a partial refund on an order of another status stays
  uncollected. The page states the refund in the order's own currency, which is
  collected as `order.currency`; the amount is still compared with the
  payment's as a number, as the payment matching's own amount key already is.
  BrickOwl states it as `refund_total` on the order itself, so it is
  collected in the mapping stage with the order's other amounts; the field is
  written as `0.00` rather than omitted where nothing came back, so a zero is
  the marketplace reporting no refund and is collected as no amount at all.
  Wherever it is uncollected the rule comparing the two sides of a refund fails
  wherever the payment shows one, which is the intended reading rather than a
  gap left open: the failure is the standing report of which orders had money
  come back that no marketplace mapping accounts for.
- The gateway refunded amount is what the provider shows has come back out of
  the payment, as a positive amount, or nothing where it shows none. A partial
  refund and a full one are the same field: how much of the payment was
  returned. From Stripe it is the expanded charge's own `amount_refunded`, the
  running total Stripe keeps on the charge, so one partial refund, several of
  them and a full refund are all one figure that no refund transaction has to be
  found for. It is what the payment has been refunded to date rather than what
  was refunded inside the reconciled month, because it is read to say what the
  order may still be invoiced for, and an order refunded in November is not
  invoiceable in August either. Refund transactions of the month are
  deliberately not summed instead: Stripe dates a refund at itself rather than
  at the charge it reverses, so the refunds inside a month's window are neither
  all of an order's refunds nor only its. Only Stripe collects it so far; PayPal
  follows when requirements for it are supplied.
- A rule holds the two accounts of the refund against each other once a payment
  has been matched: what the marketplace reported refunding must be what the
  payment shows came back, and a disagreement is an `error`, being an order one
  side or the other will invoice wrongly. Neither side reporting a refund is the
  two agreeing, which is what keeps the ordinary order silent; one side
  reporting one where the other did not is a disagreement rather than missing
  data. An order no payment was matched to is left to the rule that requires
  one.
- A refund does not return the provider's processing fee, and a marketplace does
  not give back the facilitator tax it took just because the buyer was refunded
  — it reverses its application fee separately, on its own Connect account,
  where a balance transaction of the store's does not report it. So neither the
  paid facilitator tax nor any fee is derived from a refund.
- What a payment names differs by provider and by marketplace, so each pairing
  is matched on what it actually carries. A Stripe payment carries a description:
  BrickOwl words it as `Brick Owl Order #1600001` and matches that order ID,
  BrickLink words it as `Payment for BrickLink from alan-t` and matches
  the buyer username. A PayPal payment carries what the marketplace labelled it
  with: BrickOwl puts its bare order number in `invoice_id` and matches that
  order ID, and BrickLink puts its own checkout id there instead, which names no
  order and cannot be joined to one.
- A PayPal BrickLink payment is therefore matched by the buyer, tried first: the
  marketplace order carries the buyer's real name, which is the name a payment is
  made under, and every name the payment gives — PayPal's payer name and its
  shipping recipient, which often disagree — counts as a match. Where no name
  matches, because the two systems spell one person differently often enough, the
  order is looked for by what it came to on the day it was placed. That key is
  weak, so it counts only when it names exactly one order.
- A buyer key the month collected several orders for is narrowed by what the
  payment took: the payment states its amount and each order states its grand
  total, so within one buyer's own orders the amount is an exact key rather than
  a guess. Exactly one order of that buyer coming to that amount is the order the
  payment settled. This is the same rule for both payment providers matching a
  BrickLink order on a buyer, so it is stated once in `PaymentMatch`.
- Where the amount settles nothing — several of that buyer's orders came to it,
  none did, or they carry no grand total to compare — every one of them stays
  unpaid, and the weaker amount-and-day key does not decide it either. A guessed
  payment would read exactly like a reconciled one. The first payment matched to
  an order wins.
- Names are compared trimmed, with inner runs of whitespace collapsed, and
  ignoring case, because the systems spell one person's name with different
  casing and spacing. No closer approximation is attempted: a rule that guesses
  at spelling would attach payments the screen could not be trusted on.
- The PayPal mappers consider only orders the marketplace says were paid through
  PayPal, because a weak key would otherwise attach a payment to an order settled
  another way. The Stripe mappers need no such guard: they match an order ID or a
  username the payment states outright.
- The amount-and-day fallback compares the payment against the order's grand
  total, which is in the store's base currency, while the payment is in the
  currency it was taken in. Although the collected order now carries its payment
  currency, the two amounts are still compared as numbers. That is correct while
  both are the same currency and is worth revisiting when a payment in another
  currency has to reconcile.
- An order the marketplace says was settled by bank transfer is paid through the
  bank, which is the one party to an order no provider exposes, so its payment is
  read out of the statement entries a person imported rather than asked of
  anyone. See "Bank statement feature requirements" for the import itself. The
  bank is that order's payment provider, so what it booked is collected under the
  `gateway` source exactly as a card provider's payment is, and every rule
  holding a payment against an order covers it without knowing where it came
  from. There is no payment link: a bank has no page the transfer can be opened
  at.
- Bank entries are read for the month's booking days padded seven back and ninety
  forward. The pad is lopsided because a bank transfer is paid after the order
  rather than around it: a buyer pays when they get around to it, sometimes weeks
  later, and a buyer who underpaid sends the rest later still, while the few days
  before cover only the marketplaces dating an order in a zone of their own. A
  wide window is safe here in a way it would not be for a weaker key, a transfer
  being attached only by the order ID it names and never by its date.
- A bank entry is matched to an order by the order ID it names and by nothing
  else. The mapping a person wrote is read first, being the manual last resort
  and therefore the one thing a payer's own wording must not override; failing
  that, the entry's remittance information is read. An ID counts only as a whole
  token, so "invoice 75000012" does not name order `7500001`, and text naming two
  collected orders names neither. Only orders the marketplace says were paid by
  bank transfer are considered, as the PayPal mappers consider only PayPal
  orders. Matching a bank transfer to a buyer by name is deliberately not
  attempted yet.
- A bank entry names no marketplace, so one mapper reads the text against every
  collected order rather than one mapper per marketplace each guessing at the
  other's orders. The ID scan is a match key like any other, so it is
  `ReconciledOrders.findNamedIn` rather than a scan inside the mapper.
- An order also carries the bank entries it was settled by, each named by the
  bank's own reference, and none for an order no transfer was matched to. It says
  which entries rather than how much, which the amounts already say: the matching
  screen reads the statement beside the orders and draws the link between the
  two, and an order matched by what a payer wrote on the transfer is as linked as
  one a person mapped by hand — but only the mapping is written on the entry, so
  without this the screen could show one kind of link and not the other. It is
  not a column and not in the field roster, as the payment link is not.
- Every bank credit naming one order is summed into its paid amount, which is
  where bank transfers depart from the first-payment-wins rule the providers
  follow: a buyer who underpaid and was asked for the rest made two transfers for
  one order, and both are money the store received, whereas a card payment is one
  authorization of one amount. A debit naming the order is money that went back
  out and is summed into the gateway refunded amount the same way. No entry
  either way leaves the field absent rather than zero, the bank having said
  nothing about it. The gateway facilitator tax stays absent because a bank
  deducts none.
- The shipping charged is what the marketplace charged the buyer for shipping
  the order: BrickOwl's `ship_total` and BrickLink's `ORDERSHIPPING`, or nothing
  where it charged none. It is stated as the marketplace stated it, in the
  currency it stated it in, as the sub-total is — the grand total is the one
  amount either marketplace gives in the store's base currency. It is the
  buyer's side of the postage that the shipment source states from the post
  office's, and no rule compares the two yet.
- The shipping cost is what the post office charged for the order's shipment:
  the postage with every additional service on it, as the Mans Pasts register
  states it. See "Shipment register requirements" for how the register is read.
- A shipment names its order in the notes the store wrote on it, which is where
  both marketplaces put it — `Order #32400001` — and names no marketplace at
  all, so the notes are read against every collected order rather than one
  mapper per marketplace guessing at the other's orders. That is the bank
  entry's reading and the same key, `ReconciledOrders.findNamedIn`. Notes naming
  two collected orders name neither, a guessed shipment reading exactly like a
  matched one, and a shipment naming no collected order is dropped.
- Every shipment naming one order is summed, as the bank credits are: an order
  shipped in two parcels was shipped twice for one order, and both parcels are
  postage the store paid for it, so the figure is what shipping that order cost.
  One parcel's own cost is a field of its own if it is ever wanted, not a
  different sum here.
- The register is not read by month and is not paged through: the export's first
  page holds every shipment the account has, so one request is the whole
  register and the month decides nothing about what is asked for. Everything the
  export stated is passed on, shipments of other months included — a source
  decides nothing, and a shipment naming no collected order is dropped by the
  mapper. The page number stays the client's own protocol; a register that ever
  outgrew its first page would be a walk added to the source rather than a
  change to the client.
- No rule compares the shipping cost against what the marketplace charged for
  it yet. The two are collected to be held against each other when a rule for
  them is supplied; a marketplace's postage is not the post office's price, so
  what a disagreement between them means has to be stated before it is judged.
- Because a BrickLink payment is matched on the buyer, its mapper reads fields
  another detail mapper merged. Detail mappers therefore declare their bean order
  explicitly rather than relying on scan order, and the payment mappers declare a
  later one than the BrickLink username mapper.
- A buyer, a buyer username, and an amount on a day are not the
  `<source>/<orderId>` key the collected list is indexed by, so
  `ReconciledOrders` answers each separately, scanning rather than indexing
  because those fields are merged after the order was collected. How an order is
  matched across systems stays in `ReconciledOrders` instead of moving into a
  mapper, which is why the root's API widened by those methods rather than by
  exposing the collected list.
- Data is requested from the providers on demand when the screen is opened.
- Provider requests should run in parallel so far as their dependencies allow.
- Potential performance problems from live, on-demand aggregation are accepted
  for now and will be addressed when concrete requirements or measurements are
  available.
- Keep reconciliation API acceptance scenarios focused on business behavior.
  Provider-specific WireMock protocol setup belongs in compact test-support
  fixtures, so a scenario states only the provider response and its business
  assertions.
- Orders have a shared identifier across systems, but exact identifier matching
  will not cover every case. Some sources will require more involved search or
  matching algorithms. Those algorithms will be specified during incremental
  implementation.
- Implement only the rules supplied for the current processing step rather than
  assuming that every order must have a record in every system. See
  "Reconciliation rules" for how a rule decides that it applies to an order.
- An order normally has one order source, one payment source, one shipping
  source, and corresponding single sources for the other reconciliation
  categories.

### Processing stages

- Reconciliation runs three explicit stages for one month: sourcing, mapping,
  and rules. Each stage is a separate boundary, and a class belongs to exactly
  one of them.
- `ReconciliationService` injects the sources, the mappers, and the rules as
  separate lists and controls the flow between them. It runs one stage per
  method, in order: fetch every provider, map everything that was fetched, then
  judge every collected order.
- Sourcing: a `Source<T>` takes the month and returns that provider's data as
  received, assembled only as far as the provider's own protocol requires —
  several calls of one provider joined, batches paired, transport failures
  raised. A source makes no reconciliation decision and normalizes nothing.
- Every source runs in parallel, started before the first result is joined. The
  sourcing stage finishes before mapping begins.
- A failing source is logged where it fails, at error, naming the source and the
  month and carrying the exception it failed with, whose cause is the provider's
  own account of what went wrong. It is logged there rather than only where the
  request answers because the sources run beside each other: the request answers
  with whichever failure is joined first, and a provider that failed alongside
  that one would otherwise leave no trace at all. The request's own error log
  line names the failure it answered with and no stack, that stack having been
  logged already.
- Mapping: a `Mapper<T>` turns what one source returned into the single
  reconciled order list. It never calls a client itself.
- A source declares the class it returns and a mapper declares the class it
  reads. That class is the whole glue between the two stages: neither side names
  the other, and a mapper has no dependency on a source.
- Exactly one source may return a given class. A second one claiming it is a
  wiring mistake and fails the application start, not a request. Several mappers
  may read one sourced class.
- A mapper whose class no source returns maps nothing, so a source and the
  mapper that reads it can be added in separate steps; a sourced class no mapper
  reads is simply not mapped yet.
- An `OrderMapper<T>` appends new orders to the list; a `DetailMapper<T>` merges
  fields onto orders already collected and adds none, so its data with no
  matching order is dropped. All order mappers run before all detail mappers.
- The mapping stage runs sequentially in declared bean order. That order is only
  the tiebreaker of the returned list: the orchestrator sorts every collected
  order by order date, newest first, so one month reads as one list rather than
  as one block per provider. An order with no date sorts last, and orders sharing
  a date keep the order the mappers collected them in.
- Rules: a `Rule` inspects one collected order and returns its failures. See
  "Reconciliation rules".
- Adding a provider means adding a source and a mapper. Adding a check means
  adding a rule. Neither changes the orchestrator, the API contract, or the
  reconciliation screen.
- A source, its carrier type, and its mappers live in a subpackage named after
  the reconciliation category they serve: `reconciliation.order`,
  `reconciliation.payment`, `reconciliation.shipping`,
  `reconciliation.accounting`, and later the store synchronization one.
  Category, not provider: a category is the
  vocabulary the requirements use, a provider's transport knowledge already
  lives in its `com.vastbricks.api.client.<provider>` package, and the
  categories stay a bounded set as providers are added.
- Every rule lives in `reconciliation.rule`, together with the rule boundary,
  the failure, its level, and the order field enum. Rules are not grouped by
  category: a rule reasons across categories, as the paid-amount rule does when
  it compares a payment amount with an order amount, so any category would be
  arbitrary.
- The feature root keeps the stage boundaries, the reconciled order model, the
  orchestrator, and the HTTP edge. It declares a small API and nothing more: the
  category packages see `Source`, `Mapper`, `OrderMapper`, `DetailMapper`,
  `ReconciledOrder`, `ReconciledOrders.find`,
  `ReconciledOrders.findByBuyerUsername`, `ReconciledOrders.findByBuyer`,
  `ReconciledOrders.findByGrandTotalOn`, `ReconciledOrders.findNamedIn`,
  `Marketplace`,
  `ReconciliationAmount`, `ReconciliationPaymentMethod`, and `ParallelTasks`; the rule package exposes `Rule`
  and `ReconciliationFailure` back to the root, which the orchestrator and the
  payload need. Everything else stays package-private: the orchestrator,
  `SourcedData`, the payload, the controller, `ReconciliationOrderField`,
  `ReconciliationFailureLevel`, every source, mapper, carrier, and rule
  implementation. Do not widen that API to
  make a subpackage's work easier; if one needs more, the need itself is worth
  stating here first.
- A carrier type stays package-private in its category package, because only its
  own source and mappers name it.
- Inside the reconciliation package the stage boundaries are named short:
  `Source`, `Mapper`, `OrderMapper`, `DetailMapper`, `Rule`, `ReconciledOrder`,
  `ReconciledOrders`, and `SourcedData` for what the sourcing stage handed the
  mappers. An implementation is prefixed by its stage and named after what it
  handles: `SourceBrickLinkOrders`, `MapperBrickLinkOrders`,
  `RulePaidAmountMatchesGrandTotal`. A source's carrier type is
  `Sourced<Provider><Thing>`, such as `SourcedBrickOwlOrder`; a source that
  assembles nothing declares the provider's own model as its class instead of
  wrapping it in a carrier that adds no field, as the payment sources declare
  `com.stripe.model.BalanceTransaction` and `PayPalTransaction`. A second source
  over the same model is what would make a carrier necessary, since exactly one
  source may return a given class. Everything stays package-private
  unless code outside the package uses it.

### Reconciliation rules

- A reconciliation rule is a backend Java class implementing the common rule
  boundary. Adding a rule must not require changing the evaluation pipeline,
  the API contract, or the reconciliation screen.
- A rule inspects one collected order and returns zero or more failures. Each
  failure carries a stable reason code, a level, and the ordered list of
  collected order fields the rule used. Codes identify a reason, not a rule: one
  rule may report different codes.
- A failure's level is how loudly it asks to be dealt with: `silent`, `info`,
  `warning`, or `error`. It belongs to the failure, not to the rule, so one rule
  may report different levels. A failure whose rule states no level gets `info`.
- A failure must not carry display text. The backend returns no user-facing
  strings for reconciliation. All wording lives in the `vast-portal` translation
  catalogs, keyed by failure code, and is interpolated with the field values the
  portal already holds.
- Field names in a failure are the API property names of the collected order,
  declared once in the reconciliation order field enum so the wire name and the
  property cannot drift apart.
- Rule conditionality is about whether a rule applies to an order at all. A rule
  that applies to an order and finds the data it needs missing fails that order
  rather than staying silent.
- Rule results are part of the order-list response. The screen must not issue a
  second request for reconciliation detail: nothing is stored, so a detail
  request would re-query every provider.
- Monetary amounts are normalized to two decimals, `HALF_UP`, by the mapper
  that produces the reconciled order field, so every amount is normalized
  exactly once before any rule sees it. Sources return provider amounts
  untouched. Rules compare normalized amounts exactly and must not define their
  own tolerances.
- The orders table shows `Actions`, source, order ID, order date, buyer, payment
  method, grand total, facilitator tax, refunded amount, gateway refunded
  amount, target invoice, gateway paid amount, gateway facilitator tax, and the
  shipping cost, newest order first as the API returns them. The shipping cost
  comes last, after the payment's own account of the order: it is a third
  account of the same order rather than part of the subtraction the amounts
  before it make. The gateway's paid amount and
  facilitator tax come last together, so they read as one account of the payment
  rather than interrupting the subtraction before them. The gateway's refund is
  part of that subtraction though most orders have none, because a target
  invoice cut by a refund the reader cannot see reads as a wrong one.
- The two refunds stand next to each other rather than each beside its own
  source's amounts. They are the two accounts of one refund that a rule holds
  against each other, so a disagreement between them is a thing to see at a
  glance rather than a failure to go looking for; only the gateway's takes part
  in the subtraction that follows.
- A field's label is its own name without the source, everywhere it is named.
  The detail view and the picker head their groups with the source, and a column
  heading carries nothing but the field's own name: a source in the heading
  reads as part of the column's name rather than as the account behind it.
- The table's head is two rows. The upper one is set lighter than the headings
  under it: the theme's own bold uppercase belongs to the columns, and a group
  names where a heading came from rather than what it is, so it is the quieter
  of the two. It is kept to one line: a name broken in two reads as two names
  and leaves the row a height the columns below it no longer stick under, so a
  run's columns widen to hold its name instead.
- The upper row names the account a run of columns came from, spanning it, so
  two columns headed alike — the two refunds are — are told apart by what
  stands over them. A run is columns of one source that are next to each other:
  the table is arranged so its amounts read as the sums they make, which is not
  the order the sources come in, so a source split apart by a column of another
  is named twice rather than spanning the column between them.
- A run draws its edge down the whole table, head and body alike, so a group
  reads down the table and not only across its head. The edge is the divider's
  own colour and not a colour per source. Colour in this table already means two
  things — how an order reconciled, which tints the row and is what a reader
  is looking for, and which marketplace an order came from, colouring its chip
  — and a third would compete with the tint it ran through.
- A line is spent only where the table changes, as it is on the bank statement
  screen. The theme hangs a divider off every heading, which crossed the line
  under every order and made a grid of the month; the head hangs none, so the
  only vertical line the table draws is the run edge, which means something. The
  line between one order and the next is rhythm rather than structure and is set
  well under the two rules that are — the heavy one under the head and the run
  edges down the body — rather than reading as loudly as either.
- It is a quieter line and not no line at all, which is where this table parts
  from the statement's. There the entries are banded, and a band is what
  separates one from the next; here the ground already says how an order
  reconciled, so it cannot also alternate, and two orders of one level would run
  together with nothing drawn between them.
- The detail view titles each source's fields and rules them off with a divider,
  the way a card titles what it holds. A heading alone left the groups to be
  noticed rather than seen, and which account stated a value is the whole reason
  the fields are grouped.
- The column picker is grouped the same way: one titled group per source, its
  columns indented under it, and a tick on the group itself that shows or hides
  every field one source states. Part of a group shown reads as part-ticked. A
  source's fields do not read as a group when each row merely repeats the
  source's name beside its own.
- Choosing the columns and arranging them are separate acts on separate
  surfaces. The picker chooses which columns are read and never their order;
  ordering is dragging the table's own headings, or moving a focused heading
  with the arrow keys. They cannot be one surface: the picker groups by the
  account that stated a field, while the table is arranged so its amounts read
  as the sums they make, and a list trying to be both could only be one of them.
- A heading is therefore the only place a column is moved from, so it answers
  the keyboard as well as the mouse and says as much in its label. A column that
  could only be moved with a mouse could not be moved by everyone.
- The tax type spends no column of its own. It rides in the actions cell as a
  small icon beside the invoice button: the Latvian flag for `domestic`, the
  European flag for `european-union`, the world for `export`, and the world
  marked with a percent for `export-taxable`. An order the marketplace said too
  little to type carries no icon. The icon names its type in a tooltip and in
  its accessible label, so it never says it by shape alone, and the detail view
  still shows the type as a word.
- The screen is laid out the way a shop lays out its results: one panel down the
  left side and the orders beside it. The panel is modelled on the template's own
  product filter drawer — persistent where there is room for it and a temporary
  overlay where there is not — and a button in the header opens and closes it. It
  sticks below the header card, so a long month scrolls past it rather than away
  from it.
- A header card runs above both the panel and the orders, holding what is being
  read and how much of it: the switch that opens the panel and the month on the
  left, then how many of the collected orders are shown and the button that
  collects that month again on the right. The three cards stay three cards, each
  with its own edges.
- The header card sticks under the app header, and the panel and the table's own
  head come to rest under it in turn, so what is being read and what the columns
  are never scroll away from the rows. The header's height is measured rather
  than assumed, because it wraps its controls onto another line on a narrow
  screen, and the two below it follow that measurement.
- Both buttons are their icon alone — the panel switch as the call to action, the
  refresh outlined beside the count — so each says what it is in its tooltip and
  in its accessible label rather than in a word beside it.
- Choosing a month collects it. The orders are what the screen is for, and a
  second click to see them said nothing the choice had not. A month input reports
  every keystroke of its year, so only a whole `YYYY-MM` is asked for.
- The button collects the month already on screen again, because the providers
  keep moving. Collecting queries every one of them, so it says it is working and
  refuses a second click until it is done.
- What is being read is where the screen is rather than something it merely
  remembers, so all of it rides in the address: the month, the filters narrowing
  it, and the levels highlighted. A reload, a bookmark, a link handed to someone
  else, or the browser's own Back arrow all land on the table they left. An
  address that names no month, or names one that is not a month or has not
  happened, is read as this month.
- Each facet holds its selected values under the parameter it is named for, one
  entry per value, so a marketplace's own wording needs no separator to be safe.
  The option standing for an order that answered a facet with nothing is written
  as the plain word `unstated`, and a collected value that reads that way takes a
  `!` in front of it, so the two can never be mistaken for one another.
- The highlighted levels ride in one comma-separated `highlight` parameter: a
  level is the screen's own word rather than a marketplace's, and an address with
  no `highlight` at all is the default of errors and warnings while an empty one
  is nothing highlighted, which repeated entries could not say.
- Stepping to another month carries the filters and the highlighting across
  rather than starting over, the address being what holds all three. Narrowing or
  highlighting rewrites the address rather than stacking an entry behind the Back
  arrow for every box ticked; Back is for the month.
- The panel holds two sections, because they are two different acts and neither
  is worth a panel of its own: `Highlights`, which decides how the orders on
  screen read, and `Filters`, which decides which orders are on screen.
  `Highlights` currently holds the level coloring switches alone. `Filters` heads
  its facets and carries the control that clears them.
- The orders take the whole width available rather than the centred container a
  narrower page reads better in, and the breadcrumb trail names the screen
  without the heading that would repeat it. Both are the route's own choice,
  declared in its `handle` as a `PageLayout` and read once by the dashboard
  layout, so a page states what it needs instead of the layout knowing pages.
- Each facet is a headed group of checkboxes with the count of orders answering
  each value. Ticking several values of one group widens that group and ticking
  across groups narrows, and a group's counts are of the orders the other groups
  already let through, so a count states what ticking it would leave. A value
  nothing is left of is shown at nought and cannot be ticked.
- Every value the month collected keeps its box for as long as that month is on
  screen. A group that shed options as you narrowed would move under the pointer
  that was narrowing it.
- Nothing is filtered out until the address asks for it: a month is collected to
  be looked at whole first.
- A facet the whole month answers the same way narrows nothing and is not
  offered. Orders that answered a facet with nothing are one option of it, so
  they stay reachable rather than being dropped by a facet they cannot answer.
- The current facets are the marketplace source, the reconciliation level, the
  tax type, payment method and payment currency. Adding a filter is adding a
  facet to the screen's list: it states how an order answers it and how that answer reads,
  and the options, their counts and the narrowing follow. `FilterFacets` is the
  shared panel body and knows nothing about orders.
- The source facet lists the marketplaces an order can be collected from,
  `BrickLink` and `BrickOwl`, coloured as the row's own source chip is so a box
  and the chips it stands for read as the same marketplace.
- A month whose filters let nothing through says so in its own words rather than
  reading as a month that collected nothing, and offers to clear them.
- The table scrolls with the page and never on its own, and its head sticks under
  the header card so it stays over the rows while a long month is read. That means
  nothing between the table and the page may clip: a scrolling ancestor would
  catch the head and hold it inside the card. It also means the columns fit the
  width they are given rather than being held open, so head cells wrap instead of
  forcing the table wider than the screen.
- Two things fight the sticky head, and both are handled on the table itself
  rather than in the theme every other table shares. The theme gives every head
  cell but the last `position: relative`, to hang the column divider off, which
  beats the `stickyHeader` prop's own `sticky`; the table asks for it again where
  it out-specifies the theme. And the head stops under the app header rather than
  at nought, with its own background and bottom border, which the head row would
  otherwise keep behind it.
- The row is tinted by the loudest level among the order's failures, or
  `success` green when it has none to show, in the palette's `lighter` shade so
  the cells stay readable over it. The row names that level in its accessible
  label, so color alone never carries it. Hover deepens that same color rather
  than stepping to the next one on the ramp, which would swamp the text, and
  rather than the table's default grey, which would lose the level exactly while
  the row is being pointed at.
- The source chip is colored per marketplace, not by failure level: BrickLink
  `primary` and BrickOwl `secondary`, as the accounting screen colors them.
- Selecting any order opens a read-only detail view listing every collected field
  and the order's failed rules, each named and colored by its level. Selecting a
  failed rule highlights the fields that rule used, in that failure's level
  color.
- A `silent` failure is not represented in the screen at all: it does not raise
  its order's row above green, is not counted, and is not listed in the detail
  view. It exists so a rule can report a reason without asking anyone to act on
  it.
- The reconciliation level is one of the filter facets: one option per level,
  loudest first, counting the orders that level is the loudest one of, with a
  `reconciled` option for the orders that have nothing to show.
- It is also the coloring control, which is a different thing in a different
  section: one chip per level among the orders on screen, under `Highlights`,
  filled where that level's rows are tinted and outlined where they are not.
  Errors, warnings and notices are tinted by default: a reader opens the screen
  to find the rows something was said about, and a notice is said about a row
  for the same reason a warning is. Only the reconciled rows are left untinted.
  The chips never hide a row — that is what `Filters` is for — so a count on a
  chip always matches what is under it.
- Dates are shown as `dd.mm.yyyy`, as the accounting and archive screens show
  them. The API carries them as ISO days.
- Reconciliation screen text is translated through `vast-portal`'s `en.json` and
  `lv.json`. Every new user-visible string must be added to both.
- The table shows only a subset of the collected fields. Fields that can fail
  reconciliation without being table columns are visible in the detail view.
- Only the failed state exists. Do not introduce a reconciliation status enum
  until additional states are specified. A level is not a status: it grades a
  single failure, not the order.
- Current rules:
  - An order paid through a payment provider must have been paid its grand
    total. The rule applies only to orders paid a way payments are collected
    for, currently Stripe, PayPal and bank transfer: an order paid another way
    has nothing to compare against yet, and reporting it as unpaid would say
    more about the migration than about the order. An order the rule applies to
    with no collected payment fails, because within a collected provider no
    matched payment means the money was not found rather than that the order was
    free. A bank transfer is compared against what every entry naming the order
    came to, so an order a buyer underpaid and then topped up agrees while one
    they never topped up does not.
  - An order with no target invoice is required no payment. Nothing being left
    to invoice for is exactly the case where no payment is owed: an order the
    marketplace says was refunded its whole grand total that no payment was
    matched to has nothing a payment could be shown for, and one with no grand
    total states no amount a payment could have been made of. So the rule
    requiring a collected payment does not apply to such an order at all rather
    than reporting money it never expected as missing.
  - An order the marketplace says was refunded its whole grand total that no
    payment was matched to is reported at `info`. Nothing is wrong with it: a
    gateway that only reserved the funds books no transaction at all when the
    reservation is cancelled rather than captured, so the order was refunded
    without money ever having moved and there is nothing for a payment to be
    found under. It is reported all the same, because no other rule covers such
    an order — the one requiring a payment does not apply to an order with
    nothing left to invoice for — and an order refunded without a payment
    would otherwise read exactly like a reconciled one. Only a refund of the
    whole grand total reads this way; a partial refund on an order with no
    payment is left to the rules holding the two sides of a payment against
    each other.
  - A BrickLink order the marketplace collected the tax on must have its VAT
    invoice in the store's own archive, and one with nothing archived is an
    `error`. That order type — `export-taxable` — is the one case where
    BrickLink charged tax under its own registration, and it issues a VAT
    invoice of its own for it. The store did not write that invoice and cannot
    write it again: it is the marketplace's document, served for as long as the
    marketplace cares to serve it, and the store's copy is the only one that
    will still be there when an inspection asks.
  - The rule applies to no other order. BrickOwl issues nothing answering to
    it, and a BrickLink order of any other tax type was either taxed under the
    store's own registration, where the store's own invoice is the record, or
    taxed by nobody. An archived invoice on such an order is not reported
    either: that the marketplace issued a document nobody expected is
    BrickLink's business, and the archive is a copy of what was shown rather
    than a claim that it was due.
  - Every order must have reached the store synchronization, and one BrickSync
    holds no record of is an `error`. BrickSync is what takes the stock an
    order sold off the store's other marketplace, so an order it never saw is
    an order that was never taken off the other one, which is how the same
    brick comes to be sold twice.
  - Orders go missing here in runs rather than singly. BrickSync synchronizes
    an order as it arrives, so the ordinary cause is that it was not running at
    the time, and a report showing this on more than one order is first a
    reason to go and check that BrickSync is up, before it is a reason to look
    at any one of the orders. Checking that is a person's job: nothing watches
    the process, and a rule claiming to would be reporting on a program it
    cannot see.
  - The rule applies to every collected order of either marketplace. BrickSync
    synchronizes both, and names its record after the marketplace and the order
    id exactly as the order archive names one, so there is no order it is
    silent about by design.
  - The facilitator-tax rule reports its failures at `info`. The paid-amount
    rule reports both of its failures at `error`: money that was not found, or
    that does not add up, is something to fix.

### Sourcing boundaries and current clients

- The sourcing and mapping boundaries are common to every reconciliation
  category, so adding another payment, accounting, shipping, order, or
  synchronization provider is a source plus a mapper and must not require
  redesigning the reconciliation feature.
- A low-level API client is not necessarily a reconciliation source by
  itself. A source implementation may combine multiple clients of one provider
  and expose what they returned through the common sourcing boundary.
- Conversely, one provider may need several sources. Split independent calls of
  a provider into a source each, so the sourcing stage's own fan-out runs them
  rather than one waiting inside the other; keep them in one source only when a
  call depends on an earlier call's result.
- The store's own order archive is a source too, in `reconciliation.archive`,
  and the only one that reads a directory rather than a provider. It answers
  which BrickLink orders it holds a VAT invoice for, through `OrderArchive`'s
  own public API rather than by knowing how the archive names its files. It is
  a source of its own rather than part of the order's account because it is
  nobody's claim about the order: every other source says what the order came
  to, this one says only what survives of it, which is why its field sits under
  an `archive` source of the roster's own.
- It is asked for the whole archive rather than for the period. The archive
  names a file after the moment the order last changed, not the date it was
  placed on, so narrowing the listing by the reconciled period would hide the
  invoice of every order that has been touched since. One directory listing
  answers for the whole month, and the detail mapper drops whatever the month
  did not collect. An order the listing does not name states nothing rather
  than stating that no invoice exists: whether one was due is the rule's
  judgement, not the archive's.
- The store synchronization is a source too, in `reconciliation.storesync`,
  and reads a directory for the same reason: BrickSync runs beside the store
  rather than answering questions over HTTP, so what it has done is on its
  disk. It answers through the `bricksync` feature's own public API,
  `BrickSyncOrders`, which lists the orders it holds a `.bsx` file for and
  nothing else — the file existing is the whole of what is read, because the
  question is whether BrickSync ever saw the order.
- It is asked for the whole directory rather than for the period, as the
  archive is: BrickSync names a file after the marketplace and the order id and
  nothing else, so there is no date in it to narrow by.
- `VAST_BRICKSYNC_ORDERS_DIR` is where that directory is, overridable per
  tenant. Unlike the archive it is not split by tenant, because BrickSync's
  file names carry no tenant: two tenants pointed at one directory read each
  other's orders, so a tenant running its own BrickSync must be given its own
  path. The managed `vast-api-test` is pointed away from the developer's own
  copy for the same reason, since `./vast prod async` fills the default with a
  real store's orders.
- Current order access includes:
  - a BrickLink order source and a BrickLink username source, both using the
    reverse-engineered API client from the BrickStore application, alongside the
    BrickLink API client. The export names the buyer by real name or by
    username but never both, and the two requests are independent, so they are
    two sources: an order mapper produces the marketplace order and a detail
    mapper merges the username onto it. The order source also fetches the detail
    page of each cancelled order for its refund, which stays in that source
    because those pages need the ids its export returned;
  - a BrickOwl source that fetches the order list and its detail batches, with a
    mapper that produces the marketplace order. Its batches stay in one source
    because they need the order ids the list returned.
- BrickLink's own published store API is migrated as
  `com.vastbricks.api.client.bricklink`, signed OAuth 1.0a. It is the other
  half of BrickLink from `BrickStoreClient`, which reaches the pages a
  signed-in store sees, and it is the only side that states an order as
  BrickLink's own record of it. Reconciliation does not collect from it; the
  order archive does.
- Stripe and PayPal are both migrated into `vast-services`, each as a client
  with a payment source and one detail mapper per marketplace, since the two
  marketplaces label a payment differently. Every provider's base URL and
  credentials are settings-backed, so the sandbox is another base URL rather
  than another flag, and a provider client is built per request so a request's
  own settings profile is honored.
- Stripe is migrated on its own SDK, whose client accepts a base URL. PayPal's
  SDK addresses its two hosts through a `SANDBOX`/`PRODUCTION` enum and accepts
  no other base URL, which leaves it untestable against a mocked provider, so
  the PayPal client is written on `RestClient` like the marketplace clients: a
  client-credentials token request and the transaction search.
- The legacy accounting screen keeps its own Stripe and PayPal code in
  `vb-portal-api` until that screen is retired.
- The bank is not a client at all: no provider exposes the account, so its
  entries are uploaded and stored, and reconciliation reads them through the
  `bankstatement` feature's public `BankTransfers` and `BankTransfer` boundary
  rather than through a source of its own transport. Reconciliation is that
  boundary's first caller, not its owner; importing, upserting, the summary the
  screen reads and the mapping a person writes stay inside the feature.
- The current shipping client implementation is Mans Pasts, which is two providers
  under one name. The shipping API is reached with a key and is still legacy;
  the shipment register a store sees under its own account is reached as a
  signed-in person, and that half is migrated into `vast-services` as
  `MansPastsClient`: a form login that answers with a session cookie, and the
  profile's own xlsx export asked for a page at a time. Reconciliation collects
  the register through it as one source among several; see "Shipment register
  requirements".
- The current accounting client implementation is Manakabata, migrated into
  `vast-services`: the `invoice` feature creates invoices for an order, and
  reconciliation's accounting source collects them back to show what each order
  was invoiced for. A provider has one root client per feature, and a client
  stays transport: what an invoice says is decided by the `invoice` feature, not
  by `ManakabataClient`.
- The current e-commerce store synchronization client implementation is
  BrickSync.
- These are the implementations currently known, not an exhaustive or closed
  provider list.
- Some of these clients already exist in legacy code. Migrate them into the
  rewrite incrementally as required by each supplied reconciliation processing
  step; do not migrate all clients preemptively.
- Where a provider publishes an OpenAPI specification, generate its client
  instead of handwriting one. `vast-services` owns the specification and the
  `openapi-generator-maven-plugin` execution, and generated clients belong under
  `com.vastbricks.api.client.<provider>`. The Manakabata accounting client is
  generated this way from `vast-services/src/main/openapi/manakabata-api.json`.
  Where a published specification is wrong, the payload is declared by hand next to the
  generated client rather than by patching the vendor's specification: Manakabata's
  invoice store request types its recipient, numerator and bank-account fields as arrays
  of strings although the API expects lookup objects.

