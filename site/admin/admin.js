(() => {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const svg = (paths) => {
    const ns = "http://www.w3.org/2000/svg";
    const icon = document.createElementNS(ns, "svg");
    icon.setAttribute("width", "18");
    icon.setAttribute("height", "18");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "1.8");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    for (const d of paths) {
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", d);
      icon.append(path);
    }
    return icon;
  };
  const phoneText = (phone) => {
    const d = String(phone).replace(/\D/g, "");
    return /^7\d{10}$/.test(d)
      ? `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`
      : phone;
  };
  const money = (n) => new Intl.NumberFormat("ru-KZ").format(n) + " ₸";
  const date = (value) =>
    new Intl.DateTimeFormat("ru-KZ", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  const statuses = {
    new: "Новый",
    awaiting_payment: "Ожидает оплаты",
    paid: "Оплачен",
    confirmed: "Подтверждён",
    preparing: "Собирается",
    ready: "Готов",
    completed: "Выдан",
    cancelled: "Отменён",
  };
  let page = 1,
    pageCount = 1,
    request = 0;
  let activeStatus = "active";
  let toastTimer = 0;

  // Short notices for the seller (also announced by screen readers).
  function notify(text, tone = "info") {
    const box = $("#admin-message");
    clearTimeout(toastTimer);
    box.dataset.tone = tone;
    box.textContent = text;
    if (text) toastTimer = setTimeout(() => (box.textContent = ""), 6000);
  }
  function loginMessage(text, tone = "info") {
    const box = $("#login-message");
    box.dataset.tone = tone;
    box.textContent = text;
  }
  const ordersDirty = () =>
    document.querySelector('.order-edit[data-dirty="true"]');

  /* ---------- Sections: «Заказы» / «Товары и цены» ---------- */
  const sectionTabs = [...document.querySelectorAll(".section-switch [role=tab]")];
  const sectionNames = sectionTabs.map((tab) => tab.dataset.section);
  const sectionFromHash = () => {
    const name = location.hash.slice(1);
    return sectionNames.includes(name) ? name : "orders";
  };
  let section = "orders";
  function showSection(name, { focus = false, remember = true } = {}) {
    section = sectionNames.includes(name) ? name : "orders";
    for (const tab of sectionTabs) {
      const selected = tab.dataset.section === section;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      $("#" + tab.getAttribute("aria-controls")).hidden = !selected;
      if (selected && focus) tab.focus();
      if (selected)
        tab.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
    if (remember && location.hash !== "#" + section)
      history.replaceState(null, "", "#" + section);
    document.dispatchEvent(
      new CustomEvent("admin:section", { detail: section }),
    );
  }
  sectionTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showSection(tab.dataset.section));
    tab.addEventListener("keydown", (event) => {
      const keys = { ArrowRight: 1, ArrowLeft: -1 };
      if (!(event.key in keys) && !["Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? sectionTabs.length - 1
            : (index + keys[event.key] + sectionTabs.length) %
              sectionTabs.length;
      showSection(sectionTabs[next].dataset.section, { focus: true });
    });
  });
  showSection(sectionFromHash(), {
    remember: false,
  });
  window.addEventListener("hashchange", () => {
    const wanted = sectionFromHash();
    if (wanted !== section) showSection(wanted, { remember: false });
  });

  /* ---------- Order status tabs ---------- */
  const tabLabels = {
    active: "В работе",
    new: "Новые",
    awaiting_payment: "Ожидают оплаты",
    paid: "Оплаченные",
    confirmed: "Подтверждённые",
    preparing: "Собираются",
    ready: "Готовые",
    completed: "Выданные",
    cancelled: "Корзина",
    all: "Все",
  };
  function selectStatus(value) {
    if (!discardConfirmed()) return;
    activeStatus = value;
    page = 1;
    updateTabs();
    load();
  }
  const tabs = Object.entries(tabLabels).map(([value, title]) => {
    const button = el("button", "order-tab");
    button.type = "button";
    button.id = "order-tab-" + value;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", "orders-list");
    button.dataset.status = value;
    button.append(el("span", "", title), el("span", "tab-count", "0"));
    button.onclick = () => selectStatus(value);
    $(".order-tabs").append(button);
    return button;
  });
  function updateTabs() {
    tabs.forEach((button) => {
      const selected = button.dataset.status === activeStatus;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected)
        button.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    });
    document
      .querySelectorAll(".stat-tile")
      .forEach((tile) =>
        tile.setAttribute(
          "aria-pressed",
          String(tile.dataset.status === activeStatus),
        ),
      );
    $("#orders-list").setAttribute(
      "aria-labelledby",
      "order-tab-" + activeStatus,
    );
  }
  tabs.forEach((button) =>
    button.addEventListener("keydown", (event) => {
      const shown = tabs.filter((tab) => !tab.hidden);
      const index = shown.indexOf(button);
      const next =
        event.key === "ArrowRight"
          ? (index + 1) % shown.length
          : event.key === "ArrowLeft"
            ? (index + shown.length - 1) % shown.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? shown.length - 1
                : null;
      if (next === null) return;
      event.preventDefault();
      shown[next].focus();
      shown[next].click();
    }),
  );
  const belongs = (status) =>
    activeStatus === "all" ||
    activeStatus === status ||
    (activeStatus === "active" && !["completed", "cancelled"].includes(status));

  // KPI tiles double as shortcuts to the matching status tab.
  const statTiles = ["new", "confirmed", "preparing", "ready"].map((s) => {
    const tile = el("button", "stat-tile");
    tile.type = "button";
    tile.dataset.status = s;
    tile.setAttribute("aria-pressed", "false");
    tile.append(
      el("span", "stat-label", statuses[s]),
      el("strong", "stat-value", "—"),
    );
    tile.onclick = () => selectStatus(s);
    $(".order-stats").append(tile);
    return tile;
  });
  updateTabs();

  function setView(view) {
    document.body.dataset.view = view;
    $(".admin-login").hidden = view !== "login";
    $("#dashboard").hidden = view !== "app";
  }
  function loginState() {
    request++;
    setView("login");
    $("#orders-list").replaceChildren();
    orders = [];
    closePanel(true);
    statTiles.forEach((tile) => (tile.lastChild.textContent = "—"));
    document.dispatchEvent(new CustomEvent("admin:logout"));
  }
  async function api(path, options = {}) {
    const response = await fetch("/api/admin/" + path, {
      ...options,
      headers: { "Content-Type": "application/json" },
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      if (response.ok) throw new Error("Сервер вернул неожиданный ответ.");
    }
    if (!response.ok) {
      if (response.status === 401 && path !== "login") {
        const wasInside = document.body.dataset.view === "app";
        loginState();
        if (wasInside) loginMessage("Сессия завершилась. Войдите снова.");
      }
      throw Object.assign(new Error(data.error || "Ошибка сервера."), {
        status: response.status,
      });
    }
    return data;
  }
  // Product lines keep their original wording; set lines list their contents.
  const isSet = (item) => item.type === "set" || !!item.setId;
  const componentsText = (item) =>
    (item.components || [])
      .map(
        (c) => `   – ${c.code ? c.code + " · " : ""}${c.name}, ${c.ml} мл`,
      )
      .join("\n");
  function whatsappMessage(order) {
    const russianItems = order.items
      .map((item, index) =>
        isSet(item)
          ? `${index + 1}. ${item.name} (набор)\nСостав:\n${componentsText(item)}\nКоличество: ${item.quantity}\nЦена за 1 набор: ${money(item.price)} · Сумма: ${money(item.subtotal)}`
          : `${index + 1}. ${item.code ? item.code + " · " : ""}${item.name} (${item.type === "razliv" ? "разлив" : "распив"})\nОбъём: ${item.ml} мл · Количество: ${item.quantity}\nЦена за 1 шт.: ${money(item.price)} · Сумма: ${money(item.subtotal)}`,
      )
      .join("\n\n");
    const kazakhItems = order.items
      .map((item, index) =>
        isSet(item)
          ? `${index + 1}. ${item.name} (жиынтық)\nҚұрамы:\n${componentsText(item)}\nСаны: ${item.quantity}\nБір жиынтықтың бағасы: ${money(item.price)} · Сомасы: ${money(item.subtotal)}`
          : `${index + 1}. ${item.code ? item.code + " · " : ""}${item.name} (${item.type === "razliv" ? "разлив" : "распив"})\nКөлемі: ${item.ml} мл · Саны: ${item.quantity}\nБір данасының бағасы: ${money(item.price)} · Сомасы: ${money(item.subtotal)}`,
      )
      .join("\n\n");
    return `Здравствуйте, ${order.name}! Это ARAFAN Perfume.

Код заказа: ${order.id}
Имя клиента: ${order.name}
Получение: ${order.fulfillment === "pickup" ? "Самовывоз — Достык, 108Б, 10:00–21:00" : "Доставка"}
${order.address ? "Адрес: " + order.address : ""}

${russianItems}

Итого: ${money(order.total)}
Подтверждаете ли вы заказ?

──────────

Сәлеметсіз бе, ${order.name}! Бұл — ARAFAN Perfume.

Тапсырыс коды: ${order.id}
Клиенттің аты: ${order.name}
Алу тәсілі: ${order.fulfillment === "pickup" ? "Дүкеннен алып кету — Достық, 108Б, 10:00–21:00" : "Жеткізу"}
${order.address ? "Мекенжай: " + order.address : ""}

${kazakhItems}

Жалпы сома: ${money(order.total)}
Тапсырысыңызды растайсыз ба?`;
  }
  function itemsTable(items) {
    const table = el("table", "order-items");
    const head = el("thead");
    const headRow = el("tr");
    for (const title of ["Код", "Аромат", "Объём × кол-во", "Сумма"]) {
      const th = el("th", "", title);
      th.scope = "col";
      headRow.append(th);
    }
    head.append(headRow);
    const body = el("tbody");
    for (const item of items) {
      const set = isSet(item);
      const type = set ? "Набор" : item.type === "razliv" ? "Разлив" : "Распив";
      const row = el("tr");
      if (set) row.className = "item-set";
      const name = el("td", "item-name");
      if (item.code)
        name.append(el("span", "item-code item-code-inline", item.code + " · "));
      name.append(
        document.createTextNode(item.name),
        el("span", "item-type", type),
      );
      if (set && item.components?.length) {
        const list = el("ul", "item-components");
        for (const c of item.components)
          list.append(
            el("li", "", `${c.code ? c.code + " · " : ""}${c.name} · ${c.ml} мл`),
          );
        name.append(list);
      }
      row.append(
        el("td", "item-code", item.code || "—"),
        name,
        el(
          "td",
          "item-qty",
          set ? `× ${item.quantity}` : `${item.ml} мл × ${item.quantity}`,
        ),
        el("td", "item-sum", money(item.subtotal)),
      );
      body.append(row);
    }
    table.append(head, body);
    return table;
  }
  /* ---------- Orders list + side panel (same pattern as products) ---------- */
  const panel = $("#order-editor");
  const narrow = matchMedia("(max-width: 1180px)");
  let orders = [];
  let openId = null;
  let openOrder = null;
  let returnFocus = null;
  let backdrop = null;
  const icons = {
    phone:
      "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
    comment: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    note: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  };
  const shortDate = (value) =>
    new Intl.DateTimeFormat("ru-KZ", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  const pieces = (order) =>
    order.items.reduce((sum, item) => sum + item.quantity, 0);
  const fulfillmentName = (order) =>
    order.fulfillment === "pickup" ? "Самовывоз" : "Доставка";
  function marker(kind, title) {
    const span = el("span", "o-marker");
    span.dataset.kind = kind;
    span.title = title;
    const icon = svg([icons[kind]]);
    icon.setAttribute("width", "14");
    icon.setAttribute("height", "14");
    span.append(icon, el("span", "visually-hidden", title));
    return span;
  }
  function orderRow(order) {
    const button = el("button", "order-row");
    button.type = "button";
    button.dataset.id = order.id;
    button.dataset.status = order.status;
    if (order.id === openId) button.setAttribute("aria-current", "true");
    const id = el("span", "o-id");
    // Short codes (ARF-301026-07) are read out loud; legacy ones are long.
    id.dataset.long = String(order.id.length > 14);
    id.append(
      el("span", "order-code", order.id),
      el("small", "o-date", shortDate(order.created_at)),
    );
    const who = el("span", "o-who");
    const name = el("strong");
    name.append(el("span", "o-name", order.name));
    if (order.comment) name.append(marker("comment", "Есть комментарий покупателя"));
    if (order.note) name.append(marker("note", "Есть заметка продавца"));
    who.append(name, el("small", "o-phone", phoneText(order.phone)));
    const ful = el("span", "o-ful");
    const pill = el("span", "pill", fulfillmentName(order));
    pill.dataset.kind = order.fulfillment === "pickup" ? "pickup" : "delivery";
    ful.append(pill);
    const total = el("span", "o-total");
    total.append(
      el("strong", "", money(order.total)),
      el("small", "", pieces(order) + " шт."),
    );
    const status = el("span", "o-status");
    const badge = el("span", "status-badge", statuses[order.status]);
    badge.dataset.status = order.status;
    status.append(badge);
    button.append(id, who, ful, total, status);
    button.setAttribute(
      "aria-label",
      [
        "Заказ " + order.id,
        date(order.created_at),
        order.name,
        phoneText(order.phone),
        fulfillmentName(order),
        pieces(order) + " шт. на " + money(order.total),
        "статус: " + statuses[order.status],
        order.comment ? "есть комментарий покупателя" : "",
        order.note ? "есть заметка продавца" : "",
      ]
        .filter(Boolean)
        .join(", "),
    );
    button.onclick = () => openPanel(order.id, button);
    return button;
  }
  function listHead() {
    const head = el("div", "orders-head");
    head.setAttribute("aria-hidden", "true");
    for (const title of ["Заказ", "Покупатель", "Получение", "Сумма", "Статус"])
      head.append(el("span", "", title));
    return head;
  }
  function markOpenRow() {
    document.querySelectorAll(".order-row").forEach((row) => {
      if (row.dataset.id === openId) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    });
  }
  function replaceRow(order) {
    const row = document.querySelector(
      `.order-row[data-id="${CSS.escape(order.id)}"]`,
    );
    if (!row) return;
    const focused = document.activeElement === row;
    const fresh = orderRow(order);
    row.replaceWith(fresh);
    if (focused) fresh.focus();
  }
  function setSheet(open) {
    if (open && narrow.matches) {
      panel.dataset.open = "true";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      if (!backdrop) {
        backdrop = el("div", "editor-backdrop");
        backdrop.onclick = () => closePanel();
      }
      panel.before(backdrop);
      document.body.style.overflow = "hidden";
    } else {
      panel.dataset.open = "false";
      panel.removeAttribute("role");
      panel.removeAttribute("aria-modal");
      backdrop?.remove();
      document.body.style.overflow = "";
    }
  }
  function openPanel(id, origin) {
    if (
      id !== openId &&
      ordersDirty() &&
      !confirm(
        "Есть несохранённые изменения заказа. Открыть другой заказ без сохранения?",
      )
    )
      return;
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    openId = id;
    returnFocus = origin || null;
    markOpenRow();
    drawPanel(order);
    setSheet(true);
    panel.querySelector("h2")?.focus();
  }
  function closePanel(force = false) {
    if (
      !force &&
      ordersDirty() &&
      !confirm("Есть несохранённые изменения заказа. Закрыть без сохранения?")
    )
      return;
    const wasOpen = panel.dataset.open === "true";
    const id = openId;
    setSheet(false);
    if (narrow.matches || force) {
      openId = null;
      openOrder = null;
      markOpenRow();
      drawEmptyPanel();
    }
    if (wasOpen) {
      const row = document.querySelector(
        `.order-row[data-id="${CSS.escape(id || "")}"]`,
      );
      (row || (returnFocus?.isConnected ? returnFocus : $("#orders-list"))).focus();
    }
  }
  function drawEmptyPanel() {
    const box = el("div", "editor-empty");
    const h2 = el("h2", "", "Карточка заказа");
    h2.id = "order-editor-title";
    box.append(
      h2,
      el(
        "p",
        "muted",
        "Выберите заказ в списке, чтобы связаться с покупателем и изменить статус.",
      ),
    );
    panel.replaceChildren(box);
  }
  function drawPanel(order, message) {
    openOrder = order;
    const head = el("div", "editor-head");
    const titleBox = el("div");
    const tags = el("div", "editor-tags");
    const badge = el("span", "status-badge", statuses[order.status]);
    badge.dataset.status = order.status;
    tags.append(el("span", "order-code", order.id), badge);
    const h2 = el("h2", "", order.name);
    h2.id = "order-editor-title";
    h2.tabIndex = -1;
    titleBox.append(tags, h2, el("small", "", date(order.created_at)));
    const close = el("button", "editor-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Закрыть заказ");
    close.onclick = () => closePanel();
    head.append(titleBox, close);

    const info = el("div", "order-info");
    const contact = el("div", "order-contact");
    const phone = el("a", "contact-phone");
    phone.href = "tel:" + order.phone;
    phone.append(svg([icons.phone]), document.createTextNode(phoneText(order.phone)));
    phone.setAttribute("aria-label", "Позвонить: " + phoneText(order.phone));
    const whatsapp = el("a", "btn btn-whatsapp");
    whatsapp.append(
      svg([
        "M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3z",
        "M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z",
      ]),
      document.createTextNode("WhatsApp ↗"),
    );
    whatsapp.setAttribute(
      "aria-label",
      "Написать покупателю в WhatsApp (откроется в новой вкладке)",
    );
    whatsapp.href =
      "https://wa.me/" +
      order.phone.replace(/\D/g, "") +
      "?text=" +
      encodeURIComponent(whatsappMessage(order));
    whatsapp.target = "_blank";
    whatsapp.rel = "noopener noreferrer";
    contact.append(phone, whatsapp);
    info.append(contact);

    const fulfillment = el("div", "order-fulfillment");
    const pickup = order.fulfillment === "pickup";
    const pill = el("span", "pill", fulfillmentName(order));
    pill.dataset.kind = pickup ? "pickup" : "delivery";
    fulfillment.append(
      pill,
      el(
        "span",
        "order-address",
        pickup
          ? "Достык, 108Б · 10:00–21:00"
          : order.address || "Адрес не указан",
      ),
    );
    info.append(fulfillment);
    if (order.comment) {
      const comment = el("p", "order-comment");
      comment.append(
        el("b", "", "Комментарий покупателя"),
        document.createTextNode(order.comment),
      );
      info.append(comment);
    }
    info.append(itemsTable(order.items));
    const total = el("div", "order-total");
    total.append(
      el("span", "", `Итого · ${pieces(order)} шт.`),
      el("strong", "", money(order.total)),
    );
    info.append(total);

    const form = el("form", "order-edit");
    const statusLabel = el("label", "field");
    const select = el("select");
    select.name = "status";
    for (const [value, title] of Object.entries(statuses)) {
      const option = el(
        "option",
        "",
        value === "paid" ? title + " (оплата не подключена)" : title,
      );
      option.value = value;
      option.selected = order.status === value;
      if (value === "paid") option.disabled = true;
      select.append(option);
    }
    statusLabel.append(el("span", "field-label", "Статус заказа"), select);
    const noteLabel = el("label", "field");
    const note = el("textarea");
    note.name = "note";
    note.maxLength = 1000;
    note.rows = 3;
    note.value = order.note;
    note.placeholder = "Например: заберёт завтра после 18:00";
    noteLabel.append(el("span", "field-label", "Заметка продавца"), note);
    const actions = el("div", "form-actions");
    const button = el("button", "btn btn-primary", "Сохранить");
    button.type = "submit";
    const feedback = el("p", "save-feedback");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    if (message) {
      feedback.dataset.tone = message.tone;
      feedback.textContent = message.text;
    }
    actions.append(button, feedback);
    form.append(statusLabel, noteLabel, actions);
    form.addEventListener("input", () => {
      form.dataset.dirty = "true";
      feedback.textContent = "Есть несохранённые изменения";
      feedback.dataset.tone = "";
    });
    form.onsubmit = async (event) => {
      event.preventDefault();
      button.disabled = select.disabled = note.disabled = true;
      feedback.dataset.tone = "";
      feedback.textContent = "Сохраняем…";
      let saved = null;
      try {
        const result = await api("orders/" + order.id, {
          method: "PATCH",
          body: JSON.stringify({
            status: select.value,
            note: note.value,
            version: order.version,
          }),
        });
        saved = result.order;
        form.dataset.dirty = "false";
        const index = orders.findIndex((o) => o.id === saved.id);
        if (index >= 0) orders[index] = saved;
        const moved = !belongs(saved.status);
        drawPanel(saved, {
          tone: "success",
          text:
            "Сохранено · " +
            date(saved.updated_at) +
            (moved ? ` · перенесён в «${tabLabels[saved.status]}»` : ""),
        });
        panel.querySelector(".order-edit .btn-primary")?.focus();
        if (moved) {
          notify(`Заказ ${saved.id} перемещён: ${tabLabels[saved.status]}.`);
          await load();
        } else {
          replaceRow(saved);
          // Refresh only the summary counters.
          const summary = await api("orders");
          renderStats(summary.counts);
        }
      } catch (error) {
        if (saved || document.body.dataset.view !== "app") return;
        feedback.dataset.tone = "error";
        feedback.textContent = error.message;
        if (error.status === 409 && !form.querySelector(".reload-order")) {
          const reload = el(
            "button",
            "btn btn-secondary reload-order",
            "Загрузить актуальные данные",
          );
          reload.type = "button";
          reload.onclick = async () => {
            form.dataset.dirty = "false";
            await load();
            const fresh = orders.find((o) => o.id === order.id);
            if (fresh) drawPanel(fresh);
            else
              feedback.textContent =
                "Заказ не найден в текущем списке. Откройте нужную вкладку и обновите.";
          };
          actions.append(reload);
        }
      } finally {
        if (form.isConnected)
          button.disabled = select.disabled = note.disabled = false;
      }
    };
    const body = el("div", "order-panel-body");
    body.append(info, form);
    panel.replaceChildren(head, body);
  }
  // Keep an open, untouched order in sync with freshly loaded data.
  function syncPanel() {
    if (!openId || !openOrder || ordersDirty()) return;
    // Never redraw under a seller who is typing or choosing a status.
    if (document.activeElement?.matches(".order-edit select, .order-edit textarea"))
      return;
    const fresh = orders.find((o) => o.id === openId);
    if (fresh && fresh.version !== openOrder.version) {
      const hadFocus = panel.contains(document.activeElement);
      drawPanel(fresh, {
        tone: "",
        text: "Заказ обновлён · " + date(fresh.updated_at),
      });
      if (hadFocus) panel.querySelector("h2")?.focus();
    }
  }
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel.dataset.open === "true") {
      event.preventDefault();
      closePanel();
    }
  });
  narrow.addEventListener("change", () => {
    if (!narrow.matches && panel.dataset.open === "true") setSheet(false);
  });
  document.addEventListener("admin:section", (event) => {
    // Leaving «Заказы» hides the sheet without discarding the draft.
    if (event.detail !== "orders" && panel.dataset.open === "true")
      setSheet(false);
  });
  function renderStats(counts) {
    const all = Object.values(counts).reduce((sum, count) => sum + count, 0);
    tabs.forEach((button) => {
      const status = button.dataset.status;
      button.querySelector(".tab-count").textContent =
        status === "all"
          ? all
          : status === "active"
            ? all - (counts.completed || 0) - (counts.cancelled || 0)
            : counts[status] || 0;
      // Kaspi payment is not connected yet: show payment tabs only when used.
      if (["awaiting_payment", "paid"].includes(status))
        button.hidden = !counts[status] && activeStatus !== status;
    });
    statTiles.forEach(
      (tile) => (tile.lastChild.textContent = counts[tile.dataset.status] || 0),
    );
  }
  function stateBox(title, text, tone) {
    const box = el("div", "state-box");
    if (tone) box.dataset.tone = tone;
    box.append(el("strong", "", title));
    if (text) box.append(el("span", "", text));
    return box;
  }
  async function load() {
    const turn = ++request;
    const list = $("#orders-list");
    // Remember a focused row before `inert` drops focus, to restore it later.
    const focusedId = document.activeElement?.closest?.(".order-row")?.dataset
      .id;
    list.inert = true;
    list.setAttribute("aria-busy", "true");
    if (document.body.dataset.view === "app")
      $("#orders-caption").textContent = "Обновляем список…";
    try {
      const params = new URLSearchParams({
        q: $("#order-search").value,
        status: activeStatus,
        page: String(page),
      });
      const data = await api("orders?" + params);
      if (turn !== request) return;
      if (document.body.dataset.view !== "app") {
        setView("app");
        loginMessage("");
        document.dispatchEvent(new CustomEvent("admin:ready"));
      }
      page = data.page;
      pageCount = data.pageCount;
      renderStats(data.counts);
      orders = data.orders;
      list.replaceChildren(
        ...(orders.length ? [listHead()] : []),
        ...orders.map(orderRow),
      );
      syncPanel();
      if (!data.orders.length)
        list.append(
          $("#order-search").value.trim()
            ? stateBox(
                "Ничего не найдено",
                "Проверьте код заказа, имя или телефон.",
              )
            : stateBox(
                "Заказов нет",
                "Здесь появятся заказы с выбранным статусом.",
              ),
        );
      $("#orders-caption").textContent =
        `Найдено: ${data.total} · Обновлено в ${new Date().toLocaleTimeString("ru-KZ", { hour: "2-digit", minute: "2-digit" })}`;
      $("#orders-page").textContent = `${page} из ${pageCount}`;
      $("#orders-prev").disabled = page === 1;
      $("#orders-next").disabled = page === pageCount;
      $(".admin-pagination").hidden = pageCount <= 1;
    } catch (error) {
      if (turn !== request && document.body.dataset.view !== "login") return;
      if (document.body.dataset.view === "app") {
        $("#orders-caption").textContent = "";
        notify(error.message, "error");
      } else {
        // First visit without a session: show the login form quietly.
        setView("login");
        if (error.status !== 401) loginMessage(error.message, "error");
      }
    } finally {
      if (turn === request) {
        list.inert = false;
        list.setAttribute("aria-busy", "false");
        if (
          focusedId &&
          (document.activeElement === document.body || !document.activeElement)
        )
          document
            .querySelector(`.order-row[data-id="${CSS.escape(focusedId)}"]`)
            ?.focus();
      }
    }
  }
  // The open order lives in its own panel, so reloading, filtering or paging
  // the list never discards an unsaved draft there.
  const discardConfirmed = () => true;
  $("#login-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    const { username, password } = form.elements;
    username.removeAttribute("aria-invalid");
    password.removeAttribute("aria-invalid");
    if (!username.value.trim() || !password.value) {
      const empty = !username.value.trim() ? username : password;
      empty.setAttribute("aria-invalid", "true");
      loginMessage("Введите логин и пароль.", "error");
      empty.focus();
      return;
    }
    button.disabled = true;
    loginMessage("Проверяем…");
    try {
      await api("login", {
        method: "POST",
        body: JSON.stringify({
          username: username.value,
          password: password.value,
        }),
      });
      password.value = "";
      page = 1;
      await load();
      scrollTo(0, 0);
      $("#workspace").focus({ preventScroll: true });
    } catch (error) {
      loginMessage(error.message, "error");
      if (error.status === 401) {
        password.setAttribute("aria-invalid", "true");
        password.select();
      }
    } finally {
      button.disabled = false;
    }
  };
  $("#logout").onclick = async () => {
    if (
      document.querySelector('[data-dirty="true"]') &&
      !confirm("Есть несохранённые изменения. Выйти без сохранения?")
    )
      return;
    try {
      await api("logout", { method: "POST", body: "{}" });
      document
        .querySelectorAll('[data-dirty="true"]')
        .forEach((form) => (form.dataset.dirty = "false"));
      loginState();
      loginMessage("Вы вышли из кабинета.");
    } catch (error) {
      notify(error.message, "error");
    }
  };
  $("#refresh-orders").onclick = () => {
    if (discardConfirmed()) load();
  };
  $("#orders-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (discardConfirmed()) {
      page = 1;
      load();
    }
  });
  $("#order-search").addEventListener("search", () => {
    // Fired when the field is cleared with the × button.
    if (!$("#order-search").value && discardConfirmed()) {
      page = 1;
      load();
    }
  });
  $("#orders-prev").onclick = () => {
    if (page > 1 && discardConfirmed()) {
      page--;
      load();
    }
  };
  $("#orders-next").onclick = () => {
    if (page < pageCount && discardConfirmed()) {
      page++;
      load();
    }
  };
  window.addEventListener("beforeunload", (event) => {
    if (document.querySelector('[data-dirty="true"]')) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      loginState();
      load();
    }
  });
  // Keep incoming orders in sync without replacing a seller's unfinished edit.
  setInterval(() => {
    if (
      document.hidden ||
      $("#dashboard").hidden ||
      ordersDirty() ||
      // (the always-disabled «Оплачен» option must not count as "saving")
      document.querySelector(".order-edit :is(button, select, textarea):disabled") ||
      document.activeElement?.closest(".order-edit, #orders-search-form")
    )
      return;
    load();
  }, 20000);
  // Shared helpers for products.js (loaded after this script).
  window.adminKit = {
    api,
    notify,
    money,
    section: () => section,
    loggedIn: () => document.body.dataset.view === "app",
  };
  load();
})();
