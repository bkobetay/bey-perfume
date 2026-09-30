// Store tenths of a millilitre as integers, avoiding floating-point stock drift.
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export const paidStatuses = new Set([
  "confirmed",
  "preparing",
  "ready",
  "completed",
]);
export function units(value) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1000000 ||
    Math.abs(value * 10 - Math.round(value * 10)) > 1e-7
  )
    fail(400, "Укажите объём от 0 до 1 000 000 мл, с точностью до 0,1 мл.");
  return Math.round(value * 10);
}
export function initializeInventory(db, products) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const first = !db
      .prepare("SELECT 1 FROM settings WHERE key = 'inventory_initialized'")
      .get();
    const now = new Date().toISOString();
    for (const p of products) {
      const added = db
        .prepare(
          "INSERT OR IGNORE INTO inventory(product_id, quantity_units, updated_at) VALUES (?, ?, ?)",
        )
        .run(p.id, first ? 1000 : 0, now);
      if (added.changes)
        db.prepare(
          "INSERT INTO inventory_movements(product_id, delta_units, balance_units, kind, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
          p.id,
          first ? 1000 : 0,
          first ? 1000 : 0,
          "initial",
          first ? "Начальный демо-остаток" : "Новый аромат",
          now,
        );
    }
    db.prepare(
      "INSERT OR IGNORE INTO settings(key, value) VALUES ('inventory_initialized', '1')",
    ).run();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function inventoryProducts(db, products) {
  return products.map((p) => {
    const stock = db
      .prepare("SELECT * FROM inventory WHERE product_id = ?")
      .get(p.id);
    return {
      ...p,
      availableMl: (stock?.quantity_units || 0) / 10,
      stockVersion: stock?.version || 1,
      stockUpdatedAt: stock?.updated_at,
    };
  });
}
export function requirements(items) {
  const result = new Map();
  for (const item of items) {
    const entry = result.get(item.productId) || { amount: 0, name: item.name };
    entry.amount += units(item.ml) * item.quantity;
    result.set(item.productId, entry);
  }
  return result;
}
export function checkStock(db, items) {
  for (const [id, { amount, name }] of requirements(items)) {
    const available =
      db
        .prepare("SELECT quantity_units FROM inventory WHERE product_id = ?")
        .get(id)?.quantity_units || 0;
    if (available < amount)
      fail(
        409,
        `Недостаточно «${name}»: нужно ${amount / 10} мл, доступно ${available / 10} мл.`,
      );
  }
}
export function moveStock(db, id, delta, kind, reason, orderId = null) {
  const current = db
    .prepare("SELECT * FROM inventory WHERE product_id = ?")
    .get(id);
  if (!current) fail(404, "Аромат не найден на складе.");
  const balance = current.quantity_units + delta;
  if (balance < 0 || balance > 10000000)
    fail(409, "Остаток должен быть от 0 до 1 000 000 мл.");
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE inventory SET quantity_units = ?, version = version + 1, updated_at = ? WHERE product_id = ?",
  ).run(balance, now, id);
  db.prepare(
    "INSERT INTO inventory_movements(product_id, delta_units, balance_units, kind, reason, order_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, delta, balance, kind, reason, orderId, now);
}
export function deductOrder(db, order, paymentConfirmed) {
  if (
    order.inventory_state === "deducted" ||
    order.inventory_state === "legacy"
  )
    return;
  if (paymentConfirmed !== true)
    fail(400, "Подтвердите, что оплата заказа проверена.");
  const items = JSON.parse(order.items);
  checkStock(db, items);
  for (const [id, { amount }] of requirements(items))
    moveStock(
      db,
      id,
      -amount,
      "order",
      "Оплата проверена, заказ подтверждён",
      order.id,
    );
  db.prepare("UPDATE orders SET inventory_state = 'deducted' WHERE id = ?").run(
    order.id,
  );
}
