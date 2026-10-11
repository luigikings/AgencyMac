// Pre-deploy check of the staging job (spec 003, RF-4, RF-37).
// The deploy only goes ahead when the three secrets exist and are not empty,
// and the commit of the run is still the tip of main (no old commit is ever
// published). Otherwise the next steps are skipped with a warning and the
// job stays green. Warnings name the secrets, never their values.
//
// CLI (in the deploy job): reads the tip of main with
// `git ls-remote origin refs/heads/main` (public repo, no token), writes
// ready=true|false to $GITHUB_OUTPUT and each warning as ::warning::.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { SECRET_NAMES } from "../lib/leaks.mjs";

export function preflight({ env, names, sha, mainSha }) {
  const warnings = [];
  for (const name of names) {
    const value = env[name];
    if (typeof value !== "string" || value.trim() === "") {
      warnings.push(
        `Secret ${name} is missing or empty in the staging environment: deploy skipped.`,
      );
    }
  }
  if (!mainSha) {
    warnings.push("Could not read the tip of main: deploy skipped.");
  } else if (sha !== mainSha) {
    warnings.push(
      `Commit ${sha || "(unknown)"} is no longer the tip of main (${mainSha}): deploy skipped, a newer run will deploy.`,
    );
  }
  return { ready: warnings.length === 0, warnings };
}

/** SHA of refs/heads/main in `git ls-remote` output, or null. */
export function parseLsRemote(output) {
  for (const line of output.split(/\r?\n/)) {
    const [sha, ref] = line.trim().split(/\s+/);
    if (ref === "refs/heads/main" && /^[0-9a-f]{40}$/.test(sha)) return sha;
  }
  return null;
}

function readMainSha() {
  try {
    const output = execFileSync(
      "git",
      ["ls-remote", "origin", "refs/heads/main"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return parseLsRemote(output);
  } catch {
    return null;
  }
}

const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const { ready, warnings } = preflight({
    env: process.env,
    names: SECRET_NAMES,
    sha: process.env.GITHUB_SHA ?? "",
    mainSha: readMainSha(),
  });
  for (const warning of warnings) console.log(`::warning::${warning}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `ready=${ready}\n`);
  }
  console.log(`ready=${ready}`);
}
