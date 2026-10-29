import {
  catalog,
  productPatch,
  validateOrder as validateRetailOrder,
  matchesAcceptedOrder,
} from "./commerce.mjs";
import { customerAuth } from "./customer-auth.mjs";
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
  const currentProducts = () =>
    catalog(products, db.prepare("SELECT * FROM product_settings").all());
  return {
    db,
    async handle(req, res, url) {
      try {
        const path = url.pathname;
        if (req.method === "GET" && path === "/api/products")
          return send(res, 200, {
            currency: "KZT",
            products: currentProducts(),
          });
        if (req.method !== "GET") {
          if (
            req.headers.origin !== `http://${req.headers.host}` ||
            req.headers["sec-fetch-site"] === "cross-site"
          )
            fail(403, "Запрос с другого сайта запрещён.");
        }
        const customer = customerAuth({
          first: async (sql, ...args) => db.prepare(sql).get(...args) || null,
          all: async (sql, ...args) => db.prepare(sql).all(...args),
          run: async (sql, ...args) => ({
            meta: { changes: db.prepare(sql).run(...args).changes },
          }),
          limit: async (kind, max, ms) =>
            limit(kind + ":" + req.socket.remoteAddress, max, ms),
          secure: false,
          cookies: req.headers.cookie,
        });
        if (path.startsWith("/api/account")) {
          const result = await customer.handle(
            path,
            req.method,
            req.method === "POST" ? await body(req) : undefined,
          );
          if (result)
            return send(
              res,
              result.status || 200,
              result.data,
              result.cookie ? { "Set-Cookie": result.cookie } : {},
            );
          fail(404, "Не найдено.");
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
          const accountId = (await customer.current())?.id ?? null;
          const accepted = db
            .prepare("SELECT * FROM orders WHERE request_key=?")
            .get(data.requestKey);
          if (accepted) {
            if (!matchesAcceptedOrder(data, accepted, accountId))
              fail(
                409,
                "Ключ заявки уже использован. Откройте корзину заново.",
              );
            return send(res, 200, { id: accepted.id, total: accepted.total });
          }
          const validated = validateRetailOrder(data, currentProducts());
          validated.accountId = accountId;
          const fingerprint = digest(JSON.stringify(validated));
          const id = `ARF-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(5).toString("hex").toUpperCase()}`;
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
            db.prepare(
              "INSERT INTO orders (id, request_key, fingerprint, name, phone, items, total, created_at, updated_at,address,comment,account_id,fulfillment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
              validated.address,
              validated.comment,
              validated.accountId,
              validated.fulfillment,
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
        if (
          path.startsWith("/api/admin/inventory") ||
          path.endsWith("/return-stock")
        )
          fail(404, "Не найдено.");
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
                [o.id, o.name, o.phone, o.items].some((s) =>
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
          if (req.method === "GET" && path === "/api/admin/products")
            return send(res, 200, { products: currentProducts() });
          const productMatch =
            /^\/api\/admin\/products(?:\/([a-z0-9-]+))?$/.exec(path);
          if (productMatch && req.method === "PATCH") {
            const data = await body(req),
              id = productMatch[1] || data.productId;
            if (!products.some((p) => p.id === id))
              fail(404, "Аромат не найден.");
            const patch = productPatch(data),
              now = new Date().toISOString();
            let row;
            if (data.version === 0)
              row = db
                .prepare(
                  "INSERT INTO product_settings(product_id,price_per_ml,available,sale_price_per_ml,sale_ends_at,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(product_id) DO NOTHING RETURNING *",
                )
                .get(
                  id,
                  patch.price,
                  patch.available,
                  patch.sale,
                  patch.end,
                  now,
                );
            else
              row = db
                .prepare(
                  "UPDATE product_settings SET price_per_ml=?,available=?,sale_price_per_ml=?,sale_ends_at=?,version=version+1,updated_at=? WHERE product_id=? AND version=? RETURNING *",
                )
                .get(
                  patch.price,
                  patch.available,
                  patch.sale,
                  patch.end,
                  now,
                  id,
                  data.version,
                );
            if (!row)
              fail(409, "Товар изменён в другой вкладке. Обновите список.");
            return send(res, 200, {
              product: currentProducts().find((p) => p.id === id),
            });
          }
          const match =
            /^\/api\/admin\/orders\/((?:STORE|PG|ARF|SK|CAP|CP|EGO|VP|AP|LIB|RP|FP|NA|ARO|VOX|PB|PL|PS|LAGUNA|TS|BEY)-\d{8}-[A-F0-9]{10})$/.exec(
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
              if (data.status === "paid")
                fail(
                  409,
                  "Оплата подтверждается только платёжным провайдером.",
                );
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
