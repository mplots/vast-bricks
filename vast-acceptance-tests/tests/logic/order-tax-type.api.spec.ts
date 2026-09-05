import type { APIRequestContext } from '@playwright/test';

import { expect, test } from '../support/api-test';

/** A marketplace's tax fields; a field left out is one the marketplace did not report. */
type TaxFields = Record<string, string>;

const taxTypeOf = async (request: APIRequestContext, marketplace: string, fields: TaxFields) => {
  const query = new URLSearchParams(fields).toString();
  const response = await request.get(`/api/test/order-tax-type/${marketplace}?${query}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).taxType as string | null;
};

const brickOwl = (request: APIRequestContext, fields: TaxFields) => taxTypeOf(request, 'brickowl', fields);
const brickLink = (request: APIRequestContext, fields: TaxFields) => taxTypeOf(request, 'bricklink', fields);

test('types a BrickOwl order taxed under a scheme and billed in Latvia as domestic', async ({ request }) => {
  await expect(brickOwl(request, { billingCountryCode: 'LV', taxSchemeId: '1', taxRate: '21' })).resolves.toBe(
    'domestic'
  );
});

test('types a BrickOwl order taxed at a rate under no scheme as European Union', async ({ request }) => {
  await expect(brickOwl(request, { billingCountryCode: 'DE', taxRate: '19' })).resolves.toBe('european-union');
});

test('types a BrickOwl order at a zero rate under no scheme as export', async ({ request }) => {
  await expect(brickOwl(request, { billingCountryCode: 'US', taxRate: '0' })).resolves.toBe('export');
});

test('types a BrickOwl order taxed under a scheme but billed outside Latvia as export taxable', async ({ request }) => {
  await expect(brickOwl(request, { billingCountryCode: 'GB', taxSchemeId: '2', taxRate: '20' })).resolves.toBe(
    'export-taxable'
  );
});

test('leaves a BrickOwl order reporting no tax rate untyped', async ({ request }) => {
  await expect(brickOwl(request, { billingCountryCode: 'NO' })).resolves.toBeNull();
});

test('leaves a BrickOwl order taxed under a scheme but reporting no rate untyped', async ({ request }) => {
  await expect(brickOwl(request, { billingCountryCode: 'LV', taxSchemeId: '1' })).resolves.toBeNull();
});

test('types a BrickLink order charged VAT and located in Latvia as domestic', async ({ request }) => {
  await expect(brickLink(request, { location: 'Latvia, Riga', vatCharges: '2.59' })).resolves.toBe('domestic');
});

test('types a BrickLink order charged VAT and located elsewhere as European Union', async ({ request }) => {
  await expect(brickLink(request, { location: 'Germany, Hessen', vatCharges: '43.90' })).resolves.toBe(
    'european-union'
  );
});

test('types a BrickLink order charged no tax at all as export', async ({ request }) => {
  await expect(
    brickLink(request, { location: 'Australia, New South Wales', vatCharges: '0', salesTax: '0.00', vat: '0.00' })
  ).resolves.toBe('export');
});

// The store charged no VAT, but the marketplace collected its own tax on the sale.
test('types a BrickLink order the marketplace charged VAT on as export taxable', async ({ request }) => {
  await expect(
    brickLink(request, { location: 'United Kingdom, England', vatCharges: '0', salesTax: '0.00', vat: '2.04' })
  ).resolves.toBe('export-taxable');
});

test('types a BrickLink order the marketplace charged sales tax on as export taxable', async ({ request }) => {
  await expect(
    brickLink(request, { location: 'United States, California', vatCharges: '0', salesTax: '1.10', vat: '0.00' })
  ).resolves.toBe('export-taxable');
});

test('leaves a BrickLink order reporting no VAT charges untyped', async ({ request }) => {
  await expect(brickLink(request, { location: 'Norway, Oslo' })).resolves.toBeNull();
});
