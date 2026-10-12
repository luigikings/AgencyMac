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
const REQUEST_TIMEOUT_MS = 15_000;

// Titles of the 404 pages (RF-16, RF-17). A test keeps them equal to the
// website translations (apps/web/src/lib), which this plain script cannot
// import at run time.
export const ERROR_TITLES = {
  es: "Página no encontrada · AgencyMac",
  en: "Page not found · AgencyMac",
};

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

// Cloudflare answers these redirects with 307 (observed with wrangler dev in
// T5 and accepted in D17); the local server copies it.
const redirect = (path, location) => ({
  path,
  status: 307,
  location,
  noindex: true,
});

// Table of section 5 of the plan (codes observed in Cloudflare, D17).
export const SMOKE_CHECKS = [
  home("/", "es", `${SITE}/`),
  home("/en/", "en", `${SITE}/en/`),
  notFound("/no-existe/", "es", { noindex: true, errorTitle: ERROR_TITLES.es }),
  notFound("/no-existe", "es", { noindex: true, errorTitle: ERROR_TITLES.es }),
  notFound("/en/no-existe/", "en", {
    noindex: true,
    errorTitle: ERROR_TITLES.en,
  }),
  notFound("/en/no-existe", "en", {
    noindex: true,
    errorTitle: ERROR_TITLES.en,
  }),
  // The error pages requested by their own URL answer 200 (D17).
  {
    path: "/404",
    status: 200,
    lang: "es",
    noindex: true,
    errorTitle: ERROR_TITLES.es,
  },
  redirect("/404.html", "/404"),
  {
    path: "/en/404",
    status: 200,
    lang: "en",
    noindex: true,
    errorTitle: ERROR_TITLES.en,
  },
  redirect("/en/404.html", "/en/404"),
  redirect("/index.html", "/"),
  redirect("/en/index.html", "/en/"),
  redirect("/en", "/en/"),
  redirect("/en?x=1", "/en/?x=1"),
  notFound("/EN/", "es"),
  notFound("/En/", "es"),
  notFound("/Favicon.svg", "es"),
  { path: "/_headers", status: 404 },
  { path: "/_redirects", status: 404 },
  // Spec 004: sitemap and robots.txt, also with noindex on staging.
  {
    path: "/sitemap.xml",
    status: 200,
    contentType: "application/xml",
    noindex: true,
  },
  {
    path: "/robots.txt",
    status: 200,
    contentType: "text/plain",
    noindex: true,
  },
];

/** An icon or image the pages declare: 200, its type and noindex on staging. */
export function iconCheck(path, contentType) {
  return { path, status: 200, contentType, noindex: true };
}

export function faviconCheck(path) {
  return iconCheck(path, "image/svg+xml");
}

/** The social image and the logo of the structured data are PNG files. */
export function imageCheck(path) {
  return iconCheck(path, "image/png");
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

export function evaluateResponse(check, response, { baseUrl }) {
  const problems = [];
  const expect = (expected, actual) => problems.push({ expected, actual });
  const { status } = response;
  const body = response.body ?? "";
  const isRedirect = REDIRECT_CODES.includes(status);

  if (status !== check.status) {
    expect(`status ${check.status}`, String(status));
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

    // RF-16, RF-17: the error page itself, not another page with the status.
    if (check.errorTitle) {
      const title = htmlTitle(body);
      if (title !== check.errorTitle) {
        expect(`title "${check.errorTitle}"`, quoted(title));
      }
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

// Every icon the page declares (rel "icon" and "apple-touch-icon") with the
// type it must be served as: its `type` attribute, or PNG for the Apple icon.
export function declaredIcons(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => ({
      rel: (attribute(tag, "rel") ?? "").toLowerCase().split(/\s+/),
      href: attribute(tag, "href"),
      type: attribute(tag, "type"),
    }))
    .filter(
      ({ rel, href }) =>
        href && (rel.includes("icon") || rel.includes("apple-touch-icon")),
    )
    .map(({ href, type }) => ({
      href,
      contentType: type ?? "image/png",
    }));
}

// Paths (never hosts) of the social image (og:image) and of the logo of the
// JSON-LD. Their absolute URLs point at the production domain, which the
// smoke test never requests: only the path is asked of the staging server.
export function extractSocialAssetPaths(html) {
  const urls = [];
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (attribute(tag, "property") === "og:image") {
      urls.push(attribute(tag, "content"));
    }
  }
  for (const [, json] of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      urls.push(JSON.parse(json).logo);
    } catch {
      // A broken block is simply not a source of paths.
    }
  }
  const paths = urls
    .filter((url) => typeof url === "string" && url !== "")
    .map((url) => new URL(url, "https://placeholder.invalid").pathname);
  return [...new Set(paths)];
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

// Retries until the X-Staging-Version header equals the expected id (RF-14).
// No attempt can go past limitMs: each request gets a timeout of
// min(requestTimeoutMs, time left), passed to fetchVersion({ timeoutMs }),
// and no attempt starts once the time is up. A network error or timeout
// counts as "no version yet".
export async function waitForVersion({
  fetchVersion,
  expected,
  now,
  sleep,
  limitMs = 180_000,
  intervalMs = 10_000,
  requestTimeoutMs = REQUEST_TIMEOUT_MS,
}) {
  const start = now();
  let got = null;
  const giveUp = () => ({
    ok: false,
    failure: formatFailure({
      path: "/",
      expected: `X-Staging-Version ${expected}`,
      actual: got ?? "(none)",
    }),
  });
  for (;;) {
    const remaining = limitMs - (now() - start);
    if (remaining <= 0) return giveUp();
    try {
      got = await fetchVersion({
        timeoutMs: Math.min(requestTimeoutMs, remaining),
      });
    } catch {
      got = null;
    }
    if (got === expected) return { ok: true };
    if (now() - start + intervalMs > limitMs) return giveUp();
    await sleep(intervalMs);
  }
}
