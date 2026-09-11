import { createCipheriv, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";

/**
 * The tenant a browser signs into on vast-portal-test: one whose every provider is the managed WireMock.
 *
 * <p>It has to be a tenant rather than the acceptance runtime's own environment, because an environment value wins
 * over a database override by design — setting a provider there would take the settings away from every scenario
 * that overrides it. So the mocked providers are one tenant's rows, exactly as a scenario's are, and the scenarios
 * carry on reading their own.
 *
 * <p>It is seeded here rather than by the local Flyway data, which cannot encrypt a secret with the runtime's key
 * and which the deployable runtime applies to the same database.
 */

export const mockedTenantCode = "wiremock";
export const mockedTenantEmail = "wiremock@vastbricks.test";
export const mockedTenantPassword = "wiremock";

const wireMockBaseUrl = "http://127.0.0.1:9011";

/**
 * What the tenant reaches, and under what name. The credentials are plainly nobody's: they exist because a client
 * refuses to call a provider it holds no credential for, so a base URL alone would leave the screens unable to read
 * a stub at all. A stub written by hand matches on the path rather than on these, so they are never worth quoting.
 */
const mockedSettings = {
  VAST_BRICKLINK_BASE_URL: { value: wireMockBaseUrl },
  VAST_BRICKLINK_CONSUMER_KEY: { value: "mocked-bricklink-consumer-key", secret: true },
  VAST_BRICKLINK_CONSUMER_SECRET: { value: "mocked-bricklink-consumer-secret", secret: true },
  VAST_BRICKLINK_TOKEN_VALUE: { value: "mocked-bricklink-token-value", secret: true },
  VAST_BRICKLINK_TOKEN_SECRET: { value: "mocked-bricklink-token-secret", secret: true },
  VAST_BRICKSTORE_BASE_URL: { value: wireMockBaseUrl },
  VAST_BRICKSTORE_SESSION_BASE_URL: { value: wireMockBaseUrl },
  VAST_BRICKSTORE_TOKEN: { value: "mocked-brickstore-token", secret: true },
  VAST_BRICKOWL_BASE_URL: { value: wireMockBaseUrl },
  VAST_BRICKOWL_API_KEY: { value: "mocked-brickowl-api-key", secret: true },
  VAST_MANAKABATA_BASE_URL: { value: wireMockBaseUrl },
  VAST_MANAKABATA_API_TOKEN: { value: "mocked-manakabata-api-token", secret: true },
  VAST_MANSPASTS_BASE_URL: { value: wireMockBaseUrl },
  VAST_MANSPASTS_USERNAME: { value: "mocked-manspasts-username", secret: true },
  VAST_MANSPASTS_PASSWORD: { value: "mocked-manspasts-password", secret: true },
  VAST_PAYPAL_BASE_URL: { value: wireMockBaseUrl },
  VAST_PAYPAL_CLIENT_ID: { value: "mocked-paypal-client-id", secret: true },
  VAST_PAYPAL_CLIENT_SECRET: { value: "mocked-paypal-client-secret", secret: true },
  VAST_STRIPE_BASE_URL: { value: wireMockBaseUrl },
  VAST_STRIPE_SECRET_KEY: { value: "mocked-stripe-secret-key", secret: true },
  VAST_STRIPE_ACCOUNT_ID: { value: "acct_mocked-stripe-account" },
};

/**
 * Creates the mocked tenant if it is not there and writes its provider settings either way, so a cleaned schema
 * gets it back on the next start. A failure here is reported and not thrown: the runtime is up, and what is missing
 * is a convenience for a browser rather than the service anyone else asked for.
 */
export async function ensureMockedTenant(service) {
  try {
    const tenantId = (await findTenantId(service)) ?? (await registerTenant(service));
    writeSettings(service, tenantId);
    console.log(`          ${service.name.padEnd(13)} mocked tenant '${mockedTenantCode}' reads ${wireMockBaseUrl}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`          ${service.name.padEnd(13)} mocked tenant not seeded: ${message}`);
  }
}

async function findTenantId(service) {
  const found = psql(service, `SELECT id FROM ${schema(service)}.tenants WHERE code = '${mockedTenantCode}'`).trim();
  return found ? Number(found) : undefined;
}

async function registerTenant(service) {
  const response = await fetch(`http://127.0.0.1:${service.port}/api/test/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenantCode: mockedTenantCode,
      tenantName: "WireMock",
      email: mockedTenantEmail,
      password: mockedTenantPassword,
      name: "WireMock User",
      role: "admin",
    }),
  });

  if (!response.ok) {
    throw new Error(`tenant registration answered HTTP ${response.status}`);
  }

  return (await response.json()).tenant.id;
}

function writeSettings(service, tenantId) {
  const rows = Object.entries(mockedSettings)
    .map(([key, { value, secret }]) => `(${tenantId}, '${key}', '${secret ? encrypt(service, value) : value}')`)
    .join(", ");

  psql(
    service,
    `INSERT INTO ${schema(service)}.settings_override (tenant_id, setting_key, setting_value)
     VALUES ${rows}
     ON CONFLICT (tenant_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()`,
  );
}

/**
 * A secret is stored the way the application reads it back, so the key it is encrypted under is the runtime's own.
 */
function encrypt(service, plaintext) {
  const key = Buffer.from(service.env.VAST_SETUP_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) {
    throw new Error(`${service.name} declares no 32-byte VAST_SETUP_ENCRYPTION_KEY to encrypt a secret with`);
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return `v1:${iv.toString("base64")}:${ciphertext.toString("base64")}`;
}

function schema(service) {
  return service.env.VAST_DB_SCHEMA ?? process.env.VAST_DB_SCHEMA ?? "vast";
}

// The database is the managed postgres container, which is the only one ./vast knows how to reach.
function psql(service, statement) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "vast-bricks-postgres",
      "psql",
      "-U",
      process.env.VAST_DB_USERNAME ?? "bricks",
      "-d",
      process.env.VAST_DB_NAME ?? "bricks",
      "-v",
      "ON_ERROR_STOP=1",
      "-tA",
      "-c",
      statement,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}
