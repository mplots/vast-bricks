import type { APIRequestContext, TestInfo } from '@playwright/test';

import type { SettingsOverrides } from './api-test';
import { WireMockApi } from './wiremock';

export async function mockBrickLinkOrders(
  settings: SettingsOverrides,
  request: APIRequestContext,
  testInfo: TestInfo,
  fullNameOrdersXml: string,
  usernameOrdersXml: string
) {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();
  await settings.set('VAST_BRICKSTORE_BASE_URL', wireMock.baseUrl);
  await settings.set('VAST_BRICKSTORE_SESSION_BASE_URL', wireMock.baseUrl);
  await settings.setSecret('VAST_BRICKSTORE_TOKEN', 'bricklink-client-token');
  await wireMock.addMethodHostMapping('POST', '/api/v1/actions/verify-and-create-session', {
    response: { json: { sessionToken: 'bricklink-session-token' } }
  });
  await wireMock.addMethodHostMapping('POST', '/orderExcelFinal.asp', {
    request: {
      bodyPatterns: [{ contains: 'useRealName=y' }]
    },
    response: {
      headers: { 'Content-Type': 'application/xml' },
      body: fullNameOrdersXml
    }
  });
  await wireMock.addMethodHostMapping('POST', '/orderExcelFinal.asp', {
    request: {
      bodyPatterns: [{ contains: 'useRealName=n' }]
    },
    response: {
      headers: { 'Content-Type': 'application/xml' },
      body: usernameOrdersXml
    }
  });
}
