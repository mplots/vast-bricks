import { test as base, expect } from './api-test';
import type { BrickLinkOrderDetailPage } from './bricklink-order-detail';
import { orderDetailPage } from './bricklink-order-detail';
import { WireMockApi, wireMockMode } from './wiremock';

/** The refund the client read out of that page, or `null` where it read none. */
export type OrderRefund = { currency: string; amount: number } | null;

const orderId = '70000001';
const clientToken = 'brickstore-refund-client-token';
const sessionToken = 'brickstore-refund-session-token';

export const test = base.extend<{
  /** Serves the given BrickLink order detail page and returns the refund the client read out of it. */
  orderRefund: (page: BrickLinkOrderDetailPage) => Promise<OrderRefund>;
}>({
  orderRefund: async ({ request, settings }, use, testInfo) => {
    await use(async (page) => {
      const wireMock = WireMockApi.forTest(request, testInfo);
      await wireMock.reset();
      await mockBrickLink(wireMock, settings, page);

      const response = await request.get(`/api/test/brickstore-order-refund?orderId=${orderId}`);
      expect(response.status(), await response.text()).toBe(200);
      const body = await response.text();
      return body ? (JSON.parse(body) as OrderRefund) : null;
    });
  }
});

async function mockBrickLink(
  wireMock: WireMockApi,
  settings: { set(key: string, value: string): Promise<void>; setSecret(key: string, value: string): Promise<void> },
  page: BrickLinkOrderDetailPage
) {
  await settings.set('VAST_BRICKSTORE_BASE_URL', wireMock.baseUrl);
  await settings.set('VAST_BRICKSTORE_SESSION_BASE_URL', wireMock.baseUrl);
  await settings.setSecret('VAST_BRICKSTORE_TOKEN', clientToken);
  await wireMock.addMethodHostMapping('POST', '/api/v1/actions/verify-and-create-session', {
    response: { json: { sessionToken } }
  });
  await wireMock.addMethodHostMapping('GET', '/orderDetail.asp', {
    request: {
      queryParameters: { ID: { equalTo: orderId } },
      headers: { 'x-bl-session-token': { equalTo: sessionToken } }
    },
    response: {
      headers: { 'Content-Type': 'text/html; Charset=UTF-8' },
      body: orderDetailPage(orderId, page)
    }
  });
}

export { expect, wireMockMode };
