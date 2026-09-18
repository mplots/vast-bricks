import type { APIRequestContext } from '@playwright/test';

import { expect, test } from '../support/api-test';

const paymentFeeOf = async (request: APIRequestContext, paymentMethod: string | undefined, grandTotal: string | undefined) => {
  const query = new URLSearchParams();
  if (paymentMethod !== undefined) query.set('paymentMethod', paymentMethod);
  if (grandTotal !== undefined) query.set('grandTotal', grandTotal);
  const response = await request.get(`/api/test/payment-fee?${query.toString()}`);
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()).paymentFee as number | null;
};

// Stripe's EEA card rate: 1.5% + EUR 0.25.
test('takes 1.5% plus 0.25 as the Stripe fee', async ({ request }) => {
  await expect(paymentFeeOf(request, 'Stripe', '100')).resolves.toBe(1.75);
});

// PayPal's EEA domestic commercial rate: 3.4% + EUR 0.35.
test('takes 3.4% plus 0.35 as the PayPal fee', async ({ request }) => {
  await expect(paymentFeeOf(request, 'PayPal', '100')).resolves.toBe(3.75);
});

test('takes only the fixed fee on a zero grand total', async ({ request }) => {
  await expect(paymentFeeOf(request, 'Stripe', '0')).resolves.toBe(0.25);
});

test('leaves a bank transfer without a payment fee', async ({ request }) => {
  await expect(paymentFeeOf(request, 'Bank Transfer', '100')).resolves.toBeNull();
});

test('leaves an order with no payment method without a payment fee', async ({ request }) => {
  await expect(paymentFeeOf(request, undefined, '100')).resolves.toBeNull();
});

test('leaves an order with no grand total without a payment fee', async ({ request }) => {
  await expect(paymentFeeOf(request, 'Stripe', undefined)).resolves.toBeNull();
});
