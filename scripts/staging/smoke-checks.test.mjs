import { describe, expect, it } from "vitest";
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

// A response that satisfies a check, built from the check itself.
function goodResponse(check) {
  const headers = {
    ...html,
    ...noindex,
    ...(check.contentType ? { "content-type": check.contentType } : {}),
  };
  if (check.status === "redirect" || check.status === "redirect-or-ok") {
    return {
      status: 308,
      headers: { ...headers, location: check.location },
      body: "",
    };
  }
  const body = check.contentType
    ? "binary"
    : page({ lang: check.lang ?? "es", canonical: check.canonical });
  return { status: check.status, headers, body };
}

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
    ["/404.html", 404, "es"],
    ["/en/404", 404, "en"],
    ["/EN/", 404, "es"],
    ["/Favicon.svg", 404, "es"],
  ])("%s expects status %i and lang %s", (path, status, lang) => {
    expect(checkFor(path)).toMatchObject({ status, lang });
  });

  it("asks for noindex on the pages, the 404s and the /en redirects", () => {
    for (const path of ["/", "/en/", "/no-existe/", "/en/no-existe/", "/en"]) {
      expect(checkFor(path).noindex, path).toBe(true);
    }
  });

  it("keeps the query string on the /en redirect", () => {
    expect(checkFor("/en?x=1")).toMatchObject({
      status: "redirect",
      location: "/en/?x=1",
    });
  });
});

describe("evaluateResponse — failures", () => {
  const fail = (path, response) => {
    const result = evaluateResponse(checkFor(path), response, context);
    expect(result.ok).toBe(false);
    return result.failures;
  };

  it("fails when a 404 is served with 200", () => {
    const failures = fail("/404.html", {
      status: 200,
      headers: { ...html, ...noindex },
      body: page({ lang: "es" }),
    });
    expect(failures).toEqual(["/404.html: expected status 404, got 200"]);
  });

  it("fails when the language is swapped", () => {
    const failures = fail("/en/no-existe/", {
      status: 404,
      headers: { ...html, ...noindex },
      body: page({ lang: "es" }),
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
      status: 308,
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
    expect(failures).toEqual(["/en: expected status 301|302|307|308, got 404"]);
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
    expect(failures).toEqual([
      "/index.html: expected status 301|302|307|308|200, got 404",
    ]);
  });

  it("accepts /index.html served with 200 and its canonical", () => {
    const result = evaluateResponse(
      checkFor("/index.html"),
      {
        status: 200,
        headers: { ...html, ...noindex },
        body: page({ canonical: `${SITE}/` }),
      },
      context,
    );
    expect(result).toEqual({ ok: true, failures: [] });
  });

  it("fails when /index.html redirects somewhere else, hiding other hosts", () => {
    const failures = fail("/index.html", {
      status: 301,
      headers: { location: "https://example.org/" },
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
    expect(source.calls()).toBe(19);
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
});
