import { execFileSync } from "node:child_process";

/**
 * Which PostgreSQL database each runtime uses.
 *
 * <p>They are two, and that is the point. Both runtimes reach the same managed server, but the acceptance suite
 * creates tenants, writes settings and fills tables on every run, and some of what it writes - a published shipping
 * tariff, for one - belongs to no tenant and so is not swept away when its tenant is deleted. Pointed at the
 * developer's own database, a test run leaves that behind in the data the developer works against.
 *
 * <p>A separate database rather than a separate schema, because the Vast schema name is compiled into the entities
 * and a second one would need a second build. A database costs nothing here and keeps every table apart, the
 * migration history included.
 */

/** The developer's own data: what `vast-api` serves and what `vast-portal` shows. */
export const developmentDatabase = "bricks";

/** The acceptance suite's own, thrown away and rebuilt whenever anyone likes. */
export const acceptanceDatabase = "bricks_test";

/** The managed PostgreSQL container, which is the only server `./vast` knows how to reach. */
const containerName = "vast-bricks-postgres";

export function databaseUser() {
  return process.env.VAST_DB_USERNAME ?? "bricks";
}

export function databasePassword() {
  return process.env.VAST_DB_PASSWORD ?? "bricks";
}

export function databasePort() {
  return process.env.VAST_DB_PORT ?? "2345";
}

export function databaseHost() {
  return process.env.VAST_DB_HOST ?? "127.0.0.1";
}

export function jdbcUrl(database) {
  return `jdbc:postgresql://${databaseHost()}:${databasePort()}/${database}`;
}

/**
 * Creates the database if the server does not already have it.
 *
 * <p>Creating rather than migrating: the schema inside it is Flyway's to make, and the runtime does that on its own
 * the first time it starts. What cannot be done from inside the runtime is bringing the database itself into
 * existence, a connection needing one to connect to.
 */
export function ensureDatabase(database) {
  const existing = psql(developmentDatabase, `SELECT 1 FROM pg_database WHERE datname = '${database}'`).trim();
  if (existing === "1") {
    return false;
  }

  psql(developmentDatabase, `CREATE DATABASE "${database}"`);
  return true;
}

/** One statement against one database of the managed container. */
export function psql(database, statement) {
  try {
    return execFileSync(
      "docker",
      [
        "exec",
        "-i",
        containerName,
        "psql",
        "-U",
        databaseUser(),
        "-d",
        database,
        "-v",
        "ON_ERROR_STOP=1",
        "-tA",
        "-c",
        statement,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    const detail = error?.stderr?.toString().trim() || error?.message;
    throw new Error(`Could not reach the managed postgres. Is it running? Try ./vast services start postgres.\n${detail}`);
  }
}
