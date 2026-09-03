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
    name: "vast-api-test",
    port: 6362,
    healthUrl: "http://127.0.0.1:6362/api/health",
    command: "java",
    args: () => ["-jar", resolveAcceptanceJar()],
    cwd: repoRoot,
    env: {
      VAST_API_PORT: "6362",
      VAST_SETTINGS_DEFAULT_PROFILE: "vast-playwright-default",
      VAST_HEALTH_SETTING_ENV_VALUE: "managed-health-env-value",
      VAST_BRICKSTORE_TOR_ENABLED: "false",
      VAST_AUTH_JWT_SECRET: "vast-playwright-auth-secret-must-be-at-least-32-bytes",
      VAST_SETTINGS_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    },
    build: {
      command: "mvn",
      args: ["-pl", "vast-acceptance-tests", "-am", "clean", "package", "-DskipTests"],
    },
    processMarker: "vast-acceptance-tests-",
  },
  {
    name: "wiremock",
    port: 9011,
    healthUrl: "http://127.0.0.1:9011/__admin",
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

// The managed service runs vast-acceptance-tests, which adds test-only endpoints on top of the
// vast-api launcher it depends on. vast-api's own executable JAR carries the "exec" classifier.
function resolveAcceptanceJar() {
  const targetDirectory = resolve(repoRoot, "vast-acceptance-tests", "target");
  const candidates = safeReadDirectory(targetDirectory)
    .filter((name) => name.startsWith("vast-acceptance-tests-") && name.endsWith(".jar"))
    .sort();

  if (candidates.length !== 1) {
    throw new Error(
      `Expected one executable vast-acceptance-tests JAR in ${targetDirectory}, found ${candidates.length}. Run without --skip-build.`,
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
