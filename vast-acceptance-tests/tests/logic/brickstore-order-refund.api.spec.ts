import { expect, test, wireMockMode } from '../support/brickstore-refund';

test.describe.configure({ mode: wireMockMode() });

test('reads the total refunded BrickLink states on the order', async ({ orderRefund }) => {
  const refund = await orderRefund({ totalRefunded: 'EUR&nbsp;12.34' });

  expect(refund).toEqual({ currency: 'EUR', amount: 12.34 });
});

test('reads no refund for an order whose page states none', async ({ orderRefund }) => {
  const refund = await orderRefund({});

  expect(refund).toBeNull();
});

test('reads the total rather than one of the refunds it sums', async ({ orderRefund }) => {
  const refund = await orderRefund({
    totalRefunded: 'EUR&nbsp;12.34',
    activity: ['EUR&nbsp;10.00', 'EUR&nbsp;2.34']
  });

  expect(refund?.amount).toBe(12.34);
});

test('reads an amount BrickLink wrote with a thousands separator', async ({ orderRefund }) => {
  const refund = await orderRefund({ totalRefunded: 'USD&nbsp;1,234.56' });

  expect(refund).toEqual({ currency: 'USD', amount: 1234.56 });
});
