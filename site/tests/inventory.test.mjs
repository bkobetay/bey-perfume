import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { createAPI } from "../server/api.mjs";
const products = JSON.parse(
  await readFile(new URL("../data/products.json", import.meta.url), "utf8"),
);

test("stock: atomic confirmations, manual returns, concurrency, idempotency and public availability", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "bey-inventory-"));
  const api = createAPI(products, dir),
    other = createAPI(products, dir);
  const token = randomBytes(32).toString("base64url");
  api.db
    .prepare("INSERT INTO sessions VALUES (?, ?)")
    .run(
      createHash("sha256").update(token).digest("hex"),
      Date.now() + 1000000,
    );
  const servers = [api, other].map((a) =>
    createServer((req, res) =>
      a.handle(req, res, new URL(req.url, "http://" + req.headers.host)),
    ),
  );
  for (const s of servers)
    await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const origins = servers.map((s) => "http://127.0.0.1:" + s.address().port);
  t.after(async () => {
    for (const s of servers) await new Promise((r) => s.close(r));
    api.db.close();
    other.db.close();
    await rm(dir, { recursive: true, force: true });
  });
  async function call(
    path,
    method = "GET",
    body,
    index = 0,
    auth = true,
    origin,
  ) {
    const r = await fetch(origins[index] + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin || origins[index],
        ...(auth ? { Cookie: "bey_session=" + token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json() };
  }
  const inventory = async () => (await call("/api/admin/inventory")).data;
  const current = async (id) =>
    (await inventory()).products.find((p) => p.id === id);
  const adjust = async (id, kind, ml, index = 0) =>
    call(
      "/api/admin/inventory/" + id,
      "PATCH",
      {
        kind,
        ml,
        reason: "Тест склада",
        version: (await current(id)).stockVersion,
        requestKey: randomUUID(),
      },
      index,
    );
  const p = products[0],
    q = products[1];
  const items = (id = p.id, ml = 5, quantity = 1) => [
    { productId: id, ml, quantity },
  ];
  async function order(lines = items()) {
    return call("/api/orders", "POST", {
      requestKey: randomUUID(),
      name: "Айдана",
      phone: "+77001234567",
      items: lines,
      expectedTotal: lines.reduce(
        (s, i) =>
          s +
          products
            .find((p) => p.id === i.productId)
            .variants.find((v) => v.ml === i.ml).price *
            i.quantity,
        0,
      ),
    });
  }
  const getOrder = async (id) =>
    (await call("/api/admin/orders?q=" + id)).data.orders[0];
  const confirm = async (id, index = 0) =>
    call(
      "/api/admin/orders/" + id,
      "PATCH",
      {
        status: "confirmed",
        paymentConfirmed: true,
        note: "",
        version: (await getOrder(id)).version,
      },
      index,
    );
  assert.equal(
    (await inventory()).movements.length,
    products.length,
    "initialization never duplicates opening balances",
  );
  assert.equal((await current(p.id)).availableMl, 100);
  assert.equal(
    (await call("/api/admin/inventory", "GET", null, 0, false)).status,
    401,
  );
  assert.equal(
    (
      await call(
        "/api/admin/inventory/" + p.id,
        "PATCH",
        {
          kind: "add",
          ml: 1,
          reason: "Тест",
          version: 1,
          requestKey: randomUUID(),
        },
        0,
        true,
        "https://example.org",
      )
    ).status,
    403,
  );
  for (const ml of [-1, 0.01, "100", 1000001])
    assert.equal((await adjust(p.id, "add", ml)).status, 400);
  const addPayload = {
    kind: "add",
    ml: 0.1,
    reason: "Пополнение",
    version: 1,
    requestKey: randomUUID(),
  };
  assert.equal(
    (await call("/api/admin/inventory/" + p.id, "PATCH", addPayload)).status,
    200,
  );
  assert.equal(
    (await call("/api/admin/inventory/" + p.id, "PATCH", addPayload)).status,
    200,
  );
  assert.equal((await current(p.id)).availableMl, 100.1);
  assert.equal(
    (
      await call("/api/admin/inventory/" + p.id, "PATCH", {
        ...addPayload,
        ml: 2,
      })
    ).status,
    409,
  );
  const payload = {
    kind: "add",
    ml: 1,
    reason: "Две вкладки",
    version: (await current(p.id)).stockVersion,
  };
  const both = await Promise.all(
    [0, 1].map((i) =>
      call(
        "/api/admin/inventory/" + p.id,
        "PATCH",
        { ...payload, requestKey: randomUUID() },
        i,
      ),
    ),
  );
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409]);
  await adjust(p.id, "set", 24);
  const placed = await order([...items(p.id, 5, 2), ...items(p.id, 10, 1)]);
  assert.equal(placed.status, 201);
  const id = placed.data.id;
  assert.equal(
    (await current(p.id)).availableMl,
    24,
    "new orders do not reserve stock",
  );
  assert.equal(
    (
      await call("/api/admin/orders/" + id, "PATCH", {
        status: "confirmed",
        note: "",
        version: 1,
      })
    ).status,
    400,
    "payment acknowledgement required",
  );
  assert.equal((await confirm(id)).status, 200);
  assert.equal(
    (await current(p.id)).availableMl,
    4,
    "quantity and different volumes aggregate",
  );
  assert.equal((await confirm(id)).status, 200);
  assert.equal(
    (await current(p.id)).availableMl,
    4,
    "repeat save does not debit",
  );
  assert.equal(
    (await order(items(p.id, 5))).status,
    409,
    "checkout rejects insufficient volume",
  );
  const publicP = (await call("/api/products")).data.products.find(
    (x) => x.id === p.id,
  );
  assert.equal(publicP.availableMl, 4);
  assert.equal(publicP.stockVersion, undefined);
  let saved = await getOrder(id);
  assert.equal(
    (
      await call("/api/admin/orders/" + id, "PATCH", {
        status: "cancelled",
        note: "",
        version: saved.version,
      })
    ).status,
    200,
  );
  assert.equal(
    (await current(p.id)).availableMl,
    4,
    "cancellation does not automatically return poured perfume",
  );
  saved = await getOrder(id);
  const returnPayload = { version: saved.version };
  assert.equal(
    (
      await call(
        "/api/admin/orders/" + id + "/return-stock",
        "POST",
        returnPayload,
      )
    ).status,
    200,
  );
  assert.equal((await current(p.id)).availableMl, 24);
  assert.equal(
    (
      await call(
        "/api/admin/orders/" + id + "/return-stock",
        "POST",
        returnPayload,
      )
    ).status,
    409,
  );
  assert.equal((await current(p.id)).availableMl, 24, "double return blocked");
  assert.equal((await confirm(id)).status, 200);
  assert.equal(
    (await current(p.id)).availableMl,
    4,
    "reconfirmed returned order debits once",
  );
  await adjust(p.id, "set", 10);
  await adjust(q.id, "set", 10);
  const compound = await order([...items(), ...items(q.id, 5)]);
  assert.equal(compound.status, 201);
  await adjust(q.id, "set", 0);
  assert.equal((await confirm(compound.data.id)).status, 409);
  assert.equal((await current(p.id)).availableMl, 10, "no partial debit");
  assert.equal(
    (await getOrder(compound.data.id)).status,
    "new",
    "order status rolls back",
  );
  const a = await order(items(p.id, 10)),
    b = await order(items(p.id, 10));
  const race = await Promise.all([confirm(a.data.id), confirm(b.data.id, 1)]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await current(p.id)).availableMl, 0);
  assert.equal((await adjust(p.id, "remove", 0.1)).status, 409);
  const reopened = createAPI(products, dir);
  assert.equal(
    reopened.db
      .prepare("SELECT quantity_units FROM inventory WHERE product_id=?")
      .get(p.id).quantity_units,
    0,
    "restart preserves depletion",
  );
  reopened.db.close();
  assert.ok(
    (await inventory()).movements.some(
      (m) => m.kind === "return" && m.order_id === id,
    ),
  );

  // Orders issued before the rebrand must still support status changes and returns.
  for (const prefix of [
    "BEY",
    "TS",
    "LAGUNA",
    "PS",
    "PL",
    "PB",
    "VOX",
    "ARO",
    "NA",
    "FP",
  ]) {
    const legacyId = `${prefix}-20260930-0123456789`;
    const legacyItems = JSON.stringify([
      {
        productId: p.id,
        name: `КОЛЛЕКЦИЯ ${prefix === "PS" ? "PERFUME STUDIO" : prefix === "PL" ? "PERFUMELAND" : prefix === "PB" ? "PARFBURO" : prefix === "VOX" ? "VOXPARFUM.KZ" : prefix === "ARO" ? "AROMANIA.KZ" : prefix === "NA" ? "NICHE AVENUE" : prefix === "FP" ? "FLORA PERFUME" : prefix} Mawashi`,
        ml: 3,
        quantity: 1,
        price: 2100,
        subtotal: 2100,
      },
    ]);
    api.db
      .prepare(
        "INSERT INTO orders (id, request_key, fingerprint, name, phone, items, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        legacyId,
        randomUUID(),
        "legacy-fingerprint",
        "Айдана",
        "+77001234567",
        legacyItems,
        2100,
        "2026-09-30",
        "2026-09-30",
      );
    assert.equal(
      (await getOrder(legacyId)).items[0].name,
      "КОЛЛЕКЦИЯ RATAY PERFUME Mawashi",
    );
    assert.equal(
      api.db.prepare("SELECT items FROM orders WHERE id = ?").get(legacyId)
        .items,
      legacyItems,
    );
    await adjust(p.id, "set", 3);
    assert.equal((await confirm(legacyId)).status, 200);
    assert.equal((await current(p.id)).availableMl, 0);
    assert.equal(
      (
        await call("/api/admin/orders/" + legacyId, "PATCH", {
          status: "cancelled",
          note: "",
          version: (await getOrder(legacyId)).version,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call("/api/admin/orders/" + legacyId + "/return-stock", "POST", {
          version: (await getOrder(legacyId)).version,
        })
      ).status,
      200,
    );
    assert.equal((await current(p.id)).availableMl, 3);
  }
});

test("existing orders migrate without retrospective stock deduction", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "bey-stock-migration-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const old = new DatabaseSync(join(dir, "orders.sqlite"));
  old.exec(
    `CREATE TABLE orders(id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, fingerprint TEXT NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,items TEXT NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'new',note TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  );
  old
    .prepare("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      "legacy",
      "key",
      "hash",
      "Айдана",
      "+77001234567",
      "[]",
      0,
      "confirmed",
      "",
      1,
      "2026-09-30",
      "2026-09-30",
    );
  old.close();
  const api = createAPI(products, dir);
  assert.equal(
    api.db.prepare("SELECT inventory_state FROM orders").get().inventory_state,
    "legacy",
  );
  assert.equal(
    api.db.prepare("SELECT SUM(quantity_units) AS total FROM inventory").get()
      .total,
    products.length * 1000,
  );
  api.db.close();
});
