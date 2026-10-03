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
  let section = "orders";
  let stockRequest = 0;
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
    stockRequest++;
    $("#inventory-list").replaceChildren();
    $("#inventory-history").replaceChildren();
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
    return `Здравствуйте, ${order.name}! Это LAGUNA.

Код заказа: ${order.id}
Имя клиента: ${order.name}

${russianItems}

Итого: ${money(order.total)}
Подтверждаете ли вы заказ?

──────────

Сәлеметсіз бе, ${order.name}! Бұл — LAGUNA.

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
    const stockHint = el("p", "field-hint order-stock-state");
    const returnButton = el(
      "button",
      "button button-glass",
      "Вернуть объём на склад",
    );
    returnButton.type = "button";
    const stockText = () => {
      stockHint.textContent = {
        pending: "Объём ещё не списан.",
        deducted:
          "Объём списан. При отмене возврат выполняется вручную после фактического возврата товара.",
        returned: "Объём возвращён на склад.",
        legacy:
          "Заказ создан до учёта склада. В начальном остатке учитывайте его вручную.",
      }[order.inventory_state];
      returnButton.hidden =
        order.status !== "cancelled" || order.inventory_state !== "deducted";
    };
    stockText();
    returnButton.onclick = async () => {
      if (
        !discardConfirmed() ||
        !confirm(
          "Объём из этого заказа фактически вернулся на склад? Вернуть его в доступный остаток?",
        )
      )
        return;
      returnButton.disabled = true;
      try {
        await api("orders/" + order.id + "/return-stock", {
          method: "POST",
          body: JSON.stringify({ version: order.version }),
        });
        await load();
      } catch (error) {
        stockHint.textContent = error.message;
      } finally {
        returnButton.disabled = false;
      }
    };
    article.append(stockHint, returnButton);
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
    const paymentLabel = el("label", "payment-check");
    const payment = el("input");
    payment.type = "checkbox";
    payment.name = "paymentConfirmed";
    paymentLabel.append(
      payment,
      el(
        "span",
        "",
        "Оплата проверена. Подтверждаю списание объёма со склада.",
      ),
    );
    const syncPayment = () => {
      const needed =
        ["pending", "returned"].includes(order.inventory_state) &&
        ["confirmed", "preparing", "ready", "completed"].includes(select.value);
      paymentLabel.hidden = !needed;
      payment.required = needed;
      if (!needed) payment.checked = false;
    };
    select.addEventListener("change", syncPayment);
    syncPayment();
    const noteLabel = el("label", "", "Заметка продавца");
    const note = el("textarea");
    note.name = "note";
    note.maxLength = 1000;
    note.rows = 2;
    note.value = order.note;
    note.placeholder = "Например: заберёт завтра после 18:00";
    noteLabel.append(note);
    const button = el("button", "button button-accent", "Сохранить");
    button.type = "submit";
    const feedback = el("p", "save-feedback");
    feedback.setAttribute("role", "status");
    form.append(statusLabel, paymentLabel, noteLabel, button, feedback);
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
            paymentConfirmed: payment.checked,
          }),
        });
        order = result.order;
        stockText();
        syncPayment();
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
    $("#orders-list").inert = true;
    $("#orders-list").setAttribute("aria-busy", "true");
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
    } finally {
      if (turn === request) {
        $("#orders-list").inert = false;
        $("#orders-list").setAttribute("aria-busy", "false");
      }
    }
  }
  const ml = (value) =>
    new Intl.NumberFormat("ru-KZ", { maximumFractionDigits: 1 }).format(value) +
    " мл";
  async function loadInventory() {
    const turn = ++stockRequest;
    $("#inventory-list").inert = true;
    $("#inventory-summary").textContent = "Загружаем остатки…";
    try {
      const data = await api("inventory");
      if (turn !== stockRequest || $("#dashboard").hidden) return;
      $("#inventory-summary").textContent =
        data.products.length +
        " ароматов · Нет в наличии: " +
        data.products.filter(
          (p) => !p.variants.some((v) => v.ml <= p.availableMl),
        ).length;
      $("#inventory-list").replaceChildren(
        ...data.products.map((product) => {
          const article = el("article", "inventory-card");
          article.dataset.stockProduct = product.id;
          const heading = el("div", "inventory-heading");
          const title = el("div");
          title.append(
            el("p", "product-brand", product.brand),
            el("h3", "", product.name),
          );
          heading.append(
            title,
            el("strong", "stock-amount", ml(product.availableMl)),
          );
          article.append(
            heading,
            el(
              "p",
              "stock-availability",
              product.variants.some((v) => v.ml <= product.availableMl)
                ? "В наличии"
                : "Нет в наличии для заказа",
            ),
          );
          const form = el("form", "stock-edit");
          const actionLabel = el("label", "", "Операция");
          const action = el("select");
          action.name = "kind";
          action.setAttribute("aria-label", "Операция");
          for (const [value, title] of [
            ["add", "Поступление"],
            ["remove", "Списание"],
            ["set", "Установить остаток"],
          ]) {
            const option = el("option", "", title);
            option.value = value;
            action.append(option);
          }
          actionLabel.append(action);
          const amountLabel = el("label", "", "Объём, мл");
          const amount = el("input");
          amount.name = "ml";
          amount.type = "number";
          amount.min = "0.1";
          amount.max = "1000000";
          amount.step = "0.1";
          amount.required = true;
          amount.inputMode = "decimal";
          amountLabel.append(amount);
          action.onchange = () => {
            amount.min = action.value === "set" ? "0" : "0.1";
          };
          const reasonLabel = el("label", "stock-reason", "Комментарий");
          const reason = el("input");
          reason.name = "reason";
          reason.maxLength = 300;
          reason.required = true;
          reason.placeholder = "Например: поступление нового флакона";
          reasonLabel.append(reason);
          const button = el(
            "button",
            "button button-accent",
            "Сохранить остаток",
          );
          button.type = "submit";
          const feedback = el("p", "save-feedback");
          feedback.setAttribute("role", "status");
          form.append(actionLabel, amountLabel, reasonLabel, button, feedback);
          let requestKey = crypto.randomUUID();
          form.oninput = () => {
            form.dataset.dirty = "true";
            requestKey = crypto.randomUUID();
          };
          form.onsubmit = async (event) => {
            event.preventDefault();
            const payload = {
              kind: action.value,
              ml: Number(amount.value),
              reason: reason.value,
              version: product.stockVersion,
              requestKey,
            };
            const inputs = [...form.querySelectorAll("button, input, select")];
            inputs.forEach((e) => (e.disabled = true));
            feedback.textContent = "Сохраняем…";
            try {
              await api("inventory/" + product.id, {
                method: "PATCH",
                body: JSON.stringify(payload),
              });
              form.dataset.dirty = "false";
              if (!document.querySelector('[data-dirty="true"]'))
                await loadInventory();
              else {
                feedback.textContent =
                  "Сохранено. Обновите склад после остальных правок.";
                form.dataset.saved = "true";
              }
            } catch (error) {
              feedback.textContent = error.message;
            } finally {
              if (form.dataset.saved !== "true")
                inputs.forEach((e) => (e.disabled = false));
            }
          };
          article.append(form);
          return article;
        }),
      );
      const names = new Map(
        data.products.map((p) => [p.id, p.brand + " " + p.name]),
      );
      const kinds = {
        initial: "Начальный остаток",
        add: "Поступление",
        remove: "Списание",
        set: "Корректировка",
        order: "Заказ",
        return: "Возврат",
      };
      $("#inventory-history").replaceChildren(
        ...data.movements.map((m) => {
          const row = el("article", "stock-movement");
          const text = el("div");
          text.append(
            el("strong", "", names.get(m.product_id) || m.product_id),
            el("p", "", kinds[m.kind] + " · " + m.reason),
            el(
              "small",
              "field-hint",
              date(m.created_at) + (m.order_id ? " · " + m.order_id : ""),
            ),
          );
          const balance = el("div", "movement-amount");
          balance.append(
            el(
              "strong",
              "",
              (m.delta_units > 0 ? "+" : "") + ml(m.delta_units / 10),
            ),
            el("small", "", "Остаток: " + ml(m.balance_units / 10)),
          );
          row.append(text, balance);
          return row;
        }),
      );
    } catch (error) {
      $("#inventory-summary").textContent = error.message;
    } finally {
      if (turn === stockRequest) $("#inventory-list").inert = false;
    }
  }
  for (const view of ["orders", "inventory"])
    $("#show-" + view).onclick = () => {
      if (!discardConfirmed()) return;
      document
        .querySelectorAll('[data-dirty="true"]')
        .forEach((form) => (form.dataset.dirty = "false"));
      section = view;
      $("#orders-panel").hidden = view !== "orders";
      $("#inventory-panel").hidden = view !== "inventory";
      $("#show-orders").setAttribute("aria-pressed", String(view === "orders"));
      $("#show-inventory").setAttribute(
        "aria-pressed",
        String(view === "inventory"),
      );
      if (view === "inventory") loadInventory();
      else load();
    };
  $("#refresh-inventory").onclick = () => {
    if (discardConfirmed()) loadInventory();
  };
  function discardConfirmed() {
    return (
      !document.querySelector('[data-dirty="true"]') ||
      confirm("Есть несохранённые изменения. Обновить список без сохранения?")
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
      if (section === "inventory") await loadInventory();
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
      document.querySelector(".order-edit :disabled, .stock-edit :disabled") ||
      document.activeElement?.closest(".order-edit, .admin-tools, .stock-edit")
    )
      return;
    if (section === "inventory") loadInventory();
    else load();
  }, 20000);
  load();
})();
