import { access, readFile, writeFile } from "node:fs/promises";
const products = JSON.parse(
  await readFile(new URL("../data/products.json", import.meta.url), "utf8"),
);
const path = new URL("../dist/index.html", import.meta.url);
const labels = {
  woody: "Древесный",
  fresh: "Свежий",
  oriental: "Восточный",
  leather: "Кожаный",
  spicy: "Пряный",
  floral: "Цветочный",
};
const ids = new Set();
for (const product of products) {
  if (ids.has(product.id) || !/^[a-z0-9-]+$/.test(product.id))
    throw new Error(`Invalid or duplicate product id: ${product.id}`);
  ids.add(product.id);
  if (
    !Array.isArray(product.variants) ||
    !product.variants.length ||
    new Set(product.variants.map((v) => v.ml)).size !==
      product.variants.length ||
    product.variants.some(
      (v) =>
        !Number.isInteger(v.ml) ||
        v.ml < 5 ||
        !Number.isInteger(v.price) ||
        v.price < 1,
    )
  )
    throw new Error(`Invalid volumes/prices: ${product.id}`);
  if (product.categories.some((category) => !labels[category]))
    throw new Error(`Unknown category: ${product.id}`);
  if (product.image)
    await access(
      new URL(`../dist/assets/products/${product.image}`, import.meta.url),
    );
}
const countLabel = (count) => {
  const last = count % 10,
    lastTwo = count % 100;
  return `${count} ${last === 1 && lastTwo !== 11 ? "аромат" : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? "аромата" : "ароматов"}`;
};
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
function card(product, index, featured = false) {
  const name = escape(product.name);
  const visual = product.image
    ? `<img src="/assets/products/${escape(product.image)}" alt="Флакон ${escape(product.brand)} ${name}${product.edition ? ` — ${escape(product.edition)}` : ""}" width="800" height="800" loading="lazy" decoding="async" />`
    : `<div class="demo-bottle" aria-hidden="true"><div class="bottle-cap"></div><div class="bottle-body"><div class="bottle-label"><small>Capella Perfume</small><span>${name}</span><i>SCENT COLLECTION</i></div></div></div><span class="visual-disclaimer">Демо-визуал</span>`;
  return `<article class="product-card${featured ? " featured-card reveal" : ""}" data-product="${escape(product.id)}" data-categories="${product.categories.join(" ")}" data-accent="${product.accent}">
    <div class="product-visual"><span class="product-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}${featured ? " / CAPELLA PERFUME EDIT" : ""}</span>${visual}</div>
    <div class="product-copy"><p class="product-brand">${escape(product.brand)}</p><h3>${name}</h3><p class="product-notes">${escape(product.notes)}</p><div class="product-tags">${
      product.categories.length
        ? product.categories
            .slice(0, 2)
            .map((category) => `<span>${labels[category]}</span>`)
            .join("")
        : "<span>Знакомство скоро</span>"
    }</div><div class="purchase-controls"><label>Объём<select class="volume-select" aria-label="Объём ${name}">${product.variants.map((v) => `<option value="${v.ml}">${v.ml} мл · ${v.price.toLocaleString("ru-RU")} ₸</option>`).join("")}</select></label><button class="add-cart" type="button" data-add="${escape(product.id)}" aria-label="Добавить ${name} в корзину" disabled>В корзину <span aria-hidden="true">+</span></button><span class="product-availability" role="status">Проверяем наличие…</span><small>Демонстрационная цена</small></div></div>
  </article>`;
}
const replace = (html, name, value) => {
  const pattern = new RegExp(
    `(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`,
  );
  if (!pattern.test(html))
    throw new Error(`Missing generated section: ${name}`);
  return html.replace(pattern, (_, begin, end) => `${begin}\n${value}\n${end}`);
};
const catalogPath = new URL("../dist/catalog.html", import.meta.url);
let home = await readFile(path, "utf8");
let catalog = await readFile(catalogPath, "utf8");
// A larger assortment must never expand the homepage.
const featured = products.filter((product) => product.featured).slice(0, 4);
home = replace(
  home,
  "selection",
  featured.map((product, index) => card(product, index, true)).join("\n"),
);
catalog = replace(
  catalog,
  "catalog",
  products.map((product, index) => card(product, index)).join("\n"),
);
catalog = catalog.replace(
  /(<span id="collection-total">)\d+(<\/span>)/,
  (_, begin, end) =>
    `${begin}${String(products.length).padStart(2, "0")}${end}`,
);
catalog = catalog.replace(
  /(<p\s+id="catalog-count"[\s\S]*?>)[\s\S]*?(<\/p>)/,
  (_, begin, end) => `${begin}${countLabel(products.length)}${end}`,
);
await writeFile(path, home);
await writeFile(catalogPath, catalog);
console.log(
  `Rendered ${products.length} fragrances on catalog.html and ${featured.length} homepage picks.`,
);
