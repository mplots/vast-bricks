import type { APIRequestContext } from '@playwright/test';

import { expect } from './api-test';

/**
 * The data sources endpoint, as a scenario needs to reach it: one endpoint serves every provider, and what differs
 * between them is the `config` each one brings. These helpers assert the call succeeded, so a test that only needs
 * a configured data source states that and nothing of how it got there. A scenario asserting a rejection calls the
 * endpoint directly instead, since it wants the failed response rather than a thrown assertion.
 */

export const dataSourcesEndpoint = '/api/private/data-sources';

/** One data source as the endpoint states it. A secret is never part of it, only how long the stored one is. */
export type DataSource = {
  id: number;
  name: string;
  provider: string;
  enabled: boolean;
  config: Record<string, unknown>;
};

export type PayPalConfig = {
  provider: 'PAYPAL';
  clientId: string;
  clientSecret: string;
  mode: 'SANDBOX' | 'LIVE';
};

export type StripeConfig = {
  provider: 'STRIPE';
  secretKey: string;
};

export function payPalConfig(overrides: Partial<PayPalConfig> = {}): PayPalConfig {
  return {
    provider: 'PAYPAL',
    clientId: 'paypal-client-id-for-tests',
    clientSecret: 'paypal-secret-value',
    mode: 'SANDBOX',
    ...overrides,
  };
}

export function stripeConfig(overrides: Partial<StripeConfig> = {}): StripeConfig {
  return { provider: 'STRIPE', secretKey: 'stripe-secret-key-value', ...overrides };
}

/** Configures a data source for the tenant being served. It is enabled unless the scenario says otherwise. */
export async function createDataSource(
  request: APIRequestContext,
  dataSource: { name: string; enabled?: boolean; config: unknown },
): Promise<DataSource> {
  const response = await request.post(dataSourcesEndpoint, {
    data: { enabled: true, ...dataSource },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as DataSource;
}

/**
 * Replaces a data source outright, as the screen's save does. Every field is stated, including `enabled`, because
 * this is a replace rather than a patch - except a secret left blank, which keeps whatever is already stored.
 */
export async function updateDataSource(
  request: APIRequestContext,
  id: number,
  dataSource: { name: string; enabled: boolean; config: unknown },
): Promise<DataSource> {
  const response = await request.put(`${dataSourcesEndpoint}/${id}`, { data: dataSource });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as DataSource;
}

export async function listDataSources(request: APIRequestContext): Promise<DataSource[]> {
  const response = await request.get(dataSourcesEndpoint);
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as DataSource[];
}

export async function readDataSource(request: APIRequestContext, id: number): Promise<DataSource> {
  const response = await request.get(`${dataSourcesEndpoint}/${id}`);
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as DataSource;
}

export async function deleteDataSource(request: APIRequestContext, id: number): Promise<void> {
  const response = await request.delete(`${dataSourcesEndpoint}/${id}`);
  expect(response.ok(), await response.text()).toBe(true);
}
