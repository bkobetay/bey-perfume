// Deploy only this allowlisted public build, never the repository or private data.
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  copyFile,
  rm,
  stat,
} from "node:fs/promises";
import { resolve, dirname, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
const site = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  root = resolve(site, ".."),
  output = resolve(root, "artifacts/arafan-pages");
await mkdir(resolve(root, "artifacts/arafan-cloudflare"), { recursive: true });
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const allowed = new Set([
  ".html",
  ".css",
  ".js",
  ".svg",
  ".png",
  ".webp",
  ".jpg",
  ".jpeg",
  ".woff2",
  ".ttf",
  ".txt",
  ".xml",
]);
async function copyPublic(from, to) {
  for (const item of await readdir(from, { withFileTypes: true })) {
    if (item.name.startsWith(".") || item.isSymbolicLink())
      throw Error("Unexpected hidden file or symlink in public input.");
    const source = resolve(from, item.name),
      target = resolve(to, item.name);
    if (item.isDirectory()) {
      if (!["assets", "fonts", "products", "certificates", "i18n"].includes(item.name))
        throw Error("Unexpected public directory: " + item.name);
      await mkdir(target, { recursive: true });
      await copyPublic(source, target);
    } else {
      if (!allowed.has(extname(item.name)))
        throw Error("Unexpected public file type: " + item.name);
      if ((await stat(source)).size > 25 * 1024 * 1024)
        throw Error("Public asset exceeds Pages size limit.");
      await copyFile(source, target);
    }
  }
}
await copyPublic(resolve(site, "dist"), output);
await mkdir(resolve(output, "seller-assets"));
for (const f of ["admin.js", "admin.css", "products.js"])
  await copyFile(
    resolve(site, "admin", f),
    resolve(output, "seller-assets", f),
  );
let html = await readFile(resolve(site, "admin/index.html"), "utf8");
html = html
  .replaceAll("__STOREFRONT_URL__", "/")
  .replace('src="/admin.js"', 'src="/seller-assets/admin.js"')
  .replace('href="/admin.css"', 'href="/seller-assets/admin.css"')
  .replace('src="/products.js"', 'src="/seller-assets/products.js"');
const worker = relative(output, resolve(site, "cloudflare/worker.mjs"))
  .split("\\")
  .join("/");
await writeFile(
  resolve(output, "_worker.js"),
  `import {createWorker} from ${JSON.stringify(worker.startsWith(".") ? worker : "./" + worker)};\nexport default createWorker(${JSON.stringify(html)});\n`,
);
await writeFile(
  resolve(output, "_routes.json"),
  JSON.stringify(
    { version: 1, include: ["/api/*", "/seller-*", "/admin*"], exclude: [] },
    null,
    2,
  ),
);
await writeFile(
  resolve(output, "_headers"),
  `/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'\n/assets/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/seller-assets/*\n  X-Robots-Tag: noindex, nofollow\n`,
);
await writeFile(
  resolve(output, "404.html"),
  '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Страница не найдена — Arafan Perfume</title><body><h1>Страница не найдена</h1><a href="/">На главную</a></body></html>',
);
console.log(
  "Safe public build prepared; no stock seed or private customer data copied.",
);
