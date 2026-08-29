import { Client } from 'pg';

const databaseIdentifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

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
  return `${quotedIdentifier(process.env.VAST_DB_SCHEMA ?? 'vast')}.settings_override`;
}

function quotedIdentifier(identifier: string): string {
  if (!databaseIdentifierPattern.test(identifier)) {
    throw new Error(`Unsupported database schema identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}
