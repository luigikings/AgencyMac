import { describe, expect, it } from "vitest";
import {
  contentTypeFor,
  isCompressible,
  resolveRequest,
} from "./serve-static.mjs";

// Exact-case POSIX paths relative to dist, as the CLI builds them.
const files = new Set([
  "index.html",
  "404.html",
  "en/index.html",
  "en/404.html",
  "favicon.svg",
  "_astro/index.abc123.css",
]);

const resolve = (pathname, search = "") =>
  resolveRequest({ pathname, search, files });

describe("resolveRequest", () => {
  it("serves the Spanish home at /", () => {
    expect(resolve("/")).toEqual({ status: 200, file: "index.html" });
  });

  it("serves the English home at /en/", () => {
    expect(resolve("/en/")).toEqual({ status: 200, file: "en/index.html" });
  });

  it("redirects /en to /en/ with a 308", () => {
    expect(resolve("/en")).toEqual({ status: 308, location: "/en/" });
  });

  it("keeps the query string when redirecting /en?x=1", () => {
    expect(resolve("/en", "?x=1")).toEqual({
      status: 308,
      location: "/en/?x=1",
    });
  });

  it.each(["/EN/", "/En/", "/EN", "/En/index.html"])(
    "is case-sensitive: %s gets the Spanish 404",
    (pathname) => {
      expect(resolve(pathname)).toEqual({ status: 404, file: "404.html" });
    },
  );

  it("serves the Spanish 404 for an unknown root path", () => {
    expect(resolve("/no-existe/")).toEqual({ status: 404, file: "404.html" });
  });

  it("serves the English 404 for an unknown path under /en/", () => {
    expect(resolve("/en/no-existe/")).toEqual({
      status: 404,
      file: "en/404.html",
    });
  });

  it("walks up to the nearest 404.html for deep paths", () => {
    expect(resolve("/en/a/b")).toEqual({ status: 404, file: "en/404.html" });
    expect(resolve("/en/a/b/")).toEqual({ status: 404, file: "en/404.html" });
  });

  it("does not throw on a malformed percent-encoding", () => {
    expect(() => resolve("/%E0%A4%A")).not.toThrow();
    expect(resolve("/%E0%A4%A")).toEqual({ status: 404, file: "404.html" });
  });

  it.each(["/../package.json", "/en/../../package.json", "/%2e%2e/x.html"])(
    "never resolves a path traversal: %s",
    (pathname) => {
      expect(resolve(pathname)).toEqual({ status: 404, file: "404.html" });
    },
  );

  it("rejects backslashes and NUL bytes", () => {
    expect(resolve("/en%5Cindex.html")).toEqual({
      status: 404,
      file: "404.html",
    });
    expect(resolve("/index.html%00")).toEqual({
      status: 404,
      file: "404.html",
    });
  });

  it("serves static assets by exact path", () => {
    expect(resolve("/favicon.svg")).toEqual({
      status: 200,
      file: "favicon.svg",
    });
    expect(resolve("/_astro/index.abc123.css")).toEqual({
      status: 200,
      file: "_astro/index.abc123.css",
    });
  });

  it("decodes percent-encoded paths before matching", () => {
    expect(resolve("/favicon%2Esvg")).toEqual({
      status: 200,
      file: "favicon.svg",
    });
  });

  it("returns a 404 without file when there is no 404.html at all", () => {
    expect(
      resolveRequest({
        pathname: "/x/",
        search: "",
        files: new Set(["index.html"]),
      }),
    ).toEqual({ status: 404, file: null });
  });
});

describe("contentTypeFor", () => {
  it.each([
    ["index.html", "text/html; charset=utf-8"],
    ["en/404.html", "text/html; charset=utf-8"],
    ["_astro/a.css", "text/css; charset=utf-8"],
    ["_astro/a.js", "text/javascript; charset=utf-8"],
    ["favicon.svg", "image/svg+xml"],
    ["fonts/lato.woff2", "font/woff2"],
    ["img/a.png", "image/png"],
    ["img/a.jpg", "image/jpeg"],
    ["img/a.webp", "image/webp"],
    ["img/a.avif", "image/avif"],
    ["data.json", "application/json; charset=utf-8"],
    ["robots.txt", "text/plain; charset=utf-8"],
    ["sitemap.xml", "application/xml; charset=utf-8"],
    ["favicon.ico", "image/x-icon"],
  ])("%s → %s", (path, type) => {
    expect(contentTypeFor(path)).toBe(type);
  });

  it("ignores the case of the extension", () => {
    expect(contentTypeFor("img/A.PNG")).toBe("image/png");
  });

  it("falls back to application/octet-stream", () => {
    expect(contentTypeFor("file.unknown")).toBe("application/octet-stream");
    expect(contentTypeFor("LICENSE")).toBe("application/octet-stream");
  });
});

describe("isCompressible", () => {
  it.each([
    "text/html; charset=utf-8",
    "text/css; charset=utf-8",
    "text/javascript; charset=utf-8",
    "image/svg+xml",
    "application/json; charset=utf-8",
    "application/xml; charset=utf-8",
  ])("compresses %s", (type) => {
    expect(isCompressible(type)).toBe(true);
  });

  it.each(["font/woff2", "image/png", "application/octet-stream"])(
    "does not compress %s",
    (type) => {
      expect(isCompressible(type)).toBe(false);
    },
  );
});
