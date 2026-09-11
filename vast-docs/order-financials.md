# Order financials feature requirements

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

