import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import net from "node:net";
import http from "node:http";

const project = new URL("../", import.meta.url);
async function unusedPort() {
  const server = net.createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  await new Promise((r) => server.close(r));
  return port;
}
test("orders, authentication, persistence and security boundaries", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "bey-orders-test-"));
  const port = await unusedPort();
  const origin = `http://127.0.0.1:${port}`;
  const adminPort = await unusedPort();
  const adminOrigin = `http://127.0.0.1:${adminPort}`;
  const env = {
    ...process.env,
    PORT: String(port),
    ADMIN_PORT: String(adminPort),
    BEY_PRIVATE_DIR: directory,
  };
  assert.equal(
    spawnSync(process.execPath, ["scripts/setup-admin.mjs"], {
      cwd: project,
      env,
    }).status,
    0,
  );
  const access = await readFile(join(directory, "admin-access.txt"), "utf8");
  const password = /Пароль: (.+)/.exec(access)[1];
  let processes = [];
  async function start() {
    processes = [];
    for (const args of [
      ["scripts/serve.mjs"],
      ["scripts/serve.mjs", "--admin"],
    ]) {
      const child = spawn(process.execPath, args, {
        cwd: project,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      processes.push(child);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Server start timed out")),
          10000,
        );
        child.stdout.once("data", () => {
          clearTimeout(timer);
          resolve();
        });
        child.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error("Server exit " + code));
        });
      });
    }
  }
  async function stop() {
    await Promise.all(
      processes
        .filter((p) => p.exitCode === null)
        .map(
          (p) =>
            new Promise((r) => {
              p.once("exit", r);
              p.kill("SIGTERM");
            }),
        ),
    );
  }
  t.after(async () => {
    await stop();
    await rm(directory, { recursive: true, force: true });
  });
  await start();
  let cookie = "";
  async function call(path, method = "GET", data, options = {}) {
    const destination = path.startsWith("/api/admin/") ? adminOrigin : origin;
    const headers = {
      Origin: destination,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers,
    };
    const response = await fetch(destination + path, {
      method,
      headers,
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
    const value = response.headers
      .get("content-type")
      ?.includes("application/json")
      ? await response.json()
      : await response.text();
    return { response, value, status: response.status };
  }
  for (const path of [
    "/admin.html",
    "/admin.js",
    "/admin/index.html",
    "/api/admin/login",
    "/api/admin/orders",
    "/%61dmin.js",
    "/api/%61dmin/orders",
  ]) {
    assert.equal((await fetch(origin + path)).status, 404, path);
    assert.equal(
      (
        await fetch(origin + path, {
          method: "POST",
          headers: { Origin: origin },
        })
      ).status,
      404,
      path + " POST",
    );
  }
  assert.equal((await fetch(adminOrigin + "/")).status, 200);
  assert.equal((await fetch(adminOrigin + "/catalog.html")).status, 404);
  assert.equal((await fetch(adminOrigin + "/api/products")).status, 404);
  assert.equal(
    (
      await fetch(adminOrigin + "/api/admin/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password }),
      })
    ).status,
    403,
  );
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
  let login = await call("/api/admin/login", "POST", {
    username: "admin",
    password,
  });
  assert.equal(login.status, 200);
  assert.match(
    login.response.headers.get("set-cookie"),
    /HttpOnly; SameSite=Strict/,
  );
  cookie = login.response.headers.get("set-cookie").split(";")[0];
  const products = (await call("/api/products")).value.products;
  const product = products[0],
    variant = product.variants[0];
  assert.ok(products.every((p) => p.variants.every((v) => v.ml >= 5)));
  const payload = {
    requestKey: randomUUID(),
    name: "Тестовый покупатель",
    phone: "+7 700 000 00 00",
    items: [{ productId: product.id, ml: variant.ml, quantity: 2 }],
    expectedTotal: variant.price * 2,
  };
  assert.equal(
    (await call("/api/orders", "POST", { ...payload, expectedTotal: 1 }))
      .status,
    409,
  );
  for (const name of ["аовлыдфж", "аывфаыв", "Имя123", "аааааа"]) {
    assert.equal(
      (await call("/api/orders", "POST", { ...payload, name })).status,
      400,
    );
  }
  for (const phone of [
    "+7700000000",
    "+770000000000",
    "+447000000000",
    "+7700abc0000000",
  ]) {
    assert.equal(
      (await call("/api/orders", "POST", { ...payload, phone })).status,
      400,
    );
  }
  assert.equal(
    (await call("/api/orders", "POST", { ...payload, phone: "bad" })).status,
    400,
  );
  assert.equal(
    (
      await call("/api/orders", "POST", {
        ...payload,
        name: "<script>x</script>",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/api/orders", "POST", {
        ...payload,
        items: [{ productId: product.id, ml: 3, quantity: 1 }],
      })
    ).status,
    400,
    "New orders must reject the retired 3 ml volume",
  );
  assert.equal(
    (
      await call("/api/orders", "POST", {
        ...payload,
        items: [{ productId: product.id, ml: 999, quantity: 1 }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/api/orders", "POST", {
        ...payload,
        items: [{ productId: product.id, ml: variant.ml, quantity: -1 }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/api/orders", "POST", payload, {
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/orders", "POST", payload, { headers: { Origin: "" } }))
      .status,
    403,
  );
  const hostStatus = await new Promise((resolve) =>
    http.get(
      origin + "/api/products",
      { headers: { Host: "evil.example" } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      },
    ),
  );
  assert.equal(hostStatus, 403);
  assert.equal(
    (await call("/api/orders", "POST", { padding: "x".repeat(17000) })).status,
    413,
  );
  const results = await Promise.all([
    call("/api/orders", "POST", payload),
    call("/api/orders", "POST", payload),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 201]);
  const id = results[0].value.id;
  assert.match(id, /^AP-\d{8}-[A-F0-9]{10}$/);
  assert.equal(id, results[1].value.id);
  assert.equal(
    (await call("/api/orders", "POST", { ...payload, name: "Другое имя" }))
      .status,
    409,
  );
  let list = (await call("/api/admin/orders")).value;
  assert.equal(list.total, 1);
  assert.equal(list.orders[0].total, variant.price * 2);
  assert.equal(list.orders[0].status, "new");
  assert.equal(list.orders[0].request_key, undefined);
  assert.equal(list.orders[0].fingerprint, undefined);
  const updated = await call("/api/admin/orders/" + id, "PATCH", {
    status: "confirmed",
    paymentConfirmed: true,
    note: "Заберёт завтра",
    version: 1,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.value.order.version, 2);
  assert.equal(
    (
      await call("/api/admin/orders/" + id, "PATCH", {
        status: "ready",
        note: "",
        version: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/api/admin/orders/" + id, "PATCH", {
        status: "invalid",
        note: "",
        version: 2,
      })
    ).status,
    400,
  );
  assert.equal((await call("/api/admin/orders?status=new")).value.total, 0);
  assert.equal(
    (await call("/api/admin/orders?q=" + encodeURIComponent("ПОКУПАТЕЛЬ")))
      .value.total,
    1,
  );
  assert.equal(
    (await call("/api/admin/orders?q=" + encodeURIComponent("' OR 1=1--")))
      .value.total,
    0,
  );
  assert.equal((await call("/api/admin/orders?status=active")).value.total, 1);
  assert.equal(
    (
      await call("/api/admin/orders/" + id, "PATCH", {
        status: "cancelled",
        note: "Заберёт завтра",
        version: 2,
      })
    ).status,
    200,
  );
  assert.equal((await call("/api/admin/orders?status=active")).value.total, 0);
  assert.equal(
    (await call("/api/admin/orders?status=cancelled")).value.total,
    1,
  );
  assert.equal(
    (
      await call("/api/admin/orders/" + id, "PATCH", {
        status: "confirmed",
        note: "Заберёт завтра",
        version: 3,
      })
    ).status,
    200,
  );
  assert.equal((await call("/api/admin/orders?status=active")).value.total, 1);
  for (let i = 0; i < 21; i++)
    assert.equal(
      (
        await call("/api/orders", "POST", {
          ...payload,
          requestKey: randomUUID(),
          name: "Покупатель " + String.fromCharCode(1040 + i),
        })
      ).status,
      201,
    );
  const second = (await call("/api/admin/orders?page=2")).value;
  assert.equal(second.orders.length, 2);
  assert.equal(second.pageCount, 2);
  await stop();
  await start();
  list = (await call("/api/admin/orders?status=confirmed")).value;
  assert.equal(list.total, 1);
  assert.equal(list.orders[0].note, "Заберёт завтра");
  for (const path of [
    "/private/orders.sqlite",
    "/private/admin.json",
    "/.env",
    "/../private/admin.json",
    "/data/products.json",
  ])
    assert.notEqual((await call(path)).status, 200);
  assert.equal((await call("/api/admin/logout", "POST", {})).status, 200);
  assert.equal((await call("/api/admin/orders")).status, 401);
  const fresh = await call("/api/admin/login", "POST", {
    username: "admin",
    password,
  });
  assert.equal(fresh.status, 200);
  cookie = fresh.response.headers.get("set-cookie").split(";")[0];
  for (let i = 0; i < 9; i++)
    await call("/api/admin/login", "POST", {
      username: "admin",
      password: "wrong",
    });
  assert.equal(
    (
      await call("/api/admin/login", "POST", {
        username: "admin",
        password: "wrong",
      })
    ).status,
    429,
  );
});
