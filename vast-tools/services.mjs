import {
  listServices,
  restartServices,
  startServices,
  stopServices,
} from "./service-manager.mjs";

const actions = new Set(["list", "start", "stop", "restart"]);

export async function runServicesCommand(args) {
  const options = parseOptions(args);

  if (options.help || !options.action) {
    printHelp();
    return options.help ? 0 : 1;
  }

  switch (options.action) {
    case "list":
      return listServices(options.services);
    case "start":
      return startServices(options.services, { skipBuild: options.skipBuild });
    case "stop":
      return stopServices(options.services);
    case "restart":
      return restartServices(options.services, { skipBuild: options.skipBuild, cleanDb: options.cleanDb });
  }
}

function parseOptions(args) {
  const options = {
    action: undefined,
    services: [],
    skipBuild: false,
    cleanDb: false,
    help: false,
  };

  for (const arg of args) {
    if (actions.has(arg)) {
      if (options.action) {
        throw new Error(`Unexpected command '${arg}'.`);
      }
      options.action = arg;
    } else if (arg === "--skip-build" || arg === "-sb") {
      options.skipBuild = true;
    } else if (arg === "--clean-db") {
      options.cleanDb = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option '${arg}'. Run ./vast services --help for usage.`);
    } else {
      options.services.push(arg);
    }
  }

  if (options.action === "list" || options.action === "stop") {
    if (options.skipBuild) {
      throw new Error("--skip-build is accepted only by start and restart.");
    }
    if (options.cleanDb) {
      throw new Error("--clean-db is accepted only by restart.");
    }
  }

  if (options.cleanDb) {
    if (options.action !== "restart") {
      throw new Error("--clean-db is accepted only by restart.");
    }
    if (options.services.length > 0 && !options.services.includes("vast-api-test")) {
      throw new Error("--clean-db applies only when restarting vast-api-test.");
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  ./vast services <list|start|stop|restart> [services...] [options]

Services:
  postgres | tor-proxy | vast-api-test | vast-api | wiremock | vast-portal

Commands:
  list                  Print service health and managed process state
  start [services...]   Start selected services, or all but vast-api when omitted
  stop [services...]    Stop selected managed services, or all when omitted
  restart [services...] Restart selected services, or all but vast-api when omitted

Options:
  --skip-build, -sb     Use existing built service artifacts
  --clean-db            Clean the Vast database schema before restarting vast-api-test
  --help, -h            Show this help

Managed ports:
  postgres       2345
  tor-proxy      8118
  vast-api-test  6362
  vast-api       6363
  wiremock       9011
  vast-portal    3100

Postgres intentionally uses non-default host port 2345.
IntelliJ launches keep their existing ports 6262 and 3000.

vast-api runs the deployable vb-portal-api JAR, serving the legacy and
rewritten backend together. It starts only when named, because it reads real
credentials from the external file VAST_API_ENV_FILE points at, by default
~/.vast/vast-api.env. Acceptance tests run against vast-api-test, which never
reads that file.`);
}
