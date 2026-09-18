# Country feature requirements

A marketplace states a country its own way - a name, a code, a name and a city run together - and more than one
feature needs to turn that into the one code the rest of the backend already agrees on. This is that lookup, kept as
a shared feature in `com.vastbricks.api.country` rather than built again inside whichever feature needed it first.

## What is stored

- One row per ISO 3166-1 country: its alpha-2 code, its English name, and a list of search terms - every spelling
  that should resolve to it.
- The search terms start as the name itself and the alpha-2 and alpha-3 codes, seeded once from `java.util.Locale`'s
  own copy of the ISO 3166-1 list rather than typed in by hand. A term is added beyond that only once a real order is
  found to state it - `Latvija` for Latvia is the first, BrickLink's own export naming the country in Latvian rather
  than English - so the list grows by evidence rather than by guessing every language a buyer might use up front.
- This is a platform-wide mapping, not any one feature's own: a term belongs to the country, and every caller shares
  the same growing list rather than keeping one of its own.

## The public API

- `Countries.resolve(String term)` is the whole of it. It matches `term` case-insensitively against every country's
  search terms and answers the alpha-2 code, or nothing where no country lists it.
- It takes a bare term, not a marketplace's own format. BrickLink's export states a country and a city together, as
  `Latvia, Riga`; a caller splits that itself before asking, the same way it already reads whichever of a
  marketplace's own fields it needs - splitting one marketplace's format is that caller's business, not this
  feature's.
- Every caller asks, even one already holding what looks like a clean code: `GB` is itself one of the United
  Kingdom's own search terms, so resolving it answers `GB` back, at no more cost than reading it directly would have
  been. What that buys is one path a discrepancy is ever fixed on. If a provider is ever found stating a code this
  table does not recognize as that country's own - `UK` for `GB`, or any other spelling - the fix is adding that
  spelling to the country's search terms, not teaching the caller a fold of its own; a caller that bypassed the
  lookup for an "already clean" code would need that second, separate fix instead.
- The lookup is trusted to answer correctly once a term is added: a caller does not re-check what it gets back, the
  same way a caller of `CurrencyRates.toEur` does not re-derive the rate it was given.

## Callers

- Reconciliation's `order.country` is the first caller, and asks for both marketplaces alike: BrickLink's export
  states no clean code, only the free-text location its `MapperBrickLinkOrders` already reads for tax purposes,
  `"Latvia, Riga"`, so the mapper splits off the part naming the country and resolves that. BrickOwl states a code
  directly, `ship_country_code`, and its mapper resolves that too, rather than trusting it as already correct. See
  "Reconciliation feature requirements" for where the result is exposed.

## Tenancy

- The table is global, like `currency_rates`. It carries no `@TenantId`: a country is the same country for every
  store, reached with no credential and owned by no tenant.
