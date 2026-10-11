// Pure logic of the staging smoke test (spec 003, RF-13 to RF-27, RF-39).
// No network, clock or file system here: scripts/staging/smoke.mjs does the
// requests and passes the responses ({ status, headers, body }) in.
// Failure messages show only the relative path, the expected value and the
// value seen; the staging host is never printed (RF-27, RF-39).

const SITE = "https://agencymac.com";
const REDIRECT_CODES = [301, 302, 307, 308];
const HREFLANG = { es: `${SITE}/`, en: `${SITE}/en/`, "x-default": `${SITE}/` };
const SITE_NAME = "AgencyMac";
const CONTROL_TITLE = "Centro de Control";
const SUBDOMAIN_PATTERN = /^[a-z0-9-]+$/;

const home = (path, lang, canonical) => ({
  path,
  status: 200,
  lang,
  noindex: true,
  canonical,
  notControl: true,
});
const notFound = (path, lang, extra = {}) => ({
  path,
  status: 404,
  lang,
  ...extra,
});

// Table of section 5 of the plan. Status "redirect" accepts any 3xx code
// (the exact one is observed in T5); "redirect-or-ok" also accepts 200, and
// then the page must carry its canonical.
export const SMOKE_CHECKS = [
  home("/", "es", `${SITE}/`),
  home("/en/", "en", `${SITE}/en/`),
  notFound("/no-existe/", "es", { noindex: true }),
  notFound("/no-existe", "es", { noindex: true }),
  notFound("/en/no-existe/", "en", { noindex: true }),
  notFound("/en/no-existe", "en", { noindex: true }),
  notFound("/404", "es"),
  notFound("/404.html", "es"),
  notFound("/en/404", "en"),
  notFound("/en/404.html", "en"),
  {
    path: "/index.html",
    status: "redirect-or-ok",
    location: "/",
    canonical: `${SITE}/`,
  },
  {
    path: "/en/index.html",
    status: "redirect-or-ok",
    location: "/en/",
    canonical: `${SITE}/en/`,
  },
  { path: "/en", status: "redirect", location: "/en/", noindex: true },
  { path: "/en?x=1", status: "redirect", location: "/en/?x=1", noindex: true },
  notFound("/EN/", "es"),
  notFound("/En/", "es"),
  notFound("/Favicon.svg", "es"),
  { path: "/_headers", status: 404 },
  { path: "/_redirects", status: 404 },
];

export function faviconCheck(path) {
  return { path, status: 200, contentType: "image/svg+xml", noindex: true };
}

export function fontCheck(path) {
  return { path, status: 200, contentType: "font/woff2" };
}

function header(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name);
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key === undefined ? null : headers[key];
}

function attribute(tag, name) {
  const match = new RegExp(
    `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i",
  ).exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3]) : null;
}

function links(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => ({
    rel: (attribute(tag, "rel") ?? "").toLowerCase().split(/\s+/),
    href: attribute(tag, "href"),
    hreflang: attribute(tag, "hreflang"),
  }));
}

const quoted = (value) => (value == null ? "(none)" : `"${value}"`);

function htmlLang(html) {
  const tag = /<html\b[^>]*>/i.exec(html);
  return tag ? attribute(tag[0], "lang") : null;
}

function htmlTitle(html) {
  const match = /<title\b[^>]*>([^<]*)<\/title>/i.exec(html);
  return match ? match[1].trim() : null;
}

function statusAllowed(check, status) {
  if (check.status === "redirect") return REDIRECT_CODES.includes(status);
  if (check.status === "redirect-or-ok")
    return status === 200 || REDIRECT_CODES.includes(status);
  return status === check.status;
}

function expectedStatus(check) {
  if (check.status === "redirect") return REDIRECT_CODES.join("|");
  if (check.status === "redirect-or-ok")
    return [...REDIRECT_CODES, 200].join("|");
  return String(check.status);
}

export function evaluateResponse(check, response, { baseUrl }) {
  const problems = [];
  const expect = (expected, actual) => problems.push({ expected, actual });
  const { status } = response;
  const body = response.body ?? "";
  const isRedirect = REDIRECT_CODES.includes(status);

  if (!statusAllowed(check, status)) {
    expect(`status ${expectedStatus(check)}`, String(status));
  }

  if (check.noindex) {
    const robots = header(response.headers, "x-robots-tag");
    if (!robots || !/noindex/i.test(robots)) {
      expect("X-Robots-Tag noindex", quoted(robots));
    }
  }

  if (isRedirect) {
    if (check.location) {
      const location = relativize(
        header(response.headers, "location"),
        baseUrl,
      );
      if (location !== check.location) {
        expect(`location "${check.location}"`, `"${location}"`);
      }
    }
  } else {
    if (check.contentType) {
      const type = header(response.headers, "content-type");
      if (!type || !type.toLowerCase().startsWith(check.contentType)) {
        expect(`content type "${check.contentType}"`, quoted(type));
      }
    }

    if (check.lang) {
      const lang = htmlLang(body);
      if (lang !== check.lang) expect(`lang "${check.lang}"`, quoted(lang));
    }

    if (check.notControl) {
      const title = htmlTitle(body);
      if (
        !title ||
        !title.includes(SITE_NAME) ||
        title.includes(CONTROL_TITLE)
      ) {
        expect(
          `title with "${SITE_NAME}" and without "${CONTROL_TITLE}"`,
          quoted(title),
        );
      }
    }

    // Only a page served with 200 is expected to carry canonical/hreflang.
    if (check.canonical && status === 200) {
      const pageLinks = links(body);
      const canonical =
        pageLinks.find(({ rel }) => rel.includes("canonical"))?.href ?? null;
      if (canonical !== check.canonical) {
        expect(`canonical "${check.canonical}"`, quoted(canonical));
      }
      for (const [code, href] of Object.entries(HREFLANG)) {
        const seen =
          pageLinks.find(
            ({ rel, hreflang }) =>
              rel.includes("alternate") && hreflang?.toLowerCase() === code,
          )?.href ?? null;
        if (seen !== href) expect(`hreflang ${code} "${href}"`, quoted(seen));
      }
    }
  }

  const failures = problems.map(({ expected, actual }) =>
    formatFailure({ path: check.path, expected, actual, baseUrl }),
  );
  return { ok: failures.length === 0, failures };
}

function uniqueMatches(text, pattern) {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[1]))];
}

// woff2 URLs referenced from HTML (url() in <style>, preload links) or CSS.
export function extractFontUrls(text) {
  return uniqueMatches(
    text,
    /(?:url\(\s*["']?|href\s*=\s*["'])([^"'()\s]+?\.woff2(?:[?#][^"'()\s]*)?)/gi,
  );
}

export function extractFaviconUrl(html) {
  return links(html).find(({ rel }) => rel.includes("icon"))?.href ?? null;
}

export function extractStylesheetUrls(html) {
  return links(html)
    .filter(({ rel, href }) => rel.includes("stylesheet") && href)
    .map(({ href }) => href);
}

// Location header → path + query when it stays on the staging host.
export function relativize(location, baseUrl) {
  if (!location) return "(none)";
  const base = new URL(baseUrl);
  const url = new URL(location, base);
  return url.origin === base.origin
    ? url.pathname + url.search
    : "(other host)";
}

export function formatFailure({ path, expected, actual, baseUrl }) {
  const message = `${path}: expected ${expected}, got ${actual}`;
  if (!baseUrl) return message;
  const host = new URL(baseUrl).host;
  return message.replace(
    new RegExp(host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
    "(staging host)",
  );
}

export function stagingUrl(worker, subdomain) {
  if (typeof worker !== "string" || !SUBDOMAIN_PATTERN.test(worker)) {
    throw new Error("Invalid worker name (allowed: a-z, 0-9 and -)");
  }
  if (typeof subdomain !== "string" || !SUBDOMAIN_PATTERN.test(subdomain)) {
    throw new Error("Invalid account subdomain (allowed: a-z, 0-9 and -)");
  }
  return `https://${worker}.${subdomain}.workers.dev`;
}

// Retries until the X-Staging-Version header equals the expected id, never
// starting an attempt after limitMs (RF-14). A network error counts as
// "no version yet".
export async function waitForVersion({
  fetchVersion,
  expected,
  now,
  sleep,
  limitMs = 180_000,
  intervalMs = 10_000,
}) {
  const start = now();
  for (;;) {
    let got = null;
    try {
      got = await fetchVersion();
    } catch {
      got = null;
    }
    if (got === expected) return { ok: true };
    if (now() - start + intervalMs > limitMs) {
      return {
        ok: false,
        failure: formatFailure({
          path: "/",
          expected: `X-Staging-Version ${expected}`,
          actual: got ?? "(none)",
        }),
      };
    }
    await sleep(intervalMs);
  }
}
