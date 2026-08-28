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
      return restartServices(options.services, { skipBuild: options.skipBuild });
  }
}

function parseOptions(args) {
  const options = {
    action: undefined,
    services: [],
    skipBuild: false,
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
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  ./vast services <list|start|stop|restart> [services...] [options]

Services:
  postgres | tor-proxy | vast-api | vast-portal

Commands:
  list                  Print service health and managed process state
  start [services...]   Start selected services, or all when omitted
  stop [services...]    Stop selected managed services, or all when omitted
  restart [services...] Stop and start selected services, or all when omitted

Options:
  --skip-build, -sb     Use the existing vast-api executable JAR
  --help, -h            Show this help

Managed ports:
  postgres     2345
  tor-proxy    8118
  vast-api     6362
  vast-portal  3100

Postgres intentionally uses non-default host port 2345.
IntelliJ launches keep their existing ports 6262 and 3000.`);
}
