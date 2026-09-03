import { expect, test, wireMockMode } from '../support/order-financials';

test.describe.configure({ mode: wireMockMode() });

test('reports the amounts BrickOwl sent', async ({ orderFinancials }) => {
  const financials = await orderFinancials({ brickOwl: { base_order_total: '3.42', tax_rate: '21' } });

  expect(financials.reported).toEqual({ baseOrderTotal: 3.42, taxRate: 21 });
});

test('calculates the base order total without tax to five decimals', async ({ orderFinancials }) => {
  const financials = await orderFinancials({ brickOwl: { base_order_total: '3.42', tax_rate: '21' } });

  expect(financials.calculated.baseOrderTotalWithoutTax).toBe(2.82645);
});

test('calculates no total without tax when the tax rate is missing', async ({ orderFinancials }) => {
  const financials = await orderFinancials({ brickOwl: { base_order_total: '3.42' } });

  expect(financials.calculated.baseOrderTotalWithoutTax).toBeNull();
});

test('keeps an untaxed order total unchanged', async ({ orderFinancials }) => {
  const financials = await orderFinancials({ brickOwl: { base_order_total: '3.42', tax_rate: '0' } });

  expect(financials.calculated.baseOrderTotalWithoutTax).toBe(3.42);
});
