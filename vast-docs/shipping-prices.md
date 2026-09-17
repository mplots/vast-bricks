# Shipping prices feature requirements

What it costs to post a parcel is the one number a store needs before it can say whether an order paid for itself,
and Latvijas Pasts states it in a tariff book nobody can query. The calculator behind `mans.pasts.lv` answers the
same question over HTTP, so this feature sweeps it into a table the rest of the backend can read.

## What is stored

- One row per destination, shipment type, service and weight band. A store asking "what does 400 g to Germany
  cost" is asking for one row, and that is the whole of what the table is for.
- Two shipment types, and they are the two the tariff book names: **Sīkpaka** for anything up to 2 kg, and
  **Paka** above it. The other things Latvijas Pasts sells - letters, courier delivery, parcel machines - are not
  stored. A store that ships bricks ships sīkpakas, and pakas when they will not fit in one.
- Two services under Sīkpaka, and they are the two a store chooses between: `ECONOMY` (vienkāršs) and `STANDARD`
  (izsekojams). Under Paka there is only `STANDARD_PLUS` (ierakstīts), because that is all Latvijas Pasts offers for
  a parcel: the tariff book's Pakas columns carry no economy or standard row, and neither does the API.
- **Whether a shipment can be followed is the difference the services are chosen on, so the screen says it outright.**
  Economy is unregistered and cannot be tracked. Standard is registered and tracked at every stage. Standard+ is
  registered and signed for, so a Paka is tracked whether or not anyone asks - there is no untracked parcel to buy
  instead, which is why the provider quotes no separate tracking fee against it and that column never shows a split.
  The screen states it under all three headings and not only the two it is true of: "trackable" says nothing until
  something beside it is not.
- **How long it takes is stored beside what it costs**, as a fewest and a most in days. It belongs on the row
  because it is the other half of choosing a service: Economy and Standard to the United States both take 10-15
  days, but a Paka there takes 10-12, so the estimate varies by service and not only by destination. It does not
  vary by weight, so the screen states it once under each column rather than on every row.
- Stored as two integers rather than the provider's own string. It writes the same estimate as `15 - 20` for some
  destinations and `15-20` for others, and once with a trailing space; kept as text, a day it tidied its formatting
  would close every row and open an identical one. A single number means the fewest and the most are the same.
  Anything it writes that is neither is read as no estimate rather than guessed at - a wait is worth less than a
  price and is not worth failing a destination over.
- A changed estimate closes the row and opens another, exactly as a changed price does. It is part of what was
  offered rather than metadata about the sweep, so updating it in place would leave every historical row carrying
  today's estimate, which is a quiet untruth about what the store was offered at the time.
- The price is kept as **two numbers**, not one. The provider states a base weight cost and a separate tracking fee,
  and Standard is the sum of them; storing only the sum would lose which half moved when a tariff changes. A reader
  wanting the price adds them, which is what the screen does.
- Prices are the **self-service prices** a shipment created on `mans.pasts.lv` is charged - the Mans Pasts discount
  is already in them. They are not the tariff book's list prices, and the difference is real: Germany's 101-500 g
  sīkpaka is 8.66 in the book and 8.10 here. What a store pays is the one worth storing.
- Contract pricing is not stored. The calculator answers `withContract` only for a signed-in account, and this
  feature is anonymous.

## Where it comes from

- `POST /api/public/prices/by_country` on `mans.pasts.lv`, anonymous, `{shipmentType, countryCodes, weight,
  withContract}`. Weight is in whole grams and at most five countries may be asked about at once.
- The destinations come from `GET /api/public/countries?active=true`, which is also where each country's name comes
  from. There are around 250, and their codes are mostly ISO-3166 alpha-2 but not always: an overseas territory
  priced separately from its mainland carries a numeric code of the provider's own.
- **The sweep asks for one weight, deliberately over every maximum.** Asked about a weight nothing can carry, the
  provider answers with the entire ladder of bands for every workflow at once rather than with an error. So a full
  sweep of every country, every band up to 30 kg, is around fifty requests and not two thousand. The requests are
  paced; the data is public and the caller does not hide.
- The ladder arrives **unlabelled and unordered** - a bare list of prices with no weight against any of them. It is
  read by sorting ascending and taking the bands in order, sīkpaka's five being fixed at 20/100/500/1000/2000 g and
  paka's being one per kilogram from the first. That is sound only because a heavier band never costs less, so the
  mapping is checked rather than assumed: the sync also probes a known weight and abandons a sweep whose ladder does
  not agree with it.
- Neither the order the prices arrive in nor their `@id` order can be used instead. Both are the provider's own and
  neither is band order: Germany's tracked small packet arrives `816, 508, 612, 955, 503`, which is no order at all.
  Sorting is the only reading that holds, which is why it is guarded rather than trusted.
- It was measured rather than argued. Every destination's bands were quoted individually and compared against what
  sorting the dump produces: **2,050 small-packet prices across 410 ladders and 1,781 parcel prices across 246**,
  with two disagreements in the whole set - Réunion's economy small packet and St Helena's parcel. Both are the
  destinations the guards below already refuse, so nothing stored is a band read off the wrong rung.
- Réunion is the reason a heavier band costing less is not merely theoretical: its economy small packet is 5.24 for
  21-100 g and 4.88 for 101-500 g, so the tariff falls as the weight rises. Sorting reads those two bands the wrong
  way round, and the repeated price it leaves behind is what the guard catches it by.
- A country whose ladder is the wrong length is counted and skipped, not guessed at. One destination the provider
  described oddly is not a reason to write 250 countries wrongly.
- So is one whose ladder states the same price twice, which means it is not one ladder. St Helena is answered with
  two of them under a single label - two ranges of ten kilograms priced identically, from two runs of the
  provider's own tariff - and read as one they would put every band after the first onto the price of the band
  below it. It is the only destination of the 252 that does this, and skipping it is a gap a reader can see where a
  silently wrong tariff is not.
- `maxWeightInKg` is **not** what says how far a ladder goes; the number of prices in it is. The provider reports a
  maximum that disagrees with its own band count for 22 destinations - Angola states 5 kg and then quotes 19.5 kg
  quite happily - so the field is read for nothing.

## Tenancy

- The table is **global**. It carries no `@TenantId`, and it is the first feature table that does not.
- This is deliberate and it is not the pattern for a feature table. A tariff is a published price list, identical
  for every store, reached with no credential and therefore owned by no tenant. Stamping it per tenant would buy a
  duplicate of the same 9,000 rows per store and a duplicate sweep to fill them, protecting data that is on a public
  web page.
- Jobs are tenant-specific, so the sync still fires once per active tenant. It is idempotent and cheap about it: a
  run that finds the table already swept inside the freshness window does nothing at all, so the second tenant's
  firing costs one query. `--force` is how a person asks for the sweep anyway.
- A global table is also what a scenario cannot clean up after itself: deleting its tenant takes every tenant-owned
  row with it and leaves these. So a scenario states destination codes of its own, the sweep closes rows only for
  the destinations it actually priced, and the acceptance suite runs against `bricks_test` rather than the
  developer's own database. The first two keep scenarios from colliding with each other; the third keeps them out
  of the developer's data altogether.

## Transactions

- The sweep itself runs in **no** transaction; each destination is written in a short one of its own. A sweep is
  around fifty requests over the better part of a minute, and one transaction around all of it would hold a database
  connection for the whole sweep and discard every destination already read the moment one failed.
- It would also discard the debug dock's record of the traffic, which is written through the same transaction - so
  a sweep that failed would show nothing of what it sent, which is the one thing worth having afterwards.
- Per destination rather than per sweep, so a sweep stopped or failed partway keeps what it had already read.

## History

- A price is kept until it changes. A sweep confirming a price it already holds writes nothing but `checked_at`; a
  sweep finding a different one closes the old row with `valid_to` and opens a new one. So the table answers both
  "what does this cost" and "what did this cost in March", and a year in which nothing moved costs one row.
- `checked_at` is what says a price is still real, and it is also what the freshness window is read from.

## Endpoints and screen

- `GET /api/private/shipping-prices/countries` lists the destinations there are prices for.
- `GET /api/private/shipping-prices?country=DE` gives one country's bands.
- The screen is `/shipping-prices`: a country selector, then weight bands down the rows and Economy, Standard and
  Paka across the columns - the tariff book's own shape, which is how a reader already knows to read it. Each
  column says whether that service is trackable, and a Standard price shows its base-plus-tracking split on hover.

## The job

- `shipping-price-sync`, weekly. Tariffs are set by a regulator's decision and move about once a year, so a nightly
  sweep would ask 52 times for each answer that changes.
- Its tally is `added`, `changed`, `unchanged`, `skipped` and `closed`.
