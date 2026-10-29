-- Quantitative inventory is retired. Preserve historical tables and movements.
DROP TRIGGER IF EXISTS order_stock_check;
DROP TRIGGER IF EXISTS order_paid;
DROP TRIGGER IF EXISTS order_return;
DROP TRIGGER IF EXISTS stock_adjusted;
CREATE TABLE IF NOT EXISTS product_settings (
 product_id TEXT PRIMARY KEY, price_per_ml INTEGER NOT NULL CHECK(price_per_ml BETWEEN 0 AND 10000000),
 available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0,1)),
 sale_price_per_ml INTEGER CHECK(sale_price_per_ml IS NULL OR (sale_price_per_ml >= 0 AND sale_price_per_ml < price_per_ml)),
 sale_ends_at TEXT, version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
 id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL DEFAULT '',password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customer_sessions (
 token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES customers(id),expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS customer_session_expiry ON customer_sessions(expires);
ALTER TABLE orders ADD COLUMN account_id TEXT REFERENCES customers(id);
ALTER TABLE orders ADD COLUMN address TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN comment TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS order_account_date ON orders(account_id,created_at);
