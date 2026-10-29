import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createAPI } from "../server/api.mjs";
const products = JSON.parse(
  await readFile(new URL("../data/products.json", import.meta.url), "utf8"),
);
test("local retail: availability/CAS, account sessions/ownership, addresses, stock preservation and restart", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "arafan-retail-"));
  let api = createAPI(products, directory);
  const server = createServer((req, res) =>
    api.handle(req, res, new URL(req.url, "http://" + req.headers.host)),
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    api.db.close();
    await rm(directory, { recursive: true, force: true });
  });
  const origin = "http://127.0.0.1:" + server.address().port;
  const token = randomBytes(32).toString("base64url");
  api.db
    .prepare("INSERT INTO sessions VALUES (?,?)")
    .run(
      createHash("sha256").update(token).digest("hex"),
      Date.now() + 3600000,
    );
  const admin = "bey_session=" + token;
  async function call(path, method = "GET", data, cookie = "") {
    const response = await fetch(origin + path, {
      method,
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  }
  const p = (await call("/api/products")).data.products[0];
  assert.deepEqual(
    p.variants.map((v) => v.ml),
    [5, 10, 20, 30],
  );
  assert.equal(p.available, true);
  assert.equal(p.availableMl, undefined);
  api.db
    .prepare("INSERT INTO inventory VALUES (?,?,?,?)")
    .run(p.id, 17, 9, "2020-01-01");
  const patch = {
    version: 0,
    pricePerMl: 1000,
    available: true,
    salePricePerMl: 750,
    saleEndsAt: null,
  };
  const race = await Promise.all([
    call("/api/admin/products/" + p.id, "PATCH", patch, admin),
    call("/api/admin/products/" + p.id, "PATCH", patch, admin),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  const current = (await call("/api/products")).data.products[0];
  assert.equal(current.variants[3].price, 22500);
  const register = await call("/api/account/register", "POST", {
    email: "account@example.com",
    password: "safe test password",
    name: "Айдана",
  });
  assert.equal(register.status, 201);
  const customer = register.cookie;
  assert.equal(
    (await call("/api/account/me", "GET", undefined, customer)).data.account
      .email,
    "account@example.com",
  );
  const order = {
    requestKey: randomUUID(),
    name: "Айдана",
    phone: "+77001234567",
    address: "Алматы, дом 5",
    comment: "Позвонить заранее",
    items: [{ productId: p.id, type: p.type, ml: 30, quantity: 20 }],
    expectedTotal: 22500 * 20,
  };
  const created = await call("/api/orders", "POST", order, customer);
  assert.equal(created.status, 201);
  assert.equal(
    (await call("/api/orders", "POST", order, customer)).status,
    200,
  );
  assert.equal(
    (await call("/api/orders", "POST", order)).status,
    409,
    "account cannot be removed from an accepted request",
  );
  const owned = (await call("/api/account/orders", "GET", undefined, customer))
    .data.orders;
  assert.equal(owned.length, 1);
  assert.equal(owned[0].address, order.address);
  assert.equal(owned[0].comment, order.comment);
  assert.equal((await call("/api/account/orders")).status, 401);
  const second = await call("/api/account/register", "POST", {
    email: "other@example.com",
    password: "safe other password",
  });
  assert.equal(
    (await call("/api/account/orders", "GET", undefined, second.cookie)).data
      .orders.length,
    0,
  );
  assert.equal(owned[0].fulfillment, "delivery");
  for (const extra of [{ address: "" }, { fulfillment: "courier" }])
    assert.equal(
      (
        await call(
          "/api/orders",
          "POST",
          { ...order, ...extra, requestKey: randomUUID() },
          customer,
        )
      ).status,
      400,
    );
  const pickup = {
    ...order,
    fulfillment: "pickup",
    address: "",
    requestKey: randomUUID(),
  };
  const picked = await call("/api/orders", "POST", pickup, customer);
  assert.equal(picked.status, 201);
  const pickupRow = api.db
    .prepare("SELECT fulfillment,address FROM orders WHERE id=?")
    .get(picked.data.id);
  assert.equal(pickupRow.fulfillment, "pickup");
  assert.equal(pickupRow.address, "");
  assert.equal(
    (await call("/api/orders", "POST", pickup, customer)).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/orders",
        "POST",
        { ...pickup, fulfillment: "delivery", address: "Другой адрес" },
        customer,
      )
    ).status,
    409,
  );
  const id = created.data.id;
  assert.equal(
    (
      await call(
        "/api/admin/orders/" + id,
        "PATCH",
        { status: "paid", version: 1, note: "" },
        admin,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        "/api/admin/orders/" + id,
        "PATCH",
        { status: "awaiting_payment", version: 1, note: "" },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    api.db
      .prepare("SELECT quantity_units FROM inventory WHERE product_id=?")
      .get(p.id).quantity_units,
    17,
  );
  assert.equal((await call("/api/admin/inventory")).status, 404);
  assert.equal(
    (await call("/api/admin/orders/" + id + "/return-stock", "POST", {}, admin))
      .status,
    404,
  );
  assert.equal(
    (
      await call(
        "/api/admin/products",
        "PATCH",
        { ...patch, productId: p.id, version: 1, available: false },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/orders",
        "POST",
        { ...order, requestKey: randomUUID() },
        customer,
      )
    ).status,
    409,
  );
  assert.equal(
    (await call("/api/orders", "POST", order, customer)).status,
    200,
    "accepted request survives later availability and price changes",
  );
  assert.equal(
    (
      await call("/api/account/forgot-password", "POST", {
        email: "account@example.com",
      })
    ).status,
    503,
  );
  api.db.close();
  api = createAPI(products, directory);
  assert.equal((await call("/api/products")).data.products[0].available, false);
  assert.equal(
    (await call("/api/account/orders", "GET", undefined, customer)).data.orders
      .length,
    2,
  );
  assert.equal(
    api.db
      .prepare("SELECT quantity_units FROM inventory WHERE product_id=?")
      .get(p.id).quantity_units,
    17,
  );
  assert.equal(
    (await call("/api/account/logout", "POST", {}, customer)).status,
    200,
  );
  assert.equal(
    (await call("/api/account/orders", "GET", undefined, customer)).status,
    401,
  );
});
