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
- An order whose reconciliation fails is marked by a dot in the actions column,
  colored by the loudest level among its failures, and the row is tinted that
  same color. An order with nothing to show gets a green dot, so every row states
  its verdict in the same place. The dot alone proved too quiet to find a failed
  order by while scanning a month, which is why the row carries the verdict too.
- Selecting an order shows all available details, including why its
  reconciliation failed.
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
  payment method, sub-total, items sub-total, grand total, accounting invoice
  sub-total, and paid amount, together with its rule failures. Add further
  fields and providers incrementally as their processing requirements are
  supplied.
- The grand total is the order total in the store's base currency with shipping
  and additional charges included: BrickLink's `BASEGRANDTOTAL` and BrickOwl's
  `base_order_total`. No rule compares it yet.
- The payment method is collected from BrickLink's `PAYMENTTYPE` and BrickOwl's
  `payment_method_type`. The marketplaces word one payment provider differently
  — BrickLink for a person (`Credit/Debit (Powered by Stripe)`, `PayPal
  (Onsite)`), BrickOwl as a code (`stripe`, `paypal`) — so the mapping unifies
  them to one name per provider: `PayPal` and `Stripe`. Matching is on the
  marketplace wording containing the provider's name, case-insensitively.
- A payment method no provider is known for is collected as the marketplace
  worded it, trimmed, rather than dropped or lumped into an "other" name: the
  screen must still show how the order was paid. A missing or blank method is
  collected as no method at all.
- Unifying happens in the mapping stage, once, for the same reason amounts are
  normalized there: every rule and the screen then see one name per provider and
  never match on a marketplace's wording. Adding a provider name is a change to
  `ReconciliationPaymentMethod`, which the category packages see alongside
  `ReconciliationAmount`.
- Payments are collected from Stripe and from PayPal alongside the marketplace
  orders: Stripe's balance transactions and PayPal's transaction search, each for
  the month. Both providers date their transactions in UTC, so the month is asked
  for as a UTC window from the first day at 00:00:00 to the last day at 23:59:59,
  both ends included. Stripe's cursor paging is followed 100 transactions at a
  time and PayPal's page numbering 500 at a time. The window belongs to the
  source, the only class given the month; the paging belongs to the client, being
  each provider's own protocol.
- Only a transaction that is a buyer paying for an order is mapped onto one:
  Stripe's `charge` and `payment` types, and PayPal's `T0006` event code. Both
  providers report the marketplaces' seller fees, currency conversions, refunds
  and, for PayPal, bank withdrawals in the same list; those are sourced and left
  unmapped, because a source decides nothing and what a transaction means is a
  mapping decision. Refunds are not netted against a payment until requirements
  for them are supplied.
- The paid amount is what the payment provider took for the order, gross of its
  own fees: Stripe's balance transaction `amount` in minor units divided by 100,
  and PayPal's `transaction_amount`, both normalized like every other collected
  amount. The provider's fee and net are not collected.
- What a payment names differs by provider and by marketplace, so each pairing
  is matched on what it actually carries. A Stripe payment carries a description:
  BrickOwl words it as `Brick Owl Order #1630980` and matches that order ID,
  BrickLink words it as `Payment for BrickLink from MrIntellectual` and matches
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
  an order wins, as the first invoice does.
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
- Accounting invoices are collected from Manakabata alongside the marketplace
  orders. The invoice list endpoint accepts no filter beyond the page size, so
  the whole list is requested as one page and searched; an invoice is matched to
  an order by the compact invoice-note key `<source>:<orderId>`, for example
  `bricklink:32466549`. Legacy notes such as `BrickLink order 32466549` remain
  readable. A list longer than one page fails the request rather than
  reconciling against truncated data. The note pattern and the marketplace label
  it yields decide which order an invoice attaches to, so they belong to the
  invoice mapper, not to the client or the source.
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
  `reconciliation.invoice`, `reconciliation.payment`, and later `shipping` and
  the store synchronization one. Category, not provider: a category is the
  vocabulary the requirements use, a provider's transport knowledge already
  lives in its `com.vastbricks.api.client.<provider>` package, and the
  categories stay a bounded set as providers are added. The accounting
  category's package is named `invoice` after what it collects; it is a
  subpackage of `reconciliation` and unrelated to the sibling
  `com.vastbricks.api.invoice` feature that creates invoices.
- Every rule lives in `reconciliation.rule`, together with the rule boundary,
  the failure, its level, and the order field enum. Rules are not grouped by category: a
  rule reasons across categories, as the invoice rule does when it compares an
  invoice amount with two order amounts, so any category would be arbitrary.
- The feature root keeps the stage boundaries, the reconciled order model, the
  orchestrator, and the HTTP edge. It declares a small API and nothing more: the
  category packages see `Source`, `Mapper`, `OrderMapper`, `DetailMapper`,
  `ReconciledOrder`, `ReconciledOrders.find`,
  `ReconciledOrders.findByBuyerUsername`, `ReconciledOrders.findByBuyer`,
  `ReconciledOrders.findByGrandTotalOn`, `Marketplace`,
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
  method, grand total, and paid amount, newest order first as the API returns
  them. The
  actions cell leads with a dot colored by the loudest level among the order's
  failures, or `success` green when it has none to show; the dot's level is named
  in its tooltip, so color alone never carries it. The row is tinted the same
  level color, in the palette's `lighter` shade so the cells stay readable over
  it. Hover deepens that same color rather than stepping to the next one on the
  ramp, which would swamp the text, and rather than the table's default grey,
  which would lose the level exactly while the row is being pointed at.
- The source chip is colored per marketplace, not by failure level: BrickLink
  `primary` and BrickOwl `secondary`, as the accounting screen colors them.
- Selecting any order opens a read-only detail view listing every collected field
  and the order's failed rules, each named and colored by its level. Selecting a
  failed rule highlights the fields that rule used, in that failure's level
  color.
- A `silent` failure is not represented in the screen at all: it does not raise
  its order's dot above green, is not counted, and is not listed in the detail
  view. It exists so a rule can report a reason without asking anyone to act on
  it.
- The order counts above the table are one chip per level, loudest first,
  counting the orders that level is the loudest one of, with a `reconciled` chip
  for the orders that have nothing to show. A level no order is at has nothing to
  count and no chip.
- Each of those chips is also the switch for its level's row tint: filled tints
  those rows, outlined leaves them plain. Errors and warnings are tinted by
  default, being the rows the screen is opened to find. The chips never hide a
  row — every collected order stays in the table whatever is toggled, so a count
  above the table always matches what is under it.
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
  - An order's sub-total must equal the sum of its item prices.
  - An order must have an accounting invoice whose sub-total equals both the
    order's sub-total and its items sub-total. Invoicing started on 2026-09-01,
    so the rule applies only to orders placed on or after that date; the cut-off
    is hardcoded. An order on or after it with no invoice fails.
  - An order paid through a payment provider must have been paid its grand
    total. The rule applies only to orders paid through a provider payments are
    collected from, currently Stripe and PayPal: an order paid another way has
    nothing to compare against yet, and reporting it as unpaid would say more
    about the migration than about the order. An order the rule applies to with
    no collected payment fails, because within a collected provider no matched
    payment means the money was not found rather than that the order was free.
  - The amount rules report every failure at `info`. The paid-amount rule
    reports both of its failures at `error`: money that was not found, or that
    does not add up, is something to fix.

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
    mapper merges the username onto it;
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
- The current shipping client implementation is Mans Pasts.
- The current accounting client implementation is Manakabata, migrated into
  `vast-services`: an invoice source fetches the invoice list and a detail
  mapper merges each invoice onto its order, and the `invoice` feature creates
  invoices for an order. A provider has one root client per feature, and a
  client stays transport: what an invoice says is decided by the `invoice`
  feature, not by `ManakabataClient`.
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
  search per page, Stripe one request per page of its cursor paging.
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
