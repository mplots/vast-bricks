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

/** What the account holds, as Stripe's balance endpoint states it: one entry per currency, in minor units. */
export type StripeHeldMock = { available?: [number, string][]; pending?: [number, string][] };

/** Stubs what Stripe says the account holds now, which is the one balance Stripe answers for. */
export async function stubStripeBalance(wireMock: WireMockApi, held: StripeHeldMock) {
  const money = (entries: [number, string][] = []) =>
    entries.map(([amount, currency]) => ({ amount, currency, source_types: {} }));
  await wireMock.addMethodHostMapping("GET", "/v1/balance", {
    request: {
      headers: { Authorization: { equalTo: `Bearer ${stripeSecretKey}` } },
    },
    response: {
      json: {
        object: "balance",
        livemode: false,
        available: money(held.available),
        pending: money(held.pending),
      },
    },
  });
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
  createdFrom?: WireMockValueMatcher,
) {
  // A window the scenario did not state its transactions for reports none. The Stripe ledger asks for a second
  // window when it works a closing balance back from what the account holds now, and without this it would be
  // answered with the period's own transactions and subtract them twice.
  await wireMock.addMethodHostMapping("GET", "/v1/balance_transactions", {
    priority: 10,
    request: {
      headers: { Authorization: { equalTo: `Bearer ${stripeSecretKey}` } },
    },
    response: {
      json: { object: "list", url: "/v1/balance_transactions", has_more: false, data: [] },
    },
  });

  let startingAfter: WireMockValueMatcher = { absent: true };
  for (const [pageIndex, page] of pages.entries()) {
    await wireMock.addMethodHostMapping("GET", "/v1/balance_transactions", {
      request: {
        headers: { Authorization: { equalTo: `Bearer ${stripeSecretKey}` } },
        queryParameters: {
          starting_after: startingAfter,
          ...(createdFrom === undefined ? {} : { "created[gte]": createdFrom }),
        },
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
