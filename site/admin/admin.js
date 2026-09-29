(() => {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const money = (n) => new Intl.NumberFormat("ru-KZ").format(n) + " ₸";
  const date = (value) =>
    new Intl.DateTimeFormat("ru-KZ", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  const statuses = {
    new: "Новый",
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
  const tabLabels = {
    active: "В работе",
    new: "Новые",
    confirmed: "Подтверждённые",
    preparing: "Собираются",
    ready: "Готовые",
    completed: "Выданные",
    cancelled: "Корзина",
    all: "Все",
  };
  const tabs = Object.entries(tabLabels).map(([value, title]) => {
    const button = el("button", "order-tab");
    button.type = "button";
    button.id = "order-tab-" + value;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", "orders-list");
    button.dataset.status = value;
    button.append(el("span", "", title), el("span", "tab-count", "0"));
    button.onclick = () => {
      if (!discardConfirmed()) return;
      activeStatus = value;
      page = 1;
      updateTabs();
      load();
    };
    $(".order-tabs").append(button);
    return button;
  });
  function updateTabs() {
    tabs.forEach((button) => {
      const selected = button.dataset.status === activeStatus;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    $("#orders-list").setAttribute(
      "aria-labelledby",
      "order-tab-" + activeStatus,
    );
  }
  tabs.forEach((button, index) =>
    button.addEventListener("keydown", (event) => {
      const next =
        event.key === "ArrowRight"
          ? (index + 1) % tabs.length
          : event.key === "ArrowLeft"
            ? (index + tabs.length - 1) % tabs.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : null;
      if (next === null) return;
      event.preventDefault();
      tabs[next].focus();
      tabs[next].click();
    }),
  );
  const belongs = (status) =>
    activeStatus === "all" ||
    activeStatus === status ||
    (activeStatus === "active" && !["completed", "cancelled"].includes(status));
  updateTabs();
  function loginState() {
    request++;
    $("#dashboard").hidden = true;
    $(".admin-login").hidden = false;
    $("#orders-list").replaceChildren();
    $(".order-stats").replaceChildren();
  }
  async function api(path, options = {}) {
    const response = await fetch("/api/admin/" + path, {
      ...options,
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) loginState();
      throw new Error(data.error || "Ошибка сервера.");
    }
    return data;
  }
  function whatsappMessage(order) {
    const russianItems = order.items
      .map(
        (item, index) =>
          `${index + 1}. ${item.name}\nОбъём: ${item.ml} мл · Количество: ${item.quantity}\nЦена за 1 шт.: ${money(item.price)} · Сумма: ${money(item.subtotal)}`,
      )
      .join("\n\n");
    const kazakhItems = order.items
      .map(
        (item, index) =>
          `${index + 1}. ${item.name}\nКөлемі: ${item.ml} мл · Саны: ${item.quantity}\nБір данасының бағасы: ${money(item.price)} · Сомасы: ${money(item.subtotal)}`,
      )
      .join("\n\n");
    return `Здравствуйте, ${order.name}! Это BEY Perfume.

Код заказа: ${order.id}
Имя клиента: ${order.name}

${russianItems}

Итого: ${money(order.total)}
Подтверждаете ли вы заказ?

──────────

Сәлеметсіз бе, ${order.name}! Бұл — BEY Perfume.

Тапсырыс коды: ${order.id}
Клиенттің аты: ${order.name}

${kazakhItems}

Жалпы сома: ${money(order.total)}
Тапсырысыңызды растайсыз ба?`;
  }
  function card(order) {
    const article = el("article", "order-card");
    const header = el("div", "order-card-heading");
    const heading = el("div");
    heading.append(
      el("small", "order-code", order.id),
      el("h2", "", order.name),
      el("p", "field-hint", date(order.created_at)),
    );
    const badge = el("span", "status-badge", statuses[order.status]);
    badge.dataset.status = order.status;
    header.append(heading, badge);
    article.append(header);
    const contact = el("div", "order-contact");
    const phone = el("a", "", order.phone);
    phone.href = "tel:" + order.phone;
    const whatsapp = el("a", "text-link", "Написать в WhatsApp ↗");
    whatsapp.href =
      "https://wa.me/" +
      order.phone.replace(/\D/g, "") +
      "?text=" +
      encodeURIComponent(whatsappMessage(order));
    whatsapp.target = "_blank";
    whatsapp.rel = "noopener noreferrer";
    contact.append(phone, whatsapp);
    article.append(contact);
    const items = el("ul", "order-products");
    for (const item of order.items) {
      const li = el("li");
      li.append(
        el("span", "", `${item.name} · ${item.ml} мл × ${item.quantity}`),
        el("strong", "", money(item.subtotal)),
      );
      items.append(li);
    }
    article.append(items);
    const total = el("div", "order-total");
    total.append(
      el("span", "", "Сумма заявки"),
      el("strong", "", money(order.total)),
    );
    article.append(total);
    const form = el("form", "order-edit");
    const statusLabel = el("label", "", "Статус заказа");
    const select = el("select");
    select.name = "status";
    select.setAttribute("aria-label", "Статус заказа");
    for (const [value, title] of Object.entries(statuses)) {
      const option = el("option", "", title);
      option.value = value;
      option.selected = order.status === value;
      select.append(option);
    }
    statusLabel.append(select);
    const noteLabel = el("label", "", "Заметка продавца");
    const note = el("textarea");
    note.name = "note";
    note.maxLength = 1000;
    note.rows = 2;
    note.value = order.note;
    note.placeholder = "Например: заберёт завтра после 18:00";
    noteLabel.append(note);
    const button = el("button", "button button-amber", "Сохранить");
    button.type = "submit";
    const feedback = el("p", "save-feedback");
    feedback.setAttribute("role", "status");
    form.append(statusLabel, noteLabel, button, feedback);
    form.addEventListener("input", () => {
      form.dataset.dirty = "true";
    });
    form.onsubmit = async (event) => {
      event.preventDefault();
      button.disabled = select.disabled = note.disabled = true;
      feedback.textContent = "Сохраняем…";
      try {
        const result = await api("orders/" + order.id, {
          method: "PATCH",
          body: JSON.stringify({
            status: select.value,
            note: note.value,
            version: order.version,
          }),
        });
        order = result.order;
        badge.textContent = statuses[order.status];
        badge.dataset.status = order.status;
        note.value = order.note;
        form.dataset.dirty = "false";
        feedback.textContent = "Сохранено · " + date(order.updated_at);
        // Refresh only summary counters; preserve other unsaved seller notes.
        const summary = await api("orders");
        renderStats(summary.counts);
        if (!belongs(order.status)) {
          // Move only this card if another seller note is unsaved.
          if (document.querySelector('[data-dirty="true"]')) {
            article.remove();
            $("#orders-caption").textContent =
              "Список изменился. Сохрани остальные правки и обнови его.";
          } else await load();
          $("#admin-message").textContent =
            `Заказ ${order.id} перемещён: ${tabLabels[order.status]}.`;
          $("#order-tab-" + activeStatus).focus();
        }
      } catch (error) {
        feedback.textContent = error.message;
      } finally {
        button.disabled = select.disabled = note.disabled = false;
      }
    };
    article.append(form);
    return article;
  }
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
    });
    $(".order-stats").replaceChildren();
    for (const s of ["new", "confirmed", "preparing", "ready"]) {
      const box = el("div");
      box.append(el("span", "", statuses[s]), el("strong", "", counts[s] || 0));
      $(".order-stats").append(box);
    }
  }
  async function load() {
    const turn = ++request;
    $("#admin-message").textContent = "Загружаем заказы…";
    try {
      const params = new URLSearchParams({
        q: $("#order-search").value,
        status: activeStatus,
        page: String(page),
      });
      const data = await api("orders?" + params);
      if (turn !== request) return;
      $(".admin-login").hidden = true;
      $("#dashboard").hidden = false;
      $("#admin-message").textContent = "";
      page = data.page;
      pageCount = data.pageCount;
      renderStats(data.counts);
      $("#orders-list").replaceChildren(...data.orders.map(card));
      if (!data.orders.length)
        $("#orders-list").append(
          el("p", "admin-empty", "Пока нет заказов с такими параметрами."),
        );
      $("#orders-caption").textContent =
        `Найдено: ${data.total} · Обновлено ${new Date().toLocaleTimeString("ru-KZ")}`;
      $("#orders-page").textContent = `${page} / ${pageCount}`;
      $("#orders-prev").disabled = page === 1;
      $("#orders-next").disabled = page === pageCount;
      $(".admin-pagination").hidden = pageCount <= 1;
    } catch (error) {
      if (turn === request || $("#dashboard").hidden)
        $("#admin-message").textContent = error.message;
    }
  }
  function discardConfirmed() {
    return (
      !document.querySelector('[data-dirty="true"]') ||
      confirm(
        "Есть несохранённая заметка или статус. Обновить список без сохранения?",
      )
    );
  }
  $("#login-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      await api("login", {
        method: "POST",
        body: JSON.stringify({
          username: form.elements.username.value,
          password: form.elements.password.value,
        }),
      });
      form.elements.password.value = "";
      page = 1;
      await load();
    } catch (error) {
      $("#admin-message").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
  $("#logout").onclick = async () => {
    if (!discardConfirmed()) return;
    try {
      await api("logout", { method: "POST", body: "{}" });
      loginState();
      $("#admin-message").textContent = "Вы вышли из кабинета.";
    } catch (error) {
      $("#admin-message").textContent = error.message;
    }
  };
  $("#refresh-orders").onclick = () => {
    if (discardConfirmed()) load();
  };
  $("#order-search").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && discardConfirmed()) {
      page = 1;
      load();
    }
  });
  $("#order-search").addEventListener("search", () => {
    if (discardConfirmed()) {
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
      document.querySelector('[data-dirty="true"]') ||
      document.querySelector(".order-edit :disabled") ||
      document.activeElement?.closest(".order-edit, .admin-tools")
    )
      return;
    load();
  }, 20000);
  load();
})();
