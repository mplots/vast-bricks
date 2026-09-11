# PayPal transactions feature requirements

The PayPal transaction screen is the account's own ledger, read a period at a time, and it
is the Stripe transaction screen's twin: the two are read against each other and against
the bank statement, so they may not read differently. What follows is only where PayPal
differs from Stripe; everywhere else the Stripe requirements above govern.

- The screen is backed entirely by live PayPal data. PayPal holds the account and answers
  for it, so a period is fetched when the screen asks for it and stored nowhere.
- Every transaction of the period is listed, not only the ones that paid for an order: the
  payments, the refunds, the seller fees PayPal charged and the withdrawals to the bank.
  Deciding which transaction pays for which order is reconciliation's business and stays
  there.
- Transactions read oldest first, as a statement's entries do. A transaction PayPal dated
  nothing sorts last, and transactions sharing an instant keep the order PayPal listed them
  in.
- A transaction carries the instant PayPal dated it, PayPal's own event code, the subject
  PayPal held, what the marketplace labelled the payment with, the counterparty and the
  account they paid from, the amount, its direction, the fee, the net, the currency, the
  status, the transaction it was raised against, PayPal's own breakdown of the gross, the
  records raised against it, and the link to PayPal's own page for it.
- **PayPal reports one payment as several records, and the screen reads them as one
  transaction.** A payment, the commission the marketplace took as partner and the
  conversions into the balance's currency are separate balance-affecting records, and
  PayPal's own interface shows them under one transaction. So does this: the record raised
  against nothing is the transaction, and what was raised against it is **never a row of
  the period and never a figure in the summary** — it is either taken off the transaction
  or carried as one of its lines.
- What ties them is `paypal_reference_id`: a commission or a conversion names the
  transaction it was raised against. **Two things have to be true before a record reads
  under another, and both matter.**
- It has to name a **collected** record. PayPal writes a payment's own base id into the
  same field — the checkout it came from, which is no record of the ledger — and a
  commission raised against last month's payment names nothing this period holds, so it is
  a transaction of its own rather than pulling in a month it cannot see. The chain is
  followed to its head, so a conversion raised against a commission reads under the payment
  they both belong to, and a reference that comes back round to where it started is not a
  grouping at all.
- And it has to be **something a transaction's own account can state**: a deduction, or a
  leg of a conversion. Plenty of records name a transaction without being part of it — a
  refund names the payment it reverses, and it is money going back out on a day of its own,
  weeks later, which no account of the payment has a line for. Grouping on the reference
  alone folded such a record away into a transaction whose figures said nothing about it,
  and its money left the ledger: a year's net movement came out over PayPal's own balance
  by exactly the refund. So the rule is not "what points at this" but "what this
  transaction is made of", and a record the transaction is not made of stays a transaction
  of the period however plainly it names another one.
- The guard against that returning is the `accountedFor` each line carries: a line the
  amount details do not state is reported rather than quietly folded away. It is what
  caught the refund, and it is worth keeping for the pathological cases grouping still
  allows — a deduction in a currency neither the transaction's nor its target's, or a
  transaction PayPal converted into two currencies at once.
- **A period's net movement is checkable against the account's own balance.** For a year
  in which every operation happened, the two must agree; a discrepancy means money has been
  grouped away without being accounted for, which is exactly the bug above. It is the
  cheapest test there is of whether this feature is right, and worth running against the
  live account whenever the grouping or the summary changes.
- **The fee column is everything that came off the transaction, whoever took it**: PayPal's
  own processing fee and the partner commission both. One figure is what a reader of a
  ledger wants — what the transaction cost — and the detail view is where it comes apart
  into PayPal's own lines again. So the partner commission has no column: it is a detail,
  and a column of its own would put a line of one transaction's account beside the
  transactions.
- **A conversion is not a deduction; it restates the transaction.** A payment taken in a
  currency the balance is not held in does not stay in it: PayPal takes the whole of it
  back out and puts the result into the balance's own currency. The account moved by the
  second of those, so that is the currency the table states the transaction in — a row in
  the currency the money passed through for a moment matches nothing in the bank, and its
  own currency's figures cancel to nothing anyway.
- A converted transaction's net is what PayPal put into the new currency, which is PayPal's
  own figure. Its gross is the transaction's own gross at **the rate the two legs imply** —
  what came back out of the old currency against what went into the new — because a gross
  in one currency beside a net in another is a row that does not add up. Everything between
  them is the fee, which is what the fee column already means: everything that came off,
  whichever side of the conversion it was taken on. Only the gross is carried across, and
  it is carried across by PayPal's own rate.
- Where PayPal reported a leg into a new currency but none out of the old, there is no rate
  to read: the transaction is stated at what landed, with no fee, rather than at a rate
  nobody stated. A transaction converted into two currencies has no one currency to be
  stated in and is left as PayPal reported it, its legs read in its detail.
- The summary follows, so a converted transaction is counted only in the currency the
  account actually moved in and no currency the money merely passed through appears in the
  foot.
- **PayPal answers for the balance at a stated moment**, unlike Stripe, so a period's
  closing balance is PayPal's own figure rather than one worked back to — one request, and
  right for any period. A moment ahead of now is refused the way a searched range reaching
  into the future is, so it is asked for no further than the same margin short of now: a
  period still running closes at what the account holds today. Everything the account holds
  is taken, what is withheld against a dispute included, since what it stood at is
  everything in it. A period PayPal did not answer for states no balance rather than a
  guess, logged where it fails, and the foot omits the line. The conversion legs are counted in neither turnover: the transaction's own gross is
  already what the account moved by there, and counting the legs too would state that money
  twice.
- **The turnovers are every movement of the account, the deductions included.** A fee is
  not a transaction of this ledger — it is folded into the one it came out of — but it is
  money that left the account, and a bank charging the same fee books it as an entry of its
  own. A ledger meant to be read against a statement cannot leave it out. So credits less
  debits is the net movement on its own, and a fee total is a memo of how much of the
  turnovers were fees rather than a term beside them.
- **One fee memo, not one per party.** What PayPal charged for taking the money and what a
  marketplace took out of it as partner are both money off the same transaction, and which
  party took which part of it is a detail of that transaction, stated where the rest of its
  account is. A foot is read for what a period came to, not for how its costs were shared
  out, so the memo is one figure — and the Stripe foot beside it says the same thing the
  same way.
- Opening a transaction shows what PayPal reported it as, laid out the way PayPal's own
  transaction page lays it out: the transaction's own fields, then the amount details —
  purchase total, sales tax, shipping, handling, insurance, discounts, gross, PayPal
  transaction fee, partner commission, net — then the records PayPal raised against it. It
  is read-only, as the ledger is.
- **That panel stays in PayPal's own currency**, which for a converted transaction is not
  the one the table states. It is PayPal's account of what it did, so it reads as PayPal
  wrote it.
- **The conversion is part of that account, not a footnote to it.** A panel ending on a net
  in a currency the account never held is an account that stops before the money did, so
  two lines follow it: what the conversion took back out of PayPal's own currency, and what
  the transaction came to in the currency it was converted into — the figure the table
  states. That last line is what the panel sums to.
- Nearly every record PayPal raises against a transaction is either a deduction the panel
  names or a leg of the conversion it ends on, so the panel already states it and listing
  it again beside the account it is in would say the same thing twice. Each record carries
  whether the panel accounts for it, and only the ones it does not are listed — a record
  PayPal raised under a code the account has no line for is still reported rather than
  silently dropped.
- The detail names the transaction's type with **PayPal's own code after the word**, which
  the table leaves out. It is what PayPal names a transaction by, so a reader holding the
  two side by side has the thing to match on, and two codes this catalog happens to word
  alike are still told apart.
- The purchase total is the only derived figure in that panel: PayPal states what it added
  to the purchase rather than the purchase itself, so what is left of the gross once those
  come off is what was bought. A transaction PayPal broke down in no way gets no purchase
  total rather than one equal to its gross, which would claim a breakdown that was never
  stated. An amount line PayPal stated nothing for is left out rather than shown at nought;
  the gross and the net always show, being what the lines run from and to.
- The amount is reported unsigned with a direction beside it, as on the Stripe screen and
  for the same reason.
- **The fee keeps the sign PayPal gave it**, which is the second place the payload departs
  from the Stripe ledger's. Stripe states a fee as the magnitude it deducted; PayPal states
  a fee as an amount of its own, normally a debit and therefore negative, and a refunded
  payment returns part of it. A column always read as a deduction could not say that, so
  the sign travels and the screen writes it out. The period's fee line and the net that
  sums it are signed for the same reason: the three lines above the sum add up to it in
  front of the reader.
- Nothing deducted is reported as no fee rather than as a zero, exactly as on the Stripe
  screen. The net still states the whole of what was left.
- Amounts are stated to two decimals, `HALF_UP`, as every collected amount in the rewrite
  is. PayPal states them as decimal strings rather than in minor units.
- The counterparty is who the money moved to or from, as PayPal spells them. PayPal spells
  a payer several ways and carries whichever it has, so they are tried in the order they
  name a person best: the payer's full name, the parts it was given in, then the shipping
  recipient. A transaction with no counterparty at all — a withdrawal to the bank, a fee
  PayPal charged — is left without one rather than given the account's own name. It is a
  column of its own, which the Stripe screen has no use for and a bank statement has:
  PayPal names a person on nearly every transaction.
- **PayPal states codes where Stripe states words**, so this screen words them and the
  Stripe screen does not. `T0006` and `S` say nothing to a reader, and showing them raw
  would be showing nothing. The portal words the event codes and statuses a merchant
  account meets, through `paypal-transaction-event-<code>` and
  `paypal-transaction-status-<code>`, and **falls back to the code itself** wherever the
  catalog has no message — which is what keeps the screen from going quiet on the next code
  PayPal adds, the reason the Stripe screen translates nothing. `wordedOr` is that
  fallback, and it is where any provider that states codes rather than words is worded. A
  code showing raw on screen is the signal to add its wording, not a fault, and the detail
  view shows every code beside its word so one can be looked up.
- The link opens the transaction in PayPal, and every transaction has one: PayPal
  addresses a transaction by its id alone, so unlike the Stripe screen there is no account
  to configure and no row left without a link for want of a setting. It is the same address
  the reconciliation screen sends a reader to.
- The period is a month or a whole year, asked for in one `period` parameter, and becomes
  the UTC window both ends included. It is not padded: reconciliation pads because a
  payment is not dated where its order is, and this screen reads the ledger itself.
- PayPal searches no more than 31 days in one request, so a year is covered a segment at a
  time by the client, exactly as reconciliation's padded month is. That is the client's own
  protocol and the screen states one window for it.
- Narrowing is the bank statement screen's, shared rather than copied. The current facets
  are the direction, PayPal's event code and the status; the searchable columns are the
  counterparty, which searches the account beside the name, the description, which searches
  the marketplace's label beside PayPal's subject, and the reference, which searches
  PayPal's id together with the transaction it was raised against.
- Nothing is editable and there is no mapping column: a mapping is a stored field, and
  nothing here is stored.
- The screen text is translated through `vast-portal`'s `en.json` and `lv.json`. Every new
  user-visible string must be added to both.
- The backend feature is `com.vastbricks.api.paypalledger`, named for the ledger it reads
  rather than for the screen, which stays the PayPal transaction screen and asks for
  `/api/private/paypal-transactions`. `vb-portal-api` already holds the legacy accounting
  screen's own `PayPalTransaction` and `PayPalTransactionService`, which is exactly the
  collision the `stripeledger` naming was chosen to avoid.
- PayPal's transport is one client for both features that read it: reconciliation's payment
  source and this screen. One endpoint is one client, and what a transaction means is
  decided by each caller.
- Acceptance tests are tech tests: they drive `/api/private/paypal-transactions` end to end
  against a mocked PayPal. PayPal's own protocol — the settings that reach the mock, the
  client-credentials token it exchanges first, and the pages its page numbering walks — is
  one shared test-support fixture with the reconciliation fixtures, so a scenario states the
  ledger facts it is about and nothing of the protocol.

