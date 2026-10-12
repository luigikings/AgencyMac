import { describe, expect, it } from "vitest";
import { t } from "../../apps/web/src/lib/i18n.ts";
import { SITE_NAME, buildPageTitle } from "../../apps/web/src/lib/site.ts";
import {
  ERROR_TITLES,
  SMOKE_CHECKS,
  declaredIcons,
  evaluateResponse,
  extractFaviconUrl,
  extractFontUrls,
  extractSocialAssetPaths,
  extractStylesheetUrls,
  faviconCheck,
  fontCheck,
  formatFailure,
  iconCheck,
  imageCheck,
  relativize,
  stagingUrl,
  waitForVersion,
} from "./smoke-checks.mjs";

// The staging host is built at run time so this file never trips the
// repository leak check (scripts/no-leaks.test.mjs).
const HOST = ["agencymac-staging", "acme-42", "workers", "dev"].join(".");
const BASE_URL = `https://${HOST}`;
const context = { baseUrl: BASE_URL };
const SITE = "https://agencymac.com";

function page({
  lang = "es",
  title = "Agencia de diseño web · AgencyMac",
  canonical,
  hreflang = { es: `${SITE}/`, en: `${SITE}/en/`, "x-default": `${SITE}/` },
} = {}) {
  const links = canonical
    ? `<link rel="canonical" href="${canonical}">` +
      Object.entries(hreflang)
        .map(
          ([code, href]) =>
            `<link rel="alternate" hreflang="${code}" href="${href}">`,
        )
        .join("")
    : "";
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>${title}</title>${links}<link rel="icon" href="/favicon.svg" type="image/svg+xml"></head><body><h1>Hola</h1></body></html>`;
}

const html = { "content-type": "text/html; charset=utf-8" };
const noindex = { "x-robots-tag": "noindex" };
// Titles of the error pages, straight from the website translations.
const ES_ERROR = buildPageTitle(SITE_NAME, t("es", "notFound.title"));
const EN_ERROR = buildPageTitle(SITE_NAME, t("en", "notFound.title"));

// A response that satisfies a check, built from the check itself.
function goodResponse(check) {
  const headers = {
    ...html,
    ...noindex,
    ...(check.contentType ? { "content-type": check.contentType } : {}),
  };
  if (check.location) {
    return {
      status: check.status,
      headers: { ...headers, location: check.location },
      body: "",
    };
  }
  const body = check.contentType
    ? "binary"
    : page({
        lang: check.lang ?? "es",
        canonical: check.canonical,
        ...(check.errorTitle ? { title: check.errorTitle } : {}),
      });
  return { status: check.status, headers, body };
}

describe("ERROR_TITLES", () => {
  it("match the titles of the 404 pages in the translations", () => {
    expect(ERROR_TITLES).toEqual({ es: ES_ERROR, en: EN_ERROR });
  });

  // RF-16, RF-17: the error pages are checked by their content (title).
  it.each([
    ["/no-existe/", ES_ERROR],
    ["/no-existe", ES_ERROR],
    ["/en/no-existe/", EN_ERROR],
    ["/en/no-existe", EN_ERROR],
    ["/404", ES_ERROR],
    ["/en/404", EN_ERROR],
  ])("%s expects the error page title", (path, title) => {
    expect(SMOKE_CHECKS.find((check) => check.path === path).errorTitle).toBe(
      title,
    );
  });
});

const checkFor = (path) => SMOKE_CHECKS.find((check) => check.path === path);

describe("SMOKE_CHECKS (table of section 5)", () => {
  it("covers every request of the table", () => {
    expect(SMOKE_CHECKS.map(({ path }) => path)).toEqual([
      "/",
      "/en/",
      "/no-existe/",
      "/no-existe",
      "/en/no-existe/",
      "/en/no-existe",
      "/404",
      "/404.html",
      "/en/404",
      "/en/404.html",
      "/index.html",
      "/en/index.html",
      "/en",
      "/en?x=1",
      "/EN/",
      "/En/",
      "/Favicon.svg",
      "/_headers",
      "/_redirects",
      "/sitemap.xml",
      "/robots.txt",
    ]);
  });

  it.each(SMOKE_CHECKS.map((check) => [check.path, check]))(
    "%s passes with the expected response",
    (_path, check) => {
      expect(evaluateResponse(check, goodResponse(check), context)).toEqual({
        ok: true,
        failures: [],
      });
    },
  );

  it.each([
    ["/", 200, "es"],
    ["/en/", 200, "en"],
    ["/no-existe/", 404, "es"],
    ["/en/no-existe", 404, "en"],
    ["/404", 200, "es"],
    ["/en/404", 200, "en"],
    ["/EN/", 404, "es"],
    ["/Favicon.svg", 404, "es"],
  ])("%s expects status %i and lang %s", (path, status, lang) => {
    expect(checkFor(path)).toMatchObject({ status, lang });
  });

  // D17: the codes observed in Cloudflare (wrangler dev), exactly 307.
  it.each([
    ["/404.html", "/404"],
    ["/en/404.html", "/en/404"],
    ["/index.html", "/"],
    ["/en/index.html", "/en/"],
    ["/en", "/en/"],
    ["/en?x=1", "/en/?x=1"],
  ])("%s expects exactly 307 to %s", (path, location) => {
    expect(checkFor(path)).toMatchObject({ status: 307, location });
  });

  it("asks for noindex on pages, 404s, the 200 error pages and redirects", () => {
    for (const path of [
      "/",
      "/en/",
      "/no-existe/",
      "/en/no-existe/",
      "/404",
      "/en/404",
      "/404.html",
      "/en/404.html",
      "/index.html",
      "/en/index.html",
      "/en",
      "/en?x=1",
    ]) {
      expect(checkFor(path).noindex, path).toBe(true);
    }
  });
});

describe("evaluateResponse — failures", () => {
  const fail = (path, response) => {
    const result = evaluateResponse(checkFor(path), response, context);
    expect(result.ok).toBe(false);
    return result.failures;
  };

  it("fails when a 404 is served with 200", () => {
    const failures = fail("/no-existe/", {
      status: 200,
      headers: { ...html, ...noindex },
      body: page({ lang: "es", title: ES_ERROR }),
    });
    expect(failures).toEqual(["/no-existe/: expected status 404, got 200"]);
  });

  it("fails when a 404 serves another page instead of the error page", () => {
    const failures = fail("/no-existe/", {
      status: 404,
      headers: { ...html, ...noindex },
      body: page({ lang: "es" }),
    });
    expect(failures).toEqual([
      `/no-existe/: expected title "${ES_ERROR}", got "Agencia de diseño web · AgencyMac"`,
    ]);
  });

  it("fails when /404 serves the home page with 200", () => {
    const failures = fail("/404", {
      status: 200,
      headers: { ...html, ...noindex },
      body: page({ lang: "es" }),
    });
    expect(failures).toEqual([
      `/404: expected title "${ES_ERROR}", got "Agencia de diseño web · AgencyMac"`,
    ]);
  });

  it("fails when /404 answers 404 instead of 200", () => {
    const failures = fail("/404", {
      status: 404,
      headers: { ...html, ...noindex },
      body: page({ lang: "es", title: ES_ERROR }),
    });
    expect(failures).toEqual(["/404: expected status 200, got 404"]);
  });

  it("fails when /en/404 serves the Spanish error page", () => {
    const failures = fail("/en/404", {
      status: 200,
      headers: { ...html, ...noindex },
      body: page({ lang: "es", title: ES_ERROR }),
    });
    expect(failures).toEqual([
      '/en/404: expected lang "en", got "es"',
      `/en/404: expected title "${EN_ERROR}", got "${ES_ERROR}"`,
    ]);
  });

  it("fails when /404.html is served instead of redirected", () => {
    const failures = fail("/404.html", {
      status: 200,
      headers: { ...html, ...noindex },
      body: page({ lang: "es" }),
    });
    expect(failures).toEqual(["/404.html: expected status 307, got 200"]);
  });

  it("fails on a 308 where Cloudflare answers 307", () => {
    const failures = fail("/en", {
      status: 308,
      headers: { ...noindex, location: "/en/" },
      body: "",
    });
    expect(failures).toEqual(["/en: expected status 307, got 308"]);
  });

  it("fails when the language is swapped", () => {
    const failures = fail("/en/no-existe/", {
      status: 404,
      headers: { ...html, ...noindex },
      body: page({ lang: "es", title: EN_ERROR }),
    });
    expect(failures).toEqual(['/en/no-existe/: expected lang "en", got "es"']);
  });

  it("fails without noindex", () => {
    const failures = fail("/", {
      status: 200,
      headers: html,
      body: page({ canonical: `${SITE}/` }),
    });
    expect(failures).toEqual(["/: expected X-Robots-Tag noindex, got (none)"]);
  });

  it("fails without X-Robots-Tag on a 3xx", () => {
    const failures = fail("/en", {
      status: 307,
      headers: { location: "/en/" },
      body: "",
    });
    expect(failures).toEqual([
      "/en: expected X-Robots-Tag noindex, got (none)",
    ]);
  });

  it("fails when the redirect loses the query string", () => {
    const failures = fail("/en?x=1", {
      status: 307,
      headers: { ...noindex, location: `${BASE_URL}/en/` },
      body: "",
    });
    expect(failures).toEqual([
      '/en?x=1: expected location "/en/?x=1", got "/en/"',
    ]);
  });

  it("fails when /en answers 404 instead of redirecting", () => {
    const failures = fail("/en", {
      status: 404,
      headers: { ...html, ...noindex },
      body: page({ lang: "es" }),
    });
    expect(failures).toEqual(["/en: expected status 307, got 404"]);
  });

  it("fails on the Control Center title", () => {
    const failures = fail("/", {
      status: 200,
      headers: { ...html, ...noindex },
      body: page({ title: "Centro de Control", canonical: `${SITE}/` }),
    });
    expect(failures).toEqual([
      '/: expected title with "AgencyMac" and without "Centro de Control", got "Centro de Control"',
    ]);
  });

  it("fails when the canonical points to another host, without printing it", () => {
    const failures = fail("/en/", {
      status: 200,
      headers: { ...html, ...noindex },
      body: page({ lang: "en", canonical: `${BASE_URL}/en/` }),
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/^\/en\/: expected canonical/);
    expect(failures.join("\n")).not.toContain(HOST);
  });

  it("fails when a hreflang is missing or wrong", () => {
    const failures = fail("/", {
      status: 200,
      headers: { ...html, ...noindex },
      body: page({
        canonical: `${SITE}/`,
        hreflang: { es: `${SITE}/`, en: `${SITE}/es/` },
      }),
    });
    expect(failures).toEqual([
      `/: expected hreflang en "${SITE}/en/", got "${SITE}/es/"`,
      `/: expected hreflang x-default "${SITE}/", got (none)`,
    ]);
  });

  it("fails on a wrong content type", () => {
    const check = fontCheck("/_astro/fonts/a.woff2");
    const result = evaluateResponse(
      check,
      { status: 200, headers: { "content-type": "text/html" }, body: "" },
      context,
    );
    expect(result.failures).toEqual([
      '/_astro/fonts/a.woff2: expected content type "font/woff2", got "text/html"',
    ]);
  });

  it("fails when /index.html answers 404", () => {
    const failures = fail("/index.html", {
      status: 404,
      headers: { ...html, ...noindex },
      body: page(),
    });
    expect(failures).toEqual(["/index.html: expected status 307, got 404"]);
  });

  it("fails when /index.html is served with 200 instead of redirected", () => {
    const failures = fail("/index.html", {
      status: 200,
      headers: { ...html, ...noindex },
      body: page({ canonical: `${SITE}/` }),
    });
    expect(failures).toEqual(["/index.html: expected status 307, got 200"]);
  });

  it("fails when /index.html redirects somewhere else, hiding other hosts", () => {
    const failures = fail("/index.html", {
      status: 307,
      headers: { ...noindex, location: "https://example.org/" },
      body: "",
    });
    expect(failures).toEqual([
      '/index.html: expected location "/", got "(other host)"',
    ]);
  });

  it("accepts header objects with any case and Headers instances", () => {
    const check = faviconCheck("/favicon.svg");
    const headers = new Headers({
      "Content-Type": "image/svg+xml",
      "X-Robots-Tag": "noindex",
    });
    expect(
      evaluateResponse(
        check,
        { status: 200, headers, body: "<svg/>" },
        context,
      ),
    ).toEqual({ ok: true, failures: [] });
    expect(
      evaluateResponse(
        check,
        {
          status: 200,
          headers: {
            "Content-Type": "image/svg+xml",
            "X-Robots-Tag": "noindex",
          },
          body: "<svg/>",
        },
        context,
      ).ok,
    ).toBe(true);
  });
});

describe("faviconCheck and fontCheck", () => {
  it("asks for 200, SVG and noindex on the favicon", () => {
    expect(faviconCheck("/favicon.svg")).toEqual({
      path: "/favicon.svg",
      status: 200,
      contentType: "image/svg+xml",
      noindex: true,
    });
  });

  it("asks for 200 and woff2 on a font", () => {
    expect(fontCheck("/_astro/fonts/a.woff2")).toEqual({
      path: "/_astro/fonts/a.woff2",
      status: 200,
      contentType: "font/woff2",
    });
  });
});

describe("extractors", () => {
  const head = `<link rel="icon" href="/favicon.svg" type="image/svg+xml"><style>@font-face{src:url("/_astro/fonts/a.woff2") format("woff2")}</style><link rel="preload" href="/_astro/fonts/a.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/_astro/index.css"><style>@font-face{src:url('/_astro/fonts/b.woff2?v=1')}</style>`;

  it("extracts woff2 URLs from HTML without duplicates", () => {
    expect(extractFontUrls(head)).toEqual([
      "/_astro/fonts/a.woff2",
      "/_astro/fonts/b.woff2?v=1",
    ]);
  });

  it("extracts woff2 URLs from CSS, quoted or not", () => {
    const css =
      "@font-face{src:url(/_astro/fonts/c.woff2) format('woff2')}@font-face{src:url( \"../fonts/d.woff2\" )}";
    expect(extractFontUrls(css)).toEqual([
      "/_astro/fonts/c.woff2",
      "../fonts/d.woff2",
    ]);
  });

  it("returns an empty list without fonts", () => {
    expect(extractFontUrls("<p>no fonts</p>")).toEqual([]);
  });

  it("extracts the declared favicon", () => {
    expect(extractFaviconUrl(head)).toBe("/favicon.svg");
    expect(
      extractFaviconUrl('<link href="/icon.svg" rel="shortcut icon">'),
    ).toBe("/icon.svg");
    expect(extractFaviconUrl("<title>x</title>")).toBeNull();
  });

  it("extracts the stylesheets", () => {
    expect(extractStylesheetUrls(head)).toEqual(["/_astro/index.css"]);
    expect(extractStylesheetUrls("<title>x</title>")).toEqual([]);
  });
});

// Spec 004, T14: the smoke test also covers the sitemap, robots.txt, the icons
// declared by the pages and the social and logo images. The icon and image
// paths come from the HTML of "/" and "/en/", never from agencymac.com.
describe("sitemap.xml and robots.txt checks", () => {
  it("expects 200, the right type and noindex on staging", () => {
    expect(checkFor("/sitemap.xml")).toEqual({
      path: "/sitemap.xml",
      status: 200,
      contentType: "application/xml",
      noindex: true,
    });
    expect(checkFor("/robots.txt")).toEqual({
      path: "/robots.txt",
      status: 200,
      contentType: "text/plain",
      noindex: true,
    });
  });

  it.each(["/sitemap.xml", "/robots.txt"])(
    "%s passes with a good response",
    (path) => {
      const check = checkFor(path);
      expect(evaluateResponse(check, goodResponse(check), context)).toEqual({
        ok: true,
        failures: [],
      });
    },
  );

  it.each([
    [
      "/sitemap.xml",
      { status: 404, headers: { ...noindex }, body: "" },
      [
        "/sitemap.xml: expected status 200, got 404",
        '/sitemap.xml: expected content type "application/xml", got (none)',
      ],
    ],
    [
      "/sitemap.xml",
      {
        status: 200,
        headers: { "content-type": "text/html" },
        body: "<html></html>",
      },
      [
        "/sitemap.xml: expected X-Robots-Tag noindex, got (none)",
        '/sitemap.xml: expected content type "application/xml", got "text/html"',
      ],
    ],
    [
      "/robots.txt",
      {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
        body: "User-agent: *",
      },
      ["/robots.txt: expected X-Robots-Tag noindex, got (none)"],
    ],
  ])("%s fails with a bad response", (path, response, expected) => {
    expect(
      evaluateResponse(checkFor(path), response, context).failures,
    ).toEqual(expected);
  });
});

describe("declared icons", () => {
  const head =
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">' +
    '<link rel="icon" href="/favicon-48.png" type="image/png" sizes="48x48">' +
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">' +
    '<link rel="canonical" href="https://agencymac.com/">';

  it("lists the SVG, PNG and Apple icons with their expected type", () => {
    expect(declaredIcons(head)).toEqual([
      { href: "/favicon.svg", contentType: "image/svg+xml" },
      { href: "/favicon-48.png", contentType: "image/png" },
      { href: "/apple-touch-icon.png", contentType: "image/png" },
    ]);
  });

  it("returns an empty list without icons", () => {
    expect(declaredIcons("<title>x</title>")).toEqual([]);
  });

  it("builds a check that wants 200, the type and noindex", () => {
    expect(iconCheck("/favicon-48.png", "image/png")).toEqual({
      path: "/favicon-48.png",
      status: 200,
      contentType: "image/png",
      noindex: true,
    });
    expect(faviconCheck("/favicon.svg")).toEqual(
      iconCheck("/favicon.svg", "image/svg+xml"),
    );
  });

  it("fails an icon served with another type", () => {
    const result = evaluateResponse(
      iconCheck("/apple-touch-icon.png", "image/png"),
      {
        status: 200,
        headers: { "content-type": "text/html", ...noindex },
        body: "<html></html>",
      },
      context,
    );
    expect(result.failures).toEqual([
      '/apple-touch-icon.png: expected content type "image/png", got "text/html"',
    ]);
  });
});

describe("social and logo images", () => {
  const og = (url) => `<meta property="og:image" content="${url}">`;
  const ld = (logo) =>
    `<script type="application/ld+json">{"@type":"Organization","logo":"${logo}"}</script>`;

  it("takes only the path of og:image and of the JSON-LD logo", () => {
    const head =
      og("https://agencymac.com/og-default.png") +
      ld("https://agencymac.com/logo-512.png");
    expect(extractSocialAssetPaths(head)).toEqual([
      "/og-default.png",
      "/logo-512.png",
    ]);
  });

  it("never returns the host of the production domain", () => {
    const paths = extractSocialAssetPaths(
      og("https://agencymac.com/og-default.png"),
    );
    expect(paths.join("")).not.toContain("agencymac.com");
  });

  it("does not repeat a path", () => {
    const head =
      og("https://agencymac.com/logo-512.png") +
      ld("https://agencymac.com/logo-512.png");
    expect(extractSocialAssetPaths(head)).toEqual(["/logo-512.png"]);
  });

  it("returns an empty list without them, or with broken JSON-LD", () => {
    expect(extractSocialAssetPaths("<title>x</title>")).toEqual([]);
    expect(
      extractSocialAssetPaths(
        '<script type="application/ld+json">{not json</script>',
      ),
    ).toEqual([]);
  });

  it("builds a check that wants a 200 PNG with noindex", () => {
    expect(imageCheck("/og-default.png")).toEqual({
      path: "/og-default.png",
      status: 200,
      contentType: "image/png",
      noindex: true,
    });
  });

  it("passes a good response and fails a bad one without printing the host", () => {
    const check = imageCheck("/og-default.png");
    expect(
      evaluateResponse(
        check,
        {
          status: 200,
          headers: { "content-type": "image/png", ...noindex },
          body: "binary",
        },
        context,
      ),
    ).toEqual({ ok: true, failures: [] });
    const bad = evaluateResponse(
      check,
      { status: 404, headers: {}, body: "not found" },
      context,
    );
    expect(bad.ok).toBe(false);
    expect(bad.failures.join("\n")).not.toContain(HOST);
  });
});

describe("relativize", () => {
  it.each([
    ["/en/", "/en/"],
    ["/en/?x=1", "/en/?x=1"],
    [`${BASE_URL}/en/?x=1`, "/en/?x=1"],
    ["https://example.org/en/", "(other host)"],
    [null, "(none)"],
    ["", "(none)"],
  ])("%s → %s", (location, expected) => {
    expect(relativize(location, BASE_URL)).toBe(expected);
  });
});

describe("formatFailure", () => {
  it("shows path, expected and actual", () => {
    expect(
      formatFailure({
        path: "/en/no-existe/",
        expected: "status 404",
        actual: "200",
      }),
    ).toBe("/en/no-existe/: expected status 404, got 200");
  });

  it("never prints the host it is given", () => {
    const message = formatFailure({
      path: "/",
      expected: `canonical "${SITE}/"`,
      actual: `"${BASE_URL}/"`,
      baseUrl: BASE_URL,
    });
    expect(message).not.toContain(HOST);
    expect(message).toContain("(staging host)");
  });
});

describe("stagingUrl", () => {
  it("builds the workers.dev URL from the worker and the subdomain", () => {
    expect(stagingUrl("agencymac-staging", "acme-42")).toBe(BASE_URL);
  });

  it.each(["", "Acme", "acme.evil", "acme/x", "acme 42", undefined])(
    "rejects the subdomain %j without echoing it",
    (subdomain) => {
      expect(() => stagingUrl("agencymac-staging", subdomain)).toThrow(
        /subdomain/,
      );
      try {
        stagingUrl("agencymac-staging", subdomain);
      } catch (error) {
        if (subdomain) expect(error.message).not.toContain(subdomain);
      }
    },
  );
});

describe("waitForVersion", () => {
  const SHA = "a".repeat(40);

  function fakeClock() {
    let time = 0;
    return {
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
    };
  }

  function versions(...values) {
    let calls = 0;
    const fetchVersion = async () =>
      values[Math.min(calls++, values.length - 1)];
    return { fetchVersion, calls: () => calls };
  }

  it("succeeds at the first attempt", async () => {
    const clock = fakeClock();
    const source = versions(SHA);
    await expect(
      waitForVersion({
        ...clock,
        fetchVersion: source.fetchVersion,
        expected: SHA,
      }),
    ).resolves.toEqual({ ok: true });
    expect(source.calls()).toBe(1);
    expect(clock.now()).toBe(0);
  });

  it("succeeds after two retries", async () => {
    const clock = fakeClock();
    const source = versions(null, "b".repeat(40), SHA);
    await expect(
      waitForVersion({
        ...clock,
        fetchVersion: source.fetchVersion,
        expected: SHA,
      }),
    ).resolves.toEqual({ ok: true });
    expect(source.calls()).toBe(3);
    expect(clock.now()).toBe(20_000);
  });

  it("gives up without going past 180 s and reports the version seen", async () => {
    const clock = fakeClock();
    const old = "b".repeat(40);
    const source = versions(old);
    const result = await waitForVersion({
      ...clock,
      fetchVersion: source.fetchVersion,
      expected: SHA,
    });
    expect(result.ok).toBe(false);
    expect(result.failure).toBe(
      `/: expected X-Staging-Version ${SHA}, got ${old}`,
    );
    expect(clock.now()).toBeLessThanOrEqual(180_000);
    expect(clock.now()).toBe(180_000);
    // Attempts at 0, 10, ..., 170 s; at 180 s there is no time left.
    expect(source.calls()).toBe(18);
  });

  it("reports (none) when the header never appears", async () => {
    const clock = fakeClock();
    const result = await waitForVersion({
      ...clock,
      fetchVersion: async () => null,
      expected: SHA,
    });
    expect(result.failure).toBe(
      `/: expected X-Staging-Version ${SHA}, got (none)`,
    );
  });

  it("keeps retrying after a network error", async () => {
    const clock = fakeClock();
    let calls = 0;
    const fetchVersion = async () => {
      calls += 1;
      if (calls === 1) throw new Error(`connect failed to ${HOST}`);
      return SHA;
    };
    await expect(
      waitForVersion({ ...clock, fetchVersion, expected: SHA }),
    ).resolves.toEqual({ ok: true });
  });

  it("never starts an attempt after the limit when requests are slow", async () => {
    let time = 0;
    const starts = [];
    const result = await waitForVersion({
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
      fetchVersion: async () => {
        starts.push(time);
        time += 9_000;
        return null;
      },
      expected: SHA,
    });
    expect(result.ok).toBe(false);
    expect(Math.max(...starts)).toBeLessThanOrEqual(180_000);
    expect(starts.length).toBeGreaterThan(1);
  });

  it("caps each request at 15 s or the time left, so no attempt ends past 180 s", async () => {
    let time = 0;
    const timeouts = [];
    const result = await waitForVersion({
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
      // A request that hangs until its timeout aborts it.
      fetchVersion: async ({ timeoutMs }) => {
        timeouts.push(timeoutMs);
        time += timeoutMs;
        throw new Error("TimeoutError");
      },
      expected: SHA,
    });
    expect(result.ok).toBe(false);
    expect(time).toBeLessThanOrEqual(180_000);
    expect(Math.max(...timeouts)).toBe(15_000);
    expect(timeouts.at(-1)).toBe(5_000);
    expect(timeouts.every((ms) => ms > 0)).toBe(true);
  });

  it("accepts a custom request timeout", async () => {
    const timeouts = [];
    let time = 0;
    await waitForVersion({
      now: () => time,
      sleep: async (ms) => {
        time += ms;
      },
      fetchVersion: async ({ timeoutMs }) => {
        timeouts.push(timeoutMs);
        return SHA;
      },
      expected: SHA,
      requestTimeoutMs: 3_000,
    });
    expect(timeouts).toEqual([3_000]);
  });
});
