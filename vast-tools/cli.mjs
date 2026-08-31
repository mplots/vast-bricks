import { runServicesCommand } from "./services.mjs";
import { runTestCommand } from "./test.mjs";
import { runLogsCommand } from "./logs.mjs";
import completions, { completionLoadedEnvName } from "./completion.mjs";
import { repoRoot } from "./paths.mjs";

const resetColor = "\x1b[0m";
const brightYellow = "\x1b[1;33m";

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  if (command === "services" || command === "svc") {
    return runServicesCommand(args);
  }

  if (command === "ps") {
    return runServicesCommand(["list", ...args]);
  }

  if (command === "test" || command === "t") {
    return runTestCommand(args);
  }

  if (command === "logs") {
    return runLogsCommand(args);
  }

  if (command === "completion") {
    console.log(completions());
    return 0;
  }

  throw new Error(`Unknown command '${command}'. Run ./vast help for usage.`);
}

function printHelp() {
  const shellSetupHelp = process.env[completionLoadedEnvName]
    ? ""
    : `\n\n${highlight(`Shell autocomplete is not configured:
  Add these lines to your shell config:

  alias vast="${repoRoot}/vast"
  source <(vast completion)

  Then restart your shell or source the updated config.`)}`;

  console.log(`Usage:
  ./vast <command> [options]

Commands:
  test, t         Run acceptance tests
  services, svc    Inspect and control local managed services
  ps              Shortcut for: ./vast services list
  logs            Print, follow, or clear managed service logs
  completion       Print shell completion setup

Run ./vast <command> --help for command details.${shellSetupHelp}`);
}

function highlight(text) {
  return process.stdout.isTTY && !process.env.NO_COLOR
    ? `${brightYellow}${text}${resetColor}`
    : text;
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
