import { describe, expect, it } from "vitest";
import { findIndexingBlocks } from "./dist-check.mjs";

const page = (head) =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8">${head}<title>AgencyMac</title></head><body><h1>Hola</h1></body></html>`;

const cleanBuild = [
  {
    path: "index.html",
    content: page('<meta name="robots" content="index, follow">'),
  },
  {
    path: "en/index.html",
    content: page('<meta name="description" content="x">'),
  },
  { path: "404.html", content: page("") },
  { path: "robots.txt", content: "User-agent: *\nAllow: /\n" },
  { path: "_astro/index.css", content: "body{color:red}" },
];

describe("findIndexingBlocks", () => {
  it("accepts a clean build", () => {
    expect(findIndexingBlocks(cleanBuild)).toEqual([]);
  });

  it.each([
    ["robots noindex", '<meta name="robots" content="noindex">'],
    [
      "robots noindex, follow",
      '<meta name="robots" content="noindex, follow">',
    ],
    ["robots none", '<meta name="robots" content="none">'],
    ["upper case and single quotes", "<META NAME='ROBOTS' CONTENT='NOINDEX'>"],
    ["content before name", '<meta content="noindex" name="robots" />'],
    ["unquoted attributes", "<meta name=robots content=noindex>"],
    ["googlebot noindex", '<meta name="googlebot" content="noindex">'],
    [
      "http-equiv X-Robots-Tag",
      '<meta http-equiv="X-Robots-Tag" content="noindex">',
    ],
  ])("fails on %s", (_label, meta) => {
    const files = [
      ...cleanBuild,
      { path: "en/es-page.html", content: page(meta) },
    ];
    expect(findIndexingBlocks(files)).toEqual([
      { path: "en/es-page.html", reason: "meta-noindex" },
    ]);
  });

  it("does not confuse other meta tags or words with noindex", () => {
    const files = [
      {
        path: "index.html",
        content: page(
          '<meta name="description" content="Why noindex hurts SEO"><meta name="robots" content="max-image-preview:large">',
        ),
      },
    ];
    expect(findIndexingBlocks(files)).toEqual([]);
  });

  it("fails on any _headers file", () => {
    const files = [
      ...cleanBuild,
      { path: "_headers", content: "/*\n  X-Frame-Options: DENY\n" },
    ];
    expect(findIndexingBlocks(files)).toEqual([
      { path: "_headers", reason: "headers-file" },
    ]);
  });

  it("fails on an X-Robots-Tag noindex rule in any file", () => {
    const files = [
      ...cleanBuild,
      { path: "_redirects", content: "/*\n  X-Robots-Tag: noindex\n" },
    ];
    expect(findIndexingBlocks(files)).toEqual([
      { path: "_redirects", reason: "x-robots-tag-noindex" },
    ]);
  });

  it("reports each file once even with several problems", () => {
    const files = [
      { path: "_headers", content: "/*\n  X-Robots-Tag: noindex\n" },
    ];
    expect(findIndexingBlocks(files)).toEqual([
      { path: "_headers", reason: "headers-file" },
    ]);
  });

  it("normalises Windows separators", () => {
    const files = [
      {
        path: "en\\index.html",
        content: page('<meta name="robots" content="noindex">'),
      },
    ];
    expect(findIndexingBlocks(files)).toEqual([
      { path: "en/index.html", reason: "meta-noindex" },
    ]);
  });
});
