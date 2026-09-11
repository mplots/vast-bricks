import { expect, test } from '../support/api-test';
import {
  createDataSource,
  deleteDataSource,
  listDataSources,
  payPalConfig,
  readDataSource,
  stripeConfig,
  updateDataSource,
} from '../support/data-sources';

/**
 * The data sources screen's own endpoint: the provider accounts a tenant configures, created, listed, edited and
 * removed. One endpoint serves every provider - what differs is the `config` each one brings, and a provider's
 * secret is written but never read back, only measured.
 */

test('a data source is created, listed and read back, and its secret never comes back with it', async ({ request }) => {
  const config = payPalConfig();
  const created = await createDataSource(request, { name: 'Shop PayPal', config });

  expect(created).toMatchObject({ name: 'Shop PayPal', provider: 'PAYPAL', enabled: true });
  // The secret is written and never returned - its length is all the screen is told, so it can mask it.
  expect(created.config).toMatchObject({
    provider: 'PAYPAL',
    clientId: config.clientId,
    mode: 'SANDBOX',
    clientSecret: null,
    clientSecretLength: config.clientSecret.length,
  });

  expect(await listDataSources(request)).toEqual([created]);
  expect(await readDataSource(request, created.id)).toEqual(created);
});

test('editing a data source keeps the secret it was not asked to change', async ({ request }) => {
  const config = payPalConfig();
  const created = await createDataSource(request, { name: 'Shop PayPal', config });

  await updateDataSource(request, created.id, {
    name: 'Renamed PayPal',
    enabled: false,
    // Blank, because a secret is never read back to be resubmitted.
    config: payPalConfig({ clientId: 'a-different-client-id', clientSecret: '', mode: 'LIVE' }),
  });

  const updated = await readDataSource(request, created.id);
  expect(updated).toMatchObject({ name: 'Renamed PayPal', enabled: false });
  expect(updated.config).toMatchObject({
    clientId: 'a-different-client-id',
    mode: 'LIVE',
    clientSecretLength: config.clientSecret.length,
  });
});

test('supplying a new secret replaces the stored one', async ({ request }) => {
  const created = await createDataSource(request, { name: 'Shop PayPal', config: payPalConfig() });
  const replacement = 'a-longer-paypal-secret-value';

  await updateDataSource(request, created.id, {
    name: created.name,
    enabled: true,
    config: payPalConfig({ clientSecret: replacement }),
  });

  const updated = await readDataSource(request, created.id);
  expect(updated.config).toMatchObject({ clientSecret: null, clientSecretLength: replacement.length });
});

test('deleting a data source removes it', async ({ request }) => {
  const created = await createDataSource(request, { name: 'Shop PayPal', config: payPalConfig() });

  await deleteDataSource(request, created.id);

  expect(await listDataSources(request)).toEqual([]);
});

test('each provider brings its own config, and a tenant can configure several at once', async ({ request }) => {
  const config = stripeConfig();
  await createDataSource(request, { name: 'Shop PayPal', config: payPalConfig() });
  const stripe = await createDataSource(request, { name: 'Shop Stripe', config });

  // Stripe's config is its own shape: a secret key, and none of PayPal's fields.
  expect(stripe.config).toEqual({ provider: 'STRIPE', secretKey: null, secretKeyLength: config.secretKey.length });

  const listed = await listDataSources(request);
  expect(listed.map((dataSource) => dataSource.provider).sort()).toEqual(['PAYPAL', 'STRIPE']);
});
