import { Client } from 'pg';
import { createCipheriv, randomBytes } from 'node:crypto';

const databaseIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const setupEncryptionKeyEnv = 'VAST_SETUP_ENCRYPTION_KEY';
export const vastTestPassword = 'vast-playwright-password';
const vastTestPasswordHash = '$2y$12$7UNCtzivmQcahGUhaeNGueQ4MNwka2uvb0YUyxF9b25Xhy8CmusVy';

export type VastUser = {
  readonly id: number;
  readonly email: string;
  readonly name: string;
  readonly role: string;
};

export type VastTenant = {
  readonly id: number;
  readonly code: string;
};

/** Teardown only. Cascades to every tenant-owned row the scenario wrote, whatever tables those are. */
export async function deleteVastTenant(id: number): Promise<void> {
  await withDatabaseClient(async (client) => {
    await client.query(`DELETE FROM ${vastTable('tenants')} WHERE id = $1`, [id]);
  });
}

export async function createVastUser(email: string, tenantId: number): Promise<VastUser> {
  return withDatabaseClient(async (client) => {
    const result = await client.query<VastUser>(
      `
        INSERT INTO ${vastTable('users')} (email, password_hash, name, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, name, role
      `,
      [email, vastTestPasswordHash, 'Playwright User', 'user'],
    );

    const user = result.rows[0]!;
    await client.query(
      `INSERT INTO ${vastTable('user_tenants')} (user_id, tenant_id) VALUES ($1, $2)`,
      [user.id, tenantId],
    );
    return { ...user, id: Number(user.id) };
  });
}

export async function deleteVastUser(id: number): Promise<void> {
  await withDatabaseClient(async (client) => {
    await client.query(`DELETE FROM ${vastTable('users')} WHERE id = $1`, [id]);
  });
}

export async function upsertSettingOverride(tenantId: number, settingKey: string, settingValue: string): Promise<void> {
  await withDatabaseClient(async (client) => {
    await client.query(
      `
        INSERT INTO ${settingsOverrideTable()} (tenant_id, setting_key, setting_value)
        VALUES ($1, $2, $3)
        ON CONFLICT (tenant_id, setting_key)
        DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_at = now()
      `,
      [tenantId, settingKey, settingValue],
    );
  });
}

export async function upsertSecretSettingOverride(
  tenantId: number,
  settingKey: string,
  settingValue: string,
): Promise<string> {
  const encryptedValue = encryptSettingValue(settingValue);
  await upsertSettingOverride(tenantId, settingKey, encryptedValue);
  return encryptedValue;
}

export async function findSettingOverride(tenantId: number, settingKey: string): Promise<string | null> {
  return withDatabaseClient(async (client) => {
    const result = await client.query<{ setting_value: string }>(
      `
        SELECT setting_value
        FROM ${settingsOverrideTable()}
        WHERE tenant_id = $1 AND setting_key = $2
      `,
      [tenantId, settingKey],
    );

    return result.rows[0]?.setting_value ?? null;
  });
}

export type VastCurrencyRate = {
  readonly currency: string;
  readonly rateDate: string;
  readonly rate: string;
};

/**
 * The currency rates the sync stored for one date, read directly because the table is global rather than
 * tenant-owned: there is no scenario to scope a `GET` to, and the job's own tally is all its endpoints answer.
 */
export async function findCurrencyRates(rateDate: string): Promise<VastCurrencyRate[]> {
  return withDatabaseClient(async (client) => {
    const result = await client.query<{ currency: string; rate_date: string; rate: string }>(
      `
        SELECT currency, to_char(rate_date, 'YYYY-MM-DD') AS rate_date, rate
        FROM ${vastTable('currency_rates')}
        WHERE rate_date = $1
        ORDER BY currency
      `,
      [rateDate],
    );
    return result.rows.map((row) => ({ currency: row.currency, rateDate: row.rate_date, rate: row.rate }));
  });
}

/**
 * Backdates a key's expiry so a scenario can assert that an expired key stops authenticating. Expiry is a wall-clock
 * fact with no API that can bring it forward, which is the one thing here the public surface cannot set up.
 */
export async function expireVastApiKey(id: number): Promise<void> {
  await withDatabaseClient(async (client) => {
    await client.query(`UPDATE ${vastTable('api_keys')} SET expires_at = now() - interval '1 minute' WHERE id = $1`, [
      id,
    ]);
  });
}

function encryptSettingValue(plaintext: string): string {
  const encodedKey = process.env[setupEncryptionKeyEnv];
  if (!encodedKey) {
    throw new Error(`${setupEncryptionKeyEnv} is required to write secret setting overrides.`);
  }

  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) {
    throw new Error(`${setupEncryptionKeyEnv} must be a base64-encoded 32-byte key.`);
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return `v1:${iv.toString('base64')}:${ciphertext.toString('base64')}`;
}

async function withDatabaseClient<T>(callback: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    host: process.env.VAST_DB_HOST ?? '127.0.0.1',
    port: Number.parseInt(process.env.VAST_DB_PORT ?? '2345', 10),
    // The acceptance database, never the developer's `bricks`. `./vast test` states it too, but the default is what
    // protects a suite run straight through Playwright: a scenario that could reach `bricks` would create tenants
    // and settings in the data the developer works against, and would delete them from it too.
    database: process.env.VAST_DB_NAME ?? 'bricks_test',
    user: process.env.VAST_DB_USERNAME ?? 'bricks',
    password: process.env.VAST_DB_PASSWORD ?? 'bricks',
  });

  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

function settingsOverrideTable(): string {
  return vastTable('settings_override');
}

function vastTable(table: string): string {
  return `${quotedIdentifier(process.env.VAST_DB_SCHEMA ?? 'vast')}.${table}`;
}

function quotedIdentifier(identifier: string): string {
  if (!databaseIdentifierPattern.test(identifier)) {
    throw new Error(`Unsupported database schema identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}
