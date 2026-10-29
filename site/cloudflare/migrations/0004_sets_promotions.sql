-- Seller-managed sets and group promotions; seeds the original fixed set.
CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL, fixed_price INTEGER CHECK(fixed_price IS NULL OR fixed_price>=0),
  sale_price INTEGER CHECK(sale_price IS NULL OR sale_price>=0), sale_ends_at TEXT,
  available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0,1)),
  visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0,1)),
  sort INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('all','female','male','niche','universal','raspiv','brand','sets')),
  scope_value TEXT NOT NULL DEFAULT '', percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 90),
  starts_at TEXT, ends_at TEXT, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO sets(id,title,description,items,available,visible,sort,created_at,updated_at) VALUES ('set-starter','Набор 3 × 10 мл','Aventus, Libre и Bois Imperial — три направления разливной парфюмерии. Три отдельных флакона по 10 мл.','[{"productId":"razliv-male-f-028","ml":10},{"productId":"razliv-female-sw-058","ml":10},{"productId":"razliv-niche-su-004","ml":10}]',1,1,0,'2026-10-30T00:00:00.000Z','2026-10-30T00:00:00.000Z');
