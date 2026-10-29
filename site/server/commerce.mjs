import {
  customerNameError,
  normalizeCustomerName,
} from "../dist/name-validation.js";
export const statuses = {
  new: "Новый",
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплачен",
  confirmed: "Подтверждён",
  preparing: "Собирается",
  ready: "Готов",
  completed: "Выдан",
  cancelled: "Отменён",
};
export const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export function basePrice(product) {
  const price = product.variants.find((v) => v.ml === 10)?.price / 10;
  if (!Number.isSafeInteger(price) || price < 0)
    throw new Error("Invalid baseline product price");
  return price;
}
export function catalog(products, rows, now = Date.now()) {
  return products.map((product) => {
    const row = rows.find((r) => r.product_id === product.id);
    const base = row?.price_per_ml ?? basePrice(product);
    const sale = row?.sale_price_per_ml ?? null;
    const end = row?.sale_ends_at ?? null;
    const onSale = sale !== null && sale < base;
    const price = onSale ? sale : base;
    return {
      ...product,
      type: product.type || "raspiv",
      available: row ? !!row.available : true,
      pricePerMl: price,
      basePricePerMl: base,
      salePricePerMl: sale,
      saleEndsAt: end,
      onSale,
      version: row?.version ?? 0,
      variants: [5, 10, 20, 30].map((ml) => ({
        ml,
        price: price * ml,
        ...(onSale ? { originalPrice: base * ml } : {}),
      })),
    };
  });
}
export function productPatch(data) {
  if (
    !Number.isSafeInteger(data.version) ||
    data.version < 0 ||
    !Number.isSafeInteger(data.pricePerMl) ||
    data.pricePerMl < 0 ||
    data.pricePerMl > 10000000 ||
    typeof data.available !== "boolean"
  )
    fail(400, "Проверьте цену, наличие и версию товара.");
  const sale = data.salePricePerMl ?? null;
  if (
    sale !== null &&
    (!Number.isSafeInteger(sale) || sale < 0 || sale >= data.pricePerMl)
  )
    fail(400, "Цена акции должна быть целым числом ниже обычной цены.");
  let end = data.saleEndsAt ?? null;
  if (end !== null) {
    if (
      typeof end !== "string" ||
      end.length > 40 ||
      !/^\d{4}-\d{2}-\d{2}T/.test(end) ||
      !Number.isFinite(Date.parse(end))
    )
      fail(400, "Проверьте дату окончания акции.");
    end = new Date(end).toISOString();
  }
  return {
    price: data.pricePerMl,
    available: Number(data.available),
    sale,
    end,
  };
}
function textField(value, label, max) {
  if (value === undefined) return "";
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value)
  )
    fail(400, `${label}: не более ${max} символов.`);
  return value.trim();
}
export function validateOrder(data, products) {
  const error = customerNameError(data.name);
  if (error) fail(400, error);
  if (
    typeof data.phone !== "string" ||
    data.phone.length > 30 ||
    !/^[+\d\s()\-]+$/.test(data.phone)
  )
    fail(400, "Проверьте номер телефона.");
  let digits = data.phone.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "8") digits = "7" + digits.slice(1);
  if (!/^7\d{10}$/.test(digits))
    fail(400, "Укажите +7 и ровно 10 цифр номера.");
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
      item.quantity > 20 ||
      (item.type && item.type !== product.type)
    )
      fail(400, "Проверьте аромат, объём и количество (1–20).");
    if (!product.available)
      fail(409, "Этот аромат сейчас недоступен. Обновите корзину.");
    const key = product.id + ":" + variant.ml;
    if (keys.has(key)) fail(400, "Повторяющаяся позиция.");
    keys.add(key);
    return {
      productId: product.id,
      type: product.type,
      code: product.code || "",
      name: product.brand + " " + product.name,
      ml: variant.ml,
      quantity: item.quantity,
      price: variant.price,
      subtotal: variant.price * item.quantity,
    };
  });
  const total = items.reduce((s, i) => s + i.subtotal, 0);
  if (data.expectedTotal !== total)
    fail(409, "Стоимость изменилась. Обновите страницу и проверьте сумму.");
  const fulfillment = data.fulfillment ?? "delivery";
  if (!["delivery", "pickup"].includes(fulfillment))
    fail(400, "Выберите доставку или самовывоз.");
  const address =
    fulfillment === "pickup" ? "" : textField(data.address, "Адрес", 500);
  if (fulfillment === "delivery" && !address)
    fail(400, "Укажите адрес доставки.");
  return {
    fulfillment,
    name: normalizeCustomerName(data.name),
    phone: "+" + digits,
    address,
    comment: textField(data.comment, "Комментарий", 1000),
    items,
    total,
  };
}
// Accepted requests remain retryable even when a seller later changes price or availability.
// Match the immutable snapshot and account ID; a phone number never grants ownership.
export function matchesAcceptedOrder(data, row, accountId) {
  let phone =
    typeof data.phone === "string" ? data.phone.replace(/\D/g, "") : "";
  if (phone.length === 11 && phone[0] === "8") phone = "7" + phone.slice(1);
  const items = JSON.parse(row.items);
  return (
    (row.account_id ?? null) === accountId &&
    normalizeCustomerName(data.name) === row.name &&
    "+" + phone === row.phone &&
    (data.fulfillment ?? "delivery") === (row.fulfillment ?? "delivery") &&
    (data.fulfillment === "pickup"
      ? ""
      : textField(data.address, "Адрес", 500)) === (row.address || "") &&
    textField(data.comment, "Комментарий", 1000) === (row.comment || "") &&
    data.expectedTotal === row.total &&
    Array.isArray(data.items) &&
    data.items.length === items.length &&
    data.items.every(
      (item, i) =>
        item &&
        item.productId === items[i].productId &&
        item.ml === items[i].ml &&
        item.quantity === items[i].quantity &&
        (!item.type || item.type === (items[i].type || "raspiv")),
    )
  );
}
