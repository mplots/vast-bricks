import { expect, test } from '../support/api-test';
import {
  type OperatingPeriod,
  brickLinkConfig,
  brickOwlConfig,
  createProviderAccount,
  latvijasPastsConfig,
  manaKabataConfig,
  deleteProviderAccount,
  listProviderAccounts,
  payPalConfig,
  providerAccountsEndpoint,
  readProviderAccount,
  reorderProviderAccounts,
  stripeConfig,
  updateProviderAccount,
} from '../support/provider-accounts';

/**
 * The provider accounts screen's own endpoint: the accounts a tenant configures, created, listed, edited and
 * removed. One endpoint serves every provider - what differs is the `config` each one brings, and a provider's
 * secret is written but never read back, only measured.
 */

test('a provider account is created, listed and read back, and its secret never comes back with it', async ({ request }) => {
  const config = payPalConfig();
  const created = await createProviderAccount(request, { name: 'Shop PayPal', config });

  expect(created).toMatchObject({ name: 'Shop PayPal', provider: 'PAYPAL', enabled: true });
  // The secret is written and never returned - its length is all the screen is told, so it can mask it.
  expect(created.config).toMatchObject({
    provider: 'PAYPAL',
    clientId: config.clientId,
    mode: 'SANDBOX',
    clientSecret: null,
    clientSecretLength: config.clientSecret.length,
  });

  expect(await listProviderAccounts(request)).toEqual([created]);
  expect(await readProviderAccount(request, created.id)).toEqual(created);
});

test('editing a provider account keeps the secret it was not asked to change', async ({ request }) => {
  const config = payPalConfig();
  const created = await createProviderAccount(request, { name: 'Shop PayPal', config });

  await updateProviderAccount(request, created.id, {
    name: 'Renamed PayPal',
    enabled: false,
    // Blank, because a secret is never read back to be resubmitted.
    config: payPalConfig({ clientId: 'a-different-client-id', clientSecret: '', mode: 'LIVE' }),
  });

  const updated = await readProviderAccount(request, created.id);
  expect(updated).toMatchObject({ name: 'Renamed PayPal', enabled: false });
  expect(updated.config).toMatchObject({
    clientId: 'a-different-client-id',
    mode: 'LIVE',
    clientSecretLength: config.clientSecret.length,
  });
});

test('supplying a new secret replaces the stored one', async ({ request }) => {
  const created = await createProviderAccount(request, { name: 'Shop PayPal', config: payPalConfig() });
  const replacement = 'a-longer-paypal-secret-value';

  await updateProviderAccount(request, created.id, {
    name: created.name,
    enabled: true,
    config: payPalConfig({ clientSecret: replacement }),
  });

  const updated = await readProviderAccount(request, created.id);
  expect(updated.config).toMatchObject({ clientSecret: null, clientSecretLength: replacement.length });
});

test('deleting a provider account removes it', async ({ request }) => {
  const created = await createProviderAccount(request, { name: 'Shop PayPal', config: payPalConfig() });

  await deleteProviderAccount(request, created.id);

  expect(await listProviderAccounts(request)).toEqual([]);
});

test('each provider brings its own config, and a tenant can configure several at once', async ({ request }) => {
  const config = stripeConfig();
  await createProviderAccount(request, { name: 'Shop PayPal', config: payPalConfig() });
  const stripe = await createProviderAccount(request, { name: 'Shop Stripe', config });

  // Stripe's config is its own shape: a secret key, and none of PayPal's fields.
  expect(stripe.config).toEqual({ provider: 'STRIPE', secretKey: null, secretKeyLength: config.secretKey.length });

  const listed = await listProviderAccounts(request);
  expect(listed.map((providerAccount) => providerAccount.provider).sort()).toEqual(['PAYPAL', 'STRIPE']);
});

test("a BrickLink account carries both of the store's credential sets, and measures every one of them", async ({ request }) => {
  const config = brickLinkConfig();
  const created = await createProviderAccount(request, { name: 'Shop BrickLink', config });

  // The store API's OAuth four and the store pages' session token are one account, because they reach one store.
  expect(created.config).toEqual({
    provider: 'BRICK_LINK',
    consumerKey: null,
    consumerSecret: null,
    tokenValue: null,
    tokenSecret: null,
    brickStoreToken: null,
    consumerKeyLength: config.consumerKey.length,
    consumerSecretLength: config.consumerSecret.length,
    tokenValueLength: config.tokenValue.length,
    tokenSecretLength: config.tokenSecret.length,
    brickStoreTokenLength: config.brickStoreToken.length,
    // A store's operating period lives with the store's own credentials, and is stated by no other provider.
    operatingPeriod: null
  });
});

test('editing a BrickLink account replaces only the credentials it was given', async ({ request }) => {
  const config = brickLinkConfig();
  const created = await createProviderAccount(request, { name: 'Shop BrickLink', config });
  const replacement = 'a-much-longer-brickstore-session-token';

  // Every other secret is blank, which keeps what is stored - only the session token is being rotated.
  await updateProviderAccount(request, created.id, {
    name: created.name,
    enabled: true,
    config: brickLinkConfig({ consumerKey: '', consumerSecret: '', tokenValue: '', tokenSecret: '', brickStoreToken: replacement })
  });

  const updated = await readProviderAccount(request, created.id);
  expect(updated.config).toMatchObject({
    brickStoreTokenLength: replacement.length,
    consumerKeyLength: config.consumerKey.length,
    tokenSecretLength: config.tokenSecret.length
  });
});

test("a BrickOwl account is its own shape, and none of BrickLink's fields", async ({ request }) => {
  const config = brickOwlConfig();
  const created = await createProviderAccount(request, { name: 'Shop BrickOwl', config });

  expect(created).toMatchObject({ provider: 'BRICK_OWL' });
  expect(created.config).toEqual({
    provider: 'BRICK_OWL',
    apiKey: null,
    apiKeyLength: config.apiKey.length,
    operatingPeriod: null
  });
});

test('accounts are listed in the order they were made, and a new one joins the end', async ({ request }) => {
  // Named so that creation order and alphabetical order disagree - listing them alphabetically would say Three second.
  const one = await createProviderAccount(request, { name: 'One', config: stripeConfig() });
  const two = await createProviderAccount(request, { name: 'Two', config: payPalConfig() });
  const three = await createProviderAccount(request, { name: 'Three', config: brickOwlConfig() });

  const listed = await listProviderAccounts(request);
  expect(listed.map((account) => account.id)).toEqual([one.id, two.id, three.id]);
});

test('a rearranged list stays rearranged', async ({ request }) => {
  const one = await createProviderAccount(request, { name: 'One', config: stripeConfig() });
  const two = await createProviderAccount(request, { name: 'Two', config: payPalConfig() });
  const three = await createProviderAccount(request, { name: 'Three', config: brickOwlConfig() });

  await reorderProviderAccounts(request, [three.id, one.id, two.id]);

  const listed = await listProviderAccounts(request);
  expect(listed.map((account) => account.name)).toEqual(['Three', 'One', 'Two']);
});

test('an account made after a rearrangement still joins the end', async ({ request }) => {
  const one = await createProviderAccount(request, { name: 'One', config: stripeConfig() });
  const two = await createProviderAccount(request, { name: 'Two', config: payPalConfig() });
  await reorderProviderAccounts(request, [two.id, one.id]);

  await createProviderAccount(request, { name: 'Three', config: brickOwlConfig() });

  const listed = await listProviderAccounts(request);
  expect(listed.map((account) => account.name)).toEqual(['Two', 'One', 'Three']);
});

test('an order that does not name every account exactly once is refused, and nothing moves', async ({ request }) => {
  const one = await createProviderAccount(request, { name: 'One', config: stripeConfig() });
  const two = await createProviderAccount(request, { name: 'Two', config: payPalConfig() });

  const partial = await request.put('/api/private/provider-accounts/order', { data: { ids: [two.id] } });
  expect(partial.ok()).toBe(false);

  const duplicated = await request.put('/api/private/provider-accounts/order', { data: { ids: [two.id, two.id] } });
  expect(duplicated.ok()).toBe(false);

  const listed = await listProviderAccounts(request);
  expect(listed.map((account) => account.id)).toEqual([one.id, two.id]);
});

test("another tenant's account cannot be moved into this tenant's order", async ({ request, otherTenant }) => {
  const mine = await createProviderAccount(request, { name: 'Mine', config: stripeConfig() });
  const theirs = await createProviderAccount(otherTenant.request, { name: 'Theirs', config: stripeConfig() });

  // The id is real, and reordering writes by primary key - the tenant is what must keep it out of reach.
  const attempt = await request.put('/api/private/provider-accounts/order', { data: { ids: [theirs.id, mine.id] } });
  expect(attempt.ok()).toBe(false);

  expect((await listProviderAccounts(request)).map((account) => account.name)).toEqual(['Mine']);
  expect((await listProviderAccounts(otherTenant.request)).map((account) => account.name)).toEqual(['Theirs']);
});

test('a Latvijas Pasts account holds both ways into one postal account, and shows none of them back', async ({ request }) => {
  const config = latvijasPastsConfig();
  const created = await createProviderAccount(request, { name: 'Shop post', config });

  // The shipping API's credentials and the self-service sign-in are one account, because they reach one account.
  // Each identifying half names a real postal account, so it is measured rather than shown, as the secrets are.
  expect(created.config).toEqual({
    provider: 'LATVIJAS_PASTS',
    apiUser: null,
    apiKey: null,
    username: null,
    password: null,
    apiUserLength: config.apiUser.length,
    apiKeyLength: config.apiKey.length,
    usernameLength: config.username.length,
    passwordLength: config.password.length
  });
});

test('editing a Latvijas Pasts account replaces only the credentials it was given', async ({ request }) => {
  const config = latvijasPastsConfig();
  const created = await createProviderAccount(request, { name: 'Shop post', config });
  const replacement = 'a-much-longer-manspasts-api-key';

  // Only the API key is being rotated; the sign-in is left blank, which keeps what is stored.
  await updateProviderAccount(request, created.id, {
    name: created.name,
    enabled: true,
    config: latvijasPastsConfig({ apiUser: '', apiKey: replacement, username: '', password: '' })
  });

  const updated = await readProviderAccount(request, created.id);
  expect(updated.config).toMatchObject({
    apiKeyLength: replacement.length,
    apiUserLength: config.apiUser.length,
    usernameLength: config.username.length,
    passwordLength: config.password.length
  });
});

test('a Mana Kabata account is its own shape, and none of Latvijas Pasts fields', async ({ request }) => {
  const config = manaKabataConfig();
  const created = await createProviderAccount(request, { name: 'Shop accounting', config });

  expect(created).toMatchObject({ provider: 'MANA_KABATA' });
  expect(created.config).toEqual({ provider: 'MANA_KABATA', apiToken: null, apiTokenLength: config.apiToken.length });
});

test('a store account is created with an operating period and reads it back with its config', async ({ request }) => {
  const operatingPeriod: OperatingPeriod = { from: '2019-03-01', to: '2022-12-31' };
  const created = await createProviderAccount(request, {
    name: 'Shop BrickLink',
    config: brickLinkConfig({ operatingPeriod }),
  });

  expect(created.config).toMatchObject({ operatingPeriod });
  expect((await readProviderAccount(request, created.id)).config).toMatchObject({ operatingPeriod });
  expect((await listProviderAccounts(request))[0].config).toMatchObject({ operatingPeriod });
});

test('an operating period may be open at either end, and a store may state none at all', async ({ request }) => {
  // Still selling: an unstated end is not a missing half of a range, it is a store that has not closed.
  const ongoing = await createProviderAccount(request, {
    name: 'Shop BrickOwl',
    config: brickOwlConfig({ operatingPeriod: { from: '2020-01-01', to: null } }),
  });
  expect(ongoing.config).toMatchObject({ operatingPeriod: { from: '2020-01-01', to: null } });

  // Null, never an empty period: a store that has said nothing about its dates takes every order it holds.
  const unrestricted = await createProviderAccount(request, { name: 'Shop BrickLink', config: brickLinkConfig() });
  expect(unrestricted.config).toMatchObject({ operatingPeriod: null });
});

test('a store account saved with neither date keeps no operating period', async ({ request }) => {
  const created = await createProviderAccount(request, {
    name: 'Shop BrickLink',
    config: brickLinkConfig({ operatingPeriod: { from: '2023-06-01', to: null } }),
  });

  // A period is not a secret: a blank one is cleared rather than kept, so a form with both pickers emptied says
  // exactly what a store that never stated a period says.
  const cleared = await updateProviderAccount(request, created.id, {
    name: created.name,
    enabled: true,
    config: brickLinkConfig({
      consumerKey: '',
      consumerSecret: '',
      tokenValue: '',
      tokenSecret: '',
      brickStoreToken: '',
      operatingPeriod: { from: null, to: null },
    }),
  });

  expect(cleared.config).toMatchObject({ operatingPeriod: null });
});

test('a reversed operating period is refused, and the stored one stays', async ({ request }) => {
  const operatingPeriod: OperatingPeriod = { from: '2019-03-01', to: '2022-12-31' };
  const created = await createProviderAccount(request, {
    name: 'Shop BrickOwl',
    config: brickOwlConfig({ operatingPeriod }),
  });

  const response = await request.put(`${providerAccountsEndpoint}/${created.id}`, {
    data: {
      name: created.name,
      enabled: true,
      config: brickOwlConfig({ apiKey: '', operatingPeriod: { from: '2024-06-01', to: '2024-01-01' } }),
    },
  });
  expect(response.ok(), await response.text()).toBe(false);
  expect((await readProviderAccount(request, created.id)).config).toMatchObject({ operatingPeriod });
});

test('a second account is refused for every provider but the payment gateways', async ({ request }) => {
  // A store, a postal contract and an accounting login are each a party a tenant deals with once, so a second
  // account with one of them would be the same party configured twice.
  for (const config of [brickLinkConfig(), brickOwlConfig(), latvijasPastsConfig(), manaKabataConfig()]) {
    await createProviderAccount(request, { name: `First ${config.provider}`, config });

    const second = await request.post(providerAccountsEndpoint, {
      data: { name: `Second ${config.provider}`, enabled: true, config },
    });
    expect(second.ok(), await second.text()).toBe(false);
  }

  // A store collects through as many gateway accounts as it has opened, and which one an order was paid into is a
  // fact about that order.
  await createProviderAccount(request, { name: 'Shop PayPal', config: payPalConfig() });
  await createProviderAccount(request, { name: 'Second PayPal', config: payPalConfig() });
  await createProviderAccount(request, { name: 'Shop Stripe', config: stripeConfig() });
  await createProviderAccount(request, { name: 'Second Stripe', config: stripeConfig() });

  expect((await listProviderAccounts(request)).map((account) => account.provider).sort()).toEqual([
    'BRICK_LINK',
    'BRICK_OWL',
    'LATVIJAS_PASTS',
    'MANA_KABATA',
    'PAYPAL',
    'PAYPAL',
    'STRIPE',
    'STRIPE',
  ]);
});
