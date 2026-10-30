import { fail } from "./commerce.mjs";
import { digest } from "./customer-auth.mjs";

const CODE = /^(?:ARF-\d{6}-\d{2,4}|[A-Z]+-\d{8}-[A-F0-9]{10})$/;
const HOUR = 3600000;

// Public lookup by order code and phone. Daily codes are easy to guess, so the
// answer carries only progress: no name, phone, address, comment, note or items.
export async function trackOrder({ data, first, limit, limitKey }) {
  await limit("track", 20, HOUR / 4);
  const code =
    typeof data.code === "string" ? data.code.trim().toUpperCase() : "";
  let phone =
    typeof data.phone === "string" && data.phone.length <= 30
      ? data.phone.replace(/\D/g, "")
      : "";
  if (phone.length === 11 && phone[0] === "8") phone = "7" + phone.slice(1);
  if (phone.length === 10) phone = "7" + phone;
  if (!CODE.test(code) || !/^7\d{10}$/.test(phone))
    fail(400, "Проверьте код заказа и номер телефона.");
  // Both keys hold across addresses: guessing is capped per number and per order.
  await limitKey("track-phone:" + (await digest(phone)), 20, 24 * HOUR);
  await limitKey("track-code:" + code, 20, 24 * HOUR);
  const row = await first(
    "SELECT id,status,fulfillment,total,items,created_at,updated_at FROM orders WHERE id=? AND phone=?",
    code,
    "+" + phone,
  );
  // One answer for a wrong code and a wrong phone: neither is confirmed separately.
  if (!row) fail(404, "Заказ не найден. Проверьте код и номер телефона.");
  let positions = 0;
  try {
    positions = JSON.parse(row.items).reduce((n, i) => n + i.quantity, 0);
  } catch {}
  return {
    id: row.id,
    status: row.status,
    fulfillment: row.fulfillment,
    total: row.total,
    positions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
