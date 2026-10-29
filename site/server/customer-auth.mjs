import { fail } from "./commerce.mjs";
const encode = (s) => new TextEncoder().encode(s);
const hex = (bytes) =>
  Array.from(new Uint8Array(bytes), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
export const digest = async (s) =>
  hex(await crypto.subtle.digest("SHA-256", encode(s)));
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const hash = async (password, salt) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: encode(salt),
        iterations: 100000,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
};
// Constant-time comparison of two 64-character hex digests.
function equal(actual, expected) {
  let different = 0;
  for (let i = 0; i < 64; i++)
    different |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return !different;
}
function credentials(data) {
  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof data.password !== "string" ||
    data.password.length < 10 ||
    data.password.length > 256
  )
    fail(400, "Укажите email и пароль от 10 до 256 символов.");
  return { email, password: data.password };
}
export function customerAuth({ first, all, run, limit, secure, cookies }) {
  const token = /(?:^|;\s*)store_customer=([a-f0-9]{64})(?:;|$)/.exec(
    cookies || "",
  )?.[1];
  const header = (value) =>
    `store_customer=${value}; HttpOnly; ${secure ? "Secure; " : ""}SameSite=Strict; Path=/api; Max-Age=${value ? 604800 : 0}`;
  async function current() {
    if (!token) return null;
    return first(
      "SELECT a.id,a.email,a.name FROM customer_sessions s JOIN customers a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires>?",
      await digest(token),
      Date.now(),
    );
  }
  return {
    current,
    async handle(path, method, data) {
      if (
        method === "GET" &&
        ["/api/account", "/api/account/me"].includes(path)
      )
        return { data: { account: await current() } };
      if (method === "GET" && path === "/api/account/orders") {
        const account = await current();
        if (!account) fail(401, "Войдите в личный кабинет.");
        const orders = await all(
          "SELECT id,name,phone,address,comment,fulfillment,items,total,status,created_at,updated_at FROM orders WHERE account_id=? ORDER BY created_at DESC,id DESC LIMIT 100",
          account.id,
        );
        return {
          data: {
            orders: orders.map((o) => ({ ...o, items: JSON.parse(o.items) })),
          },
        };
      }
      if (method !== "POST" || !path.startsWith("/api/account/")) return null;
      if (path === "/api/account/logout") {
        if (token)
          await run(
            "DELETE FROM customer_sessions WHERE token_hash=?",
            await digest(token),
          );
        return { data: { ok: true }, cookie: header("") };
      }
      if (
        [
          "/api/account/forgot-password",
          "/api/account/reset-password",
        ].includes(path)
      ) {
        await limit("customer-reset", 5, 3600000);
        fail(
          503,
          "Восстановление пароля пока недоступно: отправка email не настроена.",
        );
      }
      if (path === "/api/account/profile") {
        const account = await current();
        if (!account) fail(401, "Войдите в личный кабинет.");
        const name = typeof data.name === "string" ? data.name.trim() : "";
        if (!name || name.length > 100 || /[\u0000-\u001f]/u.test(name))
          fail(400, "Укажите имя (до 100 символов).");
        await run("UPDATE customers SET name=? WHERE id=?", name, account.id);
        return { data: { account: { ...account, name } } };
      }
      if (path === "/api/account/password") {
        const account = await current();
        if (!account) fail(401, "Войдите в личный кабинет.");
        await limit("customer-password", 10, 15 * 60 * 1000);
        const row = await first(
          "SELECT password_hash,password_salt FROM customers WHERE id=?",
          account.id,
        );
        if (
          typeof data.currentPassword !== "string" ||
          !equal(
            await hash(data.currentPassword, row.password_salt),
            row.password_hash,
          )
        )
          fail(401, "Текущий пароль указан неверно.");
        const { password } = credentials({
          email: account.email,
          password: data.newPassword,
        });
        const salt = random();
        await run(
          "UPDATE customers SET password_hash=?,password_salt=? WHERE id=?",
          await hash(password, salt),
          salt,
          account.id,
        );
        // Keep this browser signed in and end every other session.
        await run(
          "DELETE FROM customer_sessions WHERE account_id=? AND token_hash<>?",
          account.id,
          await digest(token),
        );
        return { data: { ok: true } };
      }
      if (!["/api/account/register", "/api/account/login"].includes(path))
        return null;
      await limit("customer-auth", 10, 15 * 60 * 1000);
      const { email, password } = credentials(data);
      let account;
      if (path.endsWith("/register")) {
        const name = typeof data.name === "string" ? data.name.trim() : "";
        if (name.length > 100 || /[\u0000-\u001f]/u.test(name))
          fail(400, "Проверьте имя (до 100 символов).");
        if (await first("SELECT id FROM customers WHERE email=?", email))
          fail(
            409,
            "Не удалось создать аккаунт с этим email. Попробуйте войти.",
          );
        const salt = random(),
          passwordHash = await hash(password, salt),
          id = crypto.randomUUID();
        const result = await run(
          "INSERT INTO customers(id,email,name,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING",
          id,
          email,
          name,
          passwordHash,
          salt,
          new Date().toISOString(),
        );
        if (!result?.meta?.changes)
          fail(
            409,
            "Не удалось создать аккаунт с этим email. Попробуйте войти.",
          );
        account = { id, email, name };
      } else {
        const row = await first("SELECT * FROM customers WHERE email=?", email);
        const actual = await hash(
          password,
          row?.password_salt || "0".repeat(64),
        );
        if (!equal(actual, row?.password_hash || "0".repeat(64)) || !row)
          fail(401, "Неверный email или пароль.");
        account = { id: row.id, email: row.email, name: row.name };
      }
      if (token)
        await run(
          "DELETE FROM customer_sessions WHERE token_hash=?",
          await digest(token),
        );
      await run("DELETE FROM customer_sessions WHERE expires<=?", Date.now());
      const next = random();
      await run(
        "INSERT INTO customer_sessions(token_hash,account_id,expires) VALUES (?,?,?)",
        await digest(next),
        account.id,
        Date.now() + 604800000,
      );
      return {
        data: { account },
        status: path.endsWith("/register") ? 201 : 200,
        cookie: header(next),
      };
    },
  };
}
