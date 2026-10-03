import {
  initializeInventory,
  inventoryProducts,
  checkStock,
  deductOrder,
  paidStatuses,
  units,
  moveStock,
  requirements,
} from "./inventory.mjs";
import {
  customerNameError,
  normalizeCustomerName,
} from "../dist/name-validation.js";
import { readFile } from "node:fs/promises";
import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { openStore, privateDir, presentOrder, statuses } from "./store.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const hashPassword = promisify(scrypt);
export function createAPI(products, directory = privateDir) {
  const db = openStore(directory);
  initializeInventory(db, products);
  const limits = new Map();
  function limit(key, max, ms) {
    const now = Date.now();
    for (const [k, v] of limits) if (v.until < now) limits.delete(k);
    const entry = limits.get(key) || { count: 0, until: now + ms };
    limits.set(key, entry);
    if (++entry.count > max)
      fail(429, "Слишком много попыток. Попробуйте немного позже.");
  }
  const send = (res, status, data, headers = {}) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    });
    res.end(JSON.stringify(data));
  };
  async function body(req) {
    if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
      fail(415, "Ожидается JSON.");
    let size = 0,
      chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16384) fail(413, "Запрос слишком большой.");
      chunks.push(chunk);
    }
    try {
      const data = JSON.parse(Buffer.concat(chunks).toString());
      if (!data || typeof data !== "object" || Array.isArray(data))
        fail(400, "Неверные данные.");
      return data;
    } catch {
      fail(400, "Неверный JSON.");
    }
  }
  function session(req) {
    const token = /(?:^|;\s*)bey_session=([A-Za-z0-9_-]{43})(?:;|$)/.exec(
      req.headers.cookie || "",
    )?.[1];
    db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
    if (
      !token ||
      !db
        .prepare("SELECT 1 FROM sessions WHERE token_hash = ? AND expires > ?")
        .get(digest(token), Date.now())
    )
      fail(401, "Войдите в кабинет продавца.");
    return digest(token);
  }
  function validateOrder(data) {
    const nameError = customerNameError(data.name);
    if (nameError) fail(400, nameError);
    if (
      typeof data.phone !== "string" ||
      data.phone.length > 30 ||
      !/^[+\d\s()\-]+$/.test(data.phone)
    )
      fail(400, "Проверьте номер телефона.");
    let digits = data.phone.replace(/\D/g, "");
    if (digits.length === 11 && digits[0] === "8")
      digits = "7" + digits.slice(1);
    if (!/^7\d{10}$/.test(digits))
      fail(400, "Укажите +7 и ровно 10 цифр номера, например +7 700 000 0000.");
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
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 20
      )
        fail(400, "Проверьте аромат, объём и количество (1–20).");
      const key = `${product.id}:${variant.ml}`;
      if (keys.has(key)) fail(400, "Повторяющаяся позиция.");
      keys.add(key);
      return {
        productId: product.id,
        name: `${product.brand} ${product.name}`,
        ml: variant.ml,
        quantity: item.quantity,
        price: variant.price,
        subtotal: variant.price * item.quantity,
      };
    });
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    if (data.expectedTotal !== total)
      fail(409, "Стоимость изменилась. Обновите страницу и проверьте сумму.");
    return {
      name: normalizeCustomerName(data.name),
      phone: "+" + digits,
      items,
      total,
    };
  }
  return {
    db,
    async handle(req, res, url) {
      try {
        const path = url.pathname;
        if (req.method === "GET" && path === "/api/products")
          return send(res, 200, {
            demoPrices: true,
            currency: "KZT",
            products: inventoryProducts(db, products).map(
              ({ stockVersion, stockUpdatedAt, ...product }) => product,
            ),
          });
        if (req.method !== "GET") {
          if (
            req.headers.origin !== `http://${req.headers.host}` ||
            req.headers["sec-fetch-site"] === "cross-site"
          )
            fail(403, "Запрос с другого сайта запрещён.");
        }
        if (req.method === "POST" && path === "/api/admin/login") {
          limit("login:" + req.socket.remoteAddress, 10, 15 * 60 * 1000);
          const data = await body(req);
          if (
            data.username !== "admin" ||
            typeof data.password !== "string" ||
            data.password.length > 256
          )
            fail(401, "Неверный логин или пароль.");
          let auth;
          try {
            auth = JSON.parse(
              await readFile(resolve(directory, "admin.json"), "utf8"),
            );
          } catch {
            fail(
              503,
              "Вход ещё не настроен. Выполните npm --prefix site run admin:setup.",
            );
          }
          const actual = await hashPassword(data.password, auth.salt, 64, {
            N: 32768,
            r: 8,
            p: 1,
            maxmem: 64 * 1024 * 1024,
          });
          if (!timingSafeEqual(Buffer.from(auth.hash, "hex"), actual))
            fail(401, "Неверный логин или пароль.");
          const old = /(?:^|;\s*)bey_session=([A-Za-z0-9_-]{43})(?:;|$)/.exec(
            req.headers.cookie || "",
          )?.[1];
          if (old)
            db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
              digest(old),
            );
          const token = randomBytes(32).toString("base64url");
          db.prepare("INSERT INTO sessions VALUES (?, ?)").run(
            digest(token),
            Date.now() + 8 * 3600000,
          );
          return send(
            res,
            200,
            { ok: true },
            {
              "Set-Cookie": `bey_session=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=28800`,
            },
          );
        }
        if (req.method === "POST" && path === "/api/orders") {
          limit("order:" + req.socket.remoteAddress, 60, 10 * 60 * 1000);
          const data = await body(req);
          if (
            typeof data.requestKey !== "string" ||
            !/^[a-f0-9-]{36}$/.test(data.requestKey)
          )
            fail(400, "Неверный ключ заявки.");
          const validated = validateOrder(data);
          const fingerprint = digest(JSON.stringify(validated));
          const id = `LAGUNA-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(5).toString("hex").toUpperCase()}`;
          const now = new Date().toISOString();
          db.exec("BEGIN IMMEDIATE");
          try {
            const prior = db
              .prepare("SELECT * FROM orders WHERE request_key = ?")
              .get(data.requestKey);
            if (prior) {
              if (prior.fingerprint !== fingerprint)
                fail(
                  409,
                  "Эта заявка уже принята с другим составом. Откройте корзину заново.",
                );
              db.exec("COMMIT");
              return send(res, 200, { id: prior.id, total: prior.total });
            }
            checkStock(db, validated.items);
            db.prepare(
              "INSERT INTO orders (id, request_key, fingerprint, name, phone, items, total, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ).run(
              id,
              data.requestKey,
              fingerprint,
              validated.name,
              validated.phone,
              JSON.stringify(validated.items),
              validated.total,
              now,
              now,
            );
            db.prepare(
              "INSERT INTO events (order_id, status, at) VALUES (?, ?, ?)",
            ).run(id, "new", now);
            db.exec("COMMIT");
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
          return send(res, 201, { id, total: validated.total });
        }
        if (path.startsWith("/api/admin/")) {
          const tokenHash = session(req);
          if (req.method === "POST" && path === "/api/admin/logout") {
            db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
              tokenHash,
            );
            return send(
              res,
              200,
              { ok: true },
              {
                "Set-Cookie":
                  "bey_session=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0",
              },
            );
          }
          if (req.method === "GET" && path === "/api/admin/orders") {
            const status = url.searchParams.get("status") || "all";
            if (
              !["all", "active"].includes(status) &&
              !Object.hasOwn(statuses, status)
            )
              fail(400, "Неизвестный статус.");
            const q = (url.searchParams.get("q") || "")
              .trim()
              .slice(0, 80)
              .toLocaleLowerCase("ru");
            // Bound parameters, including the literal substring, never become SQL.
            const all = db
              .prepare("SELECT * FROM orders ORDER BY created_at DESC, id DESC")
              .all();
            const matches = all.filter(
              (o) =>
                (status === "all" ||
                  o.status === status ||
                  (status === "active" &&
                    !["completed", "cancelled"].includes(o.status))) &&
                [o.id, o.name, o.phone].some((s) =>
                  s.toLocaleLowerCase("ru").includes(q),
                ),
            );
            const pageCount = Math.max(1, Math.ceil(matches.length / 20));
            const requested = Number(url.searchParams.get("page")) || 1;
            const page = Math.max(
              1,
              Math.min(
                pageCount,
                Number.isSafeInteger(requested) ? requested : 1,
              ),
            );
            const counts = Object.fromEntries(
              Object.keys(statuses).map((s) => [
                s,
                all.filter((o) => o.status === s).length,
              ]),
            );
            return send(res, 200, {
              orders: matches
                .slice((page - 1) * 20, page * 20)
                .map(presentOrder),
              counts,
              total: matches.length,
              page,
              pageCount,
              statuses,
            });
          }
          if (req.method === "GET" && path === "/api/admin/inventory") {
            return send(res, 200, {
              products: inventoryProducts(db, products),
              movements: db
                .prepare(
                  "SELECT * FROM inventory_movements ORDER BY id DESC LIMIT 50",
                )
                .all(),
            });
          }
          const stockMatch = /^\/api\/admin\/inventory\/([a-z0-9-]+)$/.exec(
            path,
          );
          if (stockMatch && req.method === "PATCH") {
            const data = await body(req);
            if (!products.some((p) => p.id === stockMatch[1]))
              fail(404, "Аромат не найден.");
            if (
              !["add", "remove", "set"].includes(data.kind) ||
              !Number.isInteger(data.version) ||
              typeof data.reason !== "string" ||
              !data.reason.trim() ||
              data.reason.length > 300 ||
              typeof data.requestKey !== "string" ||
              !/^[a-f0-9-]{36}$/.test(data.requestKey)
            )
              fail(400, "Укажите операцию, объём и причину (до 300 символов).");
            const amount = units(data.ml);
            if (!amount && data.kind !== "set")
              fail(
                400,
                "Для поступления или списания объём должен быть больше нуля.",
              );
            const fingerprint = digest(
              JSON.stringify([
                stockMatch[1],
                data.kind,
                amount,
                data.reason.trim(),
                data.version,
              ]),
            );
            db.exec("BEGIN IMMEDIATE");
            try {
              const prior = db
                .prepare(
                  "SELECT fingerprint FROM inventory_requests WHERE request_key = ?",
                )
                .get(data.requestKey);
              if (prior && prior.fingerprint !== fingerprint)
                fail(409, "Ключ операции уже использован. Обновите склад.");
              if (!prior) {
                const current = db
                  .prepare("SELECT * FROM inventory WHERE product_id = ?")
                  .get(stockMatch[1]);
                if (current.version !== data.version)
                  fail(
                    409,
                    "Остаток изменился. Обновите склад перед сохранением.",
                  );
                const delta =
                  data.kind === "set"
                    ? amount - current.quantity_units
                    : data.kind === "remove"
                      ? -amount
                      : amount;
                moveStock(
                  db,
                  stockMatch[1],
                  delta,
                  data.kind,
                  data.reason.trim(),
                );
                db.prepare("INSERT INTO inventory_requests VALUES (?, ?)").run(
                  data.requestKey,
                  fingerprint,
                );
              }
              db.exec("COMMIT");
            } catch (error) {
              db.exec("ROLLBACK");
              throw error;
            }
            return send(res, 200, { ok: true });
          }
          const returnMatch =
            /^\/api\/admin\/orders\/((?:LAGUNA|TS|BEY)-\d{8}-[A-F0-9]{10})\/return-stock$/.exec(
              path,
            );
          if (returnMatch && req.method === "POST") {
            const data = await body(req);
            db.exec("BEGIN IMMEDIATE");
            try {
              const order = db
                .prepare("SELECT * FROM orders WHERE id = ?")
                .get(returnMatch[1]);
              if (!order) fail(404, "Заказ не найден.");
              if (order.version !== data.version)
                fail(409, "Заказ изменился. Обновите список.");
              if (
                order.status !== "cancelled" ||
                order.inventory_state !== "deducted"
              )
                fail(
                  409,
                  "Возврат доступен только для отменённого заказа со списанным объёмом.",
                );
              for (const [id, { amount }] of requirements(
                JSON.parse(order.items),
              ))
                moveStock(
                  db,
                  id,
                  amount,
                  "return",
                  "Продавец подтвердил фактический возврат",
                  order.id,
                );
              db.prepare(
                "UPDATE orders SET inventory_state = 'returned', version = version + 1, updated_at = ? WHERE id = ?",
              ).run(new Date().toISOString(), order.id);
              db.exec("COMMIT");
            } catch (error) {
              db.exec("ROLLBACK");
              throw error;
            }
            return send(res, 200, { ok: true });
          }
          const match =
            /^\/api\/admin\/orders\/((?:LAGUNA|TS|BEY)-\d{8}-[A-F0-9]{10})$/.exec(
              path,
            );
          if (match && req.method === "PATCH") {
            const data = await body(req);
            if (
              !Object.hasOwn(statuses, data.status) ||
              typeof data.note !== "string" ||
              data.note.length > 1000 ||
              !Number.isInteger(data.version)
            )
              fail(400, "Проверьте статус и заметку (до 1000 символов).");
            const now = new Date().toISOString();
            db.exec("BEGIN IMMEDIATE");
            try {
              const current = db
                .prepare("SELECT * FROM orders WHERE id = ?")
                .get(match[1]);
              if (!current) fail(404, "Заказ не найден.");
              if (current.version !== data.version)
                fail(409, "Заказ изменён в другой вкладке. Обновите список.");
              if (paidStatuses.has(data.status))
                deductOrder(db, current, data.paymentConfirmed);
              db.prepare(
                "UPDATE orders SET status = ?, note = ?, version = version + 1, updated_at = ? WHERE id = ?",
              ).run(data.status, data.note.trim(), now, match[1]);
              if (data.status !== current.status)
                db.prepare(
                  "INSERT INTO events (order_id, status, at) VALUES (?, ?, ?)",
                ).run(match[1], data.status, now);
              db.exec("COMMIT");
            } catch (error) {
              db.exec("ROLLBACK");
              throw error;
            }
            return send(res, 200, {
              order: presentOrder(
                db.prepare("SELECT * FROM orders WHERE id = ?").get(match[1]),
              ),
            });
          }
        }
        fail(404, "Не найдено.");
      } catch (error) {
        if (!error.status)
          console.error("API error:", error.code || error.name);
        send(res, error.status || 500, {
          error: error.status
            ? error.message
            : "Не удалось сохранить данные. Попробуйте ещё раз.",
        });
      }
    },
  };
}
