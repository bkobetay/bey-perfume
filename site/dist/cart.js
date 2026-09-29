(() => {
  const money = (n) => new Intl.NumberFormat("ru-KZ").format(n) + " ₸";
  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  let products = [],
    basket = [],
    busy = false,
    opener,
    requestKey = crypto.randomUUID();
  try {
    basket = JSON.parse(localStorage.getItem("bey-cart-v1") || "[]");
  } catch {}
  if (!Array.isArray(basket)) basket = [];
  const dialog = el("dialog", "cart-dialog");
  dialog.setAttribute("aria-labelledby", "cart-title");
  dialog.innerHTML = `<div class="cart-heading"><div><p class="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</p><h2 id="cart-title">Корзина</h2></div><button type="button" class="icon-close" aria-label="Закрыть корзину">×</button></div><div class="cart-body"><p class="demo-notice">Демоверсия · цены предварительные. Онлайн-оплаты пока нет.</p><div class="cart-items"></div><div class="cart-empty" hidden><span aria-hidden="true">BEY</span><h3>Начни с одного аромата</h3><p>Выбери флакон и объём в каталоге.</p><a class="button button-amber" href="/catalog.html">Открыть каталог</a></div><form class="checkout-form"><div class="cart-summary"><span>Сумма заявки</span><strong class="cart-total"></strong></div><h3>Как с тобой связаться?</h3><label>Твоё имя<input name="name" autocomplete="name" minlength="2" maxlength="80" placeholder="Имя" required /></label><label>Номер телефона<input name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="30" placeholder="+7 700 000 00 00" required /></label><p class="field-hint">Укажи код страны. Продавец свяжется с тобой и уточнит наличие, стоимость и получение.</p><label class="contact-consent"><input type="checkbox" name="consent" required /><span>Разрешаю связаться со мной по этой заявке.</span></label><button class="button button-amber submit-order" type="submit">Оставить заявку</button></form><p class="checkout-message" role="status" aria-live="polite"></p><div class="order-success" hidden tabindex="-1"><span class="success-symbol" aria-hidden="true">✓</span><p class="eyebrow">ЗАЯВКА СОХРАНЕНА</p><h3>Твой аромат уже ближе.</h3><p>Продавец свяжется с тобой для подтверждения.</p><p class="receipt-code"></p><p class="receipt-total"></p><button type="button" class="button button-glass continue-shopping">Продолжить выбор</button></div></div>`;
  document.body.append(dialog);
  const form = dialog.querySelector("form"),
    list = dialog.querySelector(".cart-items"),
    message = dialog.querySelector(".checkout-message"),
    success = dialog.querySelector(".order-success");
  const toast = el("div", "cart-toast");
  toast.setAttribute("role", "status");
  document.body.append(toast);
  let toastTimer;
  function notify(text) {
    toast.textContent = text;
    toast.classList.add("shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("shown"), 2800);
  }
  const detail = (item) => {
    const p = products.find((p) => p.id === item.productId);
    const v = p?.variants.find((v) => v.ml === item.ml);
    return p && v ? { p, v } : null;
  };
  const total = () =>
    basket.reduce((sum, i) => sum + (detail(i)?.v.price || 0) * i.quantity, 0);
  function save() {
    try {
      localStorage.setItem("bey-cart-v1", JSON.stringify(basket));
    } catch {}
  }
  function changed() {
    requestKey = crypto.randomUUID();
    save();
    render();
    message.textContent = "";
  }
  function render() {
    document
      .querySelectorAll(".cart-count")
      .forEach(
        (e) => (e.textContent = basket.reduce((n, i) => n + i.quantity, 0)),
      );
    list.replaceChildren();
    for (const [index, item] of basket.entries()) {
      const { p, v } = detail(item);
      const row = el("article", "cart-item");
      const art = el("div", "cart-item-art");
      if (p.image) {
        const img = el("img");
        img.src = "/assets/products/" + p.image;
        img.alt = "";
        art.append(img);
      } else art.textContent = "BEY";
      const copy = el("div", "cart-item-copy");
      copy.append(
        el("small", "", p.brand),
        el("h3", "", p.name),
        el("p", "", `${item.ml} мл · ${money(v.price)}`),
      );
      const controls = el("div", "quantity-controls");
      const minus = el("button", "", "−"),
        plus = el("button", "", "+"),
        count = el("span", "", item.quantity);
      minus.type = plus.type = "button";
      minus.setAttribute("aria-label", `Уменьшить ${p.name} ${item.ml} мл`);
      plus.setAttribute("aria-label", `Увеличить ${p.name} ${item.ml} мл`);
      minus.disabled = item.quantity <= 1;
      plus.disabled = item.quantity >= 20;
      minus.onclick = () => {
        item.quantity--;
        changed();
        restoreControl(index, false);
      };
      plus.onclick = () => {
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
          dialog.querySelector(".icon-close")
        ).focus();
      };
      side.append(remove);
      row.append(art, copy, side);
      list.append(row);
    }
    form.hidden = !basket.length;
    dialog.querySelector(".cart-empty").hidden = !!basket.length;
    dialog.querySelector(".cart-total").textContent = money(total());
  }
  function restoreControl(index, plus) {
    const buttons = list.children[index]?.querySelectorAll(
      ".quantity-controls button",
    );
    const button = buttons?.[plus ? 1 : 0];
    if (button) (button.disabled ? buttons[plus ? 0 : 1] : button).focus();
  }
  function open() {
    if (dialog.open) return;
    opener = document.activeElement;
    success.hidden = true;
    list.hidden = false;
    message.textContent = "";
    render();
    dialog.showModal();
    document.body.classList.add("cart-open");
  }
  function close() {
    if (busy) return;
    dialog.close();
  }
  dialog.querySelector(".icon-close").onclick = close;
  dialog.querySelector(".continue-shopping").onclick = close;
  dialog.addEventListener("cancel", (e) => {
    if (busy) e.preventDefault();
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("cart-open");
    opener?.focus();
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        close();
    }
  });
  document.querySelectorAll(".cart-toggle").forEach((button) => {
    button.disabled = true;
    button.addEventListener("click", open);
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !basket.length || !form.reportValidity()) return;
    const data = new FormData(form);
    const phone = String(data.get("phone"));
    if (
      !/^[+\d\s()\-]+$/.test(phone) ||
      phone.replace(/\D/g, "").length < 10 ||
      phone.replace(/\D/g, "").length > 15
    ) {
      message.textContent = "Проверь номер телефона и код страны.";
      form.elements.phone.focus();
      return;
    }
    busy = true;
    message.textContent = "Сохраняем заявку…";
    dialog
      .querySelectorAll("button, input")
      .forEach((e) => (e.disabled = true));
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestKey,
          name: data.get("name"),
          phone,
          items: basket,
          expectedTotal: total(),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Не удалось отправить заявку.");
      basket = [];
      changed();
      form.reset();
      form.hidden = true;
      list.hidden = true;
      dialog.querySelector(".cart-empty").hidden = true;
      success.hidden = false;
      success.querySelector(".receipt-code").textContent = result.id;
      success.querySelector(".receipt-total").textContent =
        "Сумма: " + money(result.total);
      message.textContent = "";
      success.focus();
    } catch (error) {
      message.textContent =
        error.message === "Failed to fetch"
          ? "Нет связи с сервером. Корзина сохранена, попробуй отправить ещё раз."
          : error.message;
    } finally {
      busy = false;
      dialog
        .querySelectorAll("button, input")
        .forEach((e) => (e.disabled = false));
      if (success.hidden) render();
    }
  });
  // A changed contact is a new request; a retry of unchanged data retains its key.
  form.addEventListener("input", () => {
    requestKey = crypto.randomUUID();
  });
  fetch("/api/products")
    .then(async (response) => {
      if (!response.ok) throw new Error();
      return response.json();
    })
    .then((data) => {
      products = data.products;
      const seen = new Set();
      basket = basket
        .filter((i) => {
          const k = `${i?.productId}:${i?.ml}`;
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
      document
        .querySelectorAll(".cart-toggle")
        .forEach((button) => (button.disabled = false));
      document.querySelectorAll("[data-add]").forEach((button) => {
        button.disabled = false;
        button.onclick = () => {
          const productId = button.dataset.add;
          const ml = Number(
            button.closest(".product-card").querySelector(".volume-select")
              .value,
          );
          const existing = basket.find(
            (i) => i.productId === productId && i.ml === ml,
          );
          if (
            (existing?.quantity || 0) >= 20 ||
            (!existing && basket.length >= 24)
          ) {
            notify("Достигнут лимит количества в заявке.");
            return;
          }
          if (existing) existing.quantity++;
          else basket.push({ productId, ml, quantity: 1 });
          changed();
          notify(
            `${products.find((p) => p.id === productId).name}, ${ml} мл — в корзине`,
          );
        };
      });
    })
    .catch(() => {
      basket = [];
      render();
      notify(
        "Не удалось загрузить цены. Обнови страницу, когда сервер будет доступен.",
      );
    });
})();
