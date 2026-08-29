import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { repoRoot } from "./paths.mjs";

const viteExecutable = resolve(repoRoot, "vast-portal", "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");

export const managedServices = [
  {
    name: "postgres",
    port: 2345,
    healthCheck: "tcp",
    host: "127.0.0.1",
    dockerComposeService: "postgres",
    containerName: "vast-bricks-postgres",
  },
  {
    name: "tor-proxy",
    port: 8118,
    healthCheck: "tcp",
    host: "127.0.0.1",
    dockerComposeService: "tor-proxy",
    containerName: "vast-bricks-tor-proxy",
  },
  {
    name: "vast-api",
    port: 6362,
    healthUrl: "http://127.0.0.1:6362/api/health",
    command: "java",
    args: () => ["-jar", resolveApiJar()],
    cwd: repoRoot,
    env: {
      VAST_API_PORT: "6362",
    },
    build: {
      command: "mvn",
      args: ["-pl", "vast-api", "-am", "package", "-DskipTests"],
    },
    processMarker: "vast-api-",
  },
  {
    name: "wiremock",
    port: 9010,
    healthUrl: "http://127.0.0.1:9010/__admin",
    dockerComposeService: "wiremock",
    containerName: "vast-bricks-wiremock",
  },
  {
    name: "vast-portal",
    port: 3100,
    healthUrl: "http://127.0.0.1:3100/",
    dependency: {
      path: viteExecutable,
      install: {
        command: "yarn",
        args: ["--cwd", "vast-portal", "install", "--frozen-lockfile"],
      },
    },
    command: viteExecutable,
    args: [
      "--host",
      "127.0.0.1",
      "--port",
      "3100",
      "--strictPort",
    ],
    cwd: resolve(repoRoot, "vast-portal"),
    env: {
      VAST_MANAGED: "true",
      VITE_APP_API_PROXY: "http://127.0.0.1:6362",
    },
    processMarker: "node_modules/.bin/vite",
  },
];

export function findService(name) {
  const service = managedServices.find((candidate) => candidate.name === name);
  if (!service) {
    throw new Error(
      `Unknown service '${name}'. Available services: ${managedServices.map(({ name: serviceName }) => serviceName).join(", ")}.`,
    );
  }
  return service;
}

function resolveApiJar() {
  const targetDirectory = resolve(repoRoot, "vast-api", "target");
  const candidates = safeReadDirectory(targetDirectory)
    .filter((name) => name.startsWith("vast-api-") && name.endsWith(".jar"))
    .filter((name) => !name.endsWith(".jar.original"))
    .sort();

  if (candidates.length !== 1) {
    throw new Error(
      `Expected one executable vast-api JAR in ${targetDirectory}, found ${candidates.length}. Run without --skip-build.`,
    );
  }

  return resolve(targetDirectory, candidates[0]);
}

function safeReadDirectory(directory) {
  try {
    return readdirSync(directory);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
