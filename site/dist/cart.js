import { customerNameError, normalizeCustomerName } from "/name-validation.js";
(() => {
  const money = (n) => new Intl.NumberFormat("ru-KZ").format(n) + " ₸";
  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  let products = [],
    sets = [],
    basket = [],
    busy = false,
    requestKey = crypto.randomUUID();
  try {
    basket = JSON.parse(localStorage.getItem("bey-cart-v1") || "[]");
  } catch {}
  if (!Array.isArray(basket)) basket = [];
  const cartRoot = document.querySelector("#cart-root");
  const existingPanel = cartRoot?.querySelector(".cart-page-content");
  const panel = existingPanel || el("section", "cart-page-content");
  panel.setAttribute("aria-labelledby", "cart-page-title");
  if (!existingPanel)
    panel.innerHTML = `<div class="cart-heading"><div><p class="eyebrow">ВАШ ЗАКАЗ</p><h2 id="cart-title">Корзина</h2></div><button type="button" class="icon-close" aria-label="Закрыть корзину">×</button></div><div class="cart-body"><div class="cart-items"></div><p class="cart-stock-warning" role="status"></p><div class="cart-empty" hidden><img class="cart-empty-logo" src="/assets/arafan-perfume-logo.png" alt="" aria-hidden="true" width="1318" height="1298" /><h3>Ваша корзина пока пуста</h3><p>Добавьте аромат и выберите подходящий объём.</p><a class="button button-accent" href="/catalog">Открыть каталог</a></div><form class="checkout-form"><div class="cart-summary"><span>Сумма заявки</span><strong class="cart-total"></strong></div><fieldset class="fulfillment-choice"><legend>Способ получения</legend><label><input type="radio" name="fulfillment" value="delivery" checked><span>Доставка</span></label><label><input type="radio" name="fulfillment" value="pickup"><span>Самовывоз</span></label></fieldset><p class="pickup-details" hidden>Забрать в магазине: Алматы, Достык, 108Б.<br>Ежедневно с 10:00 до 21:00.</p><h3>Контактные данные</h3><label>Ваше имя<input name="name" autocomplete="name" minlength="2" maxlength="80" placeholder="Например, Айдана" aria-describedby="name-hint name-error" required /></label><p class="field-hint" id="name-hint">Введите ваше имя, чтобы продавец знал, как к вам обратиться.</p><p class="name-error" id="name-error" role="status" hidden></p><label>Номер телефона<span class="phone-field"><span class="phone-prefix" aria-hidden="true">+7</span><input name="phone" type="tel" aria-label="Номер телефона" aria-describedby="phone-hint" autocomplete="tel-national" inputmode="numeric" maxlength="12" pattern="[0-9]{3} [0-9]{3} [0-9]{4}" placeholder="700 000 0000" required /></span></label><p class="field-hint" id="phone-hint">Код +7 уже указан. Введите 10 цифр номера — по нему магазин свяжется с вами.</p><label class="delivery-address">Адрес доставки<textarea name="address" maxlength="500" required placeholder="Улица, дом, квартира"></textarea></label><label>Комментарий к заказу<textarea name="comment" maxlength="1000" placeholder="Необязательно"></textarea></label><p class="field-hint delivery-terms">Доставка оплачивается отдельно при получении. Стоимость зависит от адреса и тарифа курьерской службы «Яндекс».</p><label class="contact-consent"><input type="checkbox" name="consent" required /><span>Разрешаю связаться со мной по этой заявке.</span></label><button class="button button-accent submit-order" type="submit" disabled>Отправить заказ</button></form><p class="checkout-message" role="status" aria-live="polite"></p><div class="order-success" hidden tabindex="-1"><span class="success-symbol" aria-hidden="true">✓</span><p class="eyebrow">ЗАКАЗ ПРИНЯТ</p><h3>Спасибо за заказ</h3><p>Магазин свяжется с вами, чтобы уточнить детали.</p><p class="receipt-code"></p><p class="receipt-total"></p><p class="receipt-fulfillment"></p><button type="button" class="button button-glass continue-shopping">Продолжить выбор</button></div></div>`;
  panel.querySelector(".cart-heading")?.remove();
  if (cartRoot && !existingPanel) cartRoot.replaceChildren(panel);
  const form = panel.querySelector("form"),
    list = panel.querySelector(".cart-items"),
    message = panel.querySelector(".checkout-message"),
    success = panel.querySelector(".order-success");
  const toast = el("div", "cart-toast");
  toast.setAttribute("role", "status");
  document.body.append(toast);
  let toastTimer;
  function notify(text, link) {
    toast.textContent = text;
    toast.classList.toggle("has-link", !!link);
    if (link) {
      const a = el("a", "", link.label);
      a.href = link.href;
      toast.append(a);
    }
    toast.classList.add("shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => toast.classList.remove("shown"),
      link ? 4500 : 2800,
    );
  }
  const cartLink = { href: "/cart", label: "Открыть корзину" };
  // Basket lines are either {productId, type, ml, quantity} or {setId, quantity}.
  const detail = (item) => {
    if (item?.setId !== undefined) {
      const set = sets.find((s) => s.id === item.setId);
      return set ? { set, price: set.price } : null;
    }
    const p = products.find((p) => p.id === item?.productId);
    const v = p?.variants.find((v) => v.ml === item.ml);
    return p && v ? { p, v, price: v.price } : null;
  };
  const lineKey = (i) =>
    i?.setId !== undefined ? "set:" + i.setId : `${i?.productId}:${i?.ml}`;
  const total = () =>
    basket.reduce((sum, i) => sum + (detail(i)?.price || 0) * i.quantity, 0);
  function save() {
    try {
      localStorage.setItem("bey-cart-v1", JSON.stringify(basket));
    } catch {}
  }
  function changed() {
    requestKey = crypto.randomUUID();
    save();
    persistDraft();
    render();
    message.textContent = "";
  }
  const usedMl = (id) =>
    basket
      .filter((i) => i.productId === id)
      .reduce((sum, i) => sum + i.ml * i.quantity, 0);
  function stockProblem() {
    return basket.some((i) =>
      i.setId !== undefined
        ? sets.find((s) => s.id === i.setId)?.available === false
        : products.find((p) => p.id === i.productId)?.available === false,
    )
      ? "Одна из позиций больше недоступна. Удалите её из корзины."
      : "";
  }
  const bagIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7ZM9 8V6a3 3 0 0 1 6 0v2"/></svg>';
  function updateCardQuantity(card, button, product, select) {
    let group = card.querySelector(".in-cart-control");
    if (!group) {
      group = el("div", "in-cart-control");
      const minus = el("button", "in-cart-minus"),
        plus = el("button", "in-cart-plus"),
        link = el("a", "in-cart-link");
      minus.type = plus.type = "button";
      minus.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';
      plus.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>';
      link.href = "/cart";
      link.append(el("strong", "in-cart-count"), el("span", "", "Перейти"));
      group.append(minus, link, plus);
      button.after(group);
    }
    const ml = Number(select.value),
      item = basket.find((i) => i.productId === product.id && i.ml === ml),
      count = item?.quantity || 0;
    group.hidden = !count;
    button.hidden = !!count;
    group.querySelector(".in-cart-count").textContent =
      "В корзине · " + count + " шт.";
    const link = group.querySelector("a");
    link.setAttribute(
      "aria-label",
      `Перейти в корзину: ${product.name}, ${ml} мл, ${count} шт.`,
    );
    const minus = group.querySelector(".in-cart-minus"),
      plus = group.querySelector(".in-cart-plus");
    minus.setAttribute(
      "aria-label",
      `Уменьшить количество ${product.name}, ${ml} мл`,
    );
    plus.setAttribute(
      "aria-label",
      `Увеличить количество ${product.name}, ${ml} мл`,
    );
    minus.disabled = busy;
    plus.disabled = busy || count >= 20 || product.available === false;
    function adjust(delta) {
      if (busy) return;
      const current = basket.find(
        (i) => i.productId === product.id && i.ml === ml,
      );
      if (!current) return;
      const available =
        products.find((p) => p.id === product.id)?.available !== false;
      if (delta > 0 && (!available || current.quantity >= 20)) return;
      current.quantity += delta;
      if (!current.quantity) basket = basket.filter((i) => i !== current);
      changed();
      if (!current.quantity) button.focus({ preventScroll: true });
    }
    minus.onclick = () => adjust(-1);
    plus.onclick = () => adjust(1);
  }
  // Sale presentation: badge, struck original price and a live countdown.
  const clockIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>';
  const boltIcon =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>';
  const percentOff = (p) =>
    Math.round((1 - p.pricePerMl / p.basePricePerMl) * 100);
  function countdown(end, large, title = "Акция закончится через") {
    const box = el("div", "countdown " + (large ? "countdown-tiles" : "countdown-compact"));
    box.dataset.countdownEnd = end;
    box.setAttribute("role", "timer");
    if (large) {
      box.innerHTML = `<p class="countdown-title">${boltIcon}<span></span></p><div class="countdown-units">${[
        ["d", "дней"],
        ["h", "часов"],
        ["m", "минут"],
        ["s", "секунд"],
      ]
        .map(
          ([unit, label]) =>
            `<span class="countdown-unit" data-unit="${unit}"><b>00</b><small>${label}</small></span>`,
        )
        .join("")}</div>`;
      // Seller-provided promotion titles are inserted as text only.
      box.querySelector(".countdown-title span").textContent = title;
    } else
      box.innerHTML = `${clockIcon}<span class="countdown-text"></span>`;
    tickCountdowns();
    return box;
  }
  function decorateSale(card, p, variant, priceLabel) {
    const large = card.classList.contains("detail-product");
    const visual = card.querySelector(".product-visual");
    let row = priceLabel.closest(".price-row");
    if (!row) {
      row = el("div", "price-row");
      priceLabel.before(row);
      row.append(priceLabel);
    }
    card.classList.toggle("is-on-sale", !!p.onSale);
    let badge = visual?.querySelector(".sale-badge"),
      old = row.querySelector(".sale-old-price"),
      timer = card.querySelector(".countdown");
    if (!p.onSale) {
      badge?.remove();
      old?.remove();
      row.querySelector(".sale-save")?.remove();
      timer?.remove();
      return;
    }
    if (visual && !badge) {
      badge = el("span", "sale-badge");
      visual.append(badge);
    }
    if (badge) badge.textContent = "−" + percentOff(p) + "%";
    if (!old) {
      old = el("del", "sale-old-price");
      row.append(old);
    }
    old.textContent = money(variant.originalPrice);
    old.setAttribute("aria-label", "Старая цена " + money(variant.originalPrice));
    if (large) {
      let save = row.querySelector(".sale-save");
      if (!save) {
        save = el("span", "sale-save");
        row.append(save);
      }
      save.textContent = "Выгода " + money(variant.originalPrice - variant.price);
    }
    if (!(Date.parse(p.saleEndsAt) > Date.now())) {
      timer?.remove();
      return;
    }
    if (timer?.dataset.countdownEnd !== p.saleEndsAt) {
      timer?.remove();
      const box = countdown(
        p.saleEndsAt,
        large,
        p.promotion
          ? `«${p.promotion.title}» закончится через`
          : "Акция закончится через",
      );
      row.after(box);
    }
  }
  function tickCountdowns() {
    document.querySelectorAll("[data-countdown-end]").forEach((box) => {
      const left = Math.floor(
        (Date.parse(box.dataset.countdownEnd) - Date.now()) / 1000,
      );
      if (!(left > 0)) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      const parts = {
        d: Math.floor(left / 86400),
        h: Math.floor((left % 86400) / 3600),
        m: Math.floor((left % 3600) / 60),
        s: left % 60,
      };
      const pad = (n) => String(n).padStart(2, "0");
      const text = box.querySelector(".countdown-text");
      if (text)
        text.textContent =
          "Осталось " +
          (parts.d ? parts.d + " д " : "") +
          [parts.h, parts.m, parts.s].map(pad).join(":");
      box.querySelectorAll("[data-unit]").forEach((unit) => {
        const value = pad(parts[unit.dataset.unit]);
        const digits = unit.querySelector("b");
        if (digits.textContent === value) return;
        digits.textContent = value;
        unit.classList.remove("is-ticking");
        void unit.offsetWidth;
        unit.classList.add("is-ticking");
      });
      box.setAttribute(
        "aria-label",
        `До конца акции ${parts.d} д ${parts.h} ч ${parts.m} мин`,
      );
    });
  }
  setInterval(tickCountdowns, 1000);
  document.addEventListener("store:refresh-controls", tickCountdowns);
  function updateAvailability() {
    document.querySelectorAll("[data-add]").forEach((button) => {
      const p = products.find((p) => p.id === button.dataset.add);
      if (!p) return;
      const card = button.closest(".product-card");
      const select = card.querySelector(".volume-select");
      const selected = select.value;
      const priceSignature = JSON.stringify(p.variants);
      if (select.dataset.prices !== priceSignature) {
        select.dataset.prices = priceSignature;
        select.replaceChildren(
          ...p.variants.map((v) => {
            const o = document.createElement("option");
            o.value = v.ml;
            o.textContent = v.ml + " мл — " + money(v.price);
            return o;
          }),
        );
        if (p.variants.some((v) => String(v.ml) === selected))
          select.value = selected;
      }
      const priceLabel = card.querySelector("[data-current-price]");
      const variant =
        p.variants.find((v) => String(v.ml) === select.value) || p.variants[0];
      if (priceLabel) {
        priceLabel.textContent = money(variant.price);
        decorateSale(card, p, variant, priceLabel);
      }
      button.disabled = p.available === false;
      const quick = card.querySelector(".buy-now");
      if (quick) quick.disabled = p.available === false;
      if (!button.classList.contains("is-added") || p.available === false) {
        const text = p.available === false ? "Нет в наличии" : "В корзину";
        if (button.classList.contains("icon-cart-button")) {
          button.innerHTML = bagIcon + `<span class="cart-label">${text}</span>`;
          button.setAttribute(
            "aria-label",
            p.available === false
              ? "Нет в наличии"
              : "Добавить " + p.name + " в корзину",
          );
        } else if (button.textContent !== text) button.textContent = text;
      }
      if (card.classList.contains("detail-product"))
        updateCardQuantity(card, button, p, select);
      const label = card.querySelector(".product-availability");
      if (label)
        label.textContent =
          p.available === false ? "Нет в наличии" : "В наличии";
    });
    document.querySelectorAll("[data-add-set]").forEach((button) => {
      const set = sets.find((s) => s.id === button.dataset.addSet);
      const inBasket =
        basket.find((i) => i.setId === button.dataset.addSet)?.quantity || 0;
      button.disabled = !set?.available || inBasket >= 20;
      if (!button.classList.contains("is-added"))
        button.textContent = !set?.available
          ? "Набор недоступен"
          : inBasket
            ? `В корзине · ${inBasket} шт. Добавить ещё`
            : "Добавить набор в корзину";
    });
  }
  async function refreshAvailability() {
    if (busy || document.hidden) return;
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (busy) return;
      products = data.products;
      sets = data.sets || [];
      updateAvailability();
      if (success.hidden) render();
    } catch {
      /* Checkout still checks availability on the server. */
    }
  }
  function quantityControls(item, index, label, unavailable) {
    const controls = el("div", "quantity-controls");
    const minus = el("button", "", "−"),
      plus = el("button", "", "+"),
      count = el("span", "", item.quantity);
    minus.type = plus.type = "button";
    minus.setAttribute("aria-label", "Уменьшить " + label);
    plus.setAttribute("aria-label", "Увеличить " + label);
    minus.disabled = item.quantity <= 1;
    plus.disabled = item.quantity >= 20 || unavailable;
    minus.onclick = () => {
      item.quantity--;
      changed();
      restoreControl(index, false);
    };
    plus.onclick = () => {
      if (unavailable) return;
      item.quantity++;
      changed();
      restoreControl(index, true);
    };
    controls.append(minus, count, plus);
    return controls;
  }
  function setRow(set, item, index) {
    const row = el("article", "cart-item cart-item-set");
    const art = el("a", "cart-item-art cart-set-art");
    art.href = "/sets#" + set.id;
    art.setAttribute("aria-label", "Открыть набор " + set.title);
    for (const component of set.items.slice(0, 3)) {
      if (!component.image) continue;
      const img = el("img");
      img.src = "/assets/products/" + component.image;
      img.alt = "";
      art.append(img);
    }
    const copy = el("div", "cart-item-copy");
    const heading = el("h3");
    const link = el("a", "cart-product-link", set.title);
    link.href = "/sets#" + set.id;
    heading.append(link);
    copy.append(
      el("small", "", "Набор · " + set.items.length + " аромата"),
      heading,
      el(
        "p",
        "",
        set.items.map((i) => `${i.brand} ${i.name} ${i.ml} мл`).join(" · ") +
          " · " +
          money(set.price),
      ),
      quantityControls(item, index, "набор " + set.title, !set.available),
    );
    const side = el("div", "cart-item-side");
    side.append(el("strong", "", money(set.price * item.quantity)));
    if (set.onSale)
      side.append(el("del", "sale-old-price", money(set.regularPrice * item.quantity)));
    const remove = el("button", "remove-item", "Удалить");
    remove.type = "button";
    remove.setAttribute("aria-label", "Удалить набор " + set.title);
    remove.onclick = () => {
      basket.splice(index, 1);
      changed();
      (
        list.querySelector(".remove-item") ||
        panel.querySelector(".cart-empty a")
      ).focus();
    };
    side.append(remove);
    row.append(art, copy, side);
    return row;
  }
  function render() {
    if (cartRoot)
      document.documentElement.dataset.cartState = basket.length
        ? "full"
        : "empty";
    document
      .querySelectorAll(".cart-count")
      .forEach(
        (e) => {
          const count = basket.reduce((n, i) => n + i.quantity, 0);
          e.textContent = count;
          e.toggleAttribute("data-empty", !count);
        },
      );
    list.replaceChildren();
    for (const [index, item] of basket.entries()) {
      const found = detail(item);
      if (!found) continue;
      if (found.set) {
        list.append(setRow(found.set, item, index));
        continue;
      }
      const { p, v } = found;
      const row = el("article", "cart-item");
      const productURL =
        "/fragrance?id=" +
        encodeURIComponent(p.id) +
        "&ml=" +
        item.ml +
        "&from=cart";
      const art = el("a", "cart-item-art");
      art.href = productURL;
      art.setAttribute(
        "aria-label",
        "Открыть карточку " + p.brand + " " + p.name,
      );
      if (p.image) {
        const img = el("img");
        img.src = "/assets/products/" + p.image;
        img.alt = "";
        art.append(img);
      } else {
        const mark = el("img", "cart-placeholder");
        mark.src = "/assets/arafan-perfume-logo.png";
        mark.alt = "Arafan Perfume";
        art.append(mark);
      }
      const copy = el("div", "cart-item-copy");
      const heading = el("h3");
      const nameLink = el("a", "cart-product-link", p.name);
      nameLink.href = productURL;
      heading.append(nameLink);
      copy.append(
        el("small", "", p.brand),
        heading,
        el(
          "p",
          "",
          `${p.code ? p.code + " · " : ""}${p.type === "razliv" ? "Разлив" : "Распив"} · ${item.ml} мл · ${money(v.price)}`,
        ),
      );
      const controls = el("div", "quantity-controls");
      const minus = el("button", "", "−"),
        plus = el("button", "", "+"),
        count = el("span", "", item.quantity);
      minus.type = plus.type = "button";
      minus.setAttribute("aria-label", `Уменьшить ${p.name} ${item.ml} мл`);
      plus.setAttribute("aria-label", `Увеличить ${p.name} ${item.ml} мл`);
      minus.disabled = item.quantity <= 1;
      plus.disabled = item.quantity >= 20 || p.available === false;
      minus.onclick = () => {
        item.quantity--;
        changed();
        restoreControl(index, false);
      };
      plus.onclick = () => {
        if (p.available === false) return;
        item.quantity++;
        changed();
        restoreControl(index, true);
      };
      controls.append(minus, count, plus);
      copy.append(controls);
      const side = el("div", "cart-item-side");
      side.append(el("strong", "", money(v.price * item.quantity)));
      const remove = el("button", "remove-item", "Удалить");
      remove.type = "button";
      remove.setAttribute("aria-label", `Удалить ${p.name} ${item.ml} мл`);
      remove.onclick = () => {
        basket.splice(index, 1);
        changed();
        (
          list.querySelector(".remove-item") ||
          panel.querySelector(".cart-empty a")
        ).focus();
      };
      side.append(remove);
      row.append(art, copy, side);
      list.append(row);
    }
    form.hidden = !basket.length;
    panel.querySelector(".cart-empty").hidden = !!basket.length;
    panel.querySelector(".cart-total").textContent = money(total());
    panel.querySelector(".cart-stock-warning").textContent = stockProblem();
    form.querySelector(".submit-order").disabled = !!stockProblem() || busy;
    updateAvailability();
  }
  function restoreControl(index, plus) {
    const buttons = list.children[index]?.querySelectorAll(
      ".quantity-controls button",
    );
    const button = buttons?.[plus ? 1 : 0];
    if (button) (button.disabled ? buttons[plus ? 0 : 1] : button).focus();
  }
  panel.querySelector(".continue-shopping").onclick = () => {
    location.href = "/catalog";
  };
  function restoreDraft() {
    try {
      const d = JSON.parse(
        sessionStorage.getItem("arafan-checkout-draft") || "{}",
      );
      for (const key of ["name", "phone", "address", "comment"]) {
        if (typeof d[key] === "string") form.elements[key].value = d[key];
      }
      if (d.fulfillment === "pickup")
        form.querySelector('[value="pickup"]').checked = true;
      if (
        d.basket === JSON.stringify(basket) &&
        typeof d.requestKey === "string" &&
        /^[0-9a-f-]{36}$/i.test(d.requestKey)
      )
        requestKey = d.requestKey;
    } catch {}
  }
  function persistDraft() {
    try {
      const old = JSON.parse(
        sessionStorage.getItem("arafan-checkout-draft") || "{}",
      );
      const d = cartRoot ? Object.fromEntries(new FormData(form)) : old;
      delete d.consent;
      d.requestKey = requestKey;
      d.basket = JSON.stringify(basket);
      sessionStorage.setItem("arafan-checkout-draft", JSON.stringify(d));
    } catch {}
  }
  function receiving() {
    const pickup = form.elements.fulfillment.value === "pickup";
    form.querySelector(".delivery-address").hidden = pickup;
    form.elements.address.required = !pickup;
    panel.querySelector(".pickup-details").hidden = !pickup;
    panel.querySelector(".delivery-terms").hidden = pickup;
  }
  if (cartRoot) restoreDraft();
  receiving();
  // Signed-in customers get empty contact fields filled from their latest order.
  async function prefillFromAccount() {
    const fields = form.elements;
    if (fields.name.value || fields.phone.value || fields.address.value) return;
    try {
      const me = await fetch("/api/account").then((r) => r.json());
      if (!me.account) return;
      const r = await fetch("/api/account/orders");
      const history = r.ok ? (await r.json()).orders || [] : [];
      const last = history[0];
      if (fields.name.value || fields.phone.value || fields.address.value)
        return;
      fields.name.value = last?.name || me.account.name || "";
      const digits = String(last?.phone || "")
        .replace(/\D/g, "")
        .replace(/^[78](?=\d{10}$)/, "");
      fields.phone.value = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)]
        .filter(Boolean)
        .join(" ");
      fields.address.value = history.find((o) => o.address)?.address || "";
      if (last?.fulfillment === "pickup")
        form.querySelector('[value="pickup"]').checked = true;
      receiving();
      persistDraft();
    } catch {}
  }
  if (cartRoot) {
    prefillFromAccount();
    try {
      const note = sessionStorage.getItem("arafan-repeat-note");
      if (note) {
        sessionStorage.removeItem("arafan-repeat-note");
        setTimeout(() => notify(note), 300);
      }
    } catch {}
  }
  form.addEventListener("change", () => {
    receiving();
    persistDraft();
  });
  const nameInput = form.elements.name;
  const nameFeedback = panel.querySelector("#name-error");
  let nameTouched = false;
  function validateName(show = false) {
    const error = customerNameError(nameInput.value);
    nameInput.setCustomValidity(error);
    nameInput.setAttribute("aria-invalid", String(!!error && show));
    nameFeedback.textContent = show ? error : "";
    nameFeedback.hidden = !show || !error;
    return !error;
  }
  // Reveal an error on submit, so blur does not move the next click target.
  nameInput.addEventListener("input", () => validateName(nameTouched));
  nameInput.addEventListener("invalid", () => {
    nameTouched = true;
    validateName(true);
  });
  form.addEventListener("reset", () => {
    nameTouched = false;
    nameInput.setCustomValidity("");
    nameInput.removeAttribute("aria-invalid");
    nameFeedback.hidden = true;
    nameFeedback.textContent = "";
  });
  const phoneInput = form.elements.phone;
  const digitsOnly = (value) => value.replace(/\D/g, "");
  const nationalNumber = (value) => {
    let digits = digitsOnly(value);
    if (digits.length === 11 && /^[78]/.test(digits)) digits = digits.slice(1);
    return digits.slice(0, 10);
  };
  const formatPhone = (digits) =>
    [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)]
      .filter(Boolean)
      .join(" ");
  function setPhone(digits, position) {
    phoneInput.value = formatPhone(digits);
    let caret = 0,
      seen = 0;
    while (caret < phoneInput.value.length && seen < position) {
      if (/\d/.test(phoneInput.value[caret])) seen++;
      caret++;
    }
    phoneInput.setSelectionRange(caret, caret);
  }
  function editPhone(text, deletion) {
    const digits = digitsOnly(phoneInput.value);
    let start = digitsOnly(
      phoneInput.value.slice(0, phoneInput.selectionStart),
    ).length;
    let end = digitsOnly(
      phoneInput.value.slice(0, phoneInput.selectionEnd),
    ).length;
    if (deletion && start === end) {
      if (deletion === "back") start = Math.max(0, start - 1);
      else end = Math.min(digits.length, end + 1);
    }
    const insert = text.slice(0, 10 - digits.length + end - start);
    setPhone(
      digits.slice(0, start) + insert + digits.slice(end),
      start + insert.length,
    );
    phoneInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
  phoneInput.addEventListener("beforeinput", (event) => {
    if (!event.cancelable) return;
    if (event.inputType === "insertText") {
      event.preventDefault();
      const digits = digitsOnly(event.data || "");
      if (digits) editPhone(digits);
    } else if (
      ["deleteContentBackward", "deleteContentForward"].includes(
        event.inputType,
      )
    ) {
      event.preventDefault();
      editPhone(
        "",
        event.inputType === "deleteContentBackward" ? "back" : "forward",
      );
    }
  });
  phoneInput.addEventListener("paste", (event) => {
    event.preventDefault();
    const digits = nationalNumber(event.clipboardData.getData("text"));
    if (digits) editPhone(digits);
  });
  // Autofill, drag/drop and non-cancelable mobile input use the same fallback.
  phoneInput.addEventListener("input", () => {
    const raw = phoneInput.value;
    const position = digitsOnly(raw.slice(0, phoneInput.selectionStart)).length;
    const digits = nationalNumber(raw);
    const prefixRemoved =
      digitsOnly(raw).length === 11 && /^[78]/.test(digitsOnly(raw));
    setPhone(
      digits,
      Math.min(digits.length, Math.max(0, position - Number(prefixRemoved))),
    );
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !basket.length) return;
    if (stockProblem()) {
      message.textContent = stockProblem();
      return;
    }
    if (!validateName(true)) {
      nameInput.reportValidity();
      nameInput.focus();
      return;
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const national = digitsOnly(String(data.get("phone")));
    if (national.length !== 10) {
      message.textContent = "Введи ровно 10 цифр после +7.";
      phoneInput.focus();
      return;
    }
    const phone = "+7" + national;
    busy = true;
    message.textContent = "Сохраняем заявку…";
    panel
      .querySelectorAll("button, input, textarea")
      .forEach((e) => (e.disabled = true));
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey,
          name: normalizeCustomerName(data.get("name")),
          phone,
          items: basket,
          expectedTotal: total(),
          address:
            data.get("fulfillment") === "pickup" ? "" : data.get("address"),
          fulfillment: data.get("fulfillment"),
          comment: data.get("comment"),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Не удалось отправить заявку.");
      basket = [];
      changed();
      form.reset();
      receiving();
      try {
        sessionStorage.removeItem("arafan-checkout-draft");
      } catch {}
      form.hidden = true;
      list.hidden = true;
      panel.querySelector(".cart-empty").hidden = true;
      document.documentElement.dataset.cartState = "success";
      success.hidden = false;
      success.querySelector(".receipt-code").textContent = result.id;
      success.querySelector(".receipt-total").textContent =
        "Сумма: " + money(result.total);
      success.querySelector(".receipt-fulfillment").textContent =
        data.get("fulfillment") === "pickup"
          ? "Самовывоз: Алматы, Достык, 108Б · 10:00–21:00"
          : "Доставка по указанному адресу";
      message.textContent = "";
      success.focus();
    } catch (error) {
      message.textContent =
        error.message === "Failed to fetch"
          ? "Нет связи с сервером. Корзина сохранена, попробуй отправить ещё раз."
          : error.message;
    } finally {
      busy = false;
      panel
        .querySelectorAll("button, input, textarea")
        .forEach((e) => (e.disabled = false));
      if (success.hidden) render();
      refreshAvailability();
    }
  });
  // A changed contact is a new request; a retry of unchanged data retains its key.
  form.addEventListener("input", () => {
    requestKey = crypto.randomUUID();
    persistDraft();
  });
  fetch("/api/products")
    .then(async (response) => {
      if (!response.ok) throw new Error();
      return response.json();
    })
    .then((data) => {
      products = data.products;
      sets = data.sets || [];
      // The catalog and homepage read prices from this single request.
      window.storeData = data;
      document.dispatchEvent(new Event("store:data"));
      const seen = new Set();
      basket = basket
        .filter((i) => {
          const k = lineKey(i);
          if (
            !i ||
            !detail(i) ||
            !Number.isInteger(i.quantity) ||
            i.quantity < 1 ||
            i.quantity > 20 ||
            seen.has(k)
          )
            return false;
          seen.add(k);
          return true;
        })
        .slice(0, 24);
      save();
      render();

      document.addEventListener("change", (e) => {
        if (e.target.matches(".volume-select")) updateAvailability();
      });
      document.addEventListener("store:refresh-controls", updateAvailability);
      document.addEventListener("click", (event) => {
        const setButton = event.target.closest("[data-add-set]");
        if (setButton) {
          const set = sets.find((s) => s.id === setButton.dataset.addSet);
          const current = basket.find((i) => i.setId === set?.id);
          if (
            !set?.available ||
            (current?.quantity || 0) >= 20 ||
            (!current && basket.length >= 24)
          ) {
            notify("Набор сейчас нельзя добавить.");
            return;
          }
          if (current) current.quantity++;
          else basket.push({ setId: set.id, quantity: 1 });
          changed();
          setButton.classList.add("is-added");
          setButton.textContent = "Добавлено ✓";
          setTimeout(() => {
            setButton.classList.remove("is-added");
            updateAvailability();
          }, 1200);
          notify("Набор добавлен в корзину", cartLink);
          return;
        }
        const button = event.target.closest("[data-add]");
        if (!button) return;
        const requests = [
          {
            id: button.dataset.add,
            ml: Number(
              button.closest(".product-card").querySelector(".volume-select")
                .value,
            ),
          },
        ];
        if (
          requests.some((r) => {
            const p = products.find((p) => p.id === r.id);
            const current = basket.find(
              (i) => i.productId === r.id && i.ml === r.ml,
            );
            return (
              !p || p.available === false || (current?.quantity || 0) >= 20
            );
          }) ||
          basket.length +
            requests.filter(
              (r) => !basket.some((i) => i.productId === r.id && i.ml === r.ml),
            ).length >
            24
        ) {
          notify("Проверьте доступность и количество товаров.");
          return;
        }
        for (const r of requests) {
          const current = basket.find(
            (i) => i.productId === r.id && i.ml === r.ml,
          );
          if (current) current.quantity++;
          else
            basket.push({
              productId: r.id,
              type: products.find((p) => p.id === r.id).type,
              ml: r.ml,
              quantity: 1,
            });
        }
        changed();
        button.classList.add("is-added");
        if (button.classList.contains("icon-cart-button"))
          button.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg><span class="cart-label">Добавлено</span>';
        else button.textContent = "Добавлено ✓";
        setTimeout(() => {
          button.classList.remove("is-added");
          updateAvailability();
        }, 1200);
        notify("Аромат добавлен в корзину", cartLink);
      });
      updateAvailability();
      function syncBasket() {
        try {
          const saved = JSON.parse(localStorage.getItem("bey-cart-v1") || "[]");
          if (
            !Array.isArray(saved) ||
            JSON.stringify(saved) === JSON.stringify(basket)
          )
            return;
          const seen = new Set();
          basket = saved
            .filter((i) => {
              const key = lineKey(i);
              if (
                !detail(i) ||
                !Number.isInteger(i.quantity) ||
                i.quantity < 1 ||
                i.quantity > 20 ||
                seen.has(key)
              )
                return false;
              seen.add(key);
              return true;
            })
            .slice(0, 24);
          requestKey = crypto.randomUUID();
          render();
        } catch {}
      }
      window.addEventListener("pageshow", (event) => {
        if (event.persisted) syncBasket();
      });
      window.addEventListener("storage", (event) => {
        if (event.key === "bey-cart-v1") syncBasket();
      });
      setInterval(refreshAvailability, 20000);
      window.addEventListener("focus", refreshAvailability);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) refreshAvailability();
      });
    })
    .catch(() => {
      window.storeData = null;
      document.dispatchEvent(new Event("store:data"));
      form.hidden = true;
      list.hidden = true;
      panel.querySelector(".cart-empty").hidden = true;
      message.textContent =
        "Не удалось загрузить цены. Корзина сохранена. Обновите страницу, когда связь восстановится.";
      document
        .querySelectorAll(".cart-count")
        .forEach(
          (e) =>
            (e.textContent = basket.reduce(
              (n, i) => n + (Number.isInteger(i.quantity) ? i.quantity : 0),
              0,
            )),
        );
      notify("Не удалось загрузить цены. Обновите страницу.");
    });
})();
