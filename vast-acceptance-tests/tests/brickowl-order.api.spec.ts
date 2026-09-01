import { expect, test } from './support/api-test';
import { WireMockApi, wireMockMode } from './support/wiremock';

test.describe.configure({ mode: wireMockMode() });

test('BrickOwl order endpoint returns customer summaries for the requested month', async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();

  await settings.set('VAST_BRICKOWL_BASE_URL', wireMock.baseUrl);
  await settings.setSecret('VAST_BRICKOWL_API_KEY', 'test-brickowl-api-key');

  await wireMock.addMethodHostMapping('GET', '/v1/order/list', {
    response: {
      json: [
        {
          order_id: 'test-order-0810',
          order_date: '1786320000',
          total_quantity: '4',
          total_lots: '2',
          base_order_total: '12.34',
          status: 'Shipped',
          status_id: '5',
        },
        {
          order_id: 'test-order-0811',
          order_date: '1786406400',
          total_quantity: '1',
          total_lots: '1',
          base_order_total: '5.67',
          status: 'Received',
          status_id: '6',
        },
        {
          order_id: 'test-order-0901',
          order_date: '1788220800',
          total_quantity: '3',
          total_lots: '1',
          base_order_total: '9.99',
          status: 'Shipped',
          status_id: '5',
        },
      ],
    },
  });
  await wireMock.addMethodHostMapping('POST', '/v1/bulk/batch', {
    request: {
      bodyPatterns: [{ contains: 'order%2Fview' }],
    },
    response: {
      json: [
        {
          req_num: 1,
          code: 200,
          body: {
            order_id: 'test-order-0810',
            buyer_name: 'Test Buyer Alpha',
            customer_username: 'test_alpha',
            sub_total: '12.34',
          },
        },
        {
          req_num: 2,
          code: 200,
          body: {
            order_id: 'test-order-0811',
            buyer_name: 'Test Buyer Beta',
            customer_username: 'test_beta',
            sub_total: '5.67',
          },
        },
      ],
    },
  });
  await wireMock.addMethodHostMapping('POST', '/v1/bulk/batch', {
    request: {
      bodyPatterns: [{ contains: 'order%2Fitems' }],
    },
    response: {
      json: [
        {
          req_num: 1,
          code: 200,
          body: [
            { image_small: 'https://example.test/item.png', base_price: '1.20', ordered_quantity: '2' },
            { base_price: '0.30', ordered_quantity: '1' },
          ],
        },
        {
          req_num: 2,
          code: 200,
          body: [
            { base_price: '2.00', ordered_quantity: '3' },
          ],
        },
      ],
    },
  });

  const response = await request.get('/api/private/brickowl/orders?month=2026-08');

  expect(response.status(), await response.text()).toBe(200);
  await expect(response.json()).resolves.toEqual([
    { orderId: 'test-order-0810', name: 'Test Buyer Alpha', username: 'test_alpha', basePrice: 2.7, subTotal: 12.34 },
    { orderId: 'test-order-0811', name: 'Test Buyer Beta', username: 'test_beta', basePrice: 6, subTotal: 5.67 },
  ]);

  const listRequests = await wireMock.findMethodHostRequests('GET', '/v1/order/list');
  expect(listRequests).toHaveLength(1);
  expect(listRequests[0].url).toContain('key=test-brickowl-api-key');

  const batchRequests = await wireMock.findMethodHostRequests('POST', '/v1/bulk/batch');
  expect(batchRequests).toHaveLength(2);
  const viewRequest = batchRequests.find(request => request.form().get('requests')?.includes('order/view'));
  const itemRequest = batchRequests.find(request => request.form().get('requests')?.includes('order/items'));
  expect(viewRequest).toBeDefined();
  expect(itemRequest).toBeDefined();
  expect(viewRequest?.form().get('key')).toBe('test-brickowl-api-key');
  expect(JSON.parse(viewRequest?.form().get('requests') ?? '')).toEqual({
    requests: [
      { endpoint: 'order/view', request_method: 'GET', params: [{ order_id: 'test-order-0810' }] },
      { endpoint: 'order/view', request_method: 'GET', params: [{ order_id: 'test-order-0811' }] },
    ],
  });
  expect(itemRequest?.form().get('key')).toBe('test-brickowl-api-key');
  expect(JSON.parse(itemRequest?.form().get('requests') ?? '')).toEqual({
    requests: [
      { endpoint: 'order/items', request_method: 'GET', params: [{ order_id: 'test-order-0810' }] },
      { endpoint: 'order/items', request_method: 'GET', params: [{ order_id: 'test-order-0811' }] },
    ],
  });
});
