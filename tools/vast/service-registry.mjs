import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { repoRoot } from "./paths.mjs";

export const managedServices = [
  {
    name: "vast-api",
    port: 6362,
    healthUrl: "http://127.0.0.1:6362/api/vast/health",
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
    name: "vast-portal",
    port: 3100,
    healthUrl: "http://127.0.0.1:3100/",
    command: "npm",
    args: [
      "--prefix",
      "vast-portal",
      "run",
      "start",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      "3100",
      "--strictPort",
    ],
    cwd: repoRoot,
    env: {
      VAST_MANAGED: "true",
      VITE_APP_API_PROXY: "http://127.0.0.1:6362",
    },
    processMarker: "vast-portal",
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
