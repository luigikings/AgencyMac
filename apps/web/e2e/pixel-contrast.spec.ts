import { expect, test } from "@playwright/test";
import { unexpectedContrastIncomplete } from "./axe-incomplete";
import { textContrastByPixels } from "./pixel-contrast";

// Tests of the tools of spec 005 (T8), on a synthetic page: they do not need
// the website.
const page = (background: string, extra = "") => `
  <body style="margin:0;background:${background};font:700 28px sans-serif">
    <p id="t" style="margin:40px;color:#fff;${extra}">Hello sky, this is a text</p>
  </body>`;

test.describe("textContrastByPixels", () => {
  test("passes white text on a dark background", async ({ page: p }) => {
    await p.setContent(page("#34006F"));
    const result = await textContrastByPixels(p, p.locator("#t"));
    expect(result.ok).toBe(true);
    expect(result.ratio).toBeGreaterThan(10);
    expect(result.required).toBe(3); // 28 px bold is large text
  });

  test("fails white text on a light background", async ({ page: p }) => {
    await p.setContent(page("#f0f0f0"));
    const result = await textContrastByPixels(p, p.locator("#t"));
    expect(result.ok).toBe(false);
    expect(result.ratio).toBeLessThan(1.5);
  });

  test("measures the pixels behind the text, not the text itself", async ({
    page: p,
  }) => {
    // If the text were not hidden, white glyphs would drag the ratio to 1.
    await p.setContent(page("#1D003F"));
    const result = await textContrastByPixels(p, p.locator("#t"));
    expect(result.ratio).toBeGreaterThan(15);
  });

  test("a gradient that gets too bright on the text area fails", async ({
    page: p,
  }) => {
    await p.setContent(page("linear-gradient(90deg,#34006F 0,#ffffff 400px)"));
    const result = await textContrastByPixels(p, p.locator("#t"));
    expect(result.ok).toBe(false);
  });

  test("ignores a few star-sized dots (percentile 2)", async ({ page: p }) => {
    await p.setContent(`
      <body style="margin:0;background:#34006F;font:400 18px sans-serif">
        <p id="t" style="margin:40px;color:#fff;position:relative;width:600px;height:60px">
          Text over a field of stars
          <i style="position:absolute;left:300px;top:10px;width:3px;height:3px;background:#fff"></i>
        </p>
      </body>`);
    const result = await textContrastByPixels(p, p.locator("#t"));
    expect(result.ok).toBe(true);
    expect(result.required).toBe(4.5);
  });

  test("leaves the page as it was (no hidden text, no style left)", async ({
    page: p,
  }) => {
    await p.setContent(page("#34006F"));
    await textContrastByPixels(p, p.locator("#t"));
    expect(await p.locator("style[data-pixel-contrast]").count()).toBe(0);
    expect(
      await p.locator("#t").evaluate((e) => getComputedStyle(e).color),
    ).toBe("rgb(255, 255, 255)");
  });

  test("works on the real home page", async ({ page: p }) => {
    await p.goto("/");
    const result = await textContrastByPixels(p, p.locator("h1"));
    expect(result.ok).toBe(true);
  });
});

test.describe("unexpectedContrastIncomplete", () => {
  const rule = (html: string[]) => ({
    incomplete: [
      { id: "color-contrast", nodes: html.map((h) => ({ html: h })) },
      { id: "other", nodes: [{ html: "<div>" }] },
    ],
  });

  test("allows the ones marked data-sky-text", () => {
    expect(
      unexpectedContrastIncomplete(
        rule(['<h1 id="x" data-sky-text="">', "<p data-sky-text>"]),
      ),
    ).toEqual([]);
  });

  test("reports the others", () => {
    expect(
      unexpectedContrastIncomplete(
        rule(['<h1 data-sky-text="">', '<p class="a">']),
      ),
    ).toEqual(['<p class="a">']);
  });

  test("does not take a similar attribute for the mark", () => {
    expect(
      unexpectedContrastIncomplete(rule(['<p data-sky-text-x="1">'])),
    ).toEqual(['<p data-sky-text-x="1">']);
  });

  test("is empty when there is no incomplete contrast", () => {
    expect(unexpectedContrastIncomplete({ incomplete: [] })).toEqual([]);
  });
});
