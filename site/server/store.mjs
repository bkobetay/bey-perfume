import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const privateDir = resolve(
  process.env.BEY_PRIVATE_DIR ||
    fileURLToPath(new URL("../private/", import.meta.url)),
);
export function openStore(directory = privateDir) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const filename = resolve(directory, "orders.sqlite");
  const db = new DatabaseSync(filename);
  chmodSync(filename, 0o600);
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, fingerprint TEXT NOT NULL,
      name TEXT NOT NULL, phone TEXT NOT NULL, items TEXT NOT NULL, total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'new', note TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS order_status_date ON orders(status, created_at);
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id),
      status TEXT NOT NULL, at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires INTEGER NOT NULL);`);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (
      !db
        .prepare("PRAGMA table_info(orders)")
        .all()
        .some((column) => column.name === "inventory_state")
    ) {
      db.exec(
        "ALTER TABLE orders ADD COLUMN inventory_state TEXT NOT NULL DEFAULT 'pending'",
      );
      // Existing fulfilled/confirmed orders predate stock tracking; never debit them retroactively.
      db.exec(
        "UPDATE orders SET inventory_state = 'legacy' WHERE status != 'new'",
      );
    }
    db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS inventory (
        product_id TEXT PRIMARY KEY, quantity_units INTEGER NOT NULL CHECK(quantity_units >= 0 AND quantity_units <= 10000000),
        version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id INTEGER PRIMARY KEY, product_id TEXT NOT NULL REFERENCES inventory(product_id),
        delta_units INTEGER NOT NULL, balance_units INTEGER NOT NULL, kind TEXT NOT NULL,
        reason TEXT NOT NULL, order_id TEXT REFERENCES orders(id), created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS inventory_requests (request_key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS inventory_movement_product ON inventory_movements(product_id, id);`);
    db.exec(`DROP TRIGGER IF EXISTS order_stock_check; DROP TRIGGER IF EXISTS order_paid; DROP TRIGGER IF EXISTS order_return; DROP TRIGGER IF EXISTS stock_adjusted;
      CREATE TABLE IF NOT EXISTS product_settings (product_id TEXT PRIMARY KEY,price_per_ml INTEGER NOT NULL CHECK(price_per_ml BETWEEN 0 AND 10000000),available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0,1)),sale_price_per_ml INTEGER CHECK(sale_price_per_ml IS NULL OR (sale_price_per_ml>=0 AND sale_price_per_ml<price_per_ml)),sale_ends_at TEXT,version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL DEFAULT '',password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS customer_sessions (token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES customers(id),expires INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS customer_session_expiry ON customer_sessions(expires);`);
    const columns = db
      .prepare("PRAGMA table_info(orders)")
      .all()
      .map((c) => c.name);
    for (const [name, definition] of [
      ["account_id", "TEXT REFERENCES customers(id)"],
      ["address", "TEXT NOT NULL DEFAULT ''"],
      ["comment", "TEXT NOT NULL DEFAULT ''"],
      [
        "fulfillment",
        "TEXT NOT NULL DEFAULT 'delivery' CHECK(fulfillment IN ('delivery','pickup'))",
      ],
    ])
      if (!columns.includes(name))
        db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${definition}`);
    db.exec(
      "CREATE INDEX IF NOT EXISTS order_account_date ON orders(account_id,created_at)",
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }
  return db;
}
export { statuses } from "./commerce.mjs";
export function presentOrder(row) {
  if (!row) return null;
  const { request_key, fingerprint, inventory_state, account_id, ...order } =
    row;
  // Keep historical order snapshots intact; show the current collection label.
  order.items = JSON.parse(order.items).map((item) => ({
    ...item,
    name: item.name.replace(
      /^КОЛЛЕКЦИЯ (?:BEY|TS|LAGUNA|PERFUME STUDIO|PERFUMELAND|PARFBURO|VOXPARFUM\.KZ|AROMANIA\.KZ|NICHE AVENUE|FLORA PERFUME|RATAY PERFUME|LIBERTÉ|ALIDEN PARFUM|VELORA PARFUM|EGO|CHARM PERFUME|CAPELLA PERFUME|SEUIP KOR|ARAFAN PERFUME|PARFGREEN|PERFUME STORE) /,
      "КОЛЛЕКЦИЯ ARAFAN PERFUME ",
    ),
  }));
  return order;
}
