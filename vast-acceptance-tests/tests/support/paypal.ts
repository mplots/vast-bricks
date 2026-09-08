import type { SettingsOverrides } from "./api-test";
import type { WireMockApi, WireMockValueMatcher } from "./wiremock";

/**
 * PayPal's own protocol, for the scenarios that read it: pointing the client at WireMock, the client-credentials
 * token it exchanges first, and stubbing the pages its page numbering walks.
 *
 * <p>It is one fixture rather than one per feature because two features read the same search — reconciliation maps
 * the paying transactions onto orders, and the PayPal transaction screen shows the whole ledger — and two copies of
 * a provider's paging would drift apart. What a transaction says is each scenario's own business and stays in its
 * own file.
 */

export const payPalClientId = "test-paypal-client-id";
export const payPalClientSecret = "test-paypal-client-secret";
export const payPalAccessToken = "test-paypal-access-token";

const payPalBasicAuth = Buffer.from(
  `${payPalClientId}:${payPalClientSecret}`,
).toString("base64");

/** Points the PayPal client at WireMock, under credentials the stubs below require it to send. */
export async function mockPayPalSettings(
  settings: SettingsOverrides,
  wireMock: WireMockApi,
) {
  await settings.set("VAST_PAYPAL_BASE_URL", wireMock.baseUrl);
  await settings.setSecret("VAST_PAYPAL_CLIENT_ID", payPalClientId);
  await settings.setSecret("VAST_PAYPAL_CLIENT_SECRET", payPalClientSecret);

  // Client credentials are asserted so a client that sends none misses the stub instead of passing unauthenticated.
  await wireMock.addMethodHostMapping("POST", "/v1/oauth2/token", {
    request: {
      headers: { Authorization: { equalTo: `Basic ${payPalBasicAuth}` } },
    },
    response: {
      json: {
        access_token: payPalAccessToken,
        token_type: "Bearer",
        expires_in: 32400,
      },
    },
  });
}

/**
 * Stubs what PayPal says the account held, one entry per currency.
 *
 * <p>PayPal answers for the balance at a stated moment, and the moment it is asked about is clamped to just short of
 * now, so this answers whatever moment the client asks about rather than pinning one.
 */
export async function stubPayPalBalances(
  wireMock: WireMockApi,
  held: [string, string][],
) {
  await wireMock.addMethodHostMapping("GET", "/v1/reporting/balances", {
    request: {
      headers: { Authorization: { equalTo: `Bearer ${payPalAccessToken}` } },
    },
    response: {
      json: {
        balances: held.map(([currency, value], index) => ({
          currency,
          primary: index === 0,
          total_balance: { currency_code: currency, value },
          available_balance: { currency_code: currency, value },
        })),
        account_id: "test-paypal-account",
        as_of_time: "2026-08-31T23:59:59Z",
      },
    },
  });
}

/**
 * Stubs one page of transactions per entry, keyed by the page number PayPal's paging sends.
 *
 * <p>PayPal searches a limited range in one request, so a window longer than that is asked for a segment at a time.
 * The scenario's transactions answer the first segment; every later segment falls through to the empty response
 * below rather than reporting the same transactions again, which would read as a second payment of every order.
 * `firstSegment` is what pins them to that segment where a scenario asserts the window it asked for.
 *
 * <p>The bearer token is asserted so a client that skipped the token exchange misses the stub.
 */
export async function stubPayPalTransactions(
  wireMock: WireMockApi,
  pages: Record<string, unknown>[][],
  firstSegment?: WireMockValueMatcher,
) {
  await wireMock.addMethodHostMapping("GET", "/v1/reporting/transactions", {
    priority: 10,
    request: {
      headers: { Authorization: { equalTo: `Bearer ${payPalAccessToken}` } },
    },
    response: {
      json: {
        transaction_details: [],
        account_number: "test-paypal-account",
        page: 1,
        total_items: 0,
        total_pages: 1,
      },
    },
  });

  for (const [pageIndex, page] of pages.entries()) {
    await wireMock.addMethodHostMapping("GET", "/v1/reporting/transactions", {
      request: {
        headers: { Authorization: { equalTo: `Bearer ${payPalAccessToken}` } },
        queryParameters: {
          page: { equalTo: String(pageIndex + 1) },
          ...(firstSegment === undefined ? {} : { start_date: firstSegment }),
        },
      },
      response: {
        json: {
          transaction_details: page,
          account_number: "test-paypal-account",
          page: pageIndex + 1,
          total_items: page.length,
          total_pages: pages.length,
        },
      },
    });
  }
}
