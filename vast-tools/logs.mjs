import {
  closeSync,
  createReadStream,
  existsSync,
  fstatSync,
  openSync,
  readSync,
  statSync,
  truncateSync,
} from "node:fs";
import { once } from "node:events";
import { resolve } from "node:path";

import { logsRoot } from "./paths.mjs";
import { managedServices } from "./service-registry.mjs";

const allServiceNames = managedServices.map(({ name }) => name);

export async function runLogsCommand(args) {
  const options = parseLogsOptions(args);

  if (options.help) {
    printHelp();
    return 0;
  }

  const serviceNames = options.service ? [options.service] : allServiceNames;
  if (options.clear) {
    clearLogs(serviceNames);
    return 0;
  }

  const followedLogs = serviceNames.map((service) => ({
    service,
    path: logPath(service),
    offset: 0,
  }));
  const tailLines = options.tailLines ?? (options.follow ? 0 : undefined);
  await printLogs(followedLogs, tailLines);

  if (!options.follow) {
    return 0;
  }

  console.log(`Following ${options.service ?? "all managed service"} logs. Press Ctrl+C to stop.`);
  await followLogs(followedLogs);
  return 0;
}

function parseLogsOptions(args) {
  const options = {
    clear: false,
    follow: false,
    help: false,
    service: undefined,
    tailLines: undefined,
  };
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--follow":
      case "-f":
        options.follow = true;
        break;
      case "--tail":
      case "-t":
        options.tailLines = parseTailLines(arg, args[++index]);
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option '${arg}'. Run ./vast logs --help for usage.`);
        }
        positionals.push(arg);
        break;
    }
  }

  if (positionals[0] === "clear") {
    options.clear = true;
    positionals.shift();
  }

  if (positionals.length > 1) {
    throw new Error("Usage: ./vast logs [clear] [service] [options]");
  }

  if (positionals.length === 1) {
    options.service = validateServiceName(positionals[0]);
  }

  if (options.clear && (options.follow || options.tailLines !== undefined)) {
    throw new Error("The logs clear command does not support --follow or --tail.");
  }

  return options;
}

function parseTailLines(optionName, value) {
  if (value === undefined || value.startsWith("-")) {
    throw new Error(`Option ${optionName} requires a non-negative integer value.`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Option ${optionName} requires a non-negative integer value, got '${value}'.`);
  }

  return parsed;
}

function validateServiceName(serviceName) {
  if (!allServiceNames.includes(serviceName)) {
    throw new Error(`No managed service configured for ${serviceName}.`);
  }

  return serviceName;
}

function logPath(serviceName) {
  return resolve(logsRoot, `${serviceName}.log`);
}

function clearLogs(serviceNames) {
  const existingLogs = serviceNames
    .map((service) => ({ service, path: logPath(service) }))
    .filter(({ path }) => existsSync(path));

  for (const { path } of existingLogs) {
    truncateSync(path, 0);
  }

  if (existingLogs.length === 0) {
    console.log("No managed service logs found.");
    return;
  }

  console.log(`Cleared logs for: ${existingLogs.map(({ service }) => service).join(", ")}`);
}

async function printLogs(logs, tailLines) {
  const existingLogs = logs.filter(({ path }) => existsSync(path));
  const showHeaders = logs.length > 1;

  if (existingLogs.length === 0) {
    console.log("No managed service logs found.");
  }

  for (const [index, log] of existingLogs.entries()) {
    if (showHeaders) {
      printHeader(log.service, index > 0);
    }

    const endsWithNewline = tailLines === undefined
      ? await printFile(log.path)
      : printTail(log.path, tailLines);
    if (showHeaders && endsWithNewline === false) {
      process.stdout.write("\n");
    }
    log.offset = statSync(log.path).size;
  }
}

async function printFile(path) {
  let lastByte;

  for await (const chunk of createReadStream(path)) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (buffer.length > 0) {
      lastByte = buffer[buffer.length - 1];
    }
    if (!process.stdout.write(buffer)) {
      await once(process.stdout, "drain");
    }
  }

  return lastByte === undefined ? undefined : lastByte === 10;
}

function printTail(path, lineCount) {
  if (lineCount === 0) {
    return undefined;
  }

  const content = readTail(path, lineCount);
  const output = lastLines(content, lineCount);
  process.stdout.write(output);
  return output.length === 0 ? undefined : output.endsWith("\n");
}

function readTail(path, lineCount) {
  const descriptor = openSync(path, "r");
  const chunks = [];
  let position = fstatSync(descriptor).size;
  let newlineCount = 0;

  try {
    while (position > 0 && newlineCount <= lineCount) {
      const bytesToRead = Math.min(64 * 1024, position);
      position -= bytesToRead;
      const chunk = Buffer.alloc(bytesToRead);
      const bytesRead = readSync(descriptor, chunk, 0, bytesToRead, position);
      const content = chunk.subarray(0, bytesRead);
      for (const byte of content) {
        if (byte === 10) {
          newlineCount += 1;
        }
      }
      chunks.unshift(content);
    }
  } finally {
    closeSync(descriptor);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function lastLines(content, lineCount) {
  if (lineCount === 0 || content.length === 0) {
    return "";
  }

  const hasTrailingNewline = content.endsWith("\n");
  const lines = content.split(/\r?\n/);
  if (hasTrailingNewline) {
    lines.pop();
  }

  const result = lines.slice(-lineCount).join("\n");
  return hasTrailingNewline ? `${result}\n` : result;
}

async function followLogs(logs) {
  const showHeaders = logs.length > 1;

  await new Promise(() => {
    setInterval(() => {
      for (const log of logs) {
        printAppendedContent(log, showHeaders);
      }
    }, 250);
  });
}

function printAppendedContent(log, showHeader) {
  if (!existsSync(log.path)) {
    log.offset = 0;
    return;
  }

  const size = statSync(log.path).size;
  if (size < log.offset) {
    log.offset = 0;
  }
  if (size === log.offset) {
    return;
  }

  const descriptor = openSync(log.path, "r");
  try {
    const currentSize = fstatSync(descriptor).size;
    if (currentSize < log.offset) {
      log.offset = 0;
    }

    const bytesToRead = currentSize - log.offset;
    if (bytesToRead <= 0) {
      return;
    }

    const buffer = Buffer.alloc(bytesToRead);
    const bytesRead = readSync(descriptor, buffer, 0, bytesToRead, log.offset);
    if (showHeader) {
      printHeader(log.service, true);
    }
    process.stdout.write(buffer.subarray(0, bytesRead));
    log.offset += bytesRead;
  } finally {
    closeSync(descriptor);
  }
}

function printHeader(serviceName, leadingNewline) {
  process.stdout.write(`${leadingNewline ? "\n" : ""}==> ${serviceName} <==\n`);
}

function printHelp() {
  console.log(`Usage:
  ./vast logs [service] [options]
  ./vast logs clear [service]

Services:
  ${allServiceNames.join(" | ")}

Options:
  --follow, -f             Continue printing new output; defaults to --tail 0
  --tail, -t <lines>       Print only the last number of lines
  --help, -h               Show this help

Examples:
  ./vast logs vast-api
  ./vast logs vast-api --tail 100
  ./vast logs vast-api --follow
  ./vast logs clear vast-api`);
}
