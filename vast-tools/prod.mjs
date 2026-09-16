import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, resolve } from "node:path";

/** Where the local runtime keeps its archive, matching the OrderArchiveSettings default. */
const localArchiveDirectory = process.env.VAST_ORDER_ARCHIVE_DIR?.trim()
  || "/tmp/vast-bricks/order-archive";

/** The production archive, one tenant directory of it, copied in under its own name. */
const productionArchiveSource = process.env.VAST_PROD_ARCHIVE_SOURCE?.trim()
  || "ubuntu@vastbricks.com:/home/ubuntu/orders/vastbricks";

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

  const destination = archiveDirectory();
  clear(destination);
  return copy(productionArchiveSource, destination);
}

/**
 * The directory to empty, checked before anything is deleted: a mistyped or relative override would otherwise make
 * this a recursive delete of somewhere else entirely.
 */
function archiveDirectory() {
  const directory = resolve(localArchiveDirectory);

  if (directory.split("/").filter(Boolean).length < 2) {
    throw new Error(`Refusing to clear '${directory}'. VAST_ORDER_ARCHIVE_DIR must name a nested directory.`);
  }

  return directory;
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

function copy(source, destination) {
  console.log(`Copying ${source} into ${destination}`);
  const result = spawnSync("scp", ["-r", source, destination], { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    return result.status ?? 1;
  }

  const copied = resolve(destination, basename(source));
  console.log(`Copied ${existsSync(copied) ? readdirSync(copied).length : 0} files into ${copied}`);
  return 0;
}

function printHelp() {
  console.log(`Usage:
  ./vast prod async

Replaces the local order archive with production's: empties the local archive
directory, then copies the production archive into it over scp.

Options:
  --help, -h                  Show this help

Environment:
  VAST_ORDER_ARCHIVE_DIR      Local archive directory to clear and copy into,
                              default ${localArchiveDirectory}
  VAST_PROD_ARCHIVE_SOURCE    scp source to copy,
                              default ${productionArchiveSource}`);
}
