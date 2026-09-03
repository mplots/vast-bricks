import { readdirSync } from "node:fs";
import { resolve, sep } from "node:path";

import { vastApiEnvFile } from "./env-file.mjs";
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
    // The deployable runtime: vb-portal-api serving legacy and rewritten features from one launch, as production
    // does. It is started only when named, because its environment file holds real credentials that no test run
    // should ever reach.
    name: "vast-api",
    port: 6363,
    healthUrl: "http://127.0.0.1:6363/api/health",
    command: "java",
    args: () => ["-jar", resolveLegacyJar()],
    cwd: repoRoot,
    envFile: vastApiEnvFile,
    env: {
      // The legacy application fixes server.port at 6161 for IntelliJ launches, so the managed port is set here.
      SERVER_PORT: "6363",
    },
    build: {
      command: "mvn",
      args: ["-pl", "vb-portal-api", "-am", "clean", "package", "-DskipTests"],
    },
    processMarker: `vb-portal-api${sep}target${sep}vb-portal-api-`,
    startWhenNamed: true,
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
      // The portal proxies to the standalone launcher, not to the acceptance runtime with its test-only endpoints.
      VITE_APP_API_PROXY: "http://127.0.0.1:6363",
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

// vast-acceptance-tests adds test-only endpoints on top of the vast-api launcher it depends on.
function resolveAcceptanceJar() {
  return resolveSingleJar(resolve(repoRoot, "vast-acceptance-tests", "target"), "vast-acceptance-tests-", ".jar");
}

function resolveSingleJar(targetDirectory, prefix, suffix) {
  const candidates = safeReadDirectory(targetDirectory)
    .filter((name) => name.startsWith(prefix) && name.endsWith(suffix))
    .sort();

  if (candidates.length !== 1) {
    throw new Error(
      `Expected one executable ${prefix}*${suffix} in ${targetDirectory}, found ${candidates.length}. Run without --skip-build.`,
    );
  }

  return resolve(targetDirectory, candidates[0]);
}

// vb-portal-api embeds vast-services, so one launch serves the legacy and rewritten halves of the backend.
function resolveLegacyJar() {
  return resolveSingleJar(resolve(repoRoot, "vb-portal-api", "target"), "vb-portal-api-", ".jar");
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
