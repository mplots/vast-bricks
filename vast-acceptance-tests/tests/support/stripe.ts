import type { SettingsOverrides } from "./api-test";
import type { WireMockValueMatcher } from "./wiremock";
import { WireMockApi } from "./wiremock";

/**
 * Stripe's own protocol, for the scenarios that read it: pointing the client at WireMock, and stubbing the pages its
 * cursor paging walks.
 *
 * <p>It is one fixture rather than one per feature because two features read the same endpoint — reconciliation maps
 * the paying transactions onto orders, and the Stripe transaction screen shows the whole ledger — and two copies of
 * a provider's paging would drift apart. What a transaction says is each scenario's own business and stays in its
 * own file.
 */

export const stripeSecretKey = "test-stripe-secret-key";
export const stripeAccountId = "acct_test-stripe-account";

/** Points the Stripe client at WireMock, under a key the stubs below require it to send. */
export async function mockStripeSettings(
  settings: SettingsOverrides,
  wireMock: WireMockApi,
) {
  await settings.set("VAST_STRIPE_BASE_URL", wireMock.baseUrl);
  await settings.set("VAST_STRIPE_ACCOUNT_ID", stripeAccountId);
  await settings.setSecret("VAST_STRIPE_SECRET_KEY", stripeSecretKey);
}

/**
 * Stubs one page of balance transactions per entry, keyed by the cursor Stripe's paging sends: the first page is
 * asked for without one, and each page after it names the last transaction of the page before.
 *
 * <p>The key is asserted so a client that sends none misses the stub instead of passing unauthenticated.
 */
export async function stubStripeBalanceTransactions(
  wireMock: WireMockApi,
  pages: Record<string, unknown>[][],
) {
  let startingAfter: WireMockValueMatcher = { absent: true };
  for (const [pageIndex, page] of pages.entries()) {
    await wireMock.addMethodHostMapping("GET", "/v1/balance_transactions", {
      request: {
        headers: { Authorization: { equalTo: `Bearer ${stripeSecretKey}` } },
        queryParameters: { starting_after: startingAfter },
      },
      response: {
        json: {
          object: "list",
          url: "/v1/balance_transactions",
          has_more: pageIndex < pages.length - 1,
          data: page,
        },
      },
    });
    if (page.length > 0) {
      startingAfter = { equalTo: String(page[page.length - 1].id) };
    }
  }
}
