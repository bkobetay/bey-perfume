import products from "../data/products.json" with { type: "json" };
import {
  customerNameError,
  normalizeCustomerName,
} from "../dist/name-validation.js";
const statuses = {
  new: "Новый",
  confirmed: "Подтверждён",
  preparing: "Собирается",
  ready: "Готов",
  completed: "Выдан",
  cancelled: "Отменён",
};
const paid = new Set(["confirmed", "preparing", "ready", "completed"]);
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
  const { request_key, fingerprint, search_name, ...order } = row;
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
function validateOrder(data) {
  const error = customerNameError(data.name);
  if (error) fail(400, error);
  if (
    typeof data.phone !== "string" ||
    data.phone.length > 30 ||
    !/^[+\d\s()\-]+$/.test(data.phone)
  )
    fail(400, "Проверьте номер телефона.");
  let digits = data.phone.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "8") digits = "7" + digits.slice(1);
  if (!/^7\d{10}$/.test(digits))
    fail(400, "Укажите +7 и ровно 10 цифр номера.");
  if (
    !Array.isArray(data.items) ||
    !data.items.length ||
    data.items.length > 24
  )
    fail(400, "Добавьте от 1 до 24 позиций.");
  const keys = new Set();
  const items = data.items.map((item) => {
    const product = products.find((p) => p.id === item?.productId);
    const variant = product?.variants.find((v) => v.ml === item.ml);
    if (
      !variant ||
      item.ml < 5 ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20
    )
      fail(400, "Проверьте аромат, объём от 5 мл и количество (1–20).");
    const key = product.id + ":" + variant.ml;
    if (keys.has(key)) fail(400, "Повторяющаяся позиция.");
    keys.add(key);
    return {
      productId: product.id,
      name: product.brand + " " + product.name,
      ml: variant.ml,
      quantity: item.quantity,
      price: variant.price,
      subtotal: variant.price * item.quantity,
    };
  });
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  if (data.expectedTotal !== total)
    fail(409, "Стоимость изменилась. Обновите страницу и проверьте сумму.");
  return {
    name: normalizeCustomerName(data.name),
    phone: "+" + digits,
    items,
    total,
  };
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
    async function inventory() {
      const rows = await all("SELECT * FROM inventory");
      return products.map((p) => {
        const s = rows.find((r) => r.product_id === p.id);
        return {
          ...p,
          availableMl: (s?.quantity_units || 0) / 10,
          stockVersion: s?.version || 1,
          stockUpdatedAt: s?.updated_at,
        };
      });
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
        products: (await inventory()).map(
          ({ stockVersion, stockUpdatedAt, ...p }) => p,
        ),
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
      const order = validateOrder(data),
        fingerprint = await digest(JSON.stringify(order));
      const prior = await first(
        "SELECT id,total,fingerprint FROM orders WHERE request_key=?",
        data.requestKey,
      );
      if (prior) {
        if (prior.fingerprint !== fingerprint)
          fail(409, "Ключ заявки уже использован. Откройте корзину заново.");
        return json({ id: prior.id, total: prior.total });
      }
      const id =
          "ARF-" +
          new Date().toISOString().slice(0, 10).replaceAll("-", "") +
          "-" +
          hex(random(5)).toUpperCase(),
        now = new Date().toISOString();
      const inserted = await first(
        "INSERT INTO orders(id,request_key,fingerprint,name,search_name,phone,items,total,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(request_key) DO NOTHING RETURNING id,total",
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
      );
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
            "(instr(lower(id),?)>0 OR instr(search_name,?)>0 OR instr(phone,?)>0)",
          );
          args.push(q, q, q);
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
      if (method === "GET" && path === "/api/admin/inventory")
        return json({
          products: await inventory(),
          movements: await all(
            "SELECT * FROM inventory_movements ORDER BY id DESC LIMIT 50",
          ),
        });
      const stock = /^\/api\/admin\/inventory\/([a-z0-9-]+)$/.exec(path);
      if (stock && method === "PATCH") {
        const d = await body(request);
        if (!products.some((p) => p.id === stock[1]))
          fail(404, "Аромат не найден.");
        if (
          !["add", "remove", "set"].includes(d.kind) ||
          !Number.isInteger(d.version) ||
          typeof d.reason !== "string" ||
          !d.reason.trim() ||
          d.reason.length > 300 ||
          typeof d.requestKey !== "string" ||
          !/^[a-f0-9-]{36}$/.test(d.requestKey) ||
          typeof d.ml !== "number" ||
          !Number.isFinite(d.ml) ||
          d.ml < 0 ||
          d.ml > 1000000 ||
          Math.abs(d.ml * 10 - Math.round(d.ml * 10)) > 1e-7 ||
          (!d.ml && d.kind !== "set")
        )
          fail(400, "Проверьте операцию, объём и комментарий.");
        const amount = Math.round(d.ml * 10),
          reason = d.reason.trim(),
          fingerprint = await digest(
            JSON.stringify([stock[1], d.kind, amount, reason, d.version]),
          );
        const prior = await first(
          "SELECT fingerprint FROM inventory_requests WHERE request_key=?",
          d.requestKey,
        );
        if (prior) {
          if (prior.fingerprint !== fingerprint)
            fail(409, "Ключ операции уже использован.");
          return json({ ok: true });
        }
        const current = await first(
          "SELECT * FROM inventory WHERE product_id=?",
          stock[1],
        );
        if (!current || current.version !== d.version)
          fail(409, "Остаток изменился. Обновите склад.");
        await run(
          "INSERT INTO inventory_requests(request_key,fingerprint,payload,created_at) VALUES (?,?,?,?) ON CONFLICT(request_key) DO NOTHING",
          d.requestKey,
          fingerprint,
          JSON.stringify({
            id: stock[1],
            kind: d.kind,
            amount,
            reason,
            version: d.version,
            previous: current.quantity_units,
          }),
          new Date().toISOString(),
        );
        const saved = await first(
          "SELECT fingerprint FROM inventory_requests WHERE request_key=?",
          d.requestKey,
        );
        if (saved.fingerprint !== fingerprint)
          fail(409, "Ключ операции уже использован.");
        return json({ ok: true });
      }
      const orderMatch =
        /^\/api\/admin\/orders\/([A-Z]+-\d{8}-[A-F0-9]{10})(\/return-stock)?$/.exec(
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
        if (orderMatch[2] && method === "POST") {
          if (
            current.status !== "cancelled" ||
            current.inventory_state !== "deducted"
          )
            fail(
              409,
              "Возврат доступен только для отменённого заказа со списанным объёмом.",
            );
          const row = await first(
            "UPDATE orders SET inventory_state='returned',version=version+1,updated_at=? WHERE id=? AND version=? RETURNING id",
            now,
            current.id,
            d.version,
          );
          if (!row) fail(409, "Заказ изменился. Обновите список.");
          return json({ ok: true });
        }
        if (!orderMatch[2] && method === "PATCH") {
          if (
            !Object.hasOwn(statuses, d.status) ||
            typeof d.note !== "string" ||
            d.note.length > 1000
          )
            fail(400, "Проверьте статус и заметку.");
          let state = current.inventory_state;
          if (paid.has(d.status) && !["deducted", "legacy"].includes(state)) {
            if (d.paymentConfirmed !== true)
              fail(400, "Подтвердите, что оплата заказа проверена.");
            state = "deducted";
          }
          const row = await first(
            "UPDATE orders SET status=?,note=?,inventory_state=?,version=version+1,updated_at=? WHERE id=? AND version=? RETURNING *",
            d.status,
            d.note.trim(),
            state,
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
    if (/stock_conflict|quantity_units|return_conflict/.test(message))
      return json(
        {
          error:
            "Недостаточно объёма на складе либо недопустимый возврат. Обновите страницу.",
        },
        409,
      );
    if (/stock_version_conflict/.test(message))
      return json({ error: "Остаток изменился. Обновите склад." }, 409);
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
