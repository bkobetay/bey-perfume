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
const awaitMigration = await readFile(
  new URL("../cloudflare/migrations/0002_retail_accounts.sql", import.meta.url),
  "utf8",
);
const fulfillmentMigration = await readFile(
  new URL(
    "../cloudflare/migrations/0003_order_fulfillment.sql",
    import.meta.url,
  ),
  "utf8",
);
function setup() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(schema);
  sql.exec(awaitMigration);
  sql.exec(fulfillmentMigration);
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
    {
      auth = true,
      origin = "https://shop.pages.dev",
      ip = "127.0.0.1",
      customerCookie,
    } = {},
  ) {
    const headers = {
      "Content-Type": "application/json",
      "CF-Connecting-IP": ip,
    };
    if (origin) headers.Origin = origin;
    if (auth && cookie) headers.Cookie = cookie;
    if (customerCookie)
      headers.Cookie = [headers.Cookie, customerCookie]
        .filter(Boolean)
        .join("; ");
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
test("Cloudflare: retail settings, orders, customer ownership and preserved history", async (t) => {
  const s = setup();
  t.after(() => s.sql.close());
  const { call, sql } = s;
  assert.equal((await call("/api/admin/products")).status, 401);
  await s.login();
  const p = (await call("/api/products")).data.products[0];
  assert.deepEqual(
    p.variants.map((v) => v.ml),
    [5, 10, 20, 30],
  );
  assert.equal(p.type, products[0].type || "raspiv");
  assert.equal(p.available, true);
  assert.equal(p.availableMl, undefined);
  const balance = () =>
    sql
      .prepare("SELECT quantity_units FROM inventory WHERE product_id=?")
      .get(p.id).quantity_units;
  const make = (extra = {}) => ({
    requestKey: crypto.randomUUID(),
    name: "Айдана",
    phone: "+77000000000",
    address: "Алматы, Абая 1",
    comment: "После 18:00",
    items: [{ productId: p.id, type: p.type, ml: 30, quantity: 20 }],
    expectedTotal: p.pricePerMl * 30 * 20,
    ...extra,
  });
  assert.equal(
    (
      await call("/api/orders", "POST", make(), {
        origin: "https://attacker.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/orders", "POST", make({ address: "x".repeat(501) })))
      .status,
    400,
  );
  assert.equal(
    (await call("/api/orders", "POST", make({ comment: 12 }))).status,
    400,
  );
  assert.equal(
    (await call("/api/orders", "POST", make({ expectedTotal: 1 }))).status,
    409,
  );
  assert.equal(
    (await call("/api/orders", "POST", make({ address: "" }))).status,
    400,
  );
  assert.equal(
    (await call("/api/orders", "POST", make({ fulfillment: "invalid" })))
      .status,
    400,
  );
  const pickup = make({ fulfillment: "pickup", address: "" });
  const picked = await call("/api/orders", "POST", pickup);
  assert.equal(picked.status, 201);
  const pickedRow = sql
    .prepare("SELECT fulfillment,address FROM orders WHERE id=?")
    .get(picked.data.id);
  assert.equal(pickedRow.fulfillment, "pickup");
  assert.equal(pickedRow.address, "");
  assert.equal((await call("/api/orders", "POST", pickup)).status, 200);
  assert.equal(
    (
      await call("/api/orders", "POST", {
        ...pickup,
        fulfillment: "delivery",
        address: "Алматы",
      })
    ).status,
    409,
  );
  const data = make(),
    created = await Promise.all([
      call("/api/orders", "POST", data),
      call("/api/orders", "POST", data),
    ]);
  assert.deepEqual(created.map((r) => r.status).sort(), [200, 201]);
  const id = created[0].data.id;
  let order = (await call("/api/admin/orders?q=" + id)).data.orders[0];
  assert.equal(order.address, data.address);
  assert.equal(order.comment, data.comment);
  assert.equal(order.items[0].type, p.type);
  assert.equal(order.inventory_state, undefined);
  assert.equal(
    (
      await call("/api/admin/orders/" + id, "PATCH", {
        version: 1,
        status: "paid",
        note: "",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/api/admin/orders/" + id, "PATCH", {
        version: 1,
        status: "awaiting_payment",
        note: "",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/api/admin/orders/" + id, "PATCH", {
        version: 1,
        status: "ready",
        note: "",
      })
    ).status,
    409,
  );
  assert.equal(
    balance(),
    1000,
    "large orders/status updates never debit historical stock",
  );
  for (const path of [
    "/api/admin/inventory",
    "/api/admin/inventory/" + p.id,
    "/api/admin/orders/" + id + "/return-stock",
  ])
    assert.equal(
      (
        await call(
          path,
          path.endsWith("/return-stock") ? "POST" : "GET",
          path.endsWith("/return-stock") ? {} : undefined,
        )
      ).status,
      404,
    );
  const patch = {
    version: p.version,
    pricePerMl: 1000,
    available: false,
    salePricePerMl: 800,
    saleEndsAt: "2099-01-01T00:00:00Z",
  };
  const saves = await Promise.all([
    call("/api/admin/products/" + p.id, "PATCH", patch),
    call("/api/admin/products/" + p.id, "PATCH", patch),
  ]);
  assert.deepEqual(saves.map((r) => r.status).sort(), [200, 409]);
  let current = (await call("/api/products")).data.products[0];
  assert.equal(
    (await call("/api/orders", "POST", data)).status,
    200,
    "accepted request survives later price and availability changes",
  );
  assert.equal(current.available, false);
  assert.equal(current.pricePerMl, 800);
  assert.equal(current.variants[0].price, 4000);
  assert.equal(current.variants[0].originalPrice, 5000);
  assert.equal(
    (await call("/api/orders", "POST", make({ expectedTotal: 800 * 30 * 20 })))
      .status,
    409,
  );
  assert.equal(
    (
      await call("/api/admin/products/" + p.id, "PATCH", {
        ...patch,
        version: current.version,
        pricePerMl: -1,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/api/admin/products/" + p.id, "PATCH", {
        ...patch,
        version: current.version,
        available: true,
        saleEndsAt: "2000-01-01T00:00:00Z",
      })
    ).status,
    200,
  );
  current = (await call("/api/products")).data.products[0];
  assert.equal(current.pricePerMl, 800);
  assert.equal(
    current.onSale,
    true,
    "timer expiry must not silently change the seller price",
  );
  const registered = await call("/api/account/register", "POST", {
    email: "Buyer@Example.com",
    password: "a secure test password",
    name: "Айдана",
  });
  assert.equal(registered.status, 201);
  assert.match(
    registered.headers.get("set-cookie"),
    /HttpOnly; Secure; SameSite=Strict; Path=\/api;/,
  );
  const customerCookie = registered.headers.get("set-cookie").split(";")[0];
  const buyer = { customerCookie };
  assert.equal(
    (await call("/api/account", "GET", undefined, buyer)).data.account.email,
    "buyer@example.com",
  );
  assert.equal((await call("/api/account/orders")).status, 401);
  const owned = await call(
    "/api/orders",
    "POST",
    make({ expectedTotal: current.pricePerMl * 30 * 20 }),
    buyer,
  );
  assert.equal(owned.status, 201);
  assert.equal(
    (await call("/api/account/orders", "GET", undefined, buyer)).data.orders
      .length,
    1,
  );
  const other = await call("/api/account/register", "POST", {
    email: "second@example.com",
    password: "another secure password",
  });
  const otherCookie = other.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (
      await call("/api/account/orders", "GET", undefined, {
        customerCookie: otherCookie,
      })
    ).data.orders.length,
    0,
    "same phone grants no account access",
  );
  assert.notEqual(
    sql.prepare("SELECT password_hash FROM customers LIMIT 1").get()
      .password_hash,
    "a secure test password",
  );
  assert.equal(
    (
      await call("/api/account/login", "POST", {
        email: "buyer@example.com",
        password: "wrong password",
      })
    ).status,
    401,
  );
  const logged = await call(
    "/api/account/login",
    "POST",
    { email: "buyer@example.com", password: "a secure test password" },
    buyer,
  );
  assert.equal(logged.status, 200);
  assert.equal(
    (await call("/api/account/orders", "GET", undefined, buyer)).status,
    401,
    "login rotates session",
  );
  const loginCookie = logged.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (
      await call(
        "/api/account/logout",
        "POST",
        {},
        { customerCookie: loginCookie },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/api/account/orders", "GET", undefined, {
        customerCookie: loginCookie,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call("/api/account/forgot-password", "POST", {
        email: "buyer@example.com",
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await call("/api/account/reset-password", "POST", {
        token: "invented",
        password: "new test password",
      })
    ).status,
    503,
  );
  assert.equal(balance(), 1000);
  assert.equal(
    sql
      .prepare(
        "SELECT COUNT(*) n FROM sqlite_master WHERE type='trigger' AND name IN ('order_paid','order_return','stock_adjusted','order_stock_check')",
      )
      .get().n,
    0,
  );
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
test("retail migration preserves historical orders, events and stock audit rows", () => {
  const sql = new DatabaseSync(":memory:");
  try {
    sql.exec(schema);
    sql
      .prepare(
        "INSERT INTO inventory(product_id,quantity_units,updated_at) VALUES (?,?,?)",
      )
      .run("historic", 100, "2020-01-01");
    const snapshot = JSON.stringify([
      {
        productId: "historic",
        name: "Historical item",
        ml: 5,
        quantity: 1,
        price: 100,
        subtotal: 100,
      },
    ]);
    sql
      .prepare(
        "INSERT INTO orders(id,request_key,fingerprint,name,phone,items,total,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .run(
        "ARF-20200101-0123456789",
        "old-key",
        "old-fingerprint",
        "Айдана",
        "+77000000000",
        snapshot,
        100,
        "2020-01-01",
        "2020-01-01",
      );
    sql
      .prepare(
        "UPDATE orders SET status='confirmed',inventory_state='deducted',updated_at='2020-01-02' WHERE id=?",
      )
      .run("ARF-20200101-0123456789");
    const before = {
      order: sql.prepare("SELECT * FROM orders").get(),
      events: sql.prepare("SELECT * FROM events").all(),
      stock: sql.prepare("SELECT * FROM inventory").all(),
      movements: sql.prepare("SELECT * FROM inventory_movements").all(),
    };
    sql.exec(awaitMigration);
    sql.exec(fulfillmentMigration);
    const after = sql.prepare("SELECT * FROM orders").get();
    for (const [key, value] of Object.entries(before.order))
      assert.equal(after[key], value, key);
    assert.deepEqual(sql.prepare("SELECT * FROM events").all(), before.events);
    assert.deepEqual(
      sql.prepare("SELECT * FROM inventory").all(),
      before.stock,
    );
    assert.deepEqual(
      sql.prepare("SELECT * FROM inventory_movements").all(),
      before.movements,
    );
    assert.equal(after.address, "");
    assert.equal(after.comment, "");
    assert.equal(after.account_id, null);
    assert.equal(after.fulfillment, "delivery");
  } finally {
    sql.close();
  }
});
