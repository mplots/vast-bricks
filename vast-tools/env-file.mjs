import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { relative, resolve } from "node:path";

import { repoRoot } from "./paths.mjs";

/**
 * External environment files hold real credentials, so they live outside the repository and are read for one
 * managed service only. Nothing here writes into process.env: values are handed straight to the spawned service,
 * so no other managed service — the acceptance runtime above all — can inherit them.
 */

const defaultVastApiEnvFile = resolve(homedir(), ".vast", "vast-api.env");
const keyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Resolved when a service is started, so a misconfigured path is reported as a start failure, not a load crash. */
export function vastApiEnvFile() {
  return resolveExternalPath(process.env.VAST_API_ENV_FILE, defaultVastApiEnvFile, "VAST_API_ENV_FILE");
}

export function readEnvFile(path, serviceName) {
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `${serviceName} needs the external environment file ${path}, which does not exist. Create it as KEY=value lines with that service's credentials, run 'chmod 600' on it, or point VAST_API_ENV_FILE at another file outside the repository.`,
      );
    }
    throw error;
  }

  requirePrivateFile(path, serviceName);

  const values = {};
  contents.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      return;
    }

    const assignment = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const separator = assignment.indexOf("=");
    const key = separator === -1 ? "" : assignment.slice(0, separator).trim();
    if (!keyPattern.test(key)) {
      throw new Error(`${path} line ${index + 1} is not a KEY=value assignment.`);
    }

    values[key] = unquote(assignment.slice(separator + 1).trim());
  });

  return values;
}

function unquote(value) {
  const quoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
  return quoted && value.length >= 2 ? value.slice(1, -1) : value;
}

/** Credentials readable by other accounts on the machine are treated as a setup error, not a warning. */
function requirePrivateFile(path, serviceName) {
  const mode = statSync(path).mode & 0o777;
  if ((mode & 0o077) !== 0) {
    throw new Error(
      `${path} holds ${serviceName} credentials but is readable beyond its owner (mode ${mode.toString(8).padStart(3, "0")}). Run: chmod 600 ${path}`,
    );
  }
}

/** Keeps credential files out of the working tree, where they could be committed. */
function resolveExternalPath(configured, fallback, variableName) {
  const path = configured && configured.trim() !== "" ? resolve(expandHome(configured.trim())) : fallback;
  const insideRepository = !relative(repoRoot, path).startsWith("..");
  if (insideRepository) {
    throw new Error(`${variableName} must point outside the repository, but ${path} is inside ${repoRoot}.`);
  }
  return path;
}

function expandHome(path) {
  return path === "~" || path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : path;
}
