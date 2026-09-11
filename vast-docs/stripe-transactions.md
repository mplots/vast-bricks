# Stripe transactions feature requirements

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
  account moved in: debit turnover, a memo under it saying how much of it was fees, credit
  turnover, what the balance moved by, ruled off from the two turnovers, and where the
  account stood when the period ended.
- **The Stripe and PayPal feet state the same things in the same order**, and mean the same
  by them. The two are read against each other and against the bank statement, so a
  difference between them has to be a difference in the accounts and not in how the screens
  were written.
- **The turnovers are every movement of the account, the fees included.** A fee is not a
  transaction of this ledger — Stripe takes it out of the one it belongs to — but it is
  money that left the account, and a bank charging the same fee books it as an entry of its
  own. So credits less debits is the net movement on its own, and the fee total is a memo of
  how much of the debits were fees rather than a term beside them, standing under the
  turnover it is part of and set quieter than the figures that do add up.
- **A fee is signed as a deduction**, the way PayPal states one. Stripe states it the other
  way up — a positive number meaning money taken — so it is negated once, in the mapping,
  and every rule and screen past that point sees one convention. That is not only tidiness:
  a fee is counted in the turnovers now, and a fee whose sign was thrown away would be
  counted in the wrong direction. Stripe does state a negative fee, when it gives back part
  of an application fee on a refund.
- **Stripe answers for the balance at this moment and for no other**, so the closing one is
  worked back from the one it does state: what the account holds now — held and pending
  together, since what the account stood at is everything in it — less everything it has
  moved since the period ended. A period still running has moved nothing since, so its
  closing balance is simply what Stripe holds today, which is the only true answer there is
  for it, and costs one request.
- Working back over a period long gone means reading every transaction since, which is the
  same live aggregation this screen already accepts. Where it cannot be done — Stripe
  refusing, or more pages than the client will walk — the balance is left unstated rather
  than guessed, logged where it fails, and the foot omits the line rather than the whole
  period failing to load.
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
- What the ledger screens share lives outside any of them, so a further screen
  that reads a period is these parts again rather than a copy: the narrowing and its
  facet counting, the period picker and its month/year toggle, the ledger table's own
  look, the sticky summary foot, the field a table is typed in, and the mark a search
  puts on what it found. A screen states its facets, its columns and its summary lines;
  none of the mechanics is written twice. The PayPal transaction screen is the third
  reader of them.
- On the backend the same holds for the period a ledger screen is asked for.
  `com.vastbricks.api.ledger.LedgerPeriod` reads `YYYY-MM` or `YYYY` and answers the UTC
  window both ends included, and both provider ledgers use it: the two screens ask for a
  period in the same words and mean the same window by it. The bank statement screen keeps
  a period of its own because it reads booking days rather than instants.
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

