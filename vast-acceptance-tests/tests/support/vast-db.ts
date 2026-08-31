import { Client } from 'pg';
import { createCipheriv, randomBytes } from 'node:crypto';

const databaseIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
const settingsEncryptionKeyEnv = 'VAST_SETTINGS_ENCRYPTION_KEY';
export const vastTestPassword = 'vast-playwright-password';
const vastTestPasswordHash = '$2y$12$7UNCtzivmQcahGUhaeNGueQ4MNwka2uvb0YUyxF9b25Xhy8CmusVy';

export type VastUser = {
  readonly id: number;
  readonly email: string;
  readonly name: string;
  readonly role: string;
};

export async function createVastUser(email: string): Promise<VastUser> {
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
    return { ...user, id: Number(user.id) };
  });
}

export async function deleteVastUser(id: number): Promise<void> {
  await withDatabaseClient(async (client) => {
    await client.query(`DELETE FROM ${vastTable('users')} WHERE id = $1`, [id]);
  });
}

export async function upsertSettingOverride(profile: string, settingKey: string, settingValue: string): Promise<void> {
  await withDatabaseClient(async (client) => {
    await client.query(
      `
        INSERT INTO ${settingsOverrideTable()} (profile, setting_key, setting_value)
        VALUES ($1, $2, $3)
        ON CONFLICT (profile, setting_key)
        DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_at = now()
      `,
      [profile, settingKey, settingValue],
    );
  });
}

export async function upsertSecretSettingOverride(
  profile: string,
  settingKey: string,
  settingValue: string,
): Promise<string> {
  const encryptedValue = encryptSettingValue(settingValue);
  await upsertSettingOverride(profile, settingKey, encryptedValue);
  return encryptedValue;
}

export async function findSettingOverride(profile: string, settingKey: string): Promise<string | null> {
  return withDatabaseClient(async (client) => {
    const result = await client.query<{ setting_value: string }>(
      `
        SELECT setting_value
        FROM ${settingsOverrideTable()}
        WHERE profile = $1 AND setting_key = $2
      `,
      [profile, settingKey],
    );

    return result.rows[0]?.setting_value ?? null;
  });
}

function encryptSettingValue(plaintext: string): string {
  const encodedKey = process.env[settingsEncryptionKeyEnv];
  if (!encodedKey) {
    throw new Error(`${settingsEncryptionKeyEnv} is required to write secret setting overrides.`);
  }

  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32) {
    throw new Error(`${settingsEncryptionKeyEnv} must be a base64-encoded 32-byte key.`);
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
    database: process.env.VAST_DB_NAME ?? 'bricks',
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
