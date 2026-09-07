# Vast Bricks project guidelines

This file is living project documentation. Feel free to update it when project
requirements, architectural decisions, or development workflows change.

## Repository direction

`vb-portal-api` is the legacy backend. It grew together with the original
requirements and must remain operational while the backend is rewritten in
small, independently deliverable steps.

The rewritten backend has two distinct modules:

- `vast-api` is only the independently launchable Spring Boot host. It contains
  runtime composition but no controllers or business features.
- `vast-services` contains all rewritten controllers and business logic. It is
  a conventional reusable Java library and must not contain a Spring Boot
  application launcher.

Both launchers depend on `vast-services`: `vast-api` for standalone local use
and `vb-portal-api` so one legacy application launch can serve old and new
functionality without introducing another production deployment unit.

`vast-services` is a temporary migration bridge, not the target architecture.
It exists only so rewritten features can run under both launchers while the
legacy backend remains in service. After all legacy functionality has moved and
`vb-portal-api` is retired, move the controllers and business logic from
`vast-services` into `vast-api`, then remove the `vast-services` module.

The names describe architectural roles, not migration status. Do not use
temporary names such as `next`, `new`, or `rewrite` for the new modules.

Any newly introduced project, module, package, or top-level tool that belongs
to the rewrite must use the `vast-*` prefix. Treat `vast-*` as the durable
rewrite namespace and do not introduce unprefixed project names for new rewrite
work.

`vast-portal` is already part of the rewrite. The current rewrite effort applies
to Java backend code only; do not create another frontend application.

## Migration principles

- Work incrementally. Do not attempt to migrate all legacy functionality in a
  single change.
- Build all rewritten controllers and business logic in `vast-services`; do
  not add rewritten implementations to either launcher.
- Place rewritten code under the durable `com.vastbricks.api` package root so
  packages remain unchanged when `vast-services` is folded into `vast-api`.
  Do not encode the temporary module name in Java packages.
- Preserve existing behavior in `vb-portal-api` unless a task explicitly
  authorizes changing or removing it.
- Do not move legacy code merely to make the new module look complete. Migrate
  one explicit vertical feature at a time in later tasks.
- The first iteration is scaffolding only. It establishes module boundaries,
  application composition, configuration, and basic runtime verification. It
  does not migrate a business feature.
- Requirements generation will be the first business area implemented after
  scaffolding. Authentication and other capabilities will move later as
  separate features.
- While both launchers coexist, keep `vast-services` independently composable.
  Its features must work under both `vast-api` and `vb-portal-api`.
- Avoid dependencies from new code to legacy Java classes, legacy entities, or
  legacy repositories. If a reusable contract is genuinely needed, create an
  explicit new boundary rather than coupling new code to an arbitrary legacy
  implementation.
- New HTTP endpoints should use a coherent, explicitly owned API namespace and
  must not shadow legacy mappings accidentally.
- Rewritten endpoints that must be private before authentication moves into the
  rewrite must use the legacy private API path prefix `/api/private/**` so they
  are protected by `vb-portal-api` when embedded in the legacy production
  application.
- Rewritten API controllers must explicitly declare JSON response production,
  preferably on their class-level `@RequestMapping` with
  `produces = MediaType.APPLICATION_JSON_VALUE`. Do not rely on default content
  negotiation: `vb-portal-api` also has an XML converter, so browser requests
  can otherwise receive XML while the same endpoint returns JSON through
  `vast-api`.
- Do not disable or override XML content negotiation globally because legacy
  endpoints still legitimately produce XML.

## Rewrite coding guidelines

- Structure rewritten backend code by vertical feature packages, not by broad
  technical layers. Prefer packages such as `requirements`, `inventory`, or
  `pricing` that contain that feature's controllers, services, models,
  repositories, and configuration together.
- Do not create shared top-level layer packages such as `controller`, `service`,
  `repository`, `dto`, or `model` for rewrite code. Use technical subpackages
  only inside a feature package when the feature is large enough to need them.
- Cross-feature sharing is allowed when the shared capability is intentional and
  stable. For example, a Tor HTTP client can be implemented once as an explicit
  feature or infrastructure boundary and reused by other features. Do not share
  by reaching into another feature's internal implementation details.
- Shared feature boundaries must expose a small, intentional public API. For
  the Tor feature, other features request configured Spring `RestClient`
  instances from the public factory/options API and then use them as normal
  clients. Circuit switching, control-port handling, and IP polling services
  are internal implementation details and must not be exposed to other
  features.
- Do not use Java records in rewrite code. Prefer regular classes.
- Keep all of a feature's HTTP request and response DTOs in one Java file, a
  `<Feature>Payload` class named after the feature package: `InvoicePayload`,
  `OrderFinancialsPayload`, `ReconciliationPayload`. Declare every request and
  response inside it as a `public static final` class, together with the nested
  objects those payloads are built from, for example
  `OrderFinancialsPayload.ReportedOrderFinancials`. Do not give a request or
  response its own file, and do not nest them in a controller.
- The payload class is a container only: give it a private constructor and no
  behavior. Declare it package-private, and public only when code outside the
  feature package uses it, as with a public controller's payloads.
- This covers the types that shape this API's own request and response bodies.
  A model, enum, or value type used by the feature's services, sources, or
  rules beyond a single payload keeps its own file, and so do the payloads of
  outbound clients to external APIs under `com.vastbricks.api.client`; do not
  move either into the payload class to satisfy the rule.
- Use Lombok in rewrite Java code for repetitive boilerplate such as getters,
  setters, constructors, builders, `equals`, and `hashCode` when it keeps the
  code clearer.
- For Spring controllers, services, repositories, and configuration classes,
  prefer final dependencies with Lombok `@RequiredArgsConstructor` over
  handwritten dependency-injection constructors. Write an explicit constructor
  only when it contains real custom initialization logic.
- Prefer environment-variable based configuration with explicit default values
  over Spring properties classes for rewrite settings. In Spring-managed code,
  group related values in a small feature settings class and inject values with
  field-level `@Value("${ENV_VAR:default}")`, similar to `TorSettings` and
  `FlywaySettings`; do not read environment variables with `System.getenv()`
  unless Spring injection is not available.

## Reconciliation feature requirements

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
- The screen takes one month as its input and reconciles orders for that month.
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
- The first iteration is read-only.
- Only the failed state is currently required. Do not introduce additional
  reconciliation states until their requirements are provided.

### Data collection and reconciliation

- The screen is backed entirely by live data sources. Reconciliation records,
  provider responses, and reconciliation results are not stored in the Vast
  database.
- The reconciliation order list currently collects received BrickLink orders
  from the BrickStore XML export and BrickOwl orders from the BrickOwl API for
  the selected month. Each collected order carries its marketplace source
  (`BrickLink` or `BrickOwl`), order ID, order date, buyer, buyer username,
  payment method, tax type, facilitator tax, sub-total, grand total, refunded
  amount, gateway paid amount, gateway facilitator tax, gateway refunded amount,
  and target invoice, together with its rule failures and the links to the order
  and its payment, each exposed beside the field it rides on. Add further fields
  and providers incrementally as their processing requirements are supplied.
- Every field belongs to one of four sources, and reconciliation is the business
  of holding those accounts of one order against each other: `order` is what the
  marketplace reported about the order itself, `gateway` what the payment
  provider reports about the payment matched to it, `accounting` what the
  accounting system holds for it, and `calculated` what is derived from the rest
  rather than stated by anyone. Nothing is collected from the accounting system
  yet.
- The source is structural, not a naming convention. An order carries one group
  per source — `order`, `gateway`, `calculated` — and a field is addressed
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
- A source nothing is collected from yet carries no group. The accounting source
  is declared and has none.
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
  total has no target at all. A refund reaching past what was the store's to
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
  amount. The provider's fee and net are not collected. A refund does not reduce
  it: the payment did take what it took, and what came back afterwards is the
  refunded amount rather than a shortfall in what was paid.
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
  not collected: no collected order carries one, and the amount is compared with
  the payment's as a number, as the payment matching's own amount key already
  is. BrickOwl states a refund total on the order that it can be collected from
  when requirements for it are supplied. Wherever it is uncollected the rule
  comparing the two sides of a refund fails wherever the payment shows one,
  which is the intended reading rather than a gap left open: the failure is the
  standing report of which orders had money come back that no marketplace
  mapping accounts for.
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
  currency it was taken in. The collected order carries no currency, so the two
  are compared as numbers. That is correct while both are the same currency and
  is worth revisiting when a payment in another currency has to reconcile.
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
- Every bank credit naming one order is summed into its paid amount, which is
  where bank transfers depart from the first-payment-wins rule the providers
  follow: a buyer who underpaid and was asked for the rest made two transfers for
  one order, and both are money the store received, whereas a card payment is one
  authorization of one amount. A debit naming the order is money that went back
  out and is summed into the gateway refunded amount the same way. No entry
  either way leaves the field absent rather than zero, the bank having said
  nothing about it. The gateway facilitator tax stays absent because a bank
  deducts none.
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
  `reconciliation.payment`, and later `shipping` and the store synchronization
  one. Category, not provider: a category is the
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
  amount, target invoice, gateway paid amount, and gateway facilitator tax,
  newest order first as the API returns them. The gateway's paid amount and
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
  tax type and the payment method. Adding a filter is adding a facet to the
  screen's list: it states how an order answers it and how that answer reads,
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
  Errors and warnings are tinted by default, being the rows the screen is opened
  to find. The chips never hide a row — that is what `Filters` is for — so a
  count on a chip always matches what is under it.
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
  - The facilitator-tax rule reports its failures at `info`. The paid-amount
    rule reports both of its failures at `error`: money that was not found, or
    that does not add up, is something to fix.

### Data-source boundaries and current clients

- The sourcing and mapping boundaries are common to every reconciliation
  category, so adding another payment, accounting, shipping, order, or
  synchronization provider is a source plus a mapper and must not require
  redesigning the reconciliation feature.
- A low-level API client is not necessarily a reconciliation data source by
  itself. A source implementation may combine multiple clients of one provider
  and expose what they returned through the common sourcing boundary.
- Conversely, one provider may need several sources. Split independent calls of
  a provider into a source each, so the sourcing stage's own fan-out runs them
  rather than one waiting inside the other; keep them in one source only when a
  call depends on an earlier call's result.
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
- The current shipping client implementation is Mans Pasts.
- The current accounting client implementation is Manakabata, migrated into
  `vast-services`: the `invoice` feature creates invoices for an order.
  Reconciliation does not collect them — nothing compares an order against what
  it was invoiced for. A provider has one root client per feature, and a client
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

## Debug dock requirements

The debug dock is the portal's network tab for the backend: what the Vast backend sent to
a provider and what came back. It is a feature of its own, not part of reconciliation, and
covers every provider call the backend makes rather than one screen's.

- Nothing is captured until a user presses Record. An ordinary request costs a
  thread-local check and stores nothing.
- Recording is armed per user and expires on its own, so a session left armed stops
  writing provider payloads by itself. It is held in memory, so a restart stops every
  recording, which is the safe direction to fail in.
- Closing the dock stops recording too: nothing is written while nobody is watching.
  Whether it was running is remembered, so reopening resumes it rather than asking for the
  same click again, and stopping it by hand before closing means it stays stopped.
- Recorded rows belong to the user whose request caused the call, and a read or a clear
  only ever touches that user's own rows. A call made with no user on the thread belongs
  to nobody and is dropped rather than stored unattributed.
- Rows hold whatever the provider sent, so they can contain buyer names, addresses and
  emails. The panel's Clear button deletes the caller's rows and is the retention control;
  a scheduled retention window is the obvious follow-up if the table grows.
- Bodies are stored up to a cap and the row is marked truncated beyond it, so one
  pathological response cannot bloat a row or the panel.
- The client layer records; the debug feature decides what is kept. A client wraps the
  operation it wants recorded in `HttpExchangeCapture.record`, naming itself as the
  provider, and knows nothing about who wants the traffic. `HttpExchangeSink` is the
  boundary: the client package never depends on the debug feature.
- A client method keeps its own signature. Nothing returns raw traffic to a caller, so a
  feature that calls a provider does not change shape to be observable.
- How a client records follows how it reaches its provider. The ones on `RestClient`
  install `HttpExchangeCapture.interceptor()`, the generated Manakabata invoker included,
  since it takes a `RestClient` of its own. Stripe is reached through its own SDK and has
  no interceptor to hang the capture on, so its SDK transport is decorated instead and
  reports each round trip through `HttpExchangeCapture.add`. That is the seam for any
  future SDK-based provider.
- A client masks the secrets it sent. Masking happens once a recorded operation finishes
  rather than as each request is recorded, so a credential the client only learns along
  the way is masked in the response that issued it as well as in the requests that go on
  to use it: `BrickStoreClient` registers its session token and `PayPalClient` its access
  token through `HttpExchangeCapture.mask` for exactly that reason.
- One recorded operation is one client method, however many requests it takes. A BrickLink
  export records its session creation and its export, PayPal its token request and one
  search per page of each segment its window is searched in, Stripe one request per page
  of its cursor paging.
- Whose request a call belongs to travels on `DebugContext`, bound by an interceptor that
  runs after authentication has resolved the user. `ParallelTasks` propagates it alongside
  the settings profile, because a batch fetched on a virtual thread would otherwise record
  under no user.
- The dock is app-wide, docks left, right or bottom, and displaces the page rather than
  covering it: the main content is sized by flex, the fixed header takes the dock's width
  out of its own, and a bottom dock takes its height out of the page's minimum. It opens
  from a button where the template's Buy Now button used to sit, and never restores open,
  because it is a tool you reach for rather than one that greets you.
- The dock grows by adding a panel to `debugPanels`; the shell, its state and its toolbar
  do not change. Network is its first panel, not its only one. Chrome that belongs to the
  dock — the tabs, the dock side, close — lives in the shell; controls that belong to one
  panel, as Record and Clear belong to Network, live in that panel.
- The Network panel reads two ways. By time is the default and lists every call, each row
  naming its provider, which is the only way to see one provider's call land between
  another's. By provider gathers them under the provider that answered, one row per
  provider with its call count, total size and a failure count when a call was not 2xx,
  drilling into that provider's calls. Either way the newest call is at the top: the call
  you just made is the one you opened the panel for. Both reach the same detail: one
  call's request and response bodies, laid out and syntax coloured.
- A body carries no find of its own. The whole body is in the page, so the browser's own
  search reaches it, which is what people use anyway, and an in-panel find had to fight
  the highlighter for its own tokens to mark a match.
- Reload re-reads everything stored for this user, for rows recorded while the panel was
  not open, and the toolbar states how many are stored and what they weigh, so Clear says
  what it would delete.

## Bank statement feature requirements

The bank is the one party to an order the backend cannot read live: no provider exposes
the account, so a statement is uploaded instead. This is therefore the first stored
business data in the rewrite, and everything about the feature follows from that.

- Uploads are ISO 20022 **camt.052** account reports and **camt.053** statements. The two
  differ only in their wrapper — `BkToCstmrAcctRpt/Rpt` against `BkToCstmrStmt/Stmt` — and
  are the same shape from the account down, so one reader covers both. The flat CSV export
  the same banks offer is not accepted: it states a counterparty as one pipe-joined string
  and gives balance lines no reference at all, so there is nothing in it to upsert on.
- Only booked entries are stored. A report's balances and transaction summary belong to the
  moment it was pulled rather than to the entries, so re-importing a wider range would
  rewrite them for no gain.
- An entry is identified by its tenant, its account IBAN and the bank's own reference:
  `AcctSvcrRef`, falling back to `NtryRef`. A bank that states neither leaves nothing stable
  to key on, so the entry's own stated content is hashed instead, and repeats within one
  document are numbered by the order it listed them.
- **Importing is upserting.** The same document may be uploaded as often as it is exported,
  and an overlapping range refreshes the entries it restates rather than duplicating them.
  Nothing is ever deleted by an import: a range narrowing between exports is not the bank
  withdrawing what it already booked.
- `mapping` is the one column a person writes and the one an import never touches. It is
  the manual last resort for tying an entry to an order when every automatic match has
  failed, so an import that overwrote it would destroy the only thing on the row a human
  put there. Nothing else on an entry is editable.
- The document is posted as the request body under `application/xml`, not as a multipart
  part. A multipart upload would need Spring's default one-megabyte part cap raised in both
  launchers' configuration, and a busy month passes it; a raw body has no such cap. The
  parser has DTDs and external entities off, this being the only place the rewrite reads a
  file a person chose.
- `bank_statement_entries` is tenant-owned in the full sense: a `@TenantId` field, a
  `tenant_id` foreign key cascading from `tenants`, and a unique constraint carrying the
  tenant, since two banks' customers legitimately share an entry reference.
- The screen reads one **period** at a time, and the period is a month or a whole year: a
  month while mappings are being written against entries, a year while a year is being
  looked over. Both are asked for in one request parameter, `YYYY-MM` or `YYYY`, so which
  of the two is being read is readable from the period itself and nothing carries a second
  answer to the same question. A year lists its twelve months' entries flat, in the same
  table, rather than collapsing them into a row each.
- The neighbouring periods are arrows either side of the period, as they are on the
  reconciliation screen, because a statement is read a period at a time and the period
  before is the one asked for next more often than any other — too often to be worth
  opening anything for. The step forward stops at the period being lived through, nothing
  having happened yet in one that has not started.
- Which of the two kinds of period is being read is asked **beside the period, in the title
  bar**, not inside the picker: it is a question about how the table is read, not about
  which period is being read, so it does not belong inside the thing that picks one. It is
  a toggle of two buttons with the view already on screen disabled rather than merely
  unselected, there being nothing to ask for by pressing it, which is the pattern
  `vb-portal-full-version` uses wherever it offers a period of its own. Switching reads the
  same span in the other view rather than starting the reader somewhere they did not ask
  for: a month widens to its year, and a year narrows to its last month that has actually
  happened.
- The reconciliation screen's month and the bank statement and Stripe transaction screens'
  period are the title of their table, and wear one shared look for it, so a title bar
  never shows two differently sized titles of the same kind of thing.
- The period's entries are narrowed by a panel down the left of the table: the same panel
  the reconciliation screen puts beside its orders, persistent where there is room for it
  and a temporary overlay where there is not, opened by a button in the title bar beside
  the period. The shell, the facet list and the narrowing itself are shared rather than
  copied for this one, with the reconciliation screen and with the Stripe transaction
  screen, which reads a ledger the same way; see "Stripe transactions feature
  requirements". The panel holds `Filters` and nothing else, there being nothing on this
  screen that decides how the entries read, and the title bar states how many of the
  period's entries the narrowing left on screen.
- Searching is the other way the entries are narrowed, and it is not in the panel. A switch
  in the title bar beside the panel's own opens a second row in the table's head, holding
  one search field per column that can be searched, each under the column it searches: the
  text a reader is matching against is in that column, so that is where the field for it
  belongs. The row is asked for rather than always there, most reading of a statement being
  reading it, and it rests under the heading row so both stay over the entries while a long
  period scrolls. The heading row's height is measured rather than assumed, a heading
  wrapping onto a second line on a narrow screen.
- The search row carries the card's own ground rather than the head's tint. The tint is what
  says a row is headings, so fields to type in sitting on it read as headings that happen to
  be editable; and the two grounds are what tell a reader where the head's naming stops and
  its asking starts, which saves the row a rule of its own.
- There is one field style on this screen, wherever it is typed in: the mapping written
  against an entry and the search asked of a column are the same field, declared once. A
  reader meets both in the same table and a second look would read as a second kind of
  control. It is a line under the text and no box around it: a box in every searchable
  column reads heavier than the headings it is asking about. The line answers a hand in
  three steps, each one louder than the last. At rest it is drawn under the divider's own
  weight but plainly there, saying a field is here to a reader pointing at nothing; a hand
  anywhere on the row brings it up to the divider's weight; and pointing at the field itself
  sweeps a line in over it, in the accent colour, the way the focused field's own line
  arrives — one pixel to the focused line's two, so a hovered field stays quieter than the
  one being typed in. At full weight under every row of a period the resting line would be
  another rung of the ladder this table was rid of, and it is faded by the line's own opacity
  rather than by a paler colour so one number covers both themes, the divider being a
  transparent colour already.
- The sweep is what marks a hovered field, so the resting line can afford to be read: the
  two states are no longer told apart by how invisible one of them is. It is therefore the
  colour that has to arrive and not the weight. A sweep in the divider's own colour was an
  animation nobody could see, landing on a resting line of the same weight and colour, and a
  hovered field that answered by thickening its line instead read heavier than the rule under
  the table's head — a hand resting on a field is not a change in the table.
- The placeholder still names what goes in the field rather than repeating the heading over
  it. The line is held off the text and the mark above it by padding under the field as a
  whole rather than under the text: the mark is the input's sibling, so room made on the text
  alone would leave the mark on the line.
- A mark before the text is the one thing the two are allowed to differ in: a search field
  carries a magnifier, the mapping carries nothing, an icon standing in every row of a
  period being noise rather than a cue. It is set quieter than the text it stands before,
  and the field's label says the same thing in words, so nothing rests on the mark alone.
- The columns are laid out to stated shares of the table rather than to what is in the
  cells. A column measured from its own content moves whenever the content does — the
  search row opening under the headings, a period stepped to whose amounts are a digit
  longer, a month widened to its year — and a reader who has just found the entry they were
  looking for should not have the table shift under them to say so. They are shares rather
  than pixels so the columns grow with the width the table is given, and text that cannot
  be broken at a space is broken anyway rather than allowed to spill into the column
  beside it.
- Putting the row away empties it. A row put away with words still in it would go on
  narrowing the table from somewhere the reader cannot see, which is the one thing a screen
  that states how much of a period it is showing must not do.
- A column searches what it shows, so the counterparty field searches the account beside
  the name: both are in that cell, and a reader pasting an IBAN is searching what is in
  front of them. The fields are currently the counterparty, the details and the reference.
  The mapping has none: it is a text input in every row, and an input cannot carry the mark
  that says which part of it was found.
- Within one field the text is split on whitespace and every word has to be found, anywhere
  within a word and with case ignored, so half a name or a fragment of an order number is
  worth typing and a counterparty the bank spelled surname first is still found by typing
  the name out. Across fields they narrow: a name under the counterparty and a number under
  the details asks for the entries answering both. No closer approximation is attempted: a
  search that guessed at spelling would hide the entry a mapping is being written for.
- What was found is marked in the cell, in the palette's warm shade and as a `mark`
  element, so it says the same thing to a reader who cannot see the colour. Marking it is
  what makes a search worth running against a column of long remittance lines: the reader
  is looking for an order number inside a sentence a payer wrote, and a row that merely
  matched somewhere leaves them to find it again by eye. The mark keeps the cell's own text
  colour, the amount column being coloured by direction. Every word the field asked for is
  marked wherever it appears in that column.
- A year of entries is filtered again at every keystroke, so the fields answer the key at
  once and the table catches up a render later. Typing never waits on the period being
  read, however long it is. The marks are drawn from the same narrowing the entries were
  filtered by, so a cell never marks a word that is not why its row is there.
- Narrowing is otherwise a facet, as it is on the reconciliation screen: a facet states how
  an entry answers it and how that answer reads, and the options, their counts and the
  narrowing follow. A group's counts are of the entries the rest of the narrowing already
  lets through — the search as much as the other groups — so a count states what ticking it
  would leave, and every value the period holds keeps its box for as long as that period is
  on screen. A facet the whole period answers the same way narrows nothing and is not
  offered. Adding a filter is adding a facet to the screen's list.
- The current facet is the direction, credit first: which way the account moved is the
  coarsest question there is about a statement, and money in is what a mapping is normally
  written against. A booked entry answers every facet there is so far — it moved one way,
  in one currency — so no option stands for having answered nothing; a facet over a field
  an entry may leave empty is when to bring that option over from the reconciliation
  screen, which has one.
- Narrowing decides which entries are on screen and never what the period came to. The
  foot stays the bank's account of the period: both turnovers are stated whichever way the
  entries were narrowed, and the closing balance is derived over every stored entry up to
  the end of the period, so it could not follow a filter at all.
- Which entries are shown is this screen's own state rather than something the address
  carries, as the period is. The reconciliation screen keeps its narrowing in the address
  because a month of orders is worth handing to someone as a link; a statement is read a
  period at a time in front of the entries a mapping is being written against.
- A period whose narrowing lets nothing through says so in the table rather than in place
  of it: the search row is in that table's own head, and a message drawn instead of the
  table would take away the fields the reader has to reach to get their entries back. A
  period nothing was imported for has no table at all and says that instead.
- The panel's clear button empties the search row and the facets together, being the one
  control over the whole narrowing; Escape empties one field from inside it.
- The foot of the table states what the period came to, laid out the way a bank lays out
  the foot of a statement: the figure in the amount column, what it is beside it. Three
  lines — debit turnover, credit turnover, closing balance — per currency the period moved
  in, and a whole group per currency rather than one set of totals, an account moving in
  two currencies having two accounts of itself. The balance is ruled off from the turnovers
  it sums, the way it would be on paper.
- The summary keeps the table's own background rather than the tinted one a footer wears by
  default, and drops the small upper case a footer is otherwise set in: these are three
  sentences about money, not column headings. That tint is close enough to the page behind
  the card that the figures sat in a band reading as neither table nor page; the rule above
  the footer already says where the entries stop.
- **The head and the summary both stay in view while the entries scroll.** The head names
  the columns and the foot totals them, and a period long enough to scroll is exactly the
  period where both are wanted while the middle is being read — a total cannot be arrived
  at by looking. The page is the one thing that scrolls, as it is on the reconciliation
  screen: the head stops under the app header and the foot at the bottom of the window.
  Giving the entries a window of their own would have given both something nearer to hold
  on to, but it puts a second scrollbar beside the page's, and a reader scrolling a table
  should not have to notice which of two bars they are pushing. So nothing between the
  table and the page may clip, the card included.
- **A line is spent only where the table changes.** A statement is dozens of rows long, and a rule under every entry,
  a divider between every heading, a line under each summary line and an underline under every mapping field all read
  at one weight — a grid, in which the two rules that actually say something are lost. So the entries are separated by
  a banded ground rather than by a line each, the head hangs no column dividers, the summary carries no line under
  each of its three, and the mapping field draws its underline only when its row is pointed at or the field is being
  written in. What is left is the heavy rule under the head, the heavy rule above the summary, and the light one the
  closing balance is ruled off by. The band is the theme's own hover colour, so the row under the pointer answers in
  another one rather than in the one half the rows already wear.
- The foot is grounded and rounded **on its cells, never on the foot itself**. The theme grounds and edges a footer as
  a whole, and both are squares the full width of the table: they fill in and rule across the corners the last line
  rounds to meet the card, which the card cannot round for itself because it may not clip. So the foot is stripped of
  the theme's ground and edges, its cells carry the ground, and the first line draws the rule above it.
- The head is stuck cell by cell, the way MUI's own `stickyHeader` does it. **The foot is
  stuck as one element**, and this is not a matter of taste. The theme gives a table cell
  `position: relative` to hang a column divider off, under a selector that beats a plain
  `sx`, and exempts the last cell of a row — so a foot stuck cell by cell comes apart down
  the middle, the name of a line resting while the figure beside it scrolls on. Out-
  specifying the theme is possible, and the head does exactly that, but a foot has a second
  reason not to: a cell resting against the bottom is placed by its own bottom edge where
  the head is placed by its top, and cells of one line share a top edge but not necessarily
  a bottom one. A screen adding a stuck row to a table should know which of the two it is
  adding.
- The turnovers are the period's own entries. The **closing balance is derived**, not the
  bank's own figure: it is every stored entry up to the end of the period, credits less
  debits, so it is the bank's closing balance only for an account imported from its opening
  balance onward and states the movement it holds otherwise. Balances are still not read
  from a camt document, for the reason above, so there is nothing to reconcile it against;
  if that is ever wanted, the `Bal` elements are what to import.
- The feature exposes two public types and nothing else: `BankTransfer`, one booked entry
  as another feature reads it, and `BankTransfers`, which answers the entries of a span of
  days. That is the whole of what leaves the package — importing, upserting, the summary
  and the mapping a person writes are internals, and what another feature needs is what the
  bank booked. Reconciliation matches bank-transfer orders through it; see "Reconciliation
  feature requirements".
- The balance is summed in the database rather than by loading the rows it covers, that
  range growing with every import while what is wanted out of it stays two numbers per
  currency. It is the feature's one JPQL query, so it is also the one place where
  `@TenantId` reaching an aggregate rather than an entity load is worth an acceptance test
  of its own.

## Stripe transactions feature requirements

The Stripe transaction screen is the account's own ledger, read a period at a time:
what Stripe took, what came back out of it, what Stripe kept and what it paid out to
the bank. It is the bank statement screen's counterpart on the other side of the
account, and it is read the same way for that reason — the two are held against each
other, so they may not read differently.

- The screen is backed entirely by live Stripe data. Stripe holds the account and
  answers for it, so a period is fetched when the screen asks for it and stored
  nowhere. The bank statement feature stores its entries only because no provider
  exposes the account, which is not the case here.
- Every balance transaction of the period is listed, not only the ones that paid for
  an order: the charges, the refunds, the fees Stripe took, the payouts to the bank
  and the currency conversions between them. That is what makes the screen readable
  against a bank statement in the first place. Deciding which transaction pays for
  which order is reconciliation's business and stays there.
- A transaction carries the day and time Stripe dated it, Stripe's own type, the
  description Stripe held, the amount, its direction, the fee Stripe deducted, the net
  it left, the currency, the status, the charge or payout behind it, and the link to
  the payment where there is one.
- The amount is reported unsigned with a direction beside it, the way a bank states an
  entry, so a column of figures lines up and one field carries one fact. The net keeps
  the sign Stripe gave it, being what the transaction left behind rather than a
  movement of its own.
- Nothing deducted is reported as no fee rather than as a zero: Stripe takes its fee
  out of the transaction it belongs to rather than out of all of them, and a fee column
  reading `0.00` down every payout and refund says nothing a reader needs. The net still
  states the whole of what was left.
- Amounts are Stripe's minor units two decimal places to the left, at two decimals,
  `HALF_UP`, as every collected amount in the rewrite is.
- The period is a month or a whole year, asked for in one `period` parameter as
  `YYYY-MM` or `YYYY`, exactly as the bank statement screen asks for one. Stripe dates
  a balance transaction in UTC, so the period becomes a UTC window from the first day
  at 00:00:00 to the last day at 23:59:59, both ends included. It is not padded: the
  reconciliation payment window pads because a payment is not dated where its order is,
  and this screen reads the ledger itself, where a transaction belongs to the period
  Stripe dated it in.
- A year is a live fetch of a year, which is as many pages as Stripe has transactions
  for it. The cost of live aggregation is accepted here as it is for reconciliation;
  the client's own page cap is what a busier account would meet first.
- Transactions read oldest first, as a statement's entries do: the order the account
  moved in is the order the movement makes sense in. A transaction Stripe dated nothing
  sorts last, and transactions sharing an instant keep the order Stripe listed them in.
- The foot of the table states what the period came to, one group per currency the
  account moved in: debit turnover, credit turnover, the fees Stripe took, and what the
  balance moved by, ruled off from the three above it. The turnovers come in the order the
  bank statement screen states them, the two feet being read against each other. The fee line is the one thing a
  Stripe ledger has that a bank statement does not — a bank charges its fees as entries
  of their own — and it has to be stated separately for the sum to add up in front of
  the reader.
- The last line is what the balance moved by and not a closing balance. Stripe knows
  the account's balance and this screen does not ask for it: a balance is a fact about
  now, and the period being read is normally not now.
- The link opens the payment in Stripe's dashboard and rides the reference naming it,
  as the reconciliation screen's links ride the field naming what they open. Only a
  transaction that settled a payment has one: Stripe addresses a payment by the payment
  intent behind its charge, falling back to the charge for a payment taken without one,
  and a payout or a fee is left as the plain reference it was rather than given a
  guessed link. The account is `VAST_STRIPE_ACCOUNT_ID`, the same setting the
  reconciliation payment links read, and unset it leaves every row without a link
  rather than with one that lands wherever the reader is signed in.
- Narrowing is the bank statement screen's, shared rather than copied: a panel down the
  left holding `Filters` and nothing else, and a search row in the table's own head
  asked for by a switch in the title bar, one field per searchable column. The current
  facets are the direction, Stripe's own transaction type and the status; the searchable
  columns are the description and the reference, which searches Stripe's id together
  with the charge or payout behind it.
- Stripe's type and status are shown as Stripe words them. The set grows with the
  products the account uses, so a screen that translated them would go quiet on the next
  one Stripe adds; the direction is the screen's own word and is translated.
- Nothing is editable. There is no mapping column: a mapping is a stored field, and
  nothing here is stored.
- The screen text is translated through `vast-portal`'s `en.json` and `lv.json`, as
  every screen's is. Every new user-visible string must be added to both.
- What the two ledger screens share lives outside either of them, so a third screen
  that reads a period is these parts again rather than a copy: the narrowing and its
  facet counting, the period picker and its month/year toggle, the ledger table's own
  look, the sticky summary foot, the field a table is typed in, and the mark a search
  puts on what it found. A screen states its facets, its columns and its summary lines;
  none of the mechanics is written twice.
- The backend feature is `com.vastbricks.api.stripeledger`, named for the ledger it reads
  rather than for the screen, which stays the Stripe transaction screen and asks for
  `/api/private/stripe-transactions`. `vb-portal-api` holds the legacy accounting screen's
  own `StripeTransactionService` and one launcher scans both, so a `StripeTransaction` of
  ours collides with it on the bean name, and would go on colliding as either side grew a
  class the other already had. Note that only the legacy launcher fails on such a
  collision: `vast-api` does not scan legacy classes, so the acceptance tests cannot catch
  one. Check a new rewrite bean's simple name against `vb-portal-api` before adding it.
- Stripe's transport is one client for both features that read the ledger:
  reconciliation's payment source and this screen. One endpoint is one client — a second
  would be the same paging written twice — and what a transaction means is decided by
  each caller.
- Acceptance tests are tech tests: they drive `/api/private/stripe-transactions` end to
  end against a mocked Stripe. Stripe's own protocol — the settings that reach the mock,
  and the pages its cursor paging walks — is one shared test-support fixture with the
  reconciliation fixtures, so a scenario states the ledger facts it is about and nothing
  of the protocol.

## Order tax type feature requirements

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

## Order financials feature requirements

Order financials answers one question for one order: what the marketplace says
the order is worth financially, and what follows from those amounts. The
requirements here are the source of truth for the feature; add rules as they are
supplied and do not invent unspecified amounts.

- The feature is a component with no public endpoint of its own yet. It takes an
  order ID and an order source and returns that order's financials. Logic tests
  reach it through the test-only
  `GET /api/test/order-financials?orderId=<id>&source=<source>` controller in
  `vast-acceptance-tests`; add a `/api/private/**` endpoint only when a caller
  needs one.
- The response separates `reported` amounts, which are exactly what the source
  sent, from `calculated` amounts, which this feature derives. The two objects
  are never merged, so a caller always knows where an amount came from.
- A reported amount is `null` when the source sent none. A calculated amount is
  `null` when the reported amounts it needs are missing; a calculated amount
  never substitutes for a reported one.
- Calculated amounts are rounded once, to five decimals, `HALF_UP`. A derived
  amount is an intermediate financial value that later amounts are built on, so
  it keeps more precision than the cent a charged amount is expressed in.
- Each marketplace is one `OrderFinancialsSource` implementation selected by the
  requested source. Adding a marketplace means adding an implementation, not
  changing the endpoint or the response contract.
- Sources are added one at a time. BrickOwl is implemented; add the others with
  their own supplied requirements.
- Current amounts:
  - BrickOwl reports `base_order_total` and `tax_rate`.
  - `baseOrderTotalWithoutTax` is the reported base order total with the
    reported tax removed, `total / (1 + rate / 100)`, to five decimals. The
    reported base order total includes tax.
- Acceptance tests state one financial fact per scenario and are logic tests. The
  `order-financials` test-support fixture mocks the marketplace from the source
  fields a scenario names and returns the feature's response, so a scenario is a
  provider line and an assertion on a reported or calculated amount. Do not test
  technical error messages or lookup failures here.

## Spring Boot composition

- `vast-api` defines only the new Spring Boot launcher.
- `vast-services` owns controllers, services, and shared feature configuration.
- `vast-api` and `vb-portal-api` must each depend on and explicitly import
  `vast-services`.
- `vast-services` must remain a conventional dependency JAR. Do not rely on
  executable Spring Boot JAR internals as a Maven dependency.
- The root Maven POM is an aggregator, not a parent for the application
  modules. Keep module POMs self-contained, as `vb-portal-api` is.
- Keep host-specific configuration out of domain and application logic.
- The standalone service and embedded legacy host must expose the same behavior
  for rewritten endpoints.
- Use separate ports for local standalone and legacy launches. Do not require
  both applications to run for normal development of new features.
- `vast-acceptance-tests` is a third launchable module used only for testing. It
  depends on `vast-api`, adds no launcher class, no `application.yml`, and no
  Spring configuration of its own, and inherits the whole runtime composition
  from `vast-api`. Its Maven POM declares
  `mainClass` `com.vastbricks.api.VastApiApplication` and nothing else runnable.
  Do not add runtime configuration to it; configuration belongs in `vast-api`.
- Because another module depends on `vast-api`, its executable JAR carries the
  `exec` classifier. `vast-api-1.0.jar` is a plain library JAR;
  `vast-api-1.0-exec.jar` is the one to launch.
- `vb-portal-api` must never depend on `vast-acceptance-tests`, and
  `vast-acceptance-tests` must never be deployed.

## Multitenancy

A tenant is a store the portal reconciles for. Vast holds almost no domain data
of its own — reconciliation is sourced live and stored nowhere — so what a
tenant owns is not rows so much as **which external accounts a request reaches**:
its marketplace, gateway and accounting credentials. Tenancy is therefore first
a scoping rule for settings, and only incidentally one for tables.

### How isolation is enforced

- Isolation is Hibernate's, not the database's. A tenant-owned entity carries a
  `@TenantId` field and nothing else: Hibernate stamps the serving tenant on
  insert and appends it to the SQL of every query it generates for that entity.
  No repository method names the tenant, so none can forget to.
- `VastTenantIdentifierResolver` is what Hibernate asks, and it answers from
  `TenantContext` — a thread-local bound for the length of one request.
- This is deliberately not PostgreSQL row-level security. RLS protects access
  paths the ORM does not generate, and Vast has none: feature code uses Spring
  Data JPA only, with Flyway the stated exception, and there is not one `@Query`
  or native query in `vast-services`. Both mechanisms read the same `tenant_id`
  column, so adding RLS later is a migration plus the database-role work and
  touches no Java. Do not add RLS as a side errand; it needs a runtime role that
  is not the table owner, which is an infrastructure change of its own.
- A thread with no tenant resolves to `TenantContext.NO_TENANT`, which matches
  no row. Work that never said who it was for reads nothing rather than
  everything.
- `ParallelTasks` carries the tenant across the reconciliation fan-out beside
  the debug user. A provider call on a thread that lost the tenant would reach
  no credentials at all, which fails loudly rather than reaching another store.

### What is tenant-owned and what is not

- `settings_override` is tenant-owned and is the first such table. Its rows are
  one tenant's provider credentials and setting values.
- `tenants` and `user_tenants` are identity, not tenant-owned, and carry no
  `@TenantId`. They are read to decide which tenant a request serves, which is
  necessarily before a tenant is known; filtering them by the tenant would need
  the answer they exist to give. Scope a query over them by joining the
  membership explicitly.
- `users` is likewise global. A login may serve several tenants, so a user is
  not owned by one, and the email lookup at login runs before any tenant exists.
- `debug_http_exchanges` stays scoped to the user who armed recording rather
  than to a tenant. Recording is a per-user act, and the rows are already
  invisible to anyone else.
- When a feature adds a table whose rows belong to one store: give it a
  `@TenantId` field, a `tenant_id` foreign key to `tenants (id) ON DELETE
  CASCADE`, and unique constraints that include `tenant_id`. The annotation is
  the whole of making it tenant-aware; the cascade is what keeps teardown one
  delete however many such tables exist; and the unique constraint is the one
  failure `@TenantId` does not catch for you, since two tenants writing the same
  business key would otherwise collide.

### Who a request is, and which tenant it serves

- `AuthenticationInterceptor` resolves and binds; it does not reject.
  `PrivateApiInterceptor` rejects an unresolved request on `/api/private/**`.
  They are separate because a request can be legitimately anonymous and still
  need a tenant: the test endpoints send a token without being private, and the
  legacy launcher sends none at all.
- The token carries the selected tenant as its `tid` claim, but membership is
  checked against `user_tenants` on every request rather than trusted from the
  token, so a membership taken away stops working at once instead of when the
  token expires.
- Login selects a tenant: the one named by `tenantCode`, or the caller's first.
  A login with no tenant to serve is `403`, which is a different answer from a
  wrong password and must not be reported as one.
- There is no default tenant and nothing falls back to one. A request that
  cannot say which tenant it is for gets none: it reads nothing and writes
  nowhere. Nothing legitimately anonymous needs one — `POST /api/account/login`
  reads only the global identity tables, and `GET /api/health` reads nothing.
- One caller knows which store it serves without a login behind it: the legacy
  BrickLink extension endpoint, which posts a session token under a shared API
  key. It names its tenant outright through `VAST_LEGACY_TENANT_CODE` and fails
  when that tenant does not exist, rather than falling back to one. It is the
  only such caller and it goes when `vb-portal-api` does.
- The `default` tenant is seeded in `db/vast/migration/data`, which is excluded
  from production builds, because a tenant is a real store: production creates
  the ones it actually has, deliberately. The seed exists so the local
  administrator has something to serve, since a login with no membership is
  refused.
- There is no settings-profile header. A profile named one set of provider
  credentials and was chosen by an unauthenticated request header, which is the
  tenant question answered by whoever asked; the tenant replaced it. Each
  acceptance test gets a tenant of its own, which is what now keeps parallel
  tests from reading each other's settings.

### Guarding it

- A scenario registers its own tenant and a user who may serve it through
  `POST /api/test/tenants`, which returns the tenant, the user and a token for
  the pairing. Setting one up is setup, not subject matter, so a test does not
  reach into the database to do it. Teardown deletes the tenant, and the cascade
  takes everything that tenant wrote with it.
- The tenant is what isolates a scenario, so tests run in parallel without
  coordinating: each sees only its own rows, including counts.
- The isolation guardrails are acceptance tests, not Java ones. They cover
  reading and updating another tenant's row **by primary key**, not only derived
  queries — that is where the older Hibernate `@Filter` mechanism leaks, and it
  is the common path for a writable table. They also assert that a write is
  stamped with the writing tenant without being told.
- A new tenant-owned table should arrive with a scenario of the same shape.
  Assume nothing about `@TenantId` that a test has not shown.

## Database boundary

- New backend code uses a new PostgreSQL schema with a new database design.
- Use Spring Data JPA for Vast feature persistence. Do not introduce direct
  JDBC repositories in rewritten feature code; Flyway migration/bootstrap
  infrastructure is the exception.
- New code may access only tables owned by the new schema.
- Do not map, query, update, or add foreign-key dependencies to legacy tables
  from new code.
- If legacy data is required, migrate or copy it deliberately into the new
  schema as part of the relevant future feature. Do not create a permanent
  runtime dependency on the legacy data model.
- New migrations must have clear ownership and must not be mixed into the
  legacy migration history accidentally.
- Vast migration scripts must be self-contained: they may create and evolve
  only Vast-owned objects and must never query, copy from, or otherwise depend
  on legacy or other existing schemas.
- Migration execution must be safe in both runtime modes: standalone through
  `vast-api` and embedded through `vb-portal-api`.
- Database credentials and connection settings may point both runtimes at the
  same PostgreSQL server/database, but new objects remain isolated in the new
  schema.

## Real data

Real provider data is how a requirement gets stated: a BrickLink export, a
Stripe balance transaction, a camt statement, a PayPal search response pasted
into the conversation is the clearest possible account of what a field actually
looks like. Read it, and never commit it.

- Real data posted in a conversation is a specification, not a fixture. Nothing
  taken from it reaches a test, a fixture, a code comment, this file, or any
  other committed file in the shape it arrived in.
- Obfuscate every value that names a person, an account, or a real transaction
  before writing it anywhere: buyer names and usernames, payer and recipient
  names, emails, addresses, phone numbers, IBANs, bank entry references,
  tracking numbers, marketplace order IDs, invoice numbers, provider
  transaction and charge IDs, and any credential or token.
- Obfuscation preserves the shape and keeps the fact under test. An IBAN stays
  an IBAN, a BrickLink order ID stays eight digits, a camt reference keeps its
  bank's own format. What changes is that the value names nobody: fictional
  names, and identifiers plainly outside a real range.
- Amounts, dates, currencies, country and tax fields carry the behavior a rule
  is about and may be kept as posted, so long as nothing beside them identifies
  whose order it was. Change an amount only when the scenario does not turn on
  it.
- Keep obfuscated names recognisably fictional and reuse the same cast across
  scenarios rather than inventing a plausible new person each time. A test
  buyer that reads like a real one invites the next reader to paste a real one
  beside it.
- This applies to code comments and to these requirements as much as to tests.
  A comment quoting a provider's wording quotes it with an obfuscated value.
- If a posted example is worth keeping for its format, keep one obfuscated
  example of it, not the dump it came from.

## Testing strategy

- When code changes affect behavior covered by acceptance tests, verification
  must rebuild the affected runtime and run the Playwright API acceptance tests.
  Use the repository CLI for this workflow, normally `./vast test --build` or
  `./vast t -b`, unless the task explicitly narrows verification or the
  acceptance-test infrastructure is unavailable.
- Do not add new Java tests to either the legacy or rewritten applications.
- Do not delete or weaken existing legacy Java tests unless a task explicitly
  requests it.
- New behavior will be verified with black-box Playwright API acceptance tests
  against a running application. Browser UI acceptance tests are out of scope.
- Acceptance tests must exercise public HTTP behavior rather than call Java
  implementation classes.
- Acceptance tests are organized into two types, each its own Playwright project
  and directory under `vast-acceptance-tests/tests`:
  - **tech tests** (`tests/tech`) drive the real API endpoints and their
    providers end to end. They own transport concerns: status codes, error
    responses, authentication, and content negotiation.
  - **logic tests** (`tests/logic`) address one component through the test-only
    `/api/test/**` endpoints and assert its business behavior in isolation.
  Shared fixtures stay in `tests/support` and serve both types.
- Put a scenario in the type that matches how it reaches the code, not the
  feature it covers. One feature normally has tests of both types.
- Components that no public endpoint exposes are tested through minimal
  test-only controllers in `vast-acceptance-tests`, mapped under `/api/test/**`.
  A test controller lives in the same package as the code it exercises so that
  code can stay package-private, and must be named so it cannot collide with a
  `vast-services` class in that package. Give it a distinct name such as
  `VastOrderFinancialsTestController`; duplicate fully qualified names across
  the two JARs are silently shadowed rather than reported.
- A test-only controller is a thin adapter: it accepts input, calls the
  component, and returns its result. Do not put business logic in it.
- `/api/test/**` is anonymous, outside the `/api/private/**` authentication
  interceptor, so scenarios need no login for it.
- Do not write acceptance tests for the transport behavior of `/api/test/**`
  endpoints: no status-code, error-message, or content-negotiation scenarios.
  Assert business behavior only. Introducing a test endpoint does not replace
  the normal fixtures; logic tests still drive providers through WireMock and
  use the existing database and settings-profile support where the component
  needs them.
- Never add `spring-boot-devtools` to `vast-acceptance-tests`. Its restart
  classloader splits the runtime package and breaks the package-private access
  the test controllers depend on.
- Tests must be deterministic, independently runnable, safe to run in parallel,
  and must not depend on state created by another test.
- Prefer API-based test setup. Add direct database setup only where the public
  API cannot reasonably establish required state.
- The same acceptance scenario should be capable of running against the
  standalone rewritten service and, where useful, the legacy host containing
  the rewritten module.
- The acceptance-test project and full service orchestration will be introduced
  in a later, explicit iteration. Initial scaffolding needs only proportionate
  runtime verification.

## Developer CLI

- The repository-level developer command is `./vast`.
- Developers who want to call it from any working directory should add a shell
  alias using the absolute repository path, matching the `./saku` setup style:
  `alias vast="/Users/mplots/git/vast-bricks/vast"`. Also source completions
  with `source <(vast completion)`. Put both lines in the active shell config,
  such as `~/.zshrc`, then restart the shell or source the updated config.
- Follow the general model of Insaku's `./saku`: provide one stable interface
  for agents and developers to build, start, stop, restart, inspect, and test
  managed local services.
- Once implemented, use `./vast` instead of ad hoc application start commands
  or direct Playwright invocations for managed acceptance workflows.
- Use `./vast test` or the shortcut `./vast t` to run Playwright API
  acceptance tests from `vast-acceptance-tests`. Both test types run by
  default; pass `--tech` or `--logic` to run only one. Pass `-b` or `--build`
  when the managed `vast-api-test` should be rebuilt and restarted before
  running tests. Pass `-cb` or `--clean-build` to rebuild it and run the tests
  with the Vast database schema cleaned and migrated from scratch.
- The CLI should eventually manage PostgreSQL readiness, migrations, service
  readiness, focused Playwright API runs, restarts after code changes, logs, and
  cleanup.
- Add CLI capabilities incrementally with the workflow that needs them; do not
  build the entire final CLI during module scaffolding.
- The managed service named `vast-api-test` builds and runs the
  `vast-acceptance-tests` JAR on port 6362, so the test-only endpoints are
  available locally. Acceptance tests always run against it.
- The managed service named `vast-api` builds and runs the `vb-portal-api`
  JAR on port 6363, so one launch serves the legacy and rewritten halves of the
  backend exactly as the deployed artifact does. `./vast` sets `SERVER_PORT`
  because the legacy application fixes port 6161 for IntelliJ launches.
- `vast-api` reads its configuration from an external environment file of
  `KEY=value` lines, legacy settings and rewrite settings alike, by default `~/.vast/vast-api.env` and otherwise the path
  `VAST_API_ENV_FILE` names. The file holds production credentials, so it lives
  outside the repository, `./vast` refuses a path inside the working tree or a
  file readable beyond its owner, and its values are passed only to the
  `vast-api` process.
- No other managed service may ever read that file. `vast-api-test` runs
  acceptance tests against mocked providers and must never be given production
  credentials, by an environment file, a shell that sourced one, or any other
  route. Only `./vast`'s own settings for the managed port win over the file.
- Because it runs against real credentials, `vast-api` is never launched
  implicitly: `./vast services start` without service names leaves it alone.
  `./vast services restart` without names does rebuild and restart it when it is
  already running, so it never serves a JAR older than the rest, and leaves it
  down when it is not. Listing and stopping always include it.
- `./vast services` (alias `./vast svc`) manages `postgres`, `tor-proxy`,
  `vast-api-test`, `vast-api`, `wiremock`, and `vast-portal`. Managed
  application instances use ports 6362, 6363, 9011, and 3100 respectively,
  leaving the normal IntelliJ ports 6161, 6262, and 3200 available for
  independently launched instances.
- The managed `vast-portal` proxies `/api/**` to the managed `vast-api` service
  on port 6363, so the portal runs against the same backend a deployment
  serves. Start `vast-api` alongside it; the acceptance runtime is for tests,
  not for the portal.
- The managed `vast-portal` on port 3100 therefore sits in front of production
  data. Never sign in to it, drive it with browser automation, or click anything
  in it: its screens act on real marketplace orders and can generate real
  invoices, and its credentials are the deployment's own. Agents must not enter
  credentials there under any circumstances, and a running portal on 3100 is not
  a place to verify a change.
- To check a portal change visually, ask the developer for a screenshot of their
  own session, or reproduce the layout in a throwaway page under the scratchpad
  and check the behaviour there. Neither route touches production.
- `./vast ps` is the shortcut for `./vast services list`.
- Runtime process state and logs belong under the ignored `.vast` directory.
  Service stop operations must affect only processes recorded and verified as
  owned by `./vast`; never terminate an arbitrary process solely because it
  occupies a configured port.

## Planned delivery phases

1. **Scaffold modules**
   - Add `vast-api` and `vast-services` to the Maven reactor.
   - Create the standalone `vast-api` Spring Boot launcher and minimal
     configuration.
   - Establish `vast-services` as the reusable controllers-and-business-logic
     dependency.
   - Include `vast-services` in `vb-portal-api` without migrating business
     behavior.
   - Prove that the standalone host and legacy host can both start with the new
     module composition.
2. **Establish database ownership**
   - Create the new schema and its independently owned migration configuration.
   - Verify migration behavior in standalone and embedded runtime modes.
3. **Establish acceptance infrastructure**
   - Add the `./vast` workflows needed to manage dependencies and services.
   - Add Playwright API acceptance-test structure and a minimal health scenario.
4. **Implement requirements generation**
   - Design the new requirements data model and API without reusing legacy
     persistence code.
   - Migrate required legacy data explicitly where necessary.
   - Deliver behavior in small vertical slices covered by API acceptance tests.
5. **Migrate later features**
   - Move authentication and other legacy capabilities one feature at a time.
   - Retire legacy behavior only after its replacement is complete and verified.
6. **Complete the rewrite**
   - Retire `vb-portal-api` after all required functionality has moved.
   - Move all code from `vast-services` into `vast-api`.
   - Remove `vast-services`, leaving `vast-api` as the complete backend
     application.

Do not silently pull work from a later phase into the current phase. If a task
requires crossing a phase boundary, state why before expanding the change.

## Scope and deployment

- Backend deployment procedures are owned separately and are not part of this
  rewrite unless a task explicitly includes them.
- Maintain the ability to deploy one legacy application artifact containing old
  and rewritten functionality.
- Local development should normally require only PostgreSQL and `vast-api` for
  work on rewritten features.

## Version control workflow

- Do not create a branch for new feature work. Work on the currently checked-out
  branch unless the user explicitly asks for a branch.
- Do not switch branches, and do not commit or push unless the user asks.

## Existing module conventions

- More specific `AGENTS.md` files override these repository-wide guidelines for
  files in their directory tree.
- Preserve the conventions in `vb-portal-api/AGENTS.md` when modifying that
  module.
- Do not edit generated files or files under build output and dependency
  directories such as `target`, `dist`, or `node_modules`.
- Always respect user changes in the worktree. Do not revert, restore,
  normalize, or "fix" existing user edits unless the user explicitly asks for
  that exact change. If a user edit appears to break verification or conflicts
  with the requested task, stop and explain the conflict instead of changing it
  silently.
- Never overwrite unrelated work in a dirty worktree.
