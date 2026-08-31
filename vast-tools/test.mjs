import { spawnSync } from "node:child_process";
import { availableParallelism } from "node:os";
import { readFileSync } from "node:fs";

import { repoRoot } from "./paths.mjs";
import { restartServices } from "./service-manager.mjs";

export async function runTestCommand(args) {
  const options = parseOptions(args);

  if (options.help) {
    printHelp();
    return 0;
  }

  if (options.build) {
    const restartStatus = await restartServices(["vast-api"], { cleanDb: options.cleanBuild });
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
  const wireMockPlan = wireMockPlaywrightPlan();
  const result = spawnSync("npm", commandArgs, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ACCEPTANCE_PLAYWRIGHT_WORKERS: String(wireMockPlan.workers),
      ACCEPTANCE_WIREMOCK_HOSTS: wireMockPlan.hosts.join(","),
      ACCEPTANCE_WIREMOCK_MODE: wireMockPlan.mode,
      VAST_SETTINGS_ENCRYPTION_KEY: process.env.VAST_SETTINGS_ENCRYPTION_KEY
        ?? "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    },
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
    cleanBuild: false,
    help: false,
    matchers: [],
  };

  for (const arg of args) {
    if (arg === "--build" || arg === "-b") {
      options.build = true;
    } else if (arg === "--clean-build" || arg === "-cb") {
      options.build = true;
      options.cleanBuild = true;
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
  --clean-build, -cb    Rebuild vast-api and test with a freshly migrated Vast schema
  --help, -h            Show this help

Environment:
  VAST_API_BASE_URL     Target API base URL, default http://127.0.0.1:6362
  VAST_DB_HOST          PostgreSQL host for DB-backed setup, default 127.0.0.1
  VAST_DB_PORT          PostgreSQL port for DB-backed setup, default 2345
  VAST_DB_NAME          PostgreSQL database for DB-backed setup, default bricks
  VAST_DB_USERNAME      PostgreSQL user for DB-backed setup, default bricks
  VAST_DB_PASSWORD      PostgreSQL password for DB-backed setup, default bricks
  VAST_DB_SCHEMA        Vast schema for DB-backed setup, default vast
  VAST_SETTINGS_ENCRYPTION_KEY
                       Base64 32-byte key for encrypted secret settings`);
}

function wireMockPlaywrightPlan() {
  const workers = playwrightWorkerCount();
  const expectedHosts = Array.from({ length: workers }, (_, index) => `vast-wiremock-${index}`);
  const availableHosts = wireMockHostsInHostfile();
  const missingHosts = expectedHosts.filter((host) => !availableHosts.has(host));

  if (missingHosts.length === 0) {
    return {
      workers,
      mode: "parallel",
      hosts: expectedHosts,
    };
  }

  console.log("Not enough WireMock host aliases are defined in /etc/hosts.");
  console.log("WireMock-backed API tests will run in serial mode with one Playwright worker. Add these lines to /etc/hosts to enable WireMock parallel isolation:");
  for (const host of missingHosts) {
    console.log(`  127.0.0.1 ${host}`);
  }

  return {
    workers: 1,
    mode: "serial",
    hosts: ["localhost"],
  };
}

function playwrightWorkerCount() {
  const configuredWorkers = process.env.ACCEPTANCE_PLAYWRIGHT_WORKERS;
  if (configuredWorkers?.trim()) {
    const workers = Number(configuredWorkers);
    if (Number.isInteger(workers) && workers > 0) {
      return workers;
    }
    console.warn(`Ignoring invalid ACCEPTANCE_PLAYWRIGHT_WORKERS value '${configuredWorkers}'. Expected a positive integer.`);
  }

  return Math.max(1, Math.floor(availableParallelism() / 2));
}

function wireMockHostsInHostfile() {
  try {
    return loopbackHostAliases(readFileSync("/etc/hosts", "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`Could not read /etc/hosts to check WireMock host aliases: ${message}`);
    return new Set();
  }
}

function loopbackHostAliases(hostfile) {
  const hosts = new Set();

  for (const line of hostfile.split(/\r?\n/)) {
    const withoutComment = line.replace(/#.*/, "").trim();
    if (!withoutComment) {
      continue;
    }

    const [address, ...aliases] = withoutComment.split(/\s+/);
    if (address === "127.0.0.1" || address === "::1") {
      aliases.forEach((alias) => hosts.add(alias));
    }
  }

  return hosts;
}
