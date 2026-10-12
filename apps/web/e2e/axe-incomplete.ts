// Spec 005 (RF-8, plan section 9): axe cannot compute the background of a text
// that sits on the sky (gradients) and reports it as "incomplete". That is
// allowed only for the elements marked `data-sky-text`, each one covered by the
// pixel test (e2e/pixel-contrast.ts). Any other incomplete contrast result is a
// problem.

type AxeLike = {
  incomplete: { id: string; nodes: { html: string }[] }[];
};

/** HTML of the "incomplete" contrast results that are not marked `data-sky-text`. */
export function unexpectedContrastIncomplete(results: AxeLike): string[] {
  return results.incomplete
    .filter((rule) => rule.id === "color-contrast")
    .flatMap((rule) => rule.nodes)
    .map((node) => node.html)
    .filter((html) => !/\sdata-sky-text(?=[\s=>])/.test(html));
}
