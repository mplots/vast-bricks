import { expect, test } from './support/api-test';
import { WireMockApi, wireMockMode } from './support/wiremock';
import { findSettingOverride } from './support/vast-db';

test.describe.configure({ mode: wireMockMode() });

test('brickstore token endpoint stores an encrypted token used by raw order export', async ({
  request,
  settings,
}, testInfo) => {
  const wireMock = WireMockApi.forTest(request, testInfo);
  await wireMock.reset();

  await settings.set('VAST_BRICKSTORE_BASE_URL', wireMock.baseUrl);
  await settings.set('VAST_BRICKSTORE_SESSION_BASE_URL', wireMock.baseUrl);

  const tokenResponse = await request.post('/api/private/brickstore/token', {
    data: {
      token: ' playwright-client-token ',
    },
  });

  expect(tokenResponse.status(), await tokenResponse.text()).toBe(200);
  await expect(tokenResponse.json()).resolves.toEqual({
    status: 'ok',
  });

  const storedValue = await findSettingOverride(settings.profile, 'VAST_BRICKSTORE_TOKEN');
  expect(storedValue).not.toBeNull();
  expect(storedValue).toMatch(/^v1:[^:]+:[^:]+$/);
  expect(storedValue).not.toContain('playwright-client-token');

  await wireMock.addMethodHostMapping('POST', '/api/v1/actions/verify-and-create-session', {
    request: {
      bodyPatterns: [
        { contains: '"clientId":"ca629c09-4d8c-45dc-8a6f-bfb2b058f720"' },
        { contains: '"clientToken":"playwright-client-token"' },
      ],
    },
    response: {
      json: {
        sessionToken: 'playwright-session-token',
      },
    },
  });
  await wireMock.addMethodHostMapping('POST', '/orderExcelFinal.asp', {
    request: {
      headers: {
        'x-bl-tpa-client-id': {
          equalTo: 'ca629c09-4d8c-45dc-8a6f-bfb2b058f720',
        },
        'x-bl-session-token': {
          equalTo: 'playwright-session-token',
        },
      },
    },
    response: {
      headers: {
        'Content-Type': 'application/xml',
      },
      body: '<brickstore-response><status>raw</status></brickstore-response>',
    },
  });

  const response = await request.post('/api/private/brickstore/order-export', {
    headers: {
      Accept: 'application/xml',
    },
  });

  expect(response.status(), await response.text()).toBe(200);
  expect(await response.text()).toBe('<brickstore-response><status>raw</status></brickstore-response>');

  const orderExportRequests = await wireMock.findMethodHostRequests('POST', '/orderExcelFinal.asp');
  expect(orderExportRequests).toHaveLength(1);
  const form = orderExportRequests[0].form();
  expect(form.get('orderType')).toBe('received');
  expect(form.get('viewType')).toBe('X');
});
