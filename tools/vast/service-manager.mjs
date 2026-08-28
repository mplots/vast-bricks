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

import { logsRoot, runtimeRoot, servicesStatePath } from "./paths.mjs";
import { findService, managedServices } from "./service-registry.mjs";

const readinessTimeoutMs = 90_000;
const stopTimeoutMs = 15_000;
const pollIntervalMs = 250;

export async function listServices(names) {
  const services = selectedServices(names).map(findService);
  const state = readState();
  let allHealthy = true;

  for (const service of services) {
    const record = state.find(({ name }) => name === service.name);
    const health = await checkHealth(service);
    const ownership = record && isOwnedProcessRunning(service, record)
      ? `managed pid=${record.pid}`
      : record
        ? "stale managed state"
        : "unmanaged";
    const status = health.healthy ? "HEALTHY" : health.reachable ? "UNHEALTHY" : "MISSING";
    console.log(`${status.padEnd(10)} ${service.name.padEnd(12)} port=${service.port} ${ownership} ${health.detail}`);
    allHealthy &&= health.healthy;
  }

  return allHealthy ? 0 : 1;
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

async function startService(service, { skipBuild = false } = {}) {
  const state = readState();
  const record = state.find(({ name }) => name === service.name);
  const health = await checkHealth(service);
  const ownedProcessRunning = record && isOwnedProcessRunning(service, record);

  if (ownedProcessRunning && health.healthy) {
    console.log(`HEALTHY    ${service.name.padEnd(12)} already managed pid=${record.pid} port=${service.port}`);
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
    console.log(`BUILD      ${service.name}`);
    runForeground(service.build.command, service.build.args, service.cwd);
  } else if (service.build) {
    console.log(`SKIP BUILD ${service.name}`);
  }

  mkdirSync(logsRoot, { recursive: true });
  const logPath = resolve(logsRoot, `${service.name}.log`);
  const logFd = openSync(logPath, "a");
  const args = typeof service.args === "function" ? service.args() : service.args;
  let child;
  try {
    child = spawn(service.command, args, {
      cwd: service.cwd,
      detached: true,
      env: { ...process.env, ...service.env },
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
  console.log(`STARTED    ${service.name.padEnd(12)} pid=${child.pid} port=${service.port} log=${logPath}`);

  const ready = await waitForHealth(service, child.pid);
  if (!ready.healthy) {
    printLogTail(service.name);
    throw new Error(`${service.name} did not become healthy within ${readinessTimeoutMs / 1_000}s: ${ready.detail}`);
  }
  console.log(`HEALTHY    ${service.name.padEnd(12)} ${service.healthUrl}`);
}

async function stopService(service) {
  const record = readState().find(({ name }) => name === service.name);
  if (!record) {
    console.log(`NOT MANAGED ${service.name.padEnd(12)} no recorded process`);
    return;
  }

  if (!isOwnedProcessRunning(service, record)) {
    console.log(`STALE      ${service.name.padEnd(12)} pid=${record.pid}`);
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
  console.log(`STOPPING   ${service.name.padEnd(12)} pid=${record.pid}`);

  if (!(await waitForProcessGroupExit(record.pid, stopTimeoutMs))) {
    throw new Error(`${service.name} did not stop within ${stopTimeoutMs / 1_000}s. Its process was not force-killed.`);
  }

  removeStateRecord(service.name);
  console.log(`STOPPED    ${service.name.padEnd(12)} port=${service.port}`);
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

async function checkHealth(service) {
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
    if (!isProcessGroupRunning(pid)) {
      return { healthy: false, reachable: false, detail: "managed process exited during startup" };
    }
    await delay(1_000);
    health = await checkHealth(service);
  }
  return health;
}

function isPortOpen(port) {
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
    socket.connect(port, "127.0.0.1");
  });
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
  const lines = readFileSync(logPath, "utf8").split(/\r?\n/);
  console.error(`\nLast ${lineCount} lines from ${logPath}:`);
  console.error(lines.slice(-lineCount).join("\n").trimEnd());
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function selectedServices(names) {
  return names.length > 0 ? names : managedServices.map(({ name }) => name);
}
