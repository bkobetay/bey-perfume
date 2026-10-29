// Sets and group promotions shared by the local Node API and the Cloudflare Worker.
import {
  catalog,
  setCatalog,
  setPatch,
  promotionPatch,
  promotionStatus,
  promotionCovers,
  presentPromotion,
  fail,
} from "./commerce.mjs";

const randomId = (prefix) =>
  prefix +
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");

export function offers({ first, all, run }) {
  async function load(products) {
    const [settings, promotionRows, setRows] = await Promise.all([
      all("SELECT * FROM product_settings"),
      all("SELECT * FROM promotions"),
      all("SELECT * FROM sets"),
    ]);
    const now = Date.now();
    const priced = catalog(products, settings, now, promotionRows);
    return {
      products: priced,
      sets: setCatalog(setRows, priced, promotionRows, now),
      promotionRows,
      now,
    };
  }
  async function storefront(products) {
    const { products: priced, sets, promotionRows, now } = await load(products);
    return {
      products: priced,
      sets: sets.filter((set) => set.visible),
      promotions: promotionRows
        .filter((row) => promotionStatus(row, now) === "active")
        .map(presentPromotion),
    };
  }
  function adminPromotion(row, priced, sets, now) {
    return {
      ...presentPromotion(row),
      active: !!row.active,
      version: row.version,
      status: promotionStatus(row, now),
      affected:
        row.scope === "sets"
          ? sets.length
          : priced.filter((p) => promotionCovers(row, p)).length +
            (row.scope === "all" ? sets.length : 0),
      updatedAt: row.updated_at,
    };
  }
  // Returns a response body (with optional status) or null when the path is not ours.
  async function admin(path, method, data, products) {
    const setMatch =
      /^\/api\/admin\/sets(?:\/(set-[a-f0-9]{12}|set-starter))?$/.exec(path);
    const promoMatch =
      /^\/api\/admin\/promotions(?:\/(promo-[a-f0-9]{12}))?$/.exec(path);
    if (!setMatch && !promoMatch) return null;
    const now = new Date().toISOString();
    if (setMatch) {
      const id = setMatch[1];
      if (!id && method === "GET") return { sets: (await load(products)).sets };
      if (!id && method === "POST") {
        const { products: priced } = await load(products);
        const p = setPatch(data, priced);
        const newId = randomId("set-");
        await run(
          "INSERT INTO sets(id,title,description,items,fixed_price,sale_price,sale_ends_at,available,visible,sort,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
          newId,
          p.title,
          p.description,
          p.items,
          p.fixedPrice,
          p.salePrice,
          p.saleEndsAt,
          p.available,
          p.visible,
          p.sort,
          now,
          now,
        );
        const { sets } = await load(products);
        return { status: 201, set: sets.find((s) => s.id === newId) };
      }
      if (id && method === "PATCH") {
        const { products: priced } = await load(products);
        const p = setPatch(data, priced);
        if (!Number.isSafeInteger(data.version))
          fail(400, "Нет версии набора.");
        const row = await first(
          "UPDATE sets SET title=?,description=?,items=?,fixed_price=?,sale_price=?,sale_ends_at=?,available=?,visible=?,sort=?,version=version+1,updated_at=? WHERE id=? AND version=? RETURNING id",
          p.title,
          p.description,
          p.items,
          p.fixedPrice,
          p.salePrice,
          p.saleEndsAt,
          p.available,
          p.visible,
          p.sort,
          now,
          id,
          data.version,
        );
        if (!row) {
          if (!(await first("SELECT 1 AS found FROM sets WHERE id=?", id)))
            fail(404, "Набор не найден.");
          fail(409, "Набор изменён в другой вкладке. Обновите данные.");
        }
        const { sets } = await load(products);
        return { set: sets.find((s) => s.id === id) };
      }
      if (id && method === "DELETE") {
        const result = await run("DELETE FROM sets WHERE id=?", id);
        if (!result?.meta?.changes) fail(404, "Набор не найден.");
        return { ok: true };
      }
      fail(405, "Метод не поддерживается.");
    }
    const id = promoMatch[1];
    const view = async (filter) => {
      const { products: priced, sets, promotionRows } = await load(products);
      const at = Date.now();
      return promotionRows
        .filter(filter)
        .map((row) => adminPromotion(row, priced, sets, at))
        .sort(
          (a, b) =>
            ["active", "scheduled", "off", "expired"].indexOf(a.status) -
              ["active", "scheduled", "off", "expired"].indexOf(b.status) ||
            (b.updatedAt || "").localeCompare(a.updatedAt || ""),
        );
    };
    if (!id && method === "GET") return { promotions: await view(() => true) };
    if (!id && method === "POST") {
      const p = promotionPatch(data, products);
      const newId = randomId("promo-");
      await run(
        "INSERT INTO promotions(id,title,scope,scope_value,percent,starts_at,ends_at,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        newId,
        p.title,
        p.scope,
        p.scopeValue,
        p.percent,
        p.startsAt,
        p.endsAt,
        p.active,
        now,
        now,
      );
      return {
        status: 201,
        promotion: (await view((row) => row.id === newId))[0],
      };
    }
    if (id && method === "PATCH") {
      const p = promotionPatch(data, products);
      if (!Number.isSafeInteger(data.version)) fail(400, "Нет версии акции.");
      const row = await first(
        "UPDATE promotions SET title=?,scope=?,scope_value=?,percent=?,starts_at=?,ends_at=?,active=?,version=version+1,updated_at=? WHERE id=? AND version=? RETURNING id",
        p.title,
        p.scope,
        p.scopeValue,
        p.percent,
        p.startsAt,
        p.endsAt,
        p.active,
        now,
        id,
        data.version,
      );
      if (!row) {
        if (!(await first("SELECT 1 AS found FROM promotions WHERE id=?", id)))
          fail(404, "Акция не найдена.");
        fail(409, "Акция изменена в другой вкладке. Обновите данные.");
      }
      return { promotion: (await view((r) => r.id === id))[0] };
    }
    if (id && method === "DELETE") {
      const result = await run("DELETE FROM promotions WHERE id=?", id);
      if (!result?.meta?.changes) fail(404, "Акция не найдена.");
      return { ok: true };
    }
    fail(405, "Метод не поддерживается.");
  }
  return { load, storefront, admin };
}

// Schema shared by the local store and D1 migration 0004.
export const OFFERS_SCHEMA = `CREATE TABLE IF NOT EXISTS sets (
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
);`;
// The storefront's original fixed set, kept so the page is not empty after upgrade.
export const STARTER_SET_SQL = `INSERT OR IGNORE INTO sets(id,title,description,items,available,visible,sort,created_at,updated_at) VALUES ('set-starter','Набор 3 × 10 мл','Aventus, Libre и Bois Imperial — три направления разливной парфюмерии. Три отдельных флакона по 10 мл.','[{"productId":"razliv-male-f-028","ml":10},{"productId":"razliv-female-sw-058","ml":10},{"productId":"razliv-niche-su-004","ml":10}]',1,1,0,'2026-10-30T00:00:00.000Z','2026-10-30T00:00:00.000Z');`;
