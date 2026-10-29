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
// Short seller-friendly codes: ARF-DDMMYY-NN, numbered per Almaty calendar day.
export function orderCodePrefix(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Almaty",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `ARF-${parts.day}${parts.month}${parts.year}-`;
}
export const orderCode = (prefix, number) =>
  prefix + String(number).padStart(2, "0");
// Highest number already used today; old long codes never match the prefix.
export const NEXT_ORDER_NUMBER_SQL =
  "SELECT COALESCE(MAX(CAST(substr(id, 12) AS INTEGER)), 0) + 1 AS next FROM orders WHERE id LIKE ?";
export const promotionScopes = {
  all: "Весь ассортимент",
  female: "Женские ароматы",
  male: "Мужские ароматы",
  niche: "Нишевые ароматы",
  universal: "Универсальные ароматы",
  raspiv: "Распив оригиналов",
  brand: "Бренд",
  sets: "Наборы",
};
const time = (value) => (value ? Date.parse(value) : NaN);
export function promotionStatus(row, now = Date.now()) {
  if (!row.active) return "off";
  if (time(row.ends_at) <= now) return "expired";
  if (time(row.starts_at) > now) return "scheduled";
  return "active";
}
export function promotionCovers(row, product) {
  switch (row.scope) {
    case "all":
      return true;
    case "raspiv":
      return product.type === "raspiv";
    case "brand":
      return product.brand === row.scope_value;
    case "sets":
      return false;
    default:
      return product.collection === row.scope && product.type === "razliv";
  }
}
export const presentPromotion = (row) =>
  row && {
    id: row.id,
    title: row.title,
    scope: row.scope,
    scopeValue: row.scope_value || "",
    percent: row.percent,
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
  };
const discounted = (price, percent) =>
  Math.round((price * (100 - percent)) / 100);
// The deepest active promotion among those covering an item.
function bestPromotion(promotions, covers) {
  return promotions
    .filter(covers)
    .reduce(
      (best, row) => (!best || row.percent > best.percent ? row : best),
      null,
    );
}
export function catalog(products, rows, now = Date.now(), promotionRows = []) {
  const active = promotionRows.filter(
    (row) => promotionStatus(row, now) === "active",
  );
  return products.map((product) => {
    const row = rows.find((r) => r.product_id === product.id);
    const base = row?.price_per_ml ?? basePrice(product);
    const sale = row?.sale_price_per_ml ?? null;
    const ownSale = sale !== null && sale < base ? sale : null;
    const promotion = bestPromotion(active, (p) =>
      promotionCovers(p, { ...product, type: product.type || "raspiv" }),
    );
    const promoPrice = promotion ? discounted(base, promotion.percent) : null;
    // A group promotion wins only when strictly cheaper than the product's own sale.
    const byPromotion = promoPrice !== null && promoPrice < (ownSale ?? base);
    const price = byPromotion ? promoPrice : (ownSale ?? base);
    const onSale = price < base;
    const end = byPromotion
      ? promotion.ends_at || null
      : (row?.sale_ends_at ?? null);
    return {
      ...product,
      type: product.type || "raspiv",
      available: row ? !!row.available : true,
      pricePerMl: price,
      basePricePerMl: base,
      salePricePerMl: sale,
      saleEndsAt: onSale ? end : (row?.sale_ends_at ?? null),
      onSale,
      promotion: byPromotion ? presentPromotion(promotion) : null,
      // The product's own stored end date, for the seller's editor.
      ownSaleEndsAt: row?.sale_ends_at ?? null,
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
// Sets: fixed composition priced from current regular per-ml prices unless fixed.
export function setCatalog(rows, priced, promotionRows = [], now = Date.now()) {
  const active = promotionRows.filter(
    (row) =>
      promotionStatus(row, now) === "active" &&
      ["all", "sets"].includes(row.scope),
  );
  const promotion = bestPromotion(active, () => true);
  return rows
    .map((row) => {
      const items = JSON.parse(row.items).map(({ productId, ml }) => {
        const p = priced.find((x) => x.id === productId);
        return {
          productId,
          ml,
          code: p?.code || "",
          brand: p?.brand || "",
          name: p?.name || "Аромат снят с продажи",
          image: p?.image || "",
          available: !!p && p.available !== false,
          price: p ? p.basePricePerMl * ml : 0,
        };
      });
      const sum = items.reduce((total, item) => total + item.price, 0);
      const regular = row.fixed_price ?? sum;
      const saleActive =
        row.sale_price !== null &&
        row.sale_price < regular &&
        !(time(row.sale_ends_at) <= now);
      const promoPrice = promotion
        ? discounted(regular, promotion.percent)
        : null;
      const byPromotion =
        promoPrice !== null &&
        promoPrice < (saleActive ? row.sale_price : regular);
      const price = byPromotion
        ? promoPrice
        : saleActive
          ? row.sale_price
          : regular;
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        items,
        componentsPrice: sum,
        fixedPrice: row.fixed_price,
        regularPrice: regular,
        price,
        onSale: price < regular,
        salePrice: row.sale_price,
        saleEndsAt: byPromotion
          ? promotion.ends_at || null
          : row.sale_ends_at || null,
        ownSaleEndsAt: row.sale_ends_at || null,
        promotion: byPromotion ? presentPromotion(promotion) : null,
        available:
          !!row.available &&
          items.length > 0 &&
          items.every((i) => i.available),
        visible: !!row.visible,
        sort: row.sort,
        version: row.version,
        updatedAt: row.updated_at,
      };
    })
    .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title, "ru"));
}
const isoOrNull = (value, label) => {
  if (value === null || value === undefined || value === "") return null;
  if (
    typeof value !== "string" ||
    value.length > 40 ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    fail(400, `Проверьте дату: ${label}.`);
  return new Date(value).toISOString();
};
const money = (value, label) => {
  if (value === null || value === undefined || value === "") return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > 100000000)
    fail(400, `${label}: укажите целую сумму в тенге.`);
  return value;
};
export function setPatch(data, priced) {
  const title = textField(data.title, "Название", 80);
  if (!title) fail(400, "Укажите название набора.");
  const description = textField(data.description, "Описание", 300);
  if (
    !Array.isArray(data.items) ||
    !data.items.length ||
    data.items.length > 10
  )
    fail(400, "Добавьте в набор от 1 до 10 ароматов.");
  const seen = new Set();
  const items = data.items.map((item) => {
    const product = priced.find((p) => p.id === item?.productId);
    if (!product || ![5, 10, 20, 30].includes(item.ml))
      fail(400, "Проверьте аромат и объём в составе набора.");
    const key = product.id + ":" + item.ml;
    if (seen.has(key))
      fail(400, "Один и тот же аромат с объёмом добавлен дважды.");
    seen.add(key);
    return { productId: product.id, ml: item.ml };
  });
  const fixedPrice = money(data.fixedPrice, "Цена набора");
  const regular =
    fixedPrice ??
    items.reduce(
      (sum, i) =>
        sum + priced.find((p) => p.id === i.productId).basePricePerMl * i.ml,
      0,
    );
  const salePrice = money(data.salePrice, "Цена по акции");
  if (salePrice !== null && salePrice >= regular)
    fail(400, "Цена по акции должна быть ниже обычной цены набора.");
  if (typeof data.available !== "boolean" || typeof data.visible !== "boolean")
    fail(400, "Проверьте наличие и видимость набора.");
  const sort = data.sort ?? 0;
  if (!Number.isSafeInteger(sort) || Math.abs(sort) > 100000)
    fail(400, "Порядок — целое число.");
  return {
    title,
    description,
    items: JSON.stringify(items),
    fixedPrice,
    salePrice,
    saleEndsAt: isoOrNull(data.saleEndsAt, "окончание акции набора"),
    available: Number(data.available),
    visible: Number(data.visible),
    sort,
  };
}
export function promotionPatch(data, products) {
  const title = textField(data.title, "Название", 60);
  if (!title) fail(400, "Укажите название акции.");
  if (!Object.hasOwn(promotionScopes, data.scope))
    fail(400, "Выберите, на что действует акция.");
  let scopeValue = "";
  if (data.scope === "brand") {
    scopeValue = typeof data.scopeValue === "string" ? data.scopeValue : "";
    if (!products.some((p) => p.brand === scopeValue))
      fail(400, "Выберите бренд из каталога.");
  }
  if (!Number.isInteger(data.percent) || data.percent < 1 || data.percent > 90)
    fail(400, "Скидка — целое число от 1 до 90 %.");
  const startsAt = isoOrNull(data.startsAt, "начало акции");
  const endsAt = isoOrNull(data.endsAt, "окончание акции");
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt))
    fail(400, "Окончание акции должно быть позже начала.");
  if (typeof data.active !== "boolean")
    fail(400, "Укажите, включена ли акция.");
  return {
    title,
    scope: data.scope,
    scopeValue,
    percent: data.percent,
    startsAt,
    endsAt,
    active: Number(data.active),
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
export function validateOrder(data, products, sets = []) {
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
    if (item?.setId !== undefined) {
      const set = sets.find((s) => s.id === item.setId && s.visible);
      if (
        !set ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 20
      )
        fail(400, "Проверьте набор и количество (1–20).");
      if (!set.available)
        fail(409, "Этот набор сейчас недоступен. Обновите корзину.");
      const key = "set:" + set.id;
      if (keys.has(key)) fail(400, "Повторяющаяся позиция.");
      keys.add(key);
      return {
        setId: set.id,
        type: "set",
        code: "",
        name: "Набор: " + set.title,
        components: set.items.map((i) => ({
          productId: i.productId,
          code: i.code,
          name: i.brand + " " + i.name,
          ml: i.ml,
        })),
        quantity: item.quantity,
        price: set.price,
        subtotal: set.price * item.quantity,
      };
    }
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
        (items[i].setId
          ? item.setId === items[i].setId
          : item.productId === items[i].productId &&
            item.ml === items[i].ml &&
            (!item.type || item.type === (items[i].type || "raspiv"))) &&
        item.quantity === items[i].quantity,
    )
  );
}
