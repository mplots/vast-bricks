import type { APIRequestContext } from '@playwright/test';

import { expect, test } from '../support/api-test';

const paymentFeeOf = async (
  request: APIRequestContext,
  paymentMethod: string | undefined,
  grandTotal: string | undefined,
  country?: string
) => {
  const query = new URLSearchParams();
  if (paymentMethod !== undefined) query.set('paymentMethod', paymentMethod);
  if (grandTotal !== undefined) query.set('grandTotal', grandTotal);
  if (country !== undefined) query.set('country', country);
  const response = await request.get(`/api/test/payment-fee?${query.toString()}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).paymentFee as number | null;
};

// Stripe's EEA card rate: 1.5% + EUR 0.25.
test('takes 1.5% plus 0.25 as the Stripe fee for an EEA country', async ({ request }) => {
  await expect(paymentFeeOf(request, 'Stripe', '100', 'LV')).resolves.toBe(1.75);
});

// A non-euro EEA country prices the same as one that uses the euro.
test('takes the EEA Stripe rate for a non-euro EEA country too', async ({ request }) => {
  await expect(paymentFeeOf(request, 'Stripe', '100', 'DK')).resolves.toBe(1.75);
});

// Stripe's rate for a UK-issued card: 2.5% + EUR 0.25.
test('takes 2.5% plus 0.25 as the Stripe fee for the United Kingdom', async ({ request }) => {
  await expect(paymentFeeOf(request, 'Stripe', '100', 'GB')).resolves.toBe(2.75);
});

// Stripe's rate for a card issued anywhere else: 3.25% + EUR 0.25.
test('takes 3.25% plus 0.25 as the Stripe fee for a country neither EEA nor the UK', async ({ request }) => {
  await expect(paymentFeeOf(request, 'Stripe', '100', 'US')).resolves.toBe(3.5);
});

test('takes the EEA Stripe rate when no country is stated', async ({ request }) => {
  await expect(paymentFeeOf(request, 'Stripe', '100')).resolves.toBe(1.75);
});

// PayPal's EEA domestic commercial rate: 3.4% + EUR 0.35.
test('takes 3.4% plus 0.35 as the PayPal fee for an EEA country', async ({ request }) => {
  await expect(paymentFeeOf(request, 'PayPal', '100', 'LV')).resolves.toBe(3.75);
});

// A non-euro EEA country prices the same as one that uses the euro.
test('takes the EEA PayPal rate for a non-euro EEA country too', async ({ request }) => {
  await expect(paymentFeeOf(request, 'PayPal', '100', 'DK')).resolves.toBe(3.75);
});

// PayPal's rate for a UK buyer: the domestic 3.4% plus its published 1.29% surcharge.
test('takes 4.69% plus 0.35 as the PayPal fee for the United Kingdom', async ({ request }) => {
  await expect(paymentFeeOf(request, 'PayPal', '100', 'GB')).resolves.toBe(5.04);
});

// PayPal's rate for a buyer anywhere else: the domestic 3.4% plus its published 1.99% surcharge.
test('takes 5.39% plus 0.35 as the PayPal fee for a country neither EEA nor the UK', async ({ request }) => {
  await expect(paymentFeeOf(request, 'PayPal', '100', 'US')).resolves.toBe(5.74);
});

test('takes the EEA PayPal rate when no country is stated', async ({ request }) => {
  await expect(paymentFeeOf(request, 'PayPal', '100')).resolves.toBe(3.75);
});

test('takes only the fixed fee on a zero grand total', async ({ request }) => {
  await expect(paymentFeeOf(request, 'Stripe', '0', 'LV')).resolves.toBe(0.25);
});

test('leaves a bank transfer without a payment fee', async ({ request }) => {
  await expect(paymentFeeOf(request, 'Bank Transfer', '100', 'LV')).resolves.toBeNull();
});

test('leaves an order with no payment method without a payment fee', async ({ request }) => {
  await expect(paymentFeeOf(request, undefined, '100', 'LV')).resolves.toBeNull();
});

test('leaves an order with no grand total without a payment fee', async ({ request }) => {
  await expect(paymentFeeOf(request, 'Stripe', undefined, 'LV')).resolves.toBeNull();
});
