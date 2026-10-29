import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
const products = JSON.parse(
  await readFile(new URL("../data/products.json", import.meta.url), "utf8"),
);
test("approved store catalog:190 coded source positions, exact four-volume prices and real image assets", async () => {
  assert.equal(products.length, 190);
  assert.equal(new Set(products.map((p) => p.id)).size, 190);
  assert.equal(new Set(products.map((p) => p.code)).size, 190);
  const counts = {};
  for (const p of products) {
    assert.equal(p.type, p.code === "OF-001" ? "raspiv" : "razliv");
    assert.ok(p.code && p.source);
    counts[p.collection] = (counts[p.collection] || 0) + 1;
    assert.deepEqual(
      p.variants.map((v) => v.ml),
      [5, 10, 20, 30],
    );
    for (const v of p.variants)
      assert.equal(v.price, p.pricePerMl * v.ml, p.code);
    assert.ok(p.image, p.code);
    await access(
      new URL("../dist/assets/products/" + p.image, import.meta.url),
    );
    assert.ok(p.description && p.notes && p.notesSource, p.code);
  }
  assert.deepEqual(counts, { female: 58, male: 44, niche: 65, universal: 23 });
  for (const code of [
    "SU-078",
    "U-051",
    "W-006",
    "W-003",
    "W-045",
    "W-044",
    "W-026",
    "W-053",
    "F-029",
  ])
    assert.ok(!products.some((p) => p.code === code), code);
  assert.match(
    products.find((p) => p.code === "U-032").name,
    /Silver Mountain Water/i,
  );
  assert.match(products.find((p) => p.code === "U-040").name, /Lost Cherry/i);
});

test("owner performance scores match exact SKUs with a ten-point scale", () => {
  const rated = products.filter((p) => p.performanceSource);
  assert.equal(rated.length, 190);
  for (const p of rated) {
    assert.equal(p.performanceSource.sku, p.code);
    assert.equal(p.performanceSource.scale, 10);
    assert.ok(p.longevity >= 0 && p.longevity <= 10, p.code);
    assert.ok(p.sillage >= 0 && p.sillage <= 10, p.code);
    assert.match(p.performanceSource.longevityCell, /^C[0-9]+$/);
    assert.match(p.performanceSource.sillageCell, /^D[0-9]+$/);
  }
  assert.equal(products.find((p) => p.code === "SW-055").longevity, 7);
  assert.equal(products.find((p) => p.code === "SW-055").sillage, 8);
  assert.ok(!products.some(p => p.code === 'W-044'));
});
