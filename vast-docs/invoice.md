# Invoice feature requirements

The invoice feature creates the accounting invoice for one marketplace order:
the order is looked up at its marketplace, its buyer is upserted as an
accounting client, and one invoice line is written for what the order is the
store's to invoice for. Adding a marketplace is one more `InvoiceOrderSource`.

- The VAT rate the invoice is issued under is decided by the order's tax type
  and by nothing else: `domestic` and `european-union` at the Latvian 21%,
  `export` and `export-taxable` at 0%. An export the marketplace taxed under
  its own registration still carries no VAT of the store's, that tax not being
  the store's to charge.
- The tax type comes from the shared `tax` feature rather than being derived
  again here, so the invoice and the reconciliation screen can never disagree
  about how one order is treated. Reconciliation reads the same feature; neither
  screen owns it.
- An order with no tax type is not invoiced at all: how the sale is treated for
  tax is what decides the rate, and there is no rate to fall back on. It is
  rejected by the order source, before the buyer's accounting client is written,
  so a failed invoice leaves nothing behind.
- The amount invoiced is the grand total less what the marketplace collected as
  tax facilitator, which is the same subtraction reconciliation's target invoice
  makes and for the same reason: that tax was charged under the marketplace's
  registration. Only an `export-taxable` order has one, so every other type
  invoices its whole grand total. An order reporting no grand total is rejected.
- The refund reconciliation's target invoice also subtracts is not subtracted
  here. An invoice is generated for an order to be invoiced, not for one whose
  money has come back; what a refunded order should be invoiced for has no
  requirement yet.
- Two things a Latvian invoice needs are not fields on the invoice at all. The
  signature note a document is printed with (`Elektronisks dokuments, derīgs bez
  paraksta`) is a property of the Manakabata **invoice type**, and the VAT
  reference printed beside an untaxed line (`Preču eksports`, Directive
  2006/112/EK art. 146(1)(a)) is a property of the **VAT rate**.
- **Neither can be set through the API, and neither is attempted.** Both were
  implemented and reverted: the invoice type and the per-line VAT rate are
  settable in the request, but no combination of them makes Manakabata print
  either note on a generated document. Manakabata's support has been asked, so
  this is settled by their answer rather than by another attempt from here. Do
  not reintroduce a setting, a per-line `invoice_vat`, or a custom invoice type
  for these until that answer says how.
- So the invoice type stays the built-in `bill_of_landing` key and a line states
  its VAT as a bare `tax` percent, which is what the API does without either.
  Both notes are set by hand in the Manakabata interface for now.
- What the API listings do say is worth keeping, because it rules out the
  obvious retries. `signature_type` is a field of the invoice type, not of the
  invoice: the built-in `product` types are `prepayment` and `credit` at
  `electronic_without_signature` and `bill_of_landing` at
  `paper_with_signature_fields`, all three `is_system: true`. And an account's
  VAT rate list comes back **empty**, the built-in 21/12/5/0 rates being
  implicit options rather than records, so there is no zero-rated rate carrying
  a `vat_reference` for a line to point at.
- The published specification types the recipient, numerator and bank-account
  fields as arrays of strings where the API expects lookup objects, which is why
  `ManakabataInvoiceRequest` is handwritten. `invoice_vat` is a fourth such
  field, but nothing sends it.
- A marketplace states its totals with the tax it charged included, while
  Manakabata reads a line's price as the price before VAT and adds the rate back
  on top. So the rate is taken out of the amount once, in `InvoiceVat`, and the
  invoice comes to what the order actually did. Line prices are two decimals,
  `HALF_UP`.
- The invoice note stays `<marketplace>:<orderId>`. It is not decoration: it is
  the only thing tying an invoice back to its order, and reconciliation's
  accounting source reads it to collect what an order was invoiced for. Changing
  it silently unmatches every invoice already written.
- Acceptance tests are tech tests against a mocked marketplace and a mocked
  Manakabata: one scenario per tax type states the marketplace's own tax fields
  and asserts the rate and the price of the invoice line it comes to. What the
  type itself is stays a logic test of the `tax` feature.

