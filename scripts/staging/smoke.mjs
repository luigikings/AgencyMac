// Smoke test of the staging website (spec 003, RF-13 to RF-27, RF-39).
// Thin CLI over scripts/staging/smoke-checks.mjs: it does the requests
// (fetch with redirect: "manual" and a timeout per request), waits for the
// expected version and runs every check. It prints only relative paths,
// never the URL or host under test, and exits with 1 if anything fails.
//
// Usage:
//   node scripts/staging/smoke.mjs --url http://localhost:8787 --version local
//   node scripts/staging/smoke.mjs --version <sha>
//     (CI: the URL is built from the CF_WORKERS_SUBDOMAIN secret in the env)
import { pathToFileURL } from "node:url";
import {
  SMOKE_CHECKS,
  evaluateResponse,
  extractFaviconUrl,
  extractFontUrls,
  extractStylesheetUrls,
  faviconCheck,
  fontCheck,
  formatFailure,
  relativize,
  stagingUrl,
  waitForVersion,
} from "./smoke-checks.mjs";

const WORKER_NAME = "agencymac-staging";
const REQUEST_TIMEOUT_MS = 15_000;
const PAGES = ["/", "/en/"];

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") options.url = argv[++i];
    else if (argv[i] === "--version") options.version = argv[++i];
  }
  return options;
}

function resolveBaseUrl(url, env) {
  if (url) return new URL(url).origin;
  if (env.CF_WORKERS_SUBDOMAIN) {
    return stagingUrl(WORKER_NAME, env.CF_WORKERS_SUBDOMAIN);
  }
  throw new Error(
    "No URL to check: pass --url <url> (local) or set the CF_WORKERS_SUBDOMAIN secret (CI).",
  );
}

async function request(url) {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.text(),
  };
}

export async function runSmoke({ baseUrl, version, log = console.log }) {
  const failures = [];
  // Network errors are reported by name only: their message may hold the host.
  const fetchOrFail = async (path) => {
    try {
      return await request(new URL(path, baseUrl).href);
    } catch (error) {
      failures.push(
        formatFailure({
          path,
          expected: "a response",
          actual: error.name,
          baseUrl,
        }),
      );
      return null;
    }
  };
  const run = async (check) => {
    const response = await fetchOrFail(check.path);
    if (!response) return null;
    const result = evaluateResponse(check, response, { baseUrl });
    failures.push(...result.failures);
    log(`${result.ok ? "ok  " : "FAIL"} ${check.path}`);
    return response;
  };

  const versionResult = await waitForVersion({
    fetchVersion: async () =>
      (await request(new URL("/", baseUrl).href)).headers.get(
        "x-staging-version",
      ),
    expected: version,
    now: () => Date.now(),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  });
  if (!versionResult.ok)
    return { ok: false, failures: [versionResult.failure] };
  log(`ok   / (X-Staging-Version ${version})`);

  for (const check of SMOKE_CHECKS) await run(check);

  // Favicon and fonts declared by the two home pages (and their stylesheets).
  const assets = new Map();
  for (const page of PAGES) {
    const response = await fetchOrFail(page);
    if (!response) continue;
    const pageUrl = new URL(page, baseUrl);
    const favicon = extractFaviconUrl(response.body);
    if (favicon)
      assets.set(
        relativize(new URL(favicon, pageUrl).href, baseUrl),
        faviconCheck,
      );
    else
      failures.push(
        formatFailure({
          path: page,
          expected: "a declared favicon",
          actual: "(none)",
        }),
      );

    const fonts = extractFontUrls(response.body).map(
      (font) => new URL(font, pageUrl),
    );
    for (const sheet of extractStylesheetUrls(response.body)) {
      const sheetUrl = new URL(sheet, pageUrl);
      const css = await fetchOrFail(relativize(sheetUrl.href, baseUrl));
      if (css)
        fonts.push(
          ...extractFontUrls(css.body).map((font) => new URL(font, sheetUrl)),
        );
    }
    if (fonts.length === 0) {
      failures.push(
        formatFailure({
          path: page,
          expected: "at least one woff2 font",
          actual: "(none)",
        }),
      );
    }
    for (const font of fonts)
      assets.set(relativize(font.href, baseUrl), fontCheck);
  }
  for (const [path, makeCheck] of assets) {
    if (path === "(other host)" || path === "(none)") {
      failures.push(
        formatFailure({
          path,
          expected: "an asset on the same host",
          actual: path,
        }),
      );
      continue;
    }
    await run(makeCheck(path));
  }

  return { ok: failures.length === 0, failures };
}

const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  let baseUrl;
  try {
    const { url, version } = parseArgs(process.argv.slice(2));
    baseUrl = resolveBaseUrl(url, process.env);
    if (!version)
      throw new Error("Missing --version <full commit SHA | local>.");
    const { ok, failures } = await runSmoke({ baseUrl, version });
    for (const failure of failures) console.error(`FAIL ${failure}`);
    console.log(
      ok
        ? "Smoke test passed."
        : `Smoke test failed: ${failures.length} problem(s).`,
    );
    process.exitCode = ok ? 0 : 1;
  } catch (error) {
    // Never print the host under test, even in an unexpected error.
    const message = baseUrl
      ? error.message.replaceAll(new URL(baseUrl).host, "(staging host)")
      : error.message;
    console.error(`smoke: ${message}`);
    process.exitCode = 1;
  }
}
