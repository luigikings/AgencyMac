import type { Locator, Page } from "@playwright/test";
import {
  contrastPercentile,
  requiredContrast,
} from "../src/lib/pixel-contrast";

// Contrast of a text measured on the pixels really painted behind it (spec
// 005, RF-8, plan section 9). Used for the text that sits directly on the sky,
// where axe cannot compute a background (a gradient): it hides the text of the
// element, captures the area its text covers and measures every pixel against
// the text colour. No dependencies: the capture is decoded in the page.
//
// Only for text on the sky. A text with a background or border of its own
// (button, tag, card) is checked by axe, and its box would include that
// background: the capture covers only the area of the text itself.

export type PixelContrast = {
  /** Contrast reached by 98 % of the pixels (percentile 2). */
  ratio: number;
  /** 3 for large text, 4.5 otherwise. */
  required: 3 | 4.5;
  ok: boolean;
  /** Area captured, in CSS px. */
  box: { x: number; y: number; width: number; height: number };
};

const HIDE_ATTRIBUTE = "data-pixel-contrast-hide";

export async function textContrastByPixels(
  page: Page,
  locator: Locator,
  { percentile = 2 }: { percentile?: number } = {},
): Promise<PixelContrast> {
  await locator.scrollIntoViewIfNeeded();
  const info = await locator.evaluate((element, attribute) => {
    const style = getComputedStyle(element);
    const range = document.createRange();
    range.selectNodeContents(element);
    const rects = [...range.getClientRects()].filter(
      (r) => r.width > 0 && r.height > 0,
    );
    if (rects.length === 0) return null;
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    const rgb = (style.color.match(/[\d.]+/g) ?? ["255", "255", "255"])
      .slice(0, 3)
      .map(Number);
    // Hide the text of the element and of its descendants (not the background).
    const sheet = document.createElement("style");
    sheet.setAttribute("data-pixel-contrast", "");
    sheet.textContent = `[${attribute}], [${attribute}] * { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important; }`;
    document.head.appendChild(sheet);
    element.setAttribute(attribute, "");
    return {
      rgb,
      fontSize: parseFloat(style.fontSize),
      fontWeight: parseInt(style.fontWeight, 10) || 400,
      box: {
        x: Math.max(0, Math.floor(left)),
        y: Math.max(0, Math.floor(top)),
        width: Math.ceil(right) - Math.max(0, Math.floor(left)),
        height: Math.ceil(bottom) - Math.max(0, Math.floor(top)),
      },
    };
  }, HIDE_ATTRIBUTE);
  if (!info) throw new Error("The element has no visible text to measure");

  let screenshot: Buffer;
  try {
    // One frame so the hidden text is gone before the capture.
    // (Some pages run without scripts and, in a hidden or throttled page,
    // requestAnimationFrame may never fire: do not wait for it for ever.)
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(resolve);
          setTimeout(resolve, 100);
        }),
    );
    screenshot = await page.screenshot({ clip: info.box });
  } finally {
    await locator.evaluate((element, attribute) => {
      element.removeAttribute(attribute);
      document.querySelector("style[data-pixel-contrast]")?.remove();
    }, HIDE_ATTRIBUTE);
  }

  const ratio = await page.evaluate(
    async ({ base64, rgb, source, percentile: p }) => {
      const fn = new Function(`return ${source}`)() as (
        data: ArrayLike<number>,
        text: [number, number, number],
        percentile: number,
      ) => number;
      const blob = await (
        await fetch(`data:image/png;base64,${base64}`)
      ).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      return fn(data, rgb as [number, number, number], p);
    },
    {
      base64: screenshot.toString("base64"),
      rgb: info.rgb,
      source: contrastPercentile.toString(),
      percentile,
    },
  );

  const required = requiredContrast(info.fontSize, info.fontWeight);
  return { ratio, required, ok: ratio >= required, box: info.box };
}
