import { test as base, expect } from './api-test';
import { WireMockApi, wireMockMode } from './wiremock';

/**
 * One scenario's provider data. A scenario names only the source values it reasons about; every other field of the
 * marketplace response stays unset, so a fixture line reads as the financial fact it states.
 */
export type OrderFinancialsProviders = {
  /** Fields of the BrickOwl `order/view` response, spelled as BrickOwl spells them. */
  brickOwl?: Record<string, unknown>;
};

export type OrderFinancials = {
  source: string;
  orderId: string;
  /** Amounts exactly as the marketplace reported them. */
  reported: Record<string, number | null>;
  /** Amounts the feature derived from the reported ones. */
  calculated: Record<string, number | null>;
};

const brickOwlOrderId = '10574321';

export const test = base.extend<{
  /** Mocks the marketplace with the given financials and returns the feature's response for that order. */
  orderFinancials: (providers: OrderFinancialsProviders) => Promise<OrderFinancials>;
}>({
  orderFinancials: async ({ request, settings }, use, testInfo) => {
    await use(async (providers) => {
      const wireMock = WireMockApi.forTest(request, testInfo);
      await wireMock.reset();
      await mockBrickOwl(wireMock, settings, providers.brickOwl ?? {});

      const response = await request.get(
        `/api/test/order-financials?orderId=${brickOwlOrderId}&source=BrickOwl`
      );
      expect(response.status(), await response.text()).toBe(200);
      return (await response.json()) as OrderFinancials;
    });
  }
});

async function mockBrickOwl(
  wireMock: WireMockApi,
  settings: { set(key: string, value: string): Promise<void>; setSecret(key: string, value: string): Promise<void> },
  order: Record<string, unknown>
) {
  await settings.set('VAST_BRICKOWL_BASE_URL', wireMock.baseUrl);
  await settings.setSecret('VAST_BRICKOWL_API_KEY', 'test-brickowl-api-key');
  await wireMock.addMethodHostMapping('POST', '/v1/bulk/batch', {
    response: { json: [{ req_num: 1, code: 200, body: { order_id: brickOwlOrderId, ...order } }] }
  });
}

export { expect, wireMockMode };
