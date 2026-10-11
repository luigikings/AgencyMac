// Checks that a production build cannot block indexing (spec 003, RF-9).
// Pure: it receives { path, content } pairs (paths relative to the build) and
// returns one { path, reason } per offending file:
// - headers-file: any _headers file (in this spec the build ships none; the
//   staging noindex rule is added only to the staging copy).
// - meta-noindex: a robots/googlebot meta (or http-equiv X-Robots-Tag) whose
//   content has the noindex or none directive.
// - x-robots-tag-noindex: an X-Robots-Tag header rule with noindex or none.

const META_TAG = /<meta\b[^>]*>/gi;
const BLOCKING_DIRECTIVE = /(?:^|[\s,])(noindex|none)(?=$|[\s,])/i;
const HEADER_RULE = /^\s*x-robots-tag\s*:(.*)$/gim;
const INDEXING_META_NAMES = new Set(["robots", "googlebot"]);

function attribute(tag, name) {
  const match = new RegExp(
    `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>/]+))`,
    "i",
  ).exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

function hasBlockingMeta(html) {
  for (const [tag] of html.matchAll(META_TAG)) {
    const name = attribute(tag, "name")?.toLowerCase();
    const httpEquiv = attribute(tag, "http-equiv")?.toLowerCase();
    const isIndexingMeta =
      INDEXING_META_NAMES.has(name) || httpEquiv === "x-robots-tag";
    const content = attribute(tag, "content") ?? "";
    if (isIndexingMeta && BLOCKING_DIRECTIVE.test(content)) return true;
  }
  return false;
}

function hasBlockingHeaderRule(text) {
  for (const [, value] of text.matchAll(HEADER_RULE)) {
    if (BLOCKING_DIRECTIVE.test(value.trim())) return true;
  }
  return false;
}

export function findIndexingBlocks(files) {
  const blocks = [];
  for (const file of files) {
    const path = file.path.replaceAll("\\", "/");
    const name = path.split("/").at(-1);
    let reason;
    if (name === "_headers") reason = "headers-file";
    else if (/\.html?$/i.test(name) && hasBlockingMeta(file.content))
      reason = "meta-noindex";
    else if (hasBlockingHeaderRule(file.content))
      reason = "x-robots-tag-noindex";
    if (reason) blocks.push({ path, reason });
  }
  return blocks;
}
