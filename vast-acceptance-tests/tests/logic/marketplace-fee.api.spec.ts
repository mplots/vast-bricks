import type { APIRequestContext } from '@playwright/test';

import { expect, test } from '../support/api-test';

/** A marketplace's order fields; a field left out is one the marketplace did not report. */
type FeeFields = Record<string, string>;

const marketplaceFeeOf = async (request: APIRequestContext, marketplace: string, fields: FeeFields) => {
  const query = new URLSearchParams(fields).toString();
  const response = await request.get(`/api/test/marketplace-fee/${marketplace}?${query}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).marketplaceFee as number | null;
};

const brickOwl = (request: APIRequestContext, fields: FeeFields) => marketplaceFeeOf(request, 'brickowl', fields);
const brickLink = (request: APIRequestContext, fields: FeeFields) => marketplaceFeeOf(request, 'bricklink', fields);

// BrickLink's tiered commission: 3% of the first $500, 2% of the next $500, 1% of anything past $1,000.
test('takes 3% of a BrickLink order under the first tier', async ({ request }) => {
  await expect(brickLink(request, { baseGrandTotal: '100' })).resolves.toBe(3);
});

test('caps the first tier at $500 of a BrickLink order', async ({ request }) => {
  await expect(brickLink(request, { baseGrandTotal: '500' })).resolves.toBe(15);
});

test('adds the second tier for a BrickLink order past $500', async ({ request }) => {
  await expect(brickLink(request, { baseGrandTotal: '750' })).resolves.toBe(20);
});

test('adds the third tier for a BrickLink order past $1,000', async ({ request }) => {
  await expect(brickLink(request, { baseGrandTotal: '1500' })).resolves.toBe(30);
});

test('leaves a BrickLink order with no grand total without a marketplace fee', async ({ request }) => {
  await expect(brickLink(request, {})).resolves.toBeNull();
});

// BrickOwl's flat 2.65% commission on the order total, less shipping and non-import taxes.
test('takes 2.65% of a BrickOwl order total less shipping', async ({ request }) => {
  await expect(brickOwl(request, { baseOrderTotal: '1010', shipping: '10' })).resolves.toBe(26.5);
});

test('leaves the import tax BrickOwl collected as facilitator in the BrickOwl fee base', async ({ request }) => {
  await expect(
    brickOwl(request, {
      billingCountryCode: 'US',
      taxSchemeId: '2',
      taxRate: '20',
      taxAmount: '50',
      baseOrderTotal: '1010',
      shipping: '10'
    })
  ).resolves.toBe(26.5);
});

test('subtracts the VAT a domestic BrickOwl order charges under the store registration', async ({ request }) => {
  await expect(
    brickOwl(request, { billingCountryCode: 'LV', taxRate: '21', taxAmount: '50', baseOrderTotal: '1010', shipping: '10' })
  ).resolves.toBe(25.175);
});

test('leaves a BrickOwl order with no order total without a marketplace fee', async ({ request }) => {
  await expect(brickOwl(request, { shipping: '10' })).resolves.toBeNull();
});

test('does not take a negative BrickOwl fee when shipping and tax exceed the order total', async ({ request }) => {
  await expect(brickOwl(request, { baseOrderTotal: '10', shipping: '20' })).resolves.toBe(0);
});
