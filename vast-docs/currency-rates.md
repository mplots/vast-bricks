# Currency rates feature requirements

Anything the backend converts between currencies needs a rate from somewhere, and the legacy application answered
that with a hardcoded `0.96` for USD to EUR. The European Central Bank publishes an actual daily rate for free, so
this feature syncs it into a table the rest of the backend can read instead.

## What is stored

- One row per currency per day: how much of that currency one euro bought, on the day the ECB published it.
- The base side is always EUR, exactly as the ECB states its rates, so EUR itself is never a row and there is no
  column naming the base currency.
- The rate is kept at the ECB's own precision rather than rounded to money's usual two decimal places - a rate like
  `1.0876` loses the digit that a store's conversion is actually sensitive to if it is rounded on the way in.
- A row is written once and never touched again. The ECB does not revise a day once it has published it, so unlike
  `shipping_prices` there is no history to close and reopen: the `rate_date` itself is the history, and a currency's
  rate for a given day never has more than one row.

## Where it comes from

- `GET /stats/eurofxref/eurofxref-daily.xml` on `www.ecb.europa.eu`, anonymous, no key. It answers with the most
  recent day the ECB has published, as XML: one dated `<Cube time="...">` wrapping one `<Cube currency="..."
  rate="..."/>` per quoted currency.
- The ECB publishes once per TARGET business day, around 16:00 CET. It does not publish on TARGET holidays or at
  weekends, and asking on one of those days answers with the last business day's rates again rather than with
  nothing - which the sync reads as a day it already has, not a new one.
- The whole day is one unit, because that is how the ECB states it: one document, one date, every currency it quotes
  at once. So the sync checks whether that date is already stored before reading a single currency out of it, rather
  than checking each currency for itself - a repeat of an unchanged day is one query, not thirty.

## Tenancy

- The table is global, like `shipping_prices`. It carries no `@TenantId`: an ECB reference rate is published once for
  the whole world, reached with no credential, and owned by no tenant.
- Jobs are tenant-specific, so the sync still fires once per active tenant. It is idempotent and cheap about it: a
  run that finds the table already synced inside the freshness window does nothing at all, so the second tenant's
  firing costs one query. `--force` is how a person asks for the sync anyway.
- A scenario cannot rely on its tenant to keep this table's rows apart from the scenarios beside it, the table being
  global. It states a currency code and a rate date of its own instead - `XTS`, the ISO 4217 code reserved for
  testing, and a date no other scenario uses - so the sweep's own dedupe-by-day check cannot mistake one scenario's
  day for another's.

## The job

- `currency-rate-sync`, daily at 18:00 - well after the ECB's own 16:00 CET publication, with room for it to run
  late.
- Its tally is `added` and `skipped`.
