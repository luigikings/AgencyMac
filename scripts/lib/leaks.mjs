// Leak detector for files that end up in the public repository (spec 003,
// RF-36). Pure: it receives { path, content } pairs and returns where a rule
// is broken, never the offending value.
//
// (a) workers-dev: any concrete *.workers.dev host. Placeholders such as
//     "agencymac-staging.<subdominio>.workers.dev" or "*.workers.dev" pass by
//     construction, because the character before ".workers.dev" is not a
//     letter, digit or hyphen.
// (b) secret-value: a Cloudflare secret name assigned to a literal value
//     instead of its GitHub secret reference, an empty value or a <marker>.
// (c) env-file: a .env (other than .env.example), .dev.vars or .wrangler/
//     file.
// Generic hex strings are not searched on purpose (lockfile, action SHAs).

export const SECRET_NAMES = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CF_WORKERS_SUBDOMAIN",
];

const WORKERS_DEV_HOST = /[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev/i;

// NAME, optional spaces, ":" or "=" (but not "==", a comparison), value.
const assignment = (name) =>
  new RegExp(`(?<![A-Za-z0-9_])${name}\\s*[:=](?!=)(.*)$`);
const SECRET_ASSIGNMENTS = SECRET_NAMES.map((name) => ({
  pattern: assignment(name),
  reference: new RegExp(`^\\$\\{\\{\\s*secrets\\.${name}\\s*\\}\\}$`),
}));

function unquote(value) {
  const match = /^(["'`])(.*)\1$/.exec(value);
  return match ? match[2] : value;
}

function isAllowedSecretValue(raw, reference) {
  const value = unquote(
    raw
      .trim()
      .replace(/[,;]+$/, "")
      .trim(),
  ).trim();
  return value === "" || /^<[^<>]+>$/.test(value) || reference.test(value);
}

function lineHasSecretValue(line) {
  return SECRET_ASSIGNMENTS.some(({ pattern, reference }) => {
    const match = pattern.exec(line);
    return match !== null && !isAllowedSecretValue(match[1], reference);
  });
}

function isForbiddenFile(path) {
  const segments = path.split("/");
  const name = segments.at(-1);
  if (segments.slice(0, -1).includes(".wrangler")) return true;
  if (name === ".dev.vars") return true;
  return (
    (name === ".env" || name.startsWith(".env.")) && name !== ".env.example"
  );
}

export function findLeaks(files) {
  const leaks = [];
  for (const file of files) {
    const path = file.path.replaceAll("\\", "/");
    if (isForbiddenFile(path)) {
      leaks.push({ path, line: 1, rule: "env-file" });
    }
    const lines = file.content.split(/\r?\n/);
    lines.forEach((text, index) => {
      if (WORKERS_DEV_HOST.test(text)) {
        leaks.push({ path, line: index + 1, rule: "workers-dev" });
      }
      if (lineHasSecretValue(text)) {
        leaks.push({ path, line: index + 1, rule: "secret-value" });
      }
    });
  }
  return leaks;
}

export function formatLeak({ path, line, rule }) {
  return `${path}:${line} (${rule})`;
}
