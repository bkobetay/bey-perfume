import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, sep, extname } from "node:path";
import { createAPI } from "../server/api.mjs";

process.umask(0o077);
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const admin = process.argv.includes("--admin");
const port = Number(
  admin ? process.env.ADMIN_PORT || 4174 : process.env.PORT || 4173,
);
const adminRoot = fileURLToPath(new URL("../admin/", import.meta.url));
const storefront = `http://127.0.0.1:${Number(process.env.PORT || 4173)}`;
const products = JSON.parse(
  await readFile(new URL("../data/products.json", import.meta.url), "utf8"),
);
const api = createAPI(products);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
};
const server = http.createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
  if (
    ![`127.0.0.1:${port}`, `localhost:${port}`].includes(request.headers.host)
  ) {
    response.writeHead(403).end("Forbidden host");
    return;
  }
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const notFound = () =>
      response
        .writeHead(404, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        })
        .end("Страница не найдена");
    if (admin) response.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (url.pathname.startsWith("/api/")) {
      const allowed = admin
        ? url.pathname.startsWith("/api/admin/")
        : (url.pathname === "/api/products" && request.method === "GET") ||
          (url.pathname === "/api/orders" && request.method === "POST");
      if (!allowed) {
        notFound();
        return;
      }
      await api.handle(request, response, url);
      return;
    }
    if (
      !admin &&
      /^\/admin(?:[./]|$)/i.test(decodeURIComponent(url.pathname))
    ) {
      notFound();
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const adminFile =
      admin &&
      ["/", "/index.html", "/admin.js", "/admin.css"].includes(pathname);
    // The seller service serves only its UI and explicitly shared visual assets.
    if (
      admin &&
      !adminFile &&
      ![
        "/styles.css",
        "/commerce.css",
        "/assets/favicon.svg",
        "/assets/perfume-studio-logo.svg",
        "/assets/fonts/manrope-regular.ttf",
        "/assets/fonts/manrope-semibold.ttf",
      ].includes(pathname)
    ) {
      notFound();
      return;
    }
    const fileRoot = adminFile ? adminRoot : root;
    const path = resolve(
      fileRoot,
      `.${pathname === "/" ? "/index.html" : pathname}`,
    );
    if (
      !path.startsWith(fileRoot.endsWith(sep) ? fileRoot : fileRoot + sep) ||
      pathname.split("/").some((part) => part.startsWith("."))
    ) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if (!types[extname(path)]) {
      response.writeHead(404).end("Not found");
      return;
    }
    if (extname(path) === ".mp4") {
      const { size } = await stat(path);
      let start = 0,
        end = size - 1;
      const range =
        request.method === "GET" ? request.headers.range : undefined;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2])) {
          response.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
          return;
        }
        if (!match[1]) start = Math.max(0, size - Number(match[2]));
        else {
          start = Number(match[1]);
          if (match[2]) end = Math.min(size - 1, Number(match[2]));
        }
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start > end ||
          start >= size
        ) {
          response.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
          return;
        }
      }
      response.writeHead(range ? 206 : 200, {
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Cache-Control": "no-store",
        ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      const stream = createReadStream(path, { start, end });
      stream.on("error", () => response.destroy());
      response.on("close", () => stream.destroy());
      stream.pipe(response);
      return;
    }
    let contents = await readFile(path);
    if (adminFile && extname(path) === ".html")
      contents = Buffer.from(
        contents.toString().replaceAll("__STOREFRONT_URL__", storefront),
      );
    response.writeHead(200, {
      "Content-Type": types[extname(path)],
      "Cache-Control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch (error) {
    response
      .writeHead(error instanceof URIError ? 400 : 404, {
        "Content-Type": "text/plain; charset=utf-8",
      })
      .end("Страница не найдена");
  }
});
server.requestTimeout = 15000;
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE" ? `Порт ${port} занят.` : error.message,
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Perfume Studio ${admin ? "Seller (local only)" : "Perfume"}: http://127.0.0.1:${port}`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      api.db.close();
      process.exit(0);
    }),
  );
