import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, resolve } from "node:path";

/** Where the local runtime keeps its archive, matching the OrderArchiveSettings default. */
const localArchiveDirectory = process.env.VAST_ORDER_ARCHIVE_DIR?.trim()
  || "/tmp/vast-bricks/order-archive";

/**
 * Where BrickSync's own record of the orders it synchronized lands, beside the order archive rather than under it:
 * the archive is a directory per tenant and this is not, so a copy of it inside the archive's base would read as a
 * tenant named after a program.
 */
const localBrickSyncOrdersDirectory = process.env.VAST_BRICKSYNC_ORDERS_DIR?.trim()
  || "/tmp/vast-bricks/bricksync-orders";

/** The production archive, one tenant directory of it, copied in under its own name. */
const productionArchiveSource = process.env.VAST_PROD_ARCHIVE_SOURCE?.trim()
  || "ubuntu@vastbricks.com:/home/ubuntu/orders/vastbricks";

/**
 * BrickSync's orders on the production host, inside the data directory the container is run with.
 *
 * <p>One directory for every store BrickSync synchronizes, with nothing in its layout saying which store an order
 * belonged to. It is copied whole and left that way: inventing a tenant directory around it would claim a scoping
 * the files do not have.
 */
const productionBrickSyncOrdersSource = process.env.VAST_PROD_BRICKSYNC_SOURCE?.trim()
  || "ubuntu@vastbricks.com:/home/ubuntu/bricksync/data/orders";

export async function runProdCommand(args) {
  const [action, ...rest] = args;

  if (!action || action === "help" || action === "--help" || action === "-h") {
    printHelp();
    return 0;
  }

  if (action !== "async") {
    throw new Error(`Unknown prod action '${action}'. Run ./vast prod --help for usage.`);
  }

  if (rest.some((arg) => arg === "--help" || arg === "-h")) {
    printHelp();
    return 0;
  }
  if (rest.length > 0) {
    throw new Error(`Unknown option '${rest[0]}'. Run ./vast prod --help for usage.`);
  }

  // Both destinations are checked before either is emptied, so a mistyped override is caught while everything is
  // still where it was rather than after the other half has already been deleted.
  const archive = safeDirectory(localArchiveDirectory);
  const brickSyncOrders = safeDirectory(localBrickSyncOrdersDirectory);

  // The archive keeps the tenant directory it is copied as, because the runtime resolves its own base plus the
  // tenant's code; BrickSync's orders are that directory itself, there being no tenant level to keep.
  const archiveStatus = copyInto(productionArchiveSource, archive);
  const brickSyncStatus = copyAs(productionBrickSyncOrdersSource, brickSyncOrders);

  // Both halves are attempted whatever the other did: a host that would not serve one of them should not leave the
  // other quietly uncopied, which is exactly the state that reads later as production having nothing there.
  return archiveStatus || brickSyncStatus;
}

/**
 * A directory this command may empty, checked before anything is deleted: a mistyped or relative override would
 * otherwise make this a recursive delete of somewhere else entirely.
 */
function safeDirectory(configured) {
  const directory = resolve(configured);

  if (directory.split("/").filter(Boolean).length < 2) {
    throw new Error(`Refusing to clear '${directory}'. It must name a nested directory.`);
  }

  return directory;
}

/** Copies the source in under its own name, into a directory emptied of whatever was there before. */
function copyInto(source, destination) {
  clear(destination);

  const status = scp(source, destination);
  if (status !== 0) {
    return status;
  }

  return report(resolve(destination, basename(source)));
}

/** Copies the source as the destination directory itself, which is removed first so scp writes it whole. */
function copyAs(source, destination) {
  remove(destination);

  const status = scp(source, destination);
  if (status !== 0) {
    return status;
  }

  return report(destination);
}

function clear(directory) {
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
    console.log(`Created ${directory}`);
    return;
  }

  const entries = readdirSync(directory);
  for (const entry of entries) {
    rmSync(resolve(directory, entry), { force: true, recursive: true });
  }
  console.log(`Cleared ${directory}${entries.length === 0 ? " (was already empty)" : ""}`);
}

/**
 * Takes the directory away entirely, and makes sure its parent is there to receive the copy. scp writes a directory
 * it is given the name of and copies into one that already exists, so this is what makes the copy the directory
 * rather than a directory inside it.
 */
function remove(directory) {
  if (existsSync(directory)) {
    rmSync(directory, { force: true, recursive: true });
    console.log(`Cleared ${directory}`);
  }
  mkdirSync(resolve(directory, ".."), { recursive: true });
}

function scp(source, destination) {
  console.log(`Copying ${source} into ${destination}`);
  const result = spawnSync("scp", ["-r", source, destination], { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

function report(copied) {
  console.log(`Copied ${existsSync(copied) ? readdirSync(copied).length : 0} files into ${copied}`);
  return 0;
}

function printHelp() {
  console.log(`Usage:
  ./vast prod async

Replaces the local copies of production's order data: empties each local
directory, then copies production's into it over scp. Two things are copied,
the store's own order archive and BrickSync's record of the orders it
synchronized, the latter covering every store rather than one tenant.

Options:
  --help, -h                  Show this help

Environment:
  VAST_ORDER_ARCHIVE_DIR      Local archive directory to clear and copy into,
                              default ${localArchiveDirectory}
  VAST_PROD_ARCHIVE_SOURCE    scp source of the order archive,
                              default ${productionArchiveSource}
  VAST_BRICKSYNC_ORDERS_DIR   Local BrickSync orders directory to replace,
                              default ${localBrickSyncOrdersDirectory}
  VAST_PROD_BRICKSYNC_SOURCE  scp source of BrickSync's orders,
                              default ${productionBrickSyncOrdersSource}`);
}
