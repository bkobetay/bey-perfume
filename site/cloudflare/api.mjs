import products from "../data/products.json" with { type: "json" };
import {
  catalog,
  productPatch,
  validateOrder,
  matchesAcceptedOrder,
  statuses,
  orderCodePrefix,
  orderCode,
  NEXT_ORDER_NUMBER_SQL,
} from "../server/commerce.mjs";
import { customerAuth } from "../server/customer-auth.mjs";
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const hex = (bytes) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
const unhex = (s) =>
  Uint8Array.from(s.match(/../g) || [], (b) => parseInt(b, 16));
const digest = async (s) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const random = (n) => crypto.getRandomValues(new Uint8Array(n));
const cookie = (token, secure) =>
  `bey_session=${token}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Strict; Path=/api/admin; Max-Age=${token ? 28800 : 0}`;
const present = (row) => {
  const {
    request_key,
    fingerprint,
    search_name,
    inventory_state,
    account_id,
    ...order
  } = row;
  order.items = JSON.parse(order.items);
  return order;
};
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
async function body(request) {
  if (
    !/^application\/json(?:;|$)/i.test(
      request.headers.get("Content-Type") || "",
    )
  )
    fail(415, "Ожидается JSON.");
  if (Number(request.headers.get("Content-Length")) > 16384)
    fail(413, "Запрос слишком большой.");
  const reader = request.body?.getReader();
  let size = 0;
  const chunks = [];
  if (reader)
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16384) {
        await reader.cancel();
        fail(413, "Запрос слишком большой.");
      }
      chunks.push(value);
    }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error();
    return data;
  } catch {
    fail(400, "Неверный JSON.");
  }
}
async function verifyPassword(password, config) {
  const [type, iterations, salt, expected] = String(config || "").split("$");
  if (
    type !== "pbkdf2" ||
    iterations !== "100000" ||
    !/^[a-f0-9]{48}$/.test(salt) ||
    !/^[a-f0-9]{64}$/.test(expected)
  )
    fail(503, "Вход ещё не настроен.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: unhex(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
  const want = unhex(expected);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ want[i];
  return difference === 0;
}
export async function handleAPI(request, env) {
  try {
    if (!env.DB || !env.SECURITY_KEY) fail(503, "Сервис временно недоступен.");
    const db = env.DB.withSession
      ? env.DB.withSession("first-primary")
      : env.DB;
    const first = (sql, ...args) =>
      db
        .prepare(sql)
        .bind(...args)
        .first();
    const all = async (sql, ...args) =>
      (
        await db
          .prepare(sql)
          .bind(...args)
          .all()
      ).results;
    const run = (sql, ...args) =>
      db
        .prepare(sql)
        .bind(...args)
        .run();
    const url = new URL(request.url),
      path = url.pathname,
      method = request.method,
      secure = url.protocol === "https:";
    if (method !== "GET" && request.headers.get("Origin") !== url.origin)
      fail(403, "Запрос с другого сайта запрещён.");
    async function limit(kind, max, windowMs) {
      const now = Date.now();
      const ip = request.headers.get("CF-Connecting-IP") || "local";
      const key = await digest(kind + ":" + ip + ":" + env.SECURITY_KEY);
      const row = await first(
        "INSERT INTO rate_limits(key,hits,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN expires<=? THEN 1 ELSE hits+1 END,expires=CASE WHEN expires<=? THEN ? ELSE expires END RETURNING hits",
        key,
        now + windowMs,
        now,
        now,
        now + windowMs,
      );
      if (row.hits > max) fail(429, "Слишком много попыток. Попробуйте позже.");
    }
    async function currentProducts() {
      return catalog(products, await all("SELECT * FROM product_settings"));
    }
    const customer = customerAuth({
      first,
      all,
      run,
      limit,
      secure,
      cookies: request.headers.get("Cookie"),
    });
    if (path.startsWith("/api/account")) {
      const result = await customer.handle(
        path,
        method,
        method === "POST" ? await body(request) : undefined,
      );
      if (result)
        return json(
          result.data,
          result.status || 200,
          result.cookie ? { "Set-Cookie": result.cookie } : {},
        );
      fail(404, "Не найдено.");
    }
    async function authenticate() {
      const token = /(?:^|;\s*)bey_session=([A-Za-z0-9_-]{43})(?:;|$)/.exec(
        request.headers.get("Cookie") || "",
      )?.[1];
      if (!token) fail(401, "Войдите в кабинет продавца.");
      const hash = await digest(token);
      if (
        !(await first(
          "SELECT 1 FROM sessions WHERE token_hash=? AND expires>?",
          hash,
          Date.now(),
        ))
      )
        fail(401, "Войдите в кабинет продавца.");
      return hash;
    }
    if (method === "GET" && path === "/api/products")
      return json({
        currency: "KZT",
        products: await currentProducts(),
      });
    if (method === "POST" && path === "/api/admin/login") {
      await limit("login", 10, 15 * 60 * 1000);
      const data = await body(request);
      if (
        data.username !== "admin" ||
        typeof data.password !== "string" ||
        data.password.length > 256
      )
        fail(401, "Неверный логин или пароль.");
      if (!(await verifyPassword(data.password, env.ADMIN_AUTH)))
        fail(401, "Неверный логин или пароль.");
      const token = btoa(String.fromCharCode(...random(32)))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
      await run("DELETE FROM sessions WHERE expires<=?", Date.now());
      const old = /(?:^|;\s*)bey_session=([A-Za-z0-9_-]{43})(?:;|$)/.exec(
        request.headers.get("Cookie") || "",
      )?.[1];
      if (old)
        await run("DELETE FROM sessions WHERE token_hash=?", await digest(old));
      await run(
        "INSERT INTO sessions(token_hash,expires) VALUES (?,?)",
        await digest(token),
        Date.now() + 8 * 3600000,
      );
      return json({ ok: true }, 200, { "Set-Cookie": cookie(token, secure) });
    }
    if (method === "POST" && path === "/api/orders") {
      await limit("order", 30, 10 * 60 * 1000);
      const data = await body(request);
      if (
        typeof data.requestKey !== "string" ||
        !/^[a-f0-9-]{36}$/.test(data.requestKey)
      )
        fail(400, "Неверный ключ заявки.");
      const accountId = (await customer.current())?.id ?? null;
      const prior = await first(
        "SELECT * FROM orders WHERE request_key=?",
        data.requestKey,
      );
      if (prior) {
        if (!matchesAcceptedOrder(data, prior, accountId))
          fail(409, "Ключ заявки уже использован. Откройте корзину заново.");
        return json({ id: prior.id, total: prior.total });
      }
      const order = validateOrder(data, await currentProducts());
      order.accountId = accountId;
      const fingerprint = await digest(JSON.stringify(order));
      const now = new Date().toISOString(),
        prefix = orderCodePrefix();
      // D1 has no interactive transactions: take the next daily number and
      // retry with a higher one if a concurrent order claimed it first.
      let inserted,
        number = (await first(NEXT_ORDER_NUMBER_SQL, prefix + "%")).next;
      for (let attempt = 0; ; attempt++) {
        const id = orderCode(prefix, number);
        try {
          inserted = await first(
            "INSERT INTO orders(id,request_key,fingerprint,name,search_name,phone,items,total,created_at,updated_at,address,comment,account_id,fulfillment) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(request_key) DO NOTHING RETURNING id,total",
            id,
            data.requestKey,
            fingerprint,
            order.name,
            order.name.toLocaleLowerCase("ru"),
            order.phone,
            JSON.stringify(order.items),
            order.total,
            now,
            now,
            order.address,
            order.comment,
            order.accountId,
            order.fulfillment,
          );
          break;
        } catch (error) {
          if (
            attempt >= 20 ||
            !/UNIQUE constraint failed: orders\.id/.test(error.message)
          )
            throw error;
          number++;
        }
      }
      if (!inserted) {
        const row = await first(
          "SELECT id,total,fingerprint FROM orders WHERE request_key=?",
          data.requestKey,
        );
        if (!row || row.fingerprint !== fingerprint)
          fail(409, "Ключ заявки уже использован.");
        return json({ id: row.id, total: row.total });
      }
      return json(inserted, 201);
    }
    if (
      path.startsWith("/api/admin/inventory") ||
      path.endsWith("/return-stock")
    )
      fail(404, "Не найдено.");
    if (path.startsWith("/api/admin/")) {
      const tokenHash = await authenticate();
      if (method === "POST" && path === "/api/admin/logout") {
        await run("DELETE FROM sessions WHERE token_hash=?", tokenHash);
        return json({ ok: true }, 200, { "Set-Cookie": cookie("", secure) });
      }
      if (method === "GET" && path === "/api/admin/orders") {
        const status = url.searchParams.get("status") || "all",
          q = (url.searchParams.get("q") || "")
            .trim()
            .slice(0, 80)
            .toLocaleLowerCase("ru");
        if (
          !["all", "active"].includes(status) &&
          !Object.hasOwn(statuses, status)
        )
          fail(400, "Неизвестный статус.");
        const filters = [],
          args = [];
        if (status === "active")
          filters.push("status NOT IN ('completed','cancelled')");
        else if (status !== "all") {
          filters.push("status=?");
          args.push(status);
        }
        if (q) {
          filters.push(
            "(instr(lower(id),?)>0 OR instr(search_name,?)>0 OR instr(phone,?)>0 OR instr(lower(items),?)>0)",
          );
          args.push(q, q, q, q);
        }
        const where = filters.length ? " WHERE " + filters.join(" AND ") : "";
        const total = (
            await first("SELECT COUNT(*) AS n FROM orders" + where, ...args)
          ).n,
          pageCount = Math.max(1, Math.ceil(total / 20));
        const n = Number(url.searchParams.get("page")) || 1,
          page = Math.max(
            1,
            Math.min(pageCount, Number.isSafeInteger(n) ? n : 1),
          );
        const rows = await all(
          "SELECT * FROM orders" +
            where +
            " ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?",
          ...args,
          (page - 1) * 20,
        );
        const counts = Object.fromEntries(
          Object.keys(statuses).map((k) => [k, 0]),
        );
        for (const r of await all(
          "SELECT status,COUNT(*) AS n FROM orders GROUP BY status",
        ))
          counts[r.status] = r.n;
        return json({
          orders: rows.map(present),
          counts,
          total,
          page,
          pageCount,
          statuses,
        });
      }
      if (method === "GET" && path === "/api/admin/products")
        return json({ products: await currentProducts() });
      const productMatch = /^\/api\/admin\/products(?:\/([a-z0-9-]+))?$/.exec(
        path,
      );
      if (productMatch && method === "PATCH") {
        const data = await body(request),
          id = productMatch[1] || data.productId;
        if (!products.some((p) => p.id === id)) fail(404, "Аромат не найден.");
        const patch = productPatch(data),
          now = new Date().toISOString();
        let row;
        if (data.version === 0)
          row = await first(
            "INSERT INTO product_settings(product_id,price_per_ml,available,sale_price_per_ml,sale_ends_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(product_id) DO NOTHING RETURNING *",
            id,
            patch.price,
            patch.available,
            patch.sale,
            patch.end,
            now,
          );
        else
          row = await first(
            "UPDATE product_settings SET price_per_ml=?,available=?,sale_price_per_ml=?,sale_ends_at=?,version=version+1,updated_at=? WHERE product_id=? AND version=? RETURNING *",
            patch.price,
            patch.available,
            patch.sale,
            patch.end,
            now,
            id,
            data.version,
          );
        if (!row) fail(409, "Товар изменён в другой вкладке. Обновите список.");
        return json({
          product: (await currentProducts()).find((p) => p.id === id),
        });
      }
      const orderMatch =
        /^\/api\/admin\/orders\/([A-Z]+-\d{8}-[A-F0-9]{10}|ARF-\d{6}-\d{2,4})(\/return-stock)?$/.exec(
          path,
        );
      if (
        orderMatch &&
        ((orderMatch[2] && method === "POST") ||
          (!orderMatch[2] && method === "PATCH"))
      ) {
        const d = await body(request),
          current = await first(
            "SELECT * FROM orders WHERE id=?",
            orderMatch[1],
          );
        if (!current) fail(404, "Заказ не найден.");
        if (!Number.isInteger(d.version) || current.version !== d.version)
          fail(409, "Заказ изменился. Обновите список.");
        const now = new Date().toISOString();
        if (!orderMatch[2] && method === "PATCH") {
          if (
            !Object.hasOwn(statuses, d.status) ||
            typeof d.note !== "string" ||
            d.note.length > 1000
          )
            fail(400, "Проверьте статус и заметку.");
          if (d.status === "paid")
            fail(409, "Оплата подтверждается только платёжным провайдером.");
          const row = await first(
            "UPDATE orders SET status=?,note=?,version=version+1,updated_at=? WHERE id=? AND version=? RETURNING *",
            d.status,
            d.note.trim(),
            now,
            current.id,
            d.version,
          );
          if (!row) fail(409, "Заказ изменился. Обновите список.");
          return json({ order: present(row) });
        }
      }
    }
    fail(404, "Не найдено.");
  } catch (error) {
    const message = String(error.message || "");
    if (!error.status)
      console.error("Cloud API failed:", error.name || "Error");
    return json(
      {
        error: error.status
          ? error.message
          : "Не удалось сохранить данные. Попробуйте ещё раз.",
      },
      error.status || 500,
    );
  }
}
