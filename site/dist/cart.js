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
  dialog.innerHTML = `<div class="cart-heading"><div><p class="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</p><h2 id="cart-title">Корзина</h2></div><button type="button" class="icon-close" aria-label="Закрыть корзину">×</button></div><div class="cart-body"><p class="demo-notice">Демоверсия · цены предварительные. Онлайн-оплаты пока нет.</p><div class="cart-items"></div><p class="cart-stock-warning" role="status"></p><div class="cart-empty" hidden><img class="cart-empty-logo" src="/assets/aliden-parfum-logo.svg" alt="" aria-hidden="true" width="300" height="76" /><h3>Начни с одного аромата</h3><p>Выбери флакон и объём в каталоге.</p><a class="button button-accent" href="/catalog.html">Открыть каталог</a></div><form class="checkout-form"><div class="cart-summary"><span>Сумма заявки</span><strong class="cart-total"></strong></div><h3>Как с тобой связаться?</h3><label>Твоё имя<input name="name" autocomplete="name" minlength="2" maxlength="80" placeholder="Например, Айдана" aria-describedby="name-hint name-error" required /></label><p class="field-hint" id="name-hint">Введите ваше настоящее имя, чтобы продавец знал, как к вам обратиться.</p><p class="name-error" id="name-error" role="status" hidden></p><label>Номер телефона<span class="phone-field"><span class="phone-prefix" aria-hidden="true">+7</span><input name="phone" type="tel" aria-label="Номер телефона" aria-describedby="phone-hint" autocomplete="tel-national" inputmode="numeric" maxlength="12" pattern="[0-9]{3} [0-9]{3} [0-9]{4}" placeholder="700 000 0000" required /></span></label><p class="field-hint" id="phone-hint">Код +7 уже указан. Введи 10 цифр номера. Продавец свяжется с тобой и уточнит наличие, стоимость и получение.</p><label class="contact-consent"><input type="checkbox" name="consent" required /><span>Разрешаю связаться со мной по этой заявке.</span></label><button class="button button-accent submit-order" type="submit">Оставить заявку</button></form><p class="checkout-message" role="status" aria-live="polite"></p><div class="order-success" hidden tabindex="-1"><span class="success-symbol" aria-hidden="true">✓</span><p class="eyebrow">ЗАЯВКА СОХРАНЕНА</p><h3>Твой аромат уже ближе.</h3><p>Продавец свяжется с тобой для подтверждения.</p><p class="receipt-code"></p><p class="receipt-total"></p><button type="button" class="button button-glass continue-shopping">Продолжить выбор</button></div></div>`;
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
  const usedMl = (id) =>
    basket
      .filter((i) => i.productId === id)
      .reduce((sum, i) => sum + i.ml * i.quantity, 0);
  function stockProblem() {
    for (const p of products)
      if (usedMl(p.id) > p.availableMl)
        return (
          "Недостаточно «" +
          p.name +
          "»: в корзине " +
          usedMl(p.id) +
          " мл, доступно " +
          p.availableMl +
          " мл. Уменьши количество или удали позицию."
        );
    return "";
  }
  function updateAvailability() {
    document.querySelectorAll("[data-add]").forEach((button) => {
      const p = products.find((p) => p.id === button.dataset.add);
      if (!p) return;
      const card = button.closest(".product-card");
      const select = card.querySelector(".volume-select");
      let available = false;
      for (const option of select.options) {
        option.disabled = Number(option.value) > p.availableMl;
        if (!option.disabled) available = true;
      }
      if (available && select.selectedOptions[0]?.disabled)
        select.value = [...select.options].find((o) => !o.disabled).value;
      select.disabled = !available;
      const canAdd =
        available && usedMl(p.id) + Number(select.value) <= p.availableMl;
      button.disabled = !canAdd;
      button.textContent = !available
        ? "Нет в наличии"
        : !canAdd
          ? "Недостаточно объёма"
          : "В корзину +";
      card.dataset.available = String(available);
      const label = card.querySelector(".product-availability");
      if (label) label.textContent = available ? "В наличии" : "Нет в наличии";
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
      updateAvailability();
      if (success.hidden) render();
    } catch {
      /* Checkout still checks availability on the server. */
    }
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
      } else {
        const mark = el("img", "cart-placeholder");
        mark.src = "/assets/aliden-parfum-logo.svg";
        mark.alt = "Aliden Parfum";
        art.append(mark);
      }
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
      plus.disabled =
        item.quantity >= 20 || usedMl(p.id) + item.ml > p.availableMl;
      minus.onclick = () => {
        item.quantity--;
        changed();
        restoreControl(index, false);
      };
      plus.onclick = () => {
        if (usedMl(p.id) + item.ml > p.availableMl) return;
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
    dialog.querySelector(".cart-stock-warning").textContent = stockProblem();
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
  function open() {
    if (dialog.open) return;
    opener = document.activeElement;
    success.hidden = true;
    list.hidden = false;
    message.textContent = "";
    render();
    dialog.showModal();
    document.body.classList.add("cart-open");
    refreshAvailability();
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
  const nameInput = form.elements.name;
  const nameFeedback = dialog.querySelector("#name-error");
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
    dialog
      .querySelectorAll("button, input")
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
      refreshAvailability();
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
        button
          .closest(".product-card")
          .querySelector(".volume-select")
          .addEventListener("change", updateAvailability);
        button.onclick = () => {
          const productId = button.dataset.add;
          const ml = Number(
            button.closest(".product-card").querySelector(".volume-select")
              .value,
          );
          const product = products.find((p) => p.id === productId);
          if (!product || usedMl(productId) + ml > product.availableMl) {
            notify("Недостаточно объёма в наличии.");
            return;
          }
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
      updateAvailability();
      setInterval(refreshAvailability, 20000);
      window.addEventListener("focus", refreshAvailability);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) refreshAvailability();
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
