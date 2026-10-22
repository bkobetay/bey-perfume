PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL,
 name TEXT NOT NULL, search_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL, items TEXT NOT NULL CHECK(json_valid(items)),
 total INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'new', note TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1, inventory_state TEXT NOT NULL DEFAULT 'pending'
 CHECK(inventory_state IN ('pending','deducted','returned','legacy')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS order_status_date ON orders(status,created_at);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),status TEXT NOT NULL,at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inventory(product_id TEXT PRIMARY KEY,quantity_units INTEGER NOT NULL CHECK(quantity_units BETWEEN 0 AND 10000000),version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS inventory_movements(id INTEGER PRIMARY KEY,product_id TEXT NOT NULL REFERENCES inventory(product_id),delta_units INTEGER NOT NULL,balance_units INTEGER NOT NULL,kind TEXT NOT NULL,reason TEXT NOT NULL,order_id TEXT REFERENCES orders(id),created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS movement_product ON inventory_movements(product_id,id);
CREATE TABLE IF NOT EXISTS inventory_requests(request_key TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rate_expiry ON rate_limits(expires);

-- These triggers execute inside the same SQLite statement as the order write.
-- Concurrent confirmations cannot oversell, partially debit or double-debit stock.
CREATE TRIGGER IF NOT EXISTS order_stock_check BEFORE INSERT ON orders WHEN NOT EXISTS(SELECT 1 FROM orders WHERE request_key=NEW.request_key) BEGIN
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM json_each(NEW.items) j LEFT JOIN inventory i ON i.product_id=json_extract(j.value,'$.productId')
  GROUP BY json_extract(j.value,'$.productId')
  HAVING i.quantity_units IS NULL OR i.quantity_units<SUM(json_extract(j.value,'$.ml')*json_extract(j.value,'$.quantity')*10)
 ) THEN RAISE(ABORT,'stock_conflict') END;
END;
CREATE TRIGGER IF NOT EXISTS order_created AFTER INSERT ON orders BEGIN
 INSERT INTO events(order_id,status,at) VALUES(NEW.id,NEW.status,NEW.created_at);
END;
CREATE TRIGGER IF NOT EXISTS order_paid AFTER UPDATE OF inventory_state ON orders
WHEN NEW.inventory_state='deducted' AND OLD.inventory_state NOT IN ('deducted','legacy') BEGIN
 SELECT CASE WHEN EXISTS(
  SELECT 1 FROM json_each(NEW.items) j LEFT JOIN inventory i ON i.product_id=json_extract(j.value,'$.productId')
  GROUP BY json_extract(j.value,'$.productId')
  HAVING i.quantity_units IS NULL OR i.quantity_units<SUM(json_extract(j.value,'$.ml')*json_extract(j.value,'$.quantity')*10)
 ) THEN RAISE(ABORT,'stock_conflict') END;
 UPDATE inventory SET quantity_units=quantity_units-(SELECT SUM(json_extract(j.value,'$.ml')*json_extract(j.value,'$.quantity')*10) FROM json_each(NEW.items) j WHERE json_extract(j.value,'$.productId')=inventory.product_id),version=version+1,updated_at=NEW.updated_at
 WHERE product_id IN(SELECT json_extract(value,'$.productId') FROM json_each(NEW.items));
 INSERT INTO inventory_movements(product_id,delta_units,balance_units,kind,reason,order_id,created_at)
 SELECT i.product_id,-SUM(json_extract(j.value,'$.ml')*json_extract(j.value,'$.quantity')*10),i.quantity_units,'order','Оплата проверена, заказ подтверждён',NEW.id,NEW.updated_at
 FROM json_each(NEW.items) j JOIN inventory i ON i.product_id=json_extract(j.value,'$.productId') GROUP BY i.product_id;
END;
CREATE TRIGGER IF NOT EXISTS order_return AFTER UPDATE OF inventory_state ON orders
WHEN NEW.inventory_state='returned' AND OLD.inventory_state='deducted' BEGIN
 SELECT CASE WHEN NEW.status!='cancelled' THEN RAISE(ABORT,'return_conflict') END;
 UPDATE inventory SET quantity_units=quantity_units+(SELECT SUM(json_extract(j.value,'$.ml')*json_extract(j.value,'$.quantity')*10) FROM json_each(NEW.items) j WHERE json_extract(j.value,'$.productId')=inventory.product_id),version=version+1,updated_at=NEW.updated_at
 WHERE product_id IN(SELECT json_extract(value,'$.productId') FROM json_each(NEW.items));
 INSERT INTO inventory_movements(product_id,delta_units,balance_units,kind,reason,order_id,created_at)
 SELECT i.product_id,SUM(json_extract(j.value,'$.ml')*json_extract(j.value,'$.quantity')*10),i.quantity_units,'return','Продавец подтвердил фактический возврат',NEW.id,NEW.updated_at
 FROM json_each(NEW.items) j JOIN inventory i ON i.product_id=json_extract(j.value,'$.productId') GROUP BY i.product_id;
END;
CREATE TRIGGER IF NOT EXISTS order_status_changed AFTER UPDATE OF status ON orders WHEN OLD.status!=NEW.status BEGIN
 INSERT INTO events(order_id,status,at) VALUES(NEW.id,NEW.status,NEW.updated_at);
END;
CREATE TRIGGER IF NOT EXISTS stock_adjusted AFTER INSERT ON inventory_requests BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM inventory WHERE product_id=json_extract(NEW.payload,'$.id') AND version=json_extract(NEW.payload,'$.version')) THEN RAISE(ABORT,'stock_version_conflict') END;
 UPDATE inventory SET quantity_units=CASE json_extract(NEW.payload,'$.kind')
 WHEN 'set' THEN json_extract(NEW.payload,'$.amount')
 WHEN 'remove' THEN quantity_units-json_extract(NEW.payload,'$.amount')
 ELSE quantity_units+json_extract(NEW.payload,'$.amount') END,
 version=version+1,updated_at=NEW.created_at WHERE product_id=json_extract(NEW.payload,'$.id');
 INSERT INTO inventory_movements(product_id,delta_units,balance_units,kind,reason,created_at)
 SELECT product_id,CASE json_extract(NEW.payload,'$.kind')
 WHEN 'set' THEN quantity_units-json_extract(NEW.payload,'$.previous')
 WHEN 'remove' THEN -json_extract(NEW.payload,'$.amount') ELSE json_extract(NEW.payload,'$.amount') END,
 quantity_units,json_extract(NEW.payload,'$.kind'),json_extract(NEW.payload,'$.reason'),NEW.created_at FROM inventory WHERE product_id=json_extract(NEW.payload,'$.id');
END;
