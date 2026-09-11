# Shipment register requirements

The shipment register is what Latvijas Pasts holds for the store: one row per
shipment handed over, with the recipient it was addressed to, the customs
content it was declared with, and what the post office charged for it. It is
read live and stored nowhere, and reconciliation is its only caller — the
shipping cost it collects onto an order is under "Reconciliation feature
requirements".

- Latvijas Pasts publishes no API for the register, so it is read the way the
  account itself offers it: the Mans Pasts profile's xlsx export, which is a
  post to `/lv/profile/orders/export?page=N` behind a signed-in session.
- The provider is therefore reached as a person rather than with a key: a form
  post of `_username` and `_password` to `/lv/login`, which answers with the
  `PHPSESSID` cookie the export has to carry back. The credentials are
  settings-backed like every other provider's, so a tenant reaches its own
  account.
- Redirects are not followed. Both requests answer with one, and a followed
  redirect would lose the session cookie along with the only account of whether
  the credentials were accepted: a login sent back to the login form is a login
  that was refused, and anywhere else it was accepted.
- A session is bought per operation rather than kept. Credentials are the
  serving tenant's, so a cached session would have to be keyed by the account it
  was opened for, and one form post per page read is cheaper than being sure of
  that.
- The page is the provider's own: its export decides how many shipments a page
  holds and never says how many pages there are, so the client asks for a page
  and nothing more. How far to page is a caller's decision, not the client's.
- Every column of the export is one field, so nothing the provider stated is
  dropped on the way in — the register is read for one field today and the rest
  are what a later step reads. Columns are read by the heading over them rather
  than by position: the export heads them in Latvian, and a column Mans Pasts
  inserted would otherwise shift every field after it onto the wrong one
  silently. A heading the client does not know is a column that has been added
  and is passed over.
- Amounts are stated as the export stated them and are normalized where they are
  collected, as every other provider's are. A weight keeps its gram: a letter of
  six grams rounded to the cent's scale would read as weighing nothing. A column
  the export left empty is nothing rather than a zero.
- The export writes an instant as `08.09.2026 19:11:13`, in the account's own
  zone and without one, so it is carried as a local date and time. Reading it as
  an instant would shift a shipment into the reader's zone.
- A provider that would not answer is a bad gateway rather than this service
  failing: the register is Mans Pasts's, and a refused login is its account of
  the request. Reconciliation reports it as it reports every other provider's
  failure.
- An xlsx is read with `fastexcel-reader`, a streaming reader over a flat sheet,
  which is what these exports are.
- No public endpoint exposes the register, so reading it is a logic test through
  the test-only `/api/test/manspasts/shipments` controller, and what
  reconciliation makes of a shipment is a tech test through the reconciliation
  endpoint. The export a scenario states is written as a real xlsx by the
  `support/xlsx` fixture: a provider that answers with a spreadsheet has to be
  mocked with one, and a committed binary export would be a fixture no reviewer
  can read and a file real rows would have to be scrubbed out of by hand.

