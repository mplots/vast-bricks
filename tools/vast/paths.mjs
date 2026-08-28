import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolsDirectory = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(toolsDirectory, "..", "..");
export const runtimeRoot = resolve(repoRoot, ".vast");
export const logsRoot = resolve(runtimeRoot, "logs");
export const servicesStatePath = resolve(runtimeRoot, "services.json");
