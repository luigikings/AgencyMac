// Guard run before browser tests and audits: Playwright's chrome-headless-shell
// must be installed. It is the single browser shared by Playwright and
// Lighthouse CI (the full Chromium build does not start on the developer's
// Windows machine, see specs/001-base/plan.md).
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const INSTALL_COMMAND = "pnpm browsers:install";

const HEADLESS_SHELL_DIR = /^chromium_headless_shell-(\d+)$/;

/**
 * Pure lookup of the newest Playwright chrome-headless-shell executable.
 * @param {{ browsersDir: string, platform: string, entries: string[], arch?: string }} input
 *   entries: folder names inside browsersDir; arch is only used on macOS.
 * @returns {string | null}
 */
export function findHeadlessShell({ browsersDir, platform, entries, arch }) {
  const subPaths = {
    win32: ["chrome-headless-shell-win64", "chrome-headless-shell.exe"],
    linux: ["chrome-headless-shell-linux64", "chrome-headless-shell"],
    darwin: [
      `chrome-headless-shell-mac-${arch === "arm64" ? "arm64" : "x64"}`,
      "chrome-headless-shell",
    ],
  };
  const sub = subPaths[platform];
  if (!sub) return null;
  const newest = entries
    .map((name) => ({ name, match: HEADLESS_SHELL_DIR.exec(name) }))
    .filter(({ match }) => match)
    .sort((a, b) => Number(b.match[1]) - Number(a.match[1]))[0];
  if (!newest) return null;
  const join = platform === "win32" ? path.win32.join : path.posix.join;
  return join(browsersDir, newest.name, ...sub);
}

/**
 * Pure check of the headless shell installation.
 * @param {{ executablePath: string, exists: boolean }} browser
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function browserStatus({ executablePath, exists }) {
  if (executablePath && exists) return { ok: true };
  const where = executablePath ? ` en ${executablePath}` : "";
  return {
    ok: false,
    message: `chrome-headless-shell de Playwright no encontrado${where}. Ejecuta: ${INSTALL_COMMAND}`,
  };
}

/** Playwright's browsers folder: PLAYWRIGHT_BROWSERS_PATH or the OS default. */
function playwrightBrowsersDir() {
  const custom = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (custom && custom !== "0") return custom;
  if (process.platform === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local");
    return path.join(localAppData, "ms-playwright");
  }
  if (process.platform === "darwin") {
    return path.join(homedir(), "Library", "Caches", "ms-playwright");
  }
  const cache = process.env.XDG_CACHE_HOME ?? path.join(homedir(), ".cache");
  return path.join(cache, "ms-playwright");
}

/**
 * Locates the installed headless shell on this machine (reads env and disk).
 * Used by the CLI below and by apps/web/lighthouserc.cjs.
 * @returns {string} executable path, or "" when it cannot be located
 */
export function locateHeadlessShell() {
  const browsersDir = playwrightBrowsersDir();
  let entries = [];
  try {
    entries = readdirSync(browsersDir);
  } catch {
    // Missing folder: nothing installed yet.
  }
  return (
    findHeadlessShell({
      browsersDir,
      platform: process.platform,
      entries,
      arch: process.arch,
    }) ?? ""
  );
}

// No top-level await: this module is also loaded with require() from
// lighthouserc.cjs, which does not support asynchronous ES modules.
const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const executablePath = locateHeadlessShell();
  const status = browserStatus({
    executablePath,
    exists: executablePath !== "" && existsSync(executablePath),
  });
  if (!status.ok) {
    console.error(`Error: ${status.message}`);
    process.exit(1);
  }
}
