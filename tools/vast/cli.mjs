import { runServicesCommand } from "./services.mjs";

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  if (command === "services" || command === "svc") {
    return runServicesCommand(args);
  }

  throw new Error(`Unknown command '${command}'. Run ./vast help for usage.`);
}

function printHelp() {
  console.log(`Usage:
  ./vast <command> [options]

Commands:
  services, svc    Inspect and control local managed services

Run ./vast services --help for command details.`);
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
