import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { randomBytes, pbkdf2Sync } from "node:crypto";
import { handleAPI } from "../cloudflare/api.mjs";
import { createWorker } from "../cloudflare/worker.mjs";
const products = JSON.parse(
  await readFile(new URL("../data/products.json", import.meta.url), "utf8"),
);
const schema = await readFile(
  new URL("../cloudflare/migrations/0001_store.sql", import.meta.url),
  "utf8",
);
function setup() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(schema);
  for (const p of products)
    sql
      .prepare(
        "INSERT INTO inventory(product_id,quantity_units,updated_at) VALUES (?,1000,?)",
      )
      .run(p.id, new Date().toISOString());
  const salt = randomBytes(24).toString("hex"),
    password = randomBytes(24).toString("base64url");
  const env = {
    ADMIN_AUTH: `pbkdf2$100000$${salt}$${pbkdf2Sync(password, Buffer.from(salt, "hex"), 100000, 32, "sha256").toString("hex")}`,
    ADMIN_PATH: "/seller-" + "a".repeat(24),
    SECURITY_KEY: randomBytes(32).toString("hex"),
    DB: {
      prepare(query) {
        let args = [];
        return {
          bind(...values) {
            args = values;
            return this;
          },
          async first() {
            return sql.prepare(query).get(...args) || null;
          },
          async all() {
            return { results: sql.prepare(query).all(...args) };
          },
          async run() {
            const result = sql.prepare(query).run(...args);
            return { meta: { changes: result.changes } };
          },
        };
      },
    },
  };
  let cookie = "";
  async function call(
    path,
    method = "GET",
    data,
    { auth = true, origin = "https://shop.pages.dev", ip = "127.0.0.1" } = {},
  ) {
    const headers = {
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
    };
    if (origin) headers.Origin = origin;
    if (auth && cookie) headers.Cookie = cookie;
    const response = await handleAPI(
      new Request("https://shop.pages.dev" + path, {
        method,
        headers,
        ...(data ? { body: JSON.stringify(data) } : {}),
      }),
      env,
    );
    return {
      status: response.status,
      headers: response.headers,
      data: await response.json(),
    };
  }
  async function login() {
    const r = await call("/api/admin/login", "POST", {
      username: "admin",
      password,
    });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("set-cookie"), /Secure; SameSite=Strict/);
    cookie = r.headers.get("set-cookie").split(";")[0];
  }
  return { sql, env, call, login, password };
}
test("Cloudflare: authenticated orders, atomic stock, idempotency, returns and rate limits", async (t) => {
  const s = setup();
  t.after(() => s.sql.close());
  const { call, sql } = s;
  assert.equal((await call("/api/admin/orders")).status, 401);
  assert.equal(
    (
      await call("/api/admin/login", "POST", {
        username: "admin",
        password: "wrong",
      })
    ).status,
    401,
  );
  await s.login();
  const p = products[0],
    q = products[1];
  const payload = (lines = [{ productId: p.id, ml: 10, quantity: 1 }]) => ({
    requestKey: crypto.randomUUID(),
    name: "Айдана",
    phone: "+77000000000",
    items: lines,
    expectedTotal: lines.reduce(
      (v, l) =>
        v +
        products
          .find((x) => x.id === l.productId)
          .variants.find((x) => x.ml === l.ml).price *
          l.quantity,
      0,
    ),
  });
  assert.equal(
    (
      await call("/api/orders", "POST", payload(), {
        origin: "https://attacker.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/orders", "POST", { ...payload(), name: "аывфаыв" }))
      .status,
    400,
  );
  assert.equal(
    (await call("/api/orders", "POST", { ...payload(), expectedTotal: 1 }))
      .status,
    409,
  );
  const data = payload();
  const created = await Promise.all([
    call("/api/orders", "POST", data),
    call("/api/orders", "POST", data),
  ]);
  assert.deepEqual(created.map((r) => r.status).sort(), [200, 201]);
  const id = created[0].data.id;
  assert.match(id, /^ARF-\d{8}-[A-F0-9]{10}$/);
  assert.equal(
    (await call("/api/orders", "POST", { ...data, name: "Алия" })).status,
    409,
  );
  const getOrder = async (id) =>
    (await call("/api/admin/orders?q=" + id)).data.orders[0];
  const balance = (id) =>
    sql
      .prepare("SELECT quantity_units FROM inventory WHERE product_id=?")
      .get(id).quantity_units;
  async function update(id, status, extra = {}) {
    return call("/api/admin/orders/" + id, "PATCH", {
      version: (await getOrder(id)).version,
      status,
      note: "",
      ...extra,
    });
  }
  assert.equal((await update(id, "confirmed")).status, 400);
  assert.equal(balance(p.id), 1000);
  assert.equal(
    (await update(id, "confirmed", { paymentConfirmed: true })).status,
    200,
  );
  assert.equal(balance(p.id), 900);
  await update(id, "ready");
  assert.equal(balance(p.id), 900);
  assert.equal((await getOrder(id)).inventory_state, "deducted");
  assert.equal((await call("/api/admin/orders?q=айдана")).data.total, 1);
  assert.equal(
    (await call("/api/admin/orders")).data.orders[0].fingerprint,
    undefined,
  );
  await update(id, "cancelled");
  assert.equal(balance(p.id), 900);
  let order = await getOrder(id);
  assert.equal(
    (
      await call("/api/admin/orders/" + id + "/return-stock", "POST", {
        version: order.version,
      })
    ).status,
    200,
  );
  assert.equal(balance(p.id), 1000);
  assert.equal(
    (
      await call("/api/admin/orders/" + id + "/return-stock", "POST", {
        version: order.version,
      })
    ).status,
    409,
  );
  async function adjust(id, kind, ml) {
    const row = sql
      .prepare("SELECT version FROM inventory WHERE product_id=?")
      .get(id);
    const d = {
      requestKey: crypto.randomUUID(),
      version: row.version,
      kind,
      ml,
      reason: "Проверка",
    };
    return { d, result: await call("/api/admin/inventory/" + id, "PATCH", d) };
  }
  let a = await adjust(p.id, "add", 5);
  assert.equal(a.result.status, 200);
  assert.equal(balance(p.id), 1050);
  assert.equal(
    (await call("/api/admin/inventory/" + p.id, "PATCH", a.d)).status,
    200,
  );
  assert.equal(balance(p.id), 1050);
  assert.equal(
    (await call("/api/admin/inventory/" + p.id, "PATCH", { ...a.d, ml: 6 }))
      .status,
    409,
  );
  await adjust(p.id, "set", 100);
  const bulk = payload([{ productId: p.id, ml: 10, quantity: 6 }]);
  const one = (await call("/api/orders", "POST", bulk)).data.id;
  const two = (
    await call("/api/orders", "POST", {
      ...bulk,
      requestKey: crypto.randomUUID(),
    })
  ).data.id;
  const confirmed = await Promise.all([
    update(one, "confirmed", { paymentConfirmed: true }),
    update(two, "confirmed", { paymentConfirmed: true }),
  ]);
  assert.deepEqual(confirmed.map((r) => r.status).sort(), [200, 409]);
  assert.equal(balance(p.id), 400);
  const multi = payload([
    { productId: p.id, ml: 10, quantity: 1 },
    { productId: q.id, ml: 10, quantity: 1 },
  ]);
  const mid = (await call("/api/orders", "POST", multi)).data.id;
  await adjust(q.id, "set", 0);
  const pBefore = balance(p.id);
  assert.equal(
    (await update(mid, "confirmed", { paymentConfirmed: true })).status,
    409,
  );
  assert.equal(balance(p.id), pBefore);
  assert.equal((await getOrder(mid)).inventory_state, "pending");
  assert.equal((await getOrder(mid)).status, "new");
  assert.equal((await call("/api/orders", "POST", multi)).status, 200); // accepted request survives later stock changes
  assert.equal(
    (
      await call("/api/orders", "POST", {
        ...multi,
        requestKey: crypto.randomUUID(),
      })
    ).status,
    409,
  );
  const pub = await call("/api/products");
  assert.equal(pub.data.products.find((x) => x.id === q.id).availableMl, 0);
  assert.equal(pub.data.products[0].stockVersion, undefined);
  const now = sql
    .prepare("SELECT version FROM inventory WHERE product_id=?")
    .get(p.id).version;
  const simultaneous = await Promise.all([
    call("/api/admin/inventory/" + p.id, "PATCH", {
      requestKey: crypto.randomUUID(),
      version: now,
      kind: "add",
      ml: 1,
      reason: "Один",
    }),
    call("/api/admin/inventory/" + p.id, "PATCH", {
      requestKey: crypto.randomUUID(),
      version: now,
      kind: "add",
      ml: 1,
      reason: "Два",
    }),
  ]);
  assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 409]);
  const secondIP = "1.2.3.4";
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await call(
          "/api/admin/login",
          "POST",
          { username: "admin", password: "bad" },
          { ip: secondIP },
        )
      ).status,
      401,
    );
  assert.equal(
    (
      await call(
        "/api/admin/login",
        "POST",
        { username: "admin", password: s.password },
        { ip: secondIP },
      )
    ).status,
    429,
  );
  await call("/api/admin/logout", "POST", {});
  assert.equal((await call("/api/admin/orders")).status, 401);
});
test("Cloudflare: hidden seller URL, public isolation and security headers", async (t) => {
  const s = setup();
  t.after(() => s.sql.close());
  s.env.ASSETS = { fetch: async () => new Response("asset") };
  const worker = createWorker("<html>Кабинет продавца</html>");
  for (const path of [
    "/admin",
    "/admin.html",
    "/admin/index.html",
    "/seller-guessed",
    "/site/private/admin-access.txt",
    "/private/orders.sqlite",
    "/_worker.js",
  ]) {
    const r = await worker.fetch(
      new Request("https://shop.pages.dev" + path),
      s.env,
    );
    assert.equal(r.status, 404, path);
  }
  const r = await worker.fetch(
    new Request("https://shop.pages.dev" + s.env.ADMIN_PATH),
    s.env,
  );
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.match(
    r.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request("https://shop.pages.dev/api/admin/orders"),
        s.env,
      )
    ).status,
    401,
  );
});
