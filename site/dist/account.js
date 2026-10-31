// Customer account: sign-in forms for guests, orders/favorites/profile for members.
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const form = $("#account-form"),
    message = $("#account-message"),
    auth = $("#account-auth"),
    dashboard = $("#account-dashboard"),
    loading = $("#account-loading");
  const money = (n) => new Intl.NumberFormat("ru-KZ").format(n) + " ₸";
  const date = (value) =>
    window.arafanDateFormat({
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  const phoneText = (value) => {
    const d = String(value || "").replace(/\D/g, "");
    return d.length === 11
      ? `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`
      : String(value || "");
  };
  const plural = (n, one, few, many) =>
    n % 10 === 1 && n % 100 !== 11
      ? one
      : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
        ? few
        : many;
  // Build DOM nodes; user data always goes through textContent.
  function h(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value == null) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node[key] = value;
      else node.setAttribute(key, value === true ? "" : value);
    }
    node.append(...children.flat().filter((c) => c != null && c !== false));
    return node;
  }
  const svg = (path) => {
    const span = document.createElement("span");
    span.className = "acc-icon";
    span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
    return span;
  };
  async function api(path, body) {
    const r = await fetch("/api/account" + path, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const error = Error(data.error || "Не удалось выполнить запрос.");
      error.status = r.status;
      throw error;
    }
    return data;
  }
  function readFavorites() {
    try {
      const ids = JSON.parse(localStorage.getItem("arafan-favorites") || "[]");
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  }

  // Guest view: sign in or register.
  let mode = "login";
  const tabs = [...document.querySelectorAll("[data-account-view]")];
  function setMode(next, focus = false) {
    mode = next;
    tabs.forEach((tab) => {
      const on = tab.dataset.accountView === mode;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    });
    const register = mode === "register";
    $("#account-name-label").hidden = !register;
    $("#account-password-hint").hidden = !register;
    $("#forgot-password").hidden = register;
    form.elements.name.required = register;
    form.querySelector("[type=submit]").textContent = register
      ? "Создать аккаунт"
      : "Войти";
    form.elements.password.autocomplete = register
      ? "new-password"
      : "current-password";
    message.textContent = "";
    message.classList.remove("is-error");
  }
  tabs.forEach((tab, index) => {
    tab.onclick = () => setMode(tab.dataset.accountView);
    tab.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      setMode(tabs[(index + 1) % tabs.length].dataset.accountView, true);
    };
  });
  function say(text, error = false) {
    message.textContent = text;
    message.classList.toggle("is-error", error);
  }
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    say(mode === "register" ? "Создаём аккаунт…" : "Входим…");
    try {
      const data = await api("/" + mode, {
        name: form.elements.name.value,
        email: form.elements.email.value,
        password: form.elements.password.value,
      });
      form.reset();
      say("");
      await showAccount(data.account);
    } catch (error) {
      say(error.message, true);
    } finally {
      button.disabled = false;
    }
  };
  $("#forgot-password").onclick = async () => {
    if (!form.elements.email.reportValidity()) return;
    try {
      await api("/forgot-password", { email: form.elements.email.value });
      say("Если адрес зарегистрирован, мы отправим инструкции.");
    } catch (error) {
      say(
        error.status === 503
          ? "Восстановление по email пока не подключено. Напишите нам в WhatsApp — поможем войти."
          : error.message,
        true,
      );
    }
  };
  function showGuest() {
    loading.hidden = true;
    dashboard.hidden = true;
    dashboard.replaceChildren();
    auth.hidden = false;
  }

  // Member view.
  const statusLabels = {
    new: "Принят",
    awaiting_payment: "Ожидает оплаты",
    paid: "Оплачен",
    confirmed: "Подтверждён",
    preparing: "Собирается",
    ready: "Готов",
    completed: "Получен",
    cancelled: "Отменён",
  };
  const steps = [
    ["new", "Принят"],
    ["confirmed", "Подтверждён"],
    ["preparing", "Собирается"],
    ["ready", "Готов"],
    ["completed", "Получен"],
  ];
  const stepIndex = (status) =>
    ({ awaiting_payment: 0, paid: 1 })[status] ??
    steps.findIndex(([key]) => key === status);
  let account = null,
    orders = [],
    products = [],
    sets = [],
    activeTab = "orders";
  const productById = (id) => products.find((p) => p.id === id);

  function repeatOrder(order, button) {
    let basket = [];
    try {
      basket = JSON.parse(localStorage.getItem("bey-cart-v1") || "[]");
      if (!Array.isArray(basket)) basket = [];
    } catch {}
    let added = 0,
      skipped = 0;
    for (const item of order.items) {
      if (item.setId) {
        const set = sets.find((s) => s.id === item.setId);
        const current = basket.find((i) => i.setId === item.setId);
        if (!set?.available || (!current && basket.length >= 24)) {
          skipped++;
          continue;
        }
        if (current)
          current.quantity = Math.min(20, current.quantity + item.quantity);
        else
          basket.push({ setId: set.id, quantity: Math.min(20, item.quantity) });
        added++;
        continue;
      }
      const product = productById(item.productId);
      const current = basket.find(
        (i) => i.productId === item.productId && i.ml === item.ml,
      );
      if (
        !product ||
        product.available === false ||
        !product.variants.some((v) => v.ml === item.ml) ||
        (!current && basket.length >= 24)
      ) {
        skipped++;
        continue;
      }
      if (current) current.quantity = Math.min(20, current.quantity + item.quantity);
      else
        basket.push({
          productId: item.productId,
          type: product.type,
          ml: item.ml,
          quantity: Math.min(20, item.quantity),
        });
      added++;
    }
    if (!added) {
      button.textContent = "Ароматы сейчас недоступны";
      button.disabled = true;
      return;
    }
    try {
      localStorage.setItem("bey-cart-v1", JSON.stringify(basket));
      if (skipped)
        sessionStorage.setItem(
          "arafan-repeat-note",
          `Добавлено позиций: ${added}. Недоступно сейчас: ${skipped}.`,
        );
    } catch {}
    location.href = "/cart";
  }

  function orderCard(order) {
    const cancelled = order.status === "cancelled";
    const index = stepIndex(order.status);
    const progress = cancelled
      ? h("p", {
          class: "acc-cancelled",
          text: "Заказ отменён. Если это ошибка, напишите нам — поможем восстановить.",
        })
      : h(
          "ol",
          { class: "acc-progress", "aria-label": "Этапы заказа" },
          steps.map(([, label], i) =>
            h(
              "li",
              {
                class: i < index ? "is-done" : i === index ? "is-current" : "",
                "aria-current": i === index ? "step" : false,
              },
              h("span", { class: "acc-progress-dot", "aria-hidden": "true" }),
              h("span", { text: label }),
            ),
          ),
        );
    const pickup = order.fulfillment === "pickup";
    const items = h(
      "ul",
      { class: "acc-items" },
      order.items.map((item) => {
        const product = item.setId
          ? productById(item.components?.[0]?.productId)
          : productById(item.productId);
        const href = item.setId
          ? "/sets#" + encodeURIComponent(item.setId)
          : `/fragrance?id=${encodeURIComponent(item.productId)}&ml=${item.ml}`;
        return h(
          "li",
          {},
          h(
            "a",
            { class: "acc-item-photo", href, tabindex: "-1", "aria-hidden": "true" },
            product?.image
              ? h("img", {
                  src: "/assets/products/" + product.image,
                  alt: "",
                  width: "80",
                  height: "80",
                  loading: "lazy",
                })
              : null,
          ),
          h(
            "div",
            { class: "acc-item-copy" },
            h("a", { href, text: item.name }),
            h("span", {
              text: item.setId
                ? (item.components || [])
                    .map((c) => `${c.name} ${c.ml} мл`)
                    .join(" · ") + ` · × ${item.quantity}`
                : [
                    item.code,
                    item.type === "razliv" ? "Разлив" : "Распив",
                    `${item.ml} мл × ${item.quantity}`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
            }),
          ),
          h("strong", { text: money(item.subtotal) }),
        );
      }),
    );
    const question = `Здравствуйте! Вопрос по заказу ${order.id}.`;
    const repeat = h("button", {
      type: "button",
      class: "button",
      text: "Повторить заказ",
    });
    repeat.onclick = () => repeatOrder(order, repeat);
    return h(
      "article",
      { class: "acc-order", "data-status": order.status },
      h(
        "div",
        { class: "acc-order-head" },
        h(
          "div",
          {},
          h("p", { class: "acc-order-code", text: "Заказ " + order.id }),
          h("p", { class: "acc-order-date", text: date(order.created_at) }),
        ),
        h("span", {
          class: "acc-status",
          "data-status": order.status,
          text: statusLabels[order.status] || order.status,
        }),
      ),
      progress,
      h(
        "p",
        { class: "acc-fulfillment" },
        h("strong", { text: pickup ? "Самовывоз" : "Доставка" }),
        h("span", {
          text: pickup
            ? "Алматы, Достык, 108Б · 10:00–21:00"
            : order.address || "Адрес уточнит продавец",
        }),
      ),
      items,
      h(
        "div",
        { class: "acc-order-foot" },
        h(
          "p",
          { class: "acc-order-total" },
          h("span", { text: "Итого" }),
          h("strong", { text: money(order.total) }),
        ),
        h(
          "div",
          { class: "acc-order-actions" },
          repeat,
          h("a", {
            class: "button button-glass",
            href:
              "https://wa.me/77472886509?text=" + encodeURIComponent(question),
            target: "_blank",
            rel: "noopener",
            text: "Вопрос по заказу",
          }),
        ),
      ),
    );
  }

  function ordersPanel() {
    if (!orders.length)
      return h(
        "div",
        { class: "acc-empty" },
        h("h3", { text: "Заказов пока нет" }),
        h("p", {
          text: "Оформите заказ, войдя в этот аккаунт, — он появится здесь вместе со статусом.",
        }),
        h("a", { class: "button", href: "/catalog", text: "Перейти в каталог" }),
      );
    return h("div", { class: "acc-orders" }, orders.map(orderCard));
  }

  function favoritesPanel() {
    const saved = readFavorites()
      .map(productById)
      .filter(Boolean);
    if (!saved.length)
      return h(
        "div",
        { class: "acc-empty" },
        h("h3", { text: "В избранном пусто" }),
        h("p", {
          text: "Нажмите на сердечко в карточке аромата, чтобы сохранить его здесь.",
        }),
        h("a", { class: "button", href: "/catalog", text: "Открыть каталог" }),
      );
    return h(
      "div",
      {},
      h(
        "ul",
        { class: "acc-favorites" },
        saved.map((p) =>
          h(
            "li",
            {},
            h(
              "a",
              { href: "/fragrance?id=" + encodeURIComponent(p.id) },
              h(
                "span",
                { class: "acc-favorite-photo" },
                p.image
                  ? h("img", {
                      src: "/assets/products/" + p.image,
                      alt: "",
                      width: "160",
                      height: "160",
                      loading: "lazy",
                    })
                  : null,
              ),
              h("small", { text: p.brand }),
              h("strong", { text: p.name }),
              h("span", {
                text: `от ${money(p.variants[0].price)} за ${p.variants[0].ml} мл`,
              }),
            ),
          ),
        ),
      ),
      h("a", {
        class: "acc-more",
        href: "/favorites",
        text: "Открыть избранное с выбором объёма →",
      }),
    );
  }

  function field(label, input, hint) {
    return h(
      "label",
      {},
      label,
      input,
      hint ? h("span", { class: "acc-hint", text: hint }) : null,
    );
  }
  function feedback() {
    return h("p", { class: "acc-message", role: "status" });
  }
  function profilePanel() {
    const nameInput = h("input", {
      name: "name",
      maxlength: "100",
      required: true,
      autocomplete: "name",
    });
    nameInput.value = account.name || "";
    const nameStatus = feedback();
    const nameForm = h(
      "form",
      { class: "acc-form acc-card" },
      h("h3", { text: "Личные данные" }),
      field("Имя", nameInput),
      field(
        "Электронная почта",
        h("input", { value: account.email, disabled: true }),
        "Email используется для входа и не меняется.",
      ),
      h("button", { class: "button", type: "submit", text: "Сохранить" }),
      nameStatus,
    );
    nameForm.onsubmit = async (event) => {
      event.preventDefault();
      const button = nameForm.querySelector("button");
      button.disabled = true;
      try {
        account = (await api("/profile", { name: nameInput.value })).account;
        nameStatus.textContent = "Имя сохранено.";
        nameStatus.classList.remove("is-error");
        $(".acc-greeting", dashboard).textContent = greeting();
        $(".acc-avatar", dashboard).textContent = initial();
      } catch (error) {
        nameStatus.textContent = error.message;
        nameStatus.classList.add("is-error");
      } finally {
        button.disabled = false;
      }
    };

    const last = orders[0];
    const lastAddress = orders.find((o) => o.address)?.address;
    const contact = h(
      "section",
      { class: "acc-card" },
      h("h3", { text: "Контакты для заказа" }),
      last
        ? h(
            "dl",
            { class: "acc-contact" },
            h("div", {}, h("dt", { text: "Телефон" }), h("dd", { text: phoneText(last.phone) })),
            h(
              "div",
              {},
              h("dt", { text: "Адрес доставки" }),
              h("dd", { text: lastAddress || "Пока не указан — заказы были с самовывозом" }),
            ),
          )
        : null,
      h("p", {
        class: "acc-hint",
        text: last
          ? "Берём из последнего заказа и подставляем в корзину, если поля пустые. Изменить их можно прямо при оформлении."
          : "После первого заказа телефон и адрес будут подставляться в корзину автоматически.",
      }),
    );

    const current = h("input", {
      type: "password",
      required: true,
      autocomplete: "current-password",
      maxlength: "256",
    });
    const next = h("input", {
      type: "password",
      required: true,
      minlength: "10",
      maxlength: "256",
      autocomplete: "new-password",
    });
    const repeat = h("input", {
      type: "password",
      required: true,
      minlength: "10",
      maxlength: "256",
      autocomplete: "new-password",
    });
    const passwordStatus = feedback();
    const passwordForm = h(
      "form",
      { class: "acc-form acc-card" },
      h("h3", { text: "Смена пароля" }),
      field("Текущий пароль", current),
      field("Новый пароль", next, "Не менее 10 символов."),
      field("Повторите новый пароль", repeat),
      h("button", { class: "button", type: "submit", text: "Изменить пароль" }),
      passwordStatus,
    );
    passwordForm.onsubmit = async (event) => {
      event.preventDefault();
      repeat.setCustomValidity(
        repeat.value === next.value ? "" : "Пароли не совпадают.",
      );
      if (!passwordForm.reportValidity()) return;
      const button = passwordForm.querySelector("button");
      button.disabled = true;
      try {
        await api("/password", {
          currentPassword: current.value,
          newPassword: next.value,
        });
        passwordForm.reset();
        passwordStatus.textContent =
          "Пароль изменён. На других устройствах нужно будет войти заново.";
        passwordStatus.classList.remove("is-error");
      } catch (error) {
        passwordStatus.textContent = error.message;
        passwordStatus.classList.add("is-error");
      } finally {
        button.disabled = false;
      }
    };
    repeat.oninput = () => repeat.setCustomValidity("");
    return h("div", { class: "acc-profile-grid" }, nameForm, contact, passwordForm);
  }

  const initial = () =>
    (account.name || account.email).trim().charAt(0).toUpperCase();
  const greeting = () =>
    account.name ? "Здравствуйте, " + account.name : "Здравствуйте!";
  const panels = {
    orders: ["Заказы", ordersPanel],
    favorites: ["Избранное", favoritesPanel],
    profile: ["Профиль", profilePanel],
  };
  function renderDashboard() {
    const active = orders.filter(
      (o) => !["completed", "cancelled"].includes(o.status),
    ).length;
    const favorites = readFavorites().filter(productById).length;
    const logout = h("button", {
      type: "button",
      class: "button button-glass",
      text: "Выйти",
    });
    logout.onclick = async () => {
      logout.disabled = true;
      try {
        await api("/logout", {});
        account = null;
        showGuest();
        say("Вы вышли из аккаунта.");
      } catch (error) {
        logout.disabled = false;
        alert(error.message);
      }
    };
    const stat = (value, label, tab) => {
      const button = h(
        "button",
        { type: "button", class: "acc-stat" },
        h("strong", { text: String(value) }),
        h("span", { text: label }),
      );
      button.onclick = () => select(tab, true);
      return button;
    };
    const tablist = h("div", {
      class: "acc-tabs",
      role: "tablist",
      "aria-label": "Разделы личного кабинета",
    });
    const panel = h("div", { class: "acc-panel", role: "tabpanel", tabindex: "0" });
    const keys = Object.keys(panels);
    const buttons = keys.map((key, index) => {
      const button = h("button", {
        type: "button",
        role: "tab",
        id: "acc-tab-" + key,
        "aria-controls": "acc-panel",
        text: panels[key][0],
      });
      button.onclick = () => select(key);
      button.onkeydown = (event) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        select(keys[(index + step + keys.length) % keys.length], false, true);
      };
      return button;
    });
    panel.id = "acc-panel";
    tablist.append(...buttons);
    function select(key, scroll = false, focus = false) {
      activeTab = key;
      buttons.forEach((button, i) => {
        const on = keys[i] === key;
        button.setAttribute("aria-selected", String(on));
        button.tabIndex = on ? 0 : -1;
        if (on && focus) button.focus();
      });
      panel.setAttribute("aria-labelledby", "acc-tab-" + key);
      panel.replaceChildren(panels[key][1]());
      if (location.hash !== "#" + key)
        history.replaceState(null, "", "#" + key);
      if (scroll) tablist.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    dashboard.replaceChildren(
      h(
        "div",
        { class: "acc-hero" },
        h("span", { class: "acc-avatar", "aria-hidden": "true", text: initial() }),
        h(
          "div",
          { class: "acc-hero-copy" },
          h("h2", { class: "acc-greeting", text: greeting() }),
          h("p", { text: account.email }),
        ),
        logout,
      ),
      h(
        "div",
        { class: "acc-stats" },
        stat(orders.length, plural(orders.length, "заказ", "заказа", "заказов"), "orders"),
        stat(active, "в работе", "orders"),
        stat(favorites, "в избранном", "favorites"),
      ),
      tablist,
      panel,
    );
    select(panels[location.hash.slice(1)] ? location.hash.slice(1) : activeTab);
  }

  async function showAccount(next) {
    account = next;
    if (!account) return showGuest();
    loading.hidden = false;
    auth.hidden = true;
    const [orderData, productData] = await Promise.all([
      api("/orders").catch(() => ({ orders: [] })),
      fetch("/api/products")
        .then((r) => (r.ok ? r.json() : { products: [] }))
        .catch(() => ({ products: [] })),
    ]);
    orders = orderData.orders || [];
    products = productData.products || [];
    sets = productData.sets || [];
    loading.hidden = true;
    dashboard.hidden = false;
    renderDashboard();
  }
  window.addEventListener("storage", (event) => {
    if (event.key === "arafan-favorites" && account && !dashboard.hidden)
      renderDashboard();
  });
  api("")
    .then((data) => showAccount(data.account))
    .catch((error) => {
      showGuest();
      say(error.message, true);
    });
})();
