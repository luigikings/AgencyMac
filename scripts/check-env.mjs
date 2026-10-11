// Environment guard run on `preinstall`: requires Node 24 LTS and pnpm.
// No dependencies: it runs before anything is installed.
import { pathToFileURL } from "node:url";

export const REQUIRED_NODE_MAJOR = 24;
export const REQUIRED_NODE_RANGE = ">=24 <25";

/**
 * Pure check of the install environment.
 * @param {{ nodeVersion: string, userAgent: string | undefined }} env
 * @returns {string[]} human-readable errors; empty when the environment is valid.
 */
export function checkEnvironment({ nodeVersion, userAgent }) {
  const errors = [];
  const major = Number.parseInt(
    String(nodeVersion).replace(/^v/, "").split(".")[0] ?? "",
    10,
  );
  if (major !== REQUIRED_NODE_MAJOR) {
    errors.push(
      `Node 24 LTS requerido (${REQUIRED_NODE_RANGE}); tienes ${nodeVersion}.`,
    );
  }
  if (!userAgent?.startsWith("pnpm/")) {
    errors.push("Usa pnpm para instalar las dependencias: pnpm install");
  }
  return errors;
}

const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const errors = checkEnvironment({
    nodeVersion: process.version,
    userAgent: process.env.npm_config_user_agent,
  });
  if (errors.length > 0) {
    for (const error of errors) console.error(`Error: ${error}`);
    process.exit(1);
  }
}
