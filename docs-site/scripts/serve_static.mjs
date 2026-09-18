/*
 * Static file server for the exported docs site (verification helper).
 *
 * The exported tree is a plain directory of `index.html` files, so a small Node server is
 * enough to drive a browser through it.  `python -m http.server` is single-connection and
 * stalls when a browser keeps several sockets open at once, hence this.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const port = Number(process.argv[2] ?? 3131);
const root = resolve(process.argv[3] ?? "out");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    let pathname = decodeURIComponent(url.pathname);
    const candidates = [
      join(root, pathname),
      join(root, pathname, "index.html"),
    ];
    let file = candidates.map((c) => normalize(c)).find((c) => c.startsWith(root + sep) || c === root);
    let body;
    for (const candidate of candidates) {
      if (!candidate.startsWith(root)) continue;
      try {
        body = await readFile(candidate);
        file = candidate;
        break;
      } catch {
        /* try the next candidate */
      }
    }
    if (!body) {
      const notFound = await readFile(join(root, "404.html")).catch(() => undefined);
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(notFound ?? Buffer.from("not found"));
      return;
    }
    const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Content-Length": body.byteLength });
    res.end(body);
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`serving ${root} on http://127.0.0.1:${port}\n`);
});
