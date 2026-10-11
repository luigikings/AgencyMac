// Staging copy of the public website (spec 003, RF-9, RF-10, plan P4).
// Copies the production build to a separate folder and adds, only to that
// copy, one _headers rule for every path with X-Robots-Tag: noindex and the
// version header the smoke test waits for. The build itself is never
// modified, and a build that already ships _headers is refused (RF-9).
//
// Usage: node scripts/staging/staging-copy.mjs --from dist --to .staging --version <40-hex SHA | local>
import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const VERSION_PATTERN = /^(?:[0-9a-f]{40}|local)$/;

/** Text of the staging _headers file. Throws on an invalid version id. */
export function stagingHeaders(version) {
  if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
    throw new Error(
      "Invalid version: use the full commit SHA (40 lowercase hex) or local",
    );
  }
  return `/*\n  X-Robots-Tag: noindex\n  X-Staging-Version: ${version}\n`;
}

/** Replaces `to` with a copy of the build in `from` plus _headers. */
export function prepareStagingCopy({ from, to, version }) {
  const headers = stagingHeaders(version);
  const source = resolve(from);
  const target = resolve(to);
  const inside = relative(source, target);
  if (inside === "" || (!inside.startsWith("..") && !isAbsolute(inside))) {
    throw new Error("The destination must be outside the build folder");
  }
  if (!existsSync(join(source, "index.html"))) {
    throw new Error("The build folder has no index.html: run the build first");
  }
  if (existsSync(join(source, "_headers"))) {
    throw new Error(
      "The build already contains _headers: the production build must not ship one (RF-9)",
    );
  }
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  writeFileSync(join(target, "_headers"), headers);
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--from") options.from = argv[++i];
    else if (argv[i] === "--to") options.to = argv[++i];
    else if (argv[i] === "--version") options.version = argv[++i];
  }
  return options;
}

const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const { from, to, version } = parseArgs(process.argv.slice(2));
  try {
    if (!from || !to)
      throw new Error("Usage: --from <build> --to <copy> --version <id>");
    prepareStagingCopy({ from, to, version });
    console.log(`Staging copy ready in ${to} (version ${version}).`);
  } catch (error) {
    console.error(`staging-copy: ${error.message}`);
    process.exit(1);
  }
}
