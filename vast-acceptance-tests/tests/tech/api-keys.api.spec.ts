import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';

import { expect, test } from '../support/api-test';
import { expireVastApiKey } from '../support/vast-db';

type ApiKeyItem = {
  id: number;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  expired: boolean;
  /** Only ever set on the generation response. A read of a key never carries the secret. */
  token?: string;
};

type GeneratedApiKey = ApiKeyItem & { token: string };

async function generateKey(
  request: APIRequestContext,
  name: string,
  expiresInDays?: number,
): Promise<GeneratedApiKey> {
  const response = await request.post('/api/private/account/api-keys', {
    data: expiresInDays === undefined ? { name } : { name, expiresInDays },
  });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as GeneratedApiKey;
}

/** A request carrying only the key, exactly as an external program sends it: no login, no token. */
function keyRequest(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string | undefined,
  token: string,
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Accept: 'application/json', 'X-Api-Key': token },
  });
}

test('a generated key authenticates a private request as the user and store it was generated for', async ({
  authentication,
  request,
  baseURL,
  playwright,
}) => {
  const generated = await generateKey(request, 'bricklink-extension');
  const machine = await keyRequest(playwright, baseURL, generated.token);

  try {
    const response = await machine.get('/api/private/account/me');

    expect(response.status(), await response.text()).toBe(200);
    // The same answer a login token gets: a key is its issuing user, serving the store it was generated under.
    await expect(response.json()).resolves.toMatchObject({
      user: authentication.user,
      tenant: { id: authentication.tenant.id, code: authentication.tenant.code },
    });
  } finally {
    await machine.dispose();
  }
});

test('the secret is returned once and never read back, leaving only a prefix to recognise the key by', async ({
  request,
}) => {
  const generated = await generateKey(request, 'bricksync');

  expect(generated.token.startsWith('vb_')).toBe(true);
  expect(generated.tokenPrefix).toBe(generated.token.slice(0, 11));
  expect(generated.expiresAt).toBeNull();

  const listed = await request.get('/api/private/account/api-keys');
  expect(listed.status(), await listed.text()).toBe(200);
  const keys = (await listed.json()) as ApiKeyItem[];

  expect(keys).toHaveLength(1);
  expect(keys[0]).toMatchObject({ id: generated.id, name: 'bricksync', tokenPrefix: generated.tokenPrefix });
  expect(keys[0]!.token).toBeUndefined();
});

test('revoking a key stops it authenticating', async ({ request, baseURL, playwright }) => {
  const generated = await generateKey(request, 'retired-extension');
  const machine = await keyRequest(playwright, baseURL, generated.token);

  try {
    expect((await machine.get('/api/private/account/me')).status()).toBe(200);

    const revoked = await request.delete(`/api/private/account/api-keys/${generated.id}`);
    expect(revoked.status(), await revoked.text()).toBe(200);

    expect((await machine.get('/api/private/account/me')).status()).toBe(401);
    await expect((await request.get('/api/private/account/api-keys')).json()).resolves.toEqual([]);
  } finally {
    await machine.dispose();
  }
});

test('an expired key stops authenticating without being revoked', async ({ request, baseURL, playwright }) => {
  const generated = await generateKey(request, 'short-lived', 30);
  expect(generated.expiresAt).not.toBeNull();

  const machine = await keyRequest(playwright, baseURL, generated.token);
  try {
    expect((await machine.get('/api/private/account/me')).status()).toBe(200);

    await expireVastApiKey(generated.id);

    expect((await machine.get('/api/private/account/me')).status()).toBe(401);
    // The row stays until it is revoked, so its owner can see which key stopped and why.
    const keys = (await (await request.get('/api/private/account/api-keys')).json()) as ApiKeyItem[];
    expect(keys[0]).toMatchObject({ id: generated.id, expired: true });
  } finally {
    await machine.dispose();
  }
});

test('a key nobody generated authenticates nothing', async ({ baseURL, playwright }) => {
  const machine = await keyRequest(playwright, baseURL, 'vb_notakeythatwaseverissuedatall');

  try {
    expect((await machine.get('/api/private/account/me')).status()).toBe(401);
  } finally {
    await machine.dispose();
  }
});

test('a key reaches only the store it was generated for, and only its own keys', async ({
  request,
  otherTenant,
  baseURL,
  playwright,
}) => {
  const ours = await generateKey(request, 'ours');
  const theirs = await generateKey(otherTenant.request, 'theirs');

  const machine = await keyRequest(playwright, baseURL, theirs.token);
  try {
    const response = await machine.get('/api/private/account/me');

    expect(response.status(), await response.text()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ tenant: { id: otherTenant.tenant.id } });

    const theirKeys = (await (await machine.get('/api/private/account/api-keys')).json()) as ApiKeyItem[];
    expect(theirKeys.map((key) => key.id)).toEqual([theirs.id]);

    // Their key cannot revoke ours, and the answer says no such key rather than admitting it exists.
    expect((await machine.delete(`/api/private/account/api-keys/${ours.id}`)).status()).toBe(404);
  } finally {
    await machine.dispose();
  }
});

test('a key needs a name of its own, so the one to revoke can be told from the rest', async ({ request }) => {
  const unnamed = await request.post('/api/private/account/api-keys', { data: { name: '  ' } });
  expect(unnamed.status()).toBe(400);

  await generateKey(request, 'duplicate');
  const again = await request.post('/api/private/account/api-keys', { data: { name: 'Duplicate' } });
  expect(again.status()).toBe(400);
  await expect(again.json()).resolves.toMatchObject({ detail: "A key named 'Duplicate' already exists." });
});
