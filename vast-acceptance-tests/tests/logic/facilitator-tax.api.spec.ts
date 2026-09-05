import type { APIRequestContext } from '@playwright/test';

import { expect, test } from '../support/api-test';

/** A marketplace's tax fields; a field left out is one the marketplace did not report. */
type TaxFields = Record<string, string>;

const facilitatorTaxOf = async (request: APIRequestContext, marketplace: string, fields: TaxFields) => {
  const query = new URLSearchParams(fields).toString();
  const response = await request.get(`/api/test/facilitator-tax/${marketplace}?${query}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).facilitatorTax as number | null;
};

const brickOwl = (request: APIRequestContext, fields: TaxFields) => facilitatorTaxOf(request, 'brickowl', fields);
const brickLink = (request: APIRequestContext, fields: TaxFields) => facilitatorTaxOf(request, 'bricklink', fields);

test('takes the tax BrickOwl charged on an export it taxed as the facilitator tax', async ({ request }) => {
  await expect(
    brickOwl(request, { billingCountryCode: 'GB', taxSchemeId: '2', taxRate: '20', taxAmount: '3.45' })
  ).resolves.toBe(3.45);
});

test('leaves a BrickOwl order taxed at home without a facilitator tax', async ({ request }) => {
  await expect(
    brickOwl(request, { billingCountryCode: 'LV', taxSchemeId: '1', taxRate: '21', taxAmount: '2.10' })
  ).resolves.toBeNull();
});

test('leaves an untaxed BrickOwl export without a facilitator tax', async ({ request }) => {
  await expect(brickOwl(request, { billingCountryCode: 'US', taxRate: '0' })).resolves.toBeNull();
});

test('leaves an untyped BrickOwl order without a facilitator tax', async ({ request }) => {
  await expect(brickOwl(request, { billingCountryCode: 'NO', taxAmount: '1.00' })).resolves.toBeNull();
});

// BrickLink splits what it collected between the two fields, and an order can carry either or both.
test('sums the sales tax and VAT BrickLink charged on an export it taxed', async ({ request }) => {
  await expect(
    brickLink(request, { location: 'United States, California', vatCharges: '0', salesTax: '1.10', vat: '2.04' })
  ).resolves.toBe(3.14);
});

test('takes BrickLink sales tax alone as the facilitator tax', async ({ request }) => {
  await expect(
    brickLink(request, { location: 'United States, California', vatCharges: '0', salesTax: '1.10', vat: '0.00' })
  ).resolves.toBe(1.1);
});

test('takes BrickLink VAT alone as the facilitator tax', async ({ request }) => {
  await expect(
    brickLink(request, { location: 'United Kingdom, England', vatCharges: '0', salesTax: '0.00', vat: '2.04' })
  ).resolves.toBe(2.04);
});

test('leaves a BrickLink order charged VAT under the store registration without a facilitator tax', async ({
  request,
}) => {
  await expect(brickLink(request, { location: 'Latvia, Riga', vatCharges: '2.59' })).resolves.toBeNull();
});

test('leaves an untaxed BrickLink export without a facilitator tax', async ({ request }) => {
  await expect(
    brickLink(request, { location: 'Australia, New South Wales', vatCharges: '0', salesTax: '0.00', vat: '0.00' })
  ).resolves.toBeNull();
});

test('leaves an untyped BrickLink order without a facilitator tax', async ({ request }) => {
  await expect(brickLink(request, { location: 'Norway, Oslo', salesTax: '1.10' })).resolves.toBeNull();
});
