import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { Socket } from "node:net";

import { logsRoot, repoRoot, runtimeRoot, servicesStatePath } from "./paths.mjs";
import { findService, managedServices } from "./service-registry.mjs";

const readinessTimeoutMs = 90_000;
const stopTimeoutMs = 15_000;
const pollIntervalMs = 250;
const resetColor = "\x1b[0m";
const statusLabels = {
  healthy: { text: "HEALTHY", color: "\x1b[32m" },
  missing: { text: "MISSING", color: "\x1b[38;5;208m" },
  unhealthy: { text: "UNHEALTHY", color: "\x1b[31m" },
  started: { text: "STARTED", color: "\x1b[33m" },
  starting: { text: "STARTING", color: "\x1b[33m" },
  stopping: { text: "STOPPING", color: "\x1b[36m" },
  stopped: { text: "STOPPED", color: "\x1b[32m" },
  build: { text: "BUILD", color: "\x1b[33m" },
  install: { text: "INSTALL", color: "\x1b[33m" },
  skipped: { text: "SKIPPED", color: "\x1b[2m" },
  stale: { text: "STALE", color: "\x1b[38;5;208m" },
  unmanaged: { text: "UNMANAGED", color: "\x1b[2m" },
};

function statusLabel(label) {
  const config = statusLabels[label];
  const text = config.text.padEnd(9);
  return colorsEnabled() ? `${config.color}${text}${resetColor}` : text;
}

function colorsEnabled() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
}

export async function listServices(names) {
  const services = selectedServices(names).map(findService);
  const state = readState();
  let allHealthy = true;
  const rows = [];

  for (const service of services) {
    const record = state.find(({ name }) => name === service.name);
    const health = await checkHealth(service);
    const ownership = service.dockerComposeService
      ? dockerOwnership(service)
      : record && isOwnedProcessRunning(service, record)
        ? "managed"
        : record
          ? "stale managed state"
          : "unmanaged";
    const status = health.healthy ? "healthy" : health.reachable ? "unhealthy" : "missing";
    rows.push({
      status,
      name: service.name,
      port: String(service.port),
      runtime: service.dockerComposeService ? "docker" : "native",
      ownership,
      detail: health.detail,
    });
    allHealthy &&= health.healthy;
  }

  printServiceList(rows);

  return allHealthy ? 0 : 1;
}

function printServiceList(rows) {
  const serviceWidth = Math.max("SERVICE".length, 12, ...rows.map(({ name }) => name.length));
  const portWidth = Math.max("PORT".length, ...rows.map(({ port }) => port.length));
  const runtimeWidth = Math.max("RUNTIME".length, ...rows.map(({ runtime }) => runtime.length));
  const ownershipWidth = Math.max("MANAGEMENT".length, ...rows.map(({ ownership }) => ownership.length));

  console.log([
    "STATUS".padEnd(9),
    "SERVICE".padEnd(serviceWidth),
    "PORT".padEnd(portWidth),
    "RUNTIME".padEnd(runtimeWidth),
    "MANAGEMENT".padEnd(ownershipWidth),
    "DETAIL",
  ].join(" "));

  for (const row of rows) {
    console.log([
      statusLabel(row.status),
      row.name.padEnd(serviceWidth),
      row.port.padEnd(portWidth),
      row.runtime.padEnd(runtimeWidth),
      row.ownership.padEnd(ownershipWidth),
      row.detail,
    ].join(" "));
  }
}

export async function startServices(names, options = {}) {
  const services = selectedServices(names).map(findService);

  for (const service of services) {
    await startService(service, options);
  }

  return 0;
}

export async function stopServices(names) {
  const services = selectedServices(names).map(findService).reverse();

  for (const service of services) {
    await stopService(service);
  }

  return 0;
}

export async function restartServices(names, options = {}) {
  const services = selectedServices(names).map(findService);

  for (const service of [...services].reverse()) {
    await stopService(service);
  }
  for (const service of services) {
    await startService(service, options);
  }

  return 0;
}

async function startService(service, { skipBuild = false, cleanDb = false } = {}) {
  if (service.dockerComposeService) {
    await startDockerComposeService(service);
    return;
  }

  const state = readState();
  const record = state.find(({ name }) => name === service.name);
  const health = await checkHealth(service);
  const ownedProcessRunning = record && isOwnedProcessRunning(service, record);

  if (ownedProcessRunning && health.healthy) {
    console.log(`${statusLabel("healthy")} ${service.name.padEnd(13)} already managed pid=${record.pid} port=${service.port}`);
    return;
  }

  if (ownedProcessRunning) {
    throw new Error(`${service.name} has a managed process at pid ${record.pid}, but it is not healthy. Inspect its log or run ./vast services restart ${service.name}.`);
  }

  if (health.reachable) {
    const owner = record ? `recorded pid ${record.pid} no longer matches` : "it was not started by ./vast";
    throw new Error(`${service.name} port ${service.port} is already in use and ${owner}. Stop that process or choose another managed port.`);
  }

  removeStateRecord(service.name);

  if (service.build && !skipBuild) {
    runLoggedForeground(service.build.command, service.build.args, service.cwd, `${service.name}-build`, `${statusLabel("build")} ${service.name}`, service.build.env);
  } else if (service.build) {
    console.log(`${statusLabel("skipped")} ${service.name} build skipped`);
  }

  ensureServiceDependency(service);

  mkdirSync(logsRoot, { recursive: true });
  const logPath = resolve(logsRoot, `${service.name}.log`);
  const logFd = openSync(logPath, "a");
  const args = typeof service.args === "function" ? service.args() : service.args;
  let child;
  try {
    child = spawn(service.command, args, {
      cwd: service.cwd,
      detached: true,
      env: serviceEnvironment(service, { cleanDb }),
      stdio: ["ignore", logFd, logFd],
    });
  } finally {
    closeSync(logFd);
  }

  if (!child.pid) {
    throw new Error(`Failed to start ${service.name}.`);
  }

  child.unref();
  writeStateRecord({
    name: service.name,
    pid: child.pid,
    port: service.port,
    startedAt: new Date().toISOString(),
  });
  console.log(`${statusLabel("started")} ${service.name.padEnd(13)} pid=${child.pid} port=${service.port} log=${logPath}`);

  const ready = await waitForHealth(service, child.pid);
  if (!ready.healthy) {
    printLogTail(service.name);
    throw new Error(`${service.name} did not become healthy within ${readinessTimeoutMs / 1_000}s: ${ready.detail}`);
  }
  console.log(`${statusLabel("healthy")} ${service.name.padEnd(13)} ${service.healthUrl}`);
}

function serviceEnvironment(service, { cleanDb = false } = {}) {
  return {
    ...process.env,
    ...service.env,
    ...(cleanDb && service.name === "vast-api-test" ? { VAST_DB_CLEAN_ON_STARTUP: "true" } : {}),
  };
}

async function stopService(service) {
  if (service.dockerComposeService) {
    await stopDockerComposeService(service);
    return;
  }

  const record = readState().find(({ name }) => name === service.name);
  if (!record) {
    console.log(`${statusLabel("unmanaged")} ${service.name.padEnd(13)} no recorded process`);
    return;
  }

  if (!isOwnedProcessRunning(service, record)) {
    console.log(`${statusLabel("stale")} ${service.name.padEnd(13)} pid=${record.pid}`);
    removeStateRecord(service.name);
    return;
  }

  try {
    process.kill(-record.pid, "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") {
      throw error;
    }
  }
  console.log(`${statusLabel("stopping")} ${service.name.padEnd(13)} pid=${record.pid}`);

  if (!(await waitForProcessGroupExit(record.pid, stopTimeoutMs))) {
    throw new Error(`${service.name} did not stop within ${stopTimeoutMs / 1_000}s. Its process was not force-killed.`);
  }

  removeStateRecord(service.name);
  console.log(`${statusLabel("stopped")} ${service.name.padEnd(13)} port=${service.port}`);
}

async function startDockerComposeService(service) {
  const health = await checkHealth(service);
  const containerRunning = isDockerContainerRunning(service);
  removeStateRecord(service.name);

  if (containerRunning && health.healthy) {
    console.log(`${statusLabel("healthy")} ${service.name.padEnd(13)} already managed container=${service.containerName} port=${service.port}`);
    return;
  }

  if (!containerRunning && health.reachable) {
    throw new Error(`${service.name} port ${service.port} is already in use and it was not started by ./vast. Stop that process or choose another managed port.`);
  }

  runLoggedForeground(
    "docker",
    ["compose", "up", service.dockerComposeService, "-d"],
    repoRoot,
    `${service.name}-compose-up`,
    `${statusLabel("starting")} ${service.name}`,
  );

  const ready = await waitForHealth(service);
  if (!ready.healthy) {
    printDockerLogTail(service);
    throw new Error(`${service.name} did not become healthy within ${readinessTimeoutMs / 1_000}s: ${ready.detail}`);
  }
  console.log(`${statusLabel("healthy")} ${service.name.padEnd(13)} ${service.healthUrl ?? `tcp://${service.host}:${service.port}`}`);
}

async function stopDockerComposeService(service) {
  if (!isDockerContainerRunning(service)) {
    console.log(`${statusLabel("unmanaged")} ${service.name.padEnd(13)} container=${service.containerName}`);
    return;
  }

  runLoggedForeground(
    "docker",
    ["compose", "stop", service.dockerComposeService],
    repoRoot,
    `${service.name}-compose-stop`,
    `${statusLabel("stopping")} ${service.name}`,
  );

  if (!(await waitForPortClosed(service.port, stopTimeoutMs))) {
    throw new Error(`${service.name} port ${service.port} remained open after docker compose stop.`);
  }

  console.log(`${statusLabel("stopped")} ${service.name.padEnd(13)} port=${service.port}`);
}

function runForeground(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}.`);
  }
}

function runLoggedForeground(command, args, cwd, logName, label, env = {}) {
  mkdirSync(logsRoot, { recursive: true });
  const logPath = resolve(logsRoot, `${logName}.log`);
  const logFd = openSync(logPath, "a");
  console.log(`${label} log=${logPath}`);
  let result;
  try {
    result = spawnSync(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", logFd, logFd],
    });
  } finally {
    closeSync(logFd);
  }

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    printFileTail(logPath);
    throw new Error(`${command} ${args.join(" ")} exited with status ${result.status}. Log: ${logPath}`);
  }
}

function ensureServiceDependency(service) {
  if (!service.dependency || existsSync(service.dependency.path)) {
    return;
  }

  const install = service.dependency.install;
  if (!install) {
    throw new Error(`${service.name} dependency is missing at ${service.dependency.path}.`);
  }

  runLoggedForeground(install.command, install.args, repoRoot, `${service.name}-install`, `${statusLabel("install")} ${service.name}`);
  if (!existsSync(service.dependency.path)) {
    throw new Error(`${service.name} dependency install completed, but ${service.dependency.path} is still missing.`);
  }
}

async function checkHealth(service) {
  if (service.healthCheck === "tcp") {
    const portOpen = await isPortOpen(service.port, service.host);
    return {
      healthy: portOpen,
      reachable: portOpen,
      detail: portOpen ? "TCP open" : "not reachable",
    };
  }

  try {
    const response = await fetch(service.healthUrl, { signal: AbortSignal.timeout(2_000) });
    return {
      healthy: response.status >= 200 && response.status < 300,
      reachable: true,
      detail: `HTTP ${response.status}`,
    };
  } catch (error) {
    const portOpen = await isPortOpen(service.port);
    return {
      healthy: false,
      reachable: portOpen,
      detail: portOpen
        ? `port open; HTTP check failed: ${error instanceof Error ? error.message : "unknown error"}`
        : error instanceof Error ? error.message : "not reachable",
    };
  }
}

async function waitForHealth(service, pid) {
  const deadline = Date.now() + readinessTimeoutMs;
  let health = await checkHealth(service);
  while (!health.healthy && Date.now() < deadline) {
    if (pid && !isProcessGroupRunning(pid)) {
      return { healthy: false, reachable: false, detail: "managed process exited during startup" };
    }
    await delay(1_000);
    health = await checkHealth(service);
  }
  return health;
}

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolveCheck) => {
    const socket = new Socket();
    const finish = (open) => {
      socket.destroy();
      resolveCheck(open);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function waitForPortClosed(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortOpen(port))) {
      return true;
    }
    await delay(pollIntervalMs);
  }
  return !(await isPortOpen(port));
}

function isOwnedProcessRunning(service, record) {
  if (!isProcessGroupRunning(record.pid)) {
    return false;
  }

  try {
    const command = execFileSync("ps", ["-p", String(record.pid), "-o", "command="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return command.includes(service.processMarker);
  } catch {
    return false;
  }
}

function isProcessGroupRunning(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function isDockerContainerRunning(service) {
  if (!service.containerName) {
    return false;
  }

  try {
    const running = execFileSync("docker", ["inspect", "--format", "{{.State.Running}}", service.containerName], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return running === "true";
  } catch {
    return false;
  }
}

function dockerOwnership(service) {
  return isDockerContainerRunning(service)
    ? `managed container=${service.containerName}`
    : "unmanaged";
}

async function waitForProcessGroupExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessGroupRunning(pid)) {
      return true;
    }
    await delay(pollIntervalMs);
  }
  return !isProcessGroupRunning(pid);
}

function readState() {
  if (!existsSync(servicesStatePath)) {
    return [];
  }
  try {
    const value = JSON.parse(readFileSync(servicesStatePath, "utf8"));
    return Array.isArray(value)
      ? value.filter((record) => record && typeof record.name === "string" && Number.isInteger(record.pid) && record.pid > 0)
      : [];
  } catch (error) {
    throw new Error(`Cannot read ${servicesStatePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function writeState(records) {
  mkdirSync(runtimeRoot, { recursive: true });
  if (records.length === 0) {
    if (existsSync(servicesStatePath)) {
      unlinkSync(servicesStatePath);
    }
    return;
  }

  const temporaryPath = `${servicesStatePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(records, null, 2)}\n`);
  renameSync(temporaryPath, servicesStatePath);
}

function writeStateRecord(record) {
  const remaining = readState().filter(({ name }) => name !== record.name);
  writeState([...remaining, record]);
}

function removeStateRecord(name) {
  writeState(readState().filter((record) => record.name !== name));
}

function printLogTail(serviceName, lineCount = 80) {
  const logPath = resolve(logsRoot, `${serviceName}.log`);
  if (!existsSync(logPath)) {
    return;
  }
  printFileTail(logPath, lineCount);
}

function printFileTail(logPath, lineCount = 80) {
  const lines = readFileSync(logPath, "utf8").split(/\r?\n/);
  console.error(`\nLast ${lineCount} lines from ${logPath}:`);
  console.error(lines.slice(-lineCount).join("\n").trimEnd());
}

function printDockerLogTail(service, lineCount = 80) {
  if (!service.containerName) {
    return;
  }

  try {
    const output = execFileSync("docker", ["logs", "--tail", String(lineCount), service.containerName], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    console.error(`\nLast ${lineCount} lines from Docker container ${service.containerName}:`);
    console.error(output.trimEnd());
  } catch {
    // Docker may not have created the container yet; the startup error is enough.
  }
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function selectedServices(names) {
  return names.length > 0 ? names : managedServices.map(({ name }) => name);
}
