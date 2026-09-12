import type { APIRequestContext } from '@playwright/test';

import { expect } from './api-test';

/**
 * The provider accounts endpoint, as a scenario needs to reach it: one endpoint serves every provider, and what differs
 * between them is the `config` each one brings. These helpers assert the call succeeded, so a test that only needs
 * a configured provider account states that and nothing of how it got there. A scenario asserting a rejection calls the
 * endpoint directly instead, since it wants the failed response rather than a thrown assertion.
 */

export const providerAccountsEndpoint = '/api/private/provider-accounts';

/** One provider account as the endpoint states it. A secret is never part of it, only how long the stored one is. */
export type ProviderAccount = {
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

/** BrickLink carries both sets of credentials that reach one store: the store API's OAuth four, and the session
 * token the store pages are read with. */
export type BrickLinkConfig = {
  provider: 'BRICK_LINK';
  consumerKey: string;
  consumerSecret: string;
  tokenValue: string;
  tokenSecret: string;
  brickStoreToken: string;
};

export type BrickOwlConfig = {
  provider: 'BRICK_OWL';
  apiKey: string;
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

export function brickLinkConfig(overrides: Partial<BrickLinkConfig> = {}): BrickLinkConfig {
  return {
    provider: 'BRICK_LINK',
    consumerKey: 'bricklink-consumer-key',
    consumerSecret: 'bricklink-consumer-secret-value',
    tokenValue: 'bricklink-token-value',
    tokenSecret: 'bricklink-token-secret-value',
    brickStoreToken: 'brickstore-session-token-value',
    ...overrides
  };
}

/** Latvijas Pasts carries both ways one postal account is reached: the shipping API, and the self-service sign-in
 * used for the register that API does not expose. */
export type LatvijasPastsConfig = {
  provider: 'LATVIJAS_PASTS';
  apiUser: string;
  apiKey: string;
  username: string;
  password: string;
};

export type ManaKabataConfig = {
  provider: 'MANA_KABATA';
  apiToken: string;
};

export function latvijasPastsConfig(overrides: Partial<LatvijasPastsConfig> = {}): LatvijasPastsConfig {
  return {
    provider: 'LATVIJAS_PASTS',
    apiUser: 'manspasts-api-user',
    apiKey: 'manspasts-api-key-value',
    username: 'manspasts-user',
    password: 'manspasts-password-value',
    ...overrides
  };
}

export function manaKabataConfig(overrides: Partial<ManaKabataConfig> = {}): ManaKabataConfig {
  return { provider: 'MANA_KABATA', apiToken: 'manakabata-api-token-value', ...overrides };
}

export function brickOwlConfig(overrides: Partial<BrickOwlConfig> = {}): BrickOwlConfig {
  return { provider: 'BRICK_OWL', apiKey: 'brickowl-api-key-value', ...overrides };
}

/** Configures a provider account for the tenant being served. It is enabled unless the scenario says otherwise. */
export async function createProviderAccount(
  request: APIRequestContext,
  providerAccount: { name: string; enabled?: boolean; config: unknown },
): Promise<ProviderAccount> {
  const response = await request.post(providerAccountsEndpoint, {
    data: { enabled: true, ...providerAccount },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as ProviderAccount;
}

/**
 * Replaces a provider account outright, as the screen's save does. Every field is stated, including `enabled`, because
 * this is a replace rather than a patch - except a secret left blank, which keeps whatever is already stored.
 */
export async function updateProviderAccount(
  request: APIRequestContext,
  id: number,
  providerAccount: { name: string; enabled: boolean; config: unknown },
): Promise<ProviderAccount> {
  const response = await request.put(`${providerAccountsEndpoint}/${id}`, { data: providerAccount });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as ProviderAccount;
}

export async function listProviderAccounts(request: APIRequestContext): Promise<ProviderAccount[]> {
  const response = await request.get(providerAccountsEndpoint);
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as ProviderAccount[];
}

export async function readProviderAccount(request: APIRequestContext, id: number): Promise<ProviderAccount> {
  const response = await request.get(`${providerAccountsEndpoint}/${id}`);
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as ProviderAccount;
}

/** Restates the tenant's whole arrangement, as a rearranged screen does. */
export async function reorderProviderAccounts(request: APIRequestContext, ids: number[]): Promise<void> {
  const response = await request.put(`${providerAccountsEndpoint}/order`, { data: { ids } });
  expect(response.ok(), await response.text()).toBe(true);
}

export async function deleteProviderAccount(request: APIRequestContext, id: number): Promise<void> {
  const response = await request.delete(`${providerAccountsEndpoint}/${id}`);
  expect(response.ok(), await response.text()).toBe(true);
}
