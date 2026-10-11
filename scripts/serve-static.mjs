// Static server for the production build of the public website (spec 002,
// decision P3). It replaces `astro preview`, which always serves the root
// dist/404.html. It mimics Cloudflare (Workers static assets with
// html_handling "auto-trailing-slash", the codes observed with wrangler dev in
// spec 003, D17): nearest 404.html walking up the folders, case-sensitive
// paths (even on Windows' case-insensitive disk), 307 redirects that keep the
// query (/en → /en/, /index.html → /, /404.html → /404), /404 and /en/404
// served with 200, and _headers/_redirects never served.
// No dependencies: node:http, node:fs and node:zlib only.
//
// Usage: node scripts/serve-static.mjs --dir dist --port 4322
import { createServer } from "node:http";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const NOT_FOUND_PAGE = "404.html";
const INDEX_PAGE = "index.html";

const CONTENT_TYPES = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  ico: "image/x-icon",
  woff2: "font/woff2",
  woff: "font/woff",
};

/** Media type for a published file path, by extension (case-insensitive). */
export function contentTypeFor(path) {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "application/octet-stream";
  const ext = name.slice(dot + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Text-based media types worth compressing with gzip. */
export function isCompressible(contentType) {
  const type = contentType.split(";")[0].trim();
  return (
    type.startsWith("text/") ||
    type === "image/svg+xml" ||
    type === "application/json" ||
    type === "application/xml"
  );
}

function safeDecode(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

function isUnsafe(path) {
  return (
    !path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.split("/").some((segment) => segment === "." || segment === "..")
  );
}

// Nearest 404.html walking up from the requested folder, exact case.
function notFound(path, files) {
  const segments = path.split("/").filter(Boolean);
  const dirs = path.endsWith("/") ? segments : segments.slice(0, -1);
  for (let i = dirs.length; i >= 0; i--) {
    const candidate = [...dirs.slice(0, i), NOT_FOUND_PAGE].join("/");
    if (files.has(candidate)) return { status: 404, file: candidate };
  }
  return { status: 404, file: null };
}

// Hosting rule files at the root are configuration, never content.
const HIDDEN_FILES = new Set(["_headers", "_redirects"]);

/**
 * Decides how to answer a request. Pure: `files` is a Set of the exact-case
 * POSIX paths (relative to the build folder) that exist.
 * Returns { status: 200|404, file } or { status: 307, location }.
 *
 * Same behaviour as Cloudflare's assets with html_handling
 * "auto-trailing-slash" (observed with wrangler dev, spec 003 D17):
 * - "/dir/" serves dir/index.html; "/dir" → 307 "/dir/".
 * - "/dir/index.html" and "/dir/index" → 307 "/dir/".
 * - "/name" serves name.html with 200 (also "/404": the error page by its
 *   own URL); "/name.html" → 307 "/name"; "/name/" → 307 "/name".
 * - Redirects keep the query string; anything else gets the nearest 404.
 */
export function resolveRequest({ pathname, search, files: allFiles }) {
  const path = safeDecode(pathname);
  if (path === null || isUnsafe(path)) return notFound("/", allFiles);

  const files = {
    has: (rel) => allFiles.has(rel) && !HIDDEN_FILES.has(rel),
  };
  const query = search ?? "";
  const redirect = (location) => ({ status: 307, location: location + query });
  const rel = path.slice(1);

  if (path.endsWith("/")) {
    if (files.has(rel + INDEX_PAGE)) {
      return { status: 200, file: rel + INDEX_PAGE };
    }
    const bare = rel.slice(0, -1);
    if (bare && files.has(`${bare}.html`)) return redirect(`/${bare}`);
    return notFound(path, allFiles);
  }

  const name = rel.split("/").pop();
  const dir = rel.slice(0, rel.length - name.length);
  if (
    (name === INDEX_PAGE || name === "index") &&
    files.has(dir + INDEX_PAGE)
  ) {
    return redirect(`/${dir}`);
  }
  if (name.endsWith(".html")) {
    if (files.has(rel)) return redirect(`/${rel.slice(0, -".html".length)}`);
    return notFound(path, allFiles);
  }
  if (files.has(rel)) return { status: 200, file: rel };
  if (files.has(`${rel}.html`)) return { status: 200, file: `${rel}.html` };
  if (files.has(`${rel}/${INDEX_PAGE}`)) return redirect(`${path}/`);
  return notFound(path, allFiles);
}

// Recursively lists the files of `root` as exact-case POSIX relative paths.
function listFiles(root, prefix = "") {
  const result = [];
  for (const entry of readdirSync(join(root, prefix), {
    withFileTypes: true,
  })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...listFiles(root, rel));
    else if (entry.isFile()) result.push(rel);
  }
  return result;
}

function parseArgs(argv) {
  const options = { dir: "dist", port: 4322 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") options.dir = argv[++i];
    else if (argv[i] === "--port") options.port = Number(argv[++i]);
  }
  return options;
}

function startServer({ dir, port }) {
  const root = resolvePath(dir);
  let isDir = false;
  try {
    isDir = statSync(root).isDirectory();
  } catch {
    isDir = false;
  }
  if (!isDir) {
    console.error(`Error: no existe la carpeta de la build: ${root}`);
    process.exit(1);
  }
  if (!Number.isInteger(port) || port <= 0) {
    console.error(`Error: puerto no válido: ${port}`);
    process.exit(1);
  }
  const files = new Set(listFiles(root));

  const server = createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    const result = resolveRequest({
      pathname: url.pathname,
      search: url.search,
      files,
    });

    if (result.location) {
      res.writeHead(result.status, { Location: result.location }).end();
      return;
    }
    if (result.file === null) {
      res
        .writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
        .end(req.method === "HEAD" ? undefined : "404 Not Found");
      return;
    }

    const contentType = contentTypeFor(result.file);
    let body = readFileSync(join(root, ...result.file.split("/")));
    const headers = {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
      Vary: "Accept-Encoding",
    };
    const acceptsGzip = /\bgzip\b/.test(req.headers["accept-encoding"] ?? "");
    if (acceptsGzip && isCompressible(contentType)) {
      body = gzipSync(body);
      headers["Content-Encoding"] = "gzip";
    }
    headers["Content-Length"] = body.length;
    res.writeHead(result.status, headers);
    res.end(req.method === "HEAD" ? undefined : body);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Error: el puerto ${port} está ocupado. Cierra el proceso que lo usa (puede ser un node huérfano) y vuelve a lanzarlo.`,
      );
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  });

  server.listen(port, "localhost", () => {
    console.log(`Sirviendo ${root} en http://localhost:${port}/`);
  });
}

const isCli =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) startServer(parseArgs(process.argv.slice(2)));
