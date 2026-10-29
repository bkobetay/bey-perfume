import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { catalog, setCatalog, promotionStatus } from "../server/commerce.mjs";

const products = JSON.parse(
  await readFile(new URL("../data/products.json", import.meta.url), "utf8"),
);
const now = Date.parse("2026-11-01T12:00:00Z");
const row = (extra) => ({
  id: "promo-000000000001",
  title: "Тест",
  scope: "all",
  scope_value: "",
  percent: 10,
  starts_at: null,
  ends_at: null,
  active: 1,
  ...extra,
});

test("group promotions apply only while active and to their scope", () => {
  assert.equal(promotionStatus(row({ active: 0 }), now), "off");
  assert.equal(
    promotionStatus(row({ starts_at: "2026-11-02T00:00:00Z" }), now),
    "scheduled",
  );
  assert.equal(
    promotionStatus(row({ ends_at: "2026-11-01T11:59:59Z" }), now),
    "expired",
  );
  assert.equal(promotionStatus(row(), now), "active");
  const brand = products.find((p) => p.type === "razliv").brand;
  const priced = catalog(products, [], now, [
    row({ scope: "brand", scope_value: brand, percent: 30 }),
    row({ id: "promo-000000000002", scope: "raspiv", percent: 15 }),
    row({
      id: "promo-000000000003",
      scope: "all",
      percent: 50,
      starts_at: "2026-11-05T00:00:00Z",
    }),
  ]);
  for (const p of priced) {
    const expected = p.brand === brand ? 30 : p.type === "raspiv" ? 15 : 0;
    assert.equal(
      p.pricePerMl,
      Math.round((p.basePricePerMl * (100 - expected)) / 100),
      p.id,
    );
    assert.equal(p.onSale, expected > 0);
  }
  const sets = setCatalog(
    [
      {
        id: "set-starter",
        title: "Набор",
        description: "",
        items: JSON.stringify([{ productId: products[0].id, ml: 10 }]),
        fixed_price: null,
        sale_price: 100,
        sale_ends_at: "2026-11-01T00:00:00Z",
        available: 1,
        visible: 1,
        sort: 0,
        version: 1,
      },
    ],
    catalog(products, [], now),
    [],
    now,
  );
  assert.equal(sets[0].onSale, false, "an expired set sale stops");
  assert.equal(sets[0].price, sets[0].regularPrice);
});
