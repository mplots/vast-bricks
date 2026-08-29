import { spawnSync } from "node:child_process";

import { repoRoot } from "./paths.mjs";
import { restartServices } from "./service-manager.mjs";

export async function runTestCommand(args) {
  const options = parseOptions(args);

  if (options.help) {
    printHelp();
    return 0;
  }

  if (options.build) {
    const restartStatus = await restartServices(["vast-api"]);
    if (restartStatus !== 0) {
      return restartStatus;
    }
  }

  const commandArgs = [
    "--prefix",
    "vast-acceptance-tests",
    "run",
    "test:api",
    "--",
    ...options.matchers,
  ];
  const result = spawnSync("npm", commandArgs, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

function parseOptions(args) {
  const options = {
    build: false,
    help: false,
    matchers: [],
  };

  for (const arg of args) {
    if (arg === "--build" || arg === "-b") {
      options.build = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option '${arg}'. Run ./vast test --help for usage.`);
    } else {
      options.matchers.push(arg);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  ./vast test [matcher...] [options]
  ./vast t [matcher...] [options]

Runs Playwright API acceptance tests from vast-acceptance-tests.

Options:
  --build, -b           Rebuild and restart managed vast-api before testing
  --help, -h            Show this help

Environment:
  VAST_API_BASE_URL     Target API base URL, default http://127.0.0.1:6362
  VAST_DB_HOST          PostgreSQL host for DB-backed setup, default 127.0.0.1
  VAST_DB_PORT          PostgreSQL port for DB-backed setup, default 2345
  VAST_DB_NAME          PostgreSQL database for DB-backed setup, default bricks
  VAST_DB_USERNAME      PostgreSQL user for DB-backed setup, default bricks
  VAST_DB_PASSWORD      PostgreSQL password for DB-backed setup, default bricks
  VAST_DB_SCHEMA        Vast schema for DB-backed setup, default vast`);
}
