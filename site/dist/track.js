// Guest order lookup; the phone stays in the POST body and is never stored.
(() => {
  const form = document.querySelector("#track-form");
  if (!form) return;
  const message = document.querySelector("#track-message");
  const result = document.querySelector("#track-result");
  const submit = form.querySelector("button[type=submit]");
  const money = (n) => new Intl.NumberFormat("ru-KZ").format(n) + " ₸";
  const date = (value) =>
    new Intl.DateTimeFormat("ru-KZ", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Almaty",
    }).format(new Date(value));
  const steps = [
    ["new", "Принят"],
    ["confirmed", "Подтверждён"],
    ["preparing", "Собирается"],
    ["ready", "Готов"],
    ["completed", "Получен"],
  ];
  const labels = {
    new: "Принят, магазин скоро свяжется с вами",
    awaiting_payment: "Ожидает оплаты",
    paid: "Оплачен",
    confirmed: "Подтверждён магазином",
    preparing: "Собирается",
    cancelled: "Отменён",
    completed: "Получен",
  };
  const stepIndex = (status) =>
    ({ awaiting_payment: 0, paid: 1 })[status] ??
    steps.findIndex(([key]) => key === status);
  const h = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const statusText = (order) =>
    order.status === "ready"
      ? order.fulfillment === "pickup"
        ? "Готов, можно забирать"
        : "Готов к отправке"
      : labels[order.status] || "В обработке";
  function draw(order) {
    const head = h("div", "track-head");
    head.append(
      h("span", "track-code", order.id),
      h("h2", "", statusText(order)),
    );
    const parts = [head];
    if (order.status === "cancelled") {
      parts.push(
        h(
          "p",
          "acc-cancelled",
          "Заказ отменён. Если это ошибка, напишите нам — поможем разобраться.",
        ),
      );
    } else {
      const progress = h("ol", "acc-progress");
      progress.setAttribute("aria-label", "Этапы заказа");
      const index = stepIndex(order.status);
      steps.forEach(([, label], i) => {
        const step = h(
          "li",
          i < index ? "is-done" : i === index ? "is-current" : "",
        );
        if (i === index) step.setAttribute("aria-current", "step");
        const dot = h("span", "acc-progress-dot");
        dot.setAttribute("aria-hidden", "true");
        step.append(dot, h("span", "", label));
        progress.append(step);
      });
      parts.push(progress);
    }
    const facts = h("dl", "track-facts");
    for (const [term, value] of [
      ["Оформлен", date(order.createdAt)],
      ["Обновлён", date(order.updatedAt)],
      [
        "Получение",
        order.fulfillment === "pickup"
          ? "Самовывоз: Алматы, Достык, 108Б"
          : "Доставка по адресу из заказа",
      ],
      ["Позиций", String(order.positions)],
      ["Сумма", money(order.total)],
    ]) {
      const row = h("div");
      row.append(h("dt", "", term), h("dd", "", value));
      facts.append(row);
    }
    parts.push(facts);
    const ask = h("a", "button button-glass", "Вопрос по заказу");
    ask.href =
      "https://wa.me/77472886509?text=" +
      encodeURIComponent("Здравствуйте! Вопрос по заказу " + order.id + ".");
    ask.target = "_blank";
    ask.rel = "noopener";
    parts.push(ask);
    result.replaceChildren(...parts);
    result.hidden = false;
  }
  const phoneField = form.elements.phone;
  phoneField.addEventListener("input", () => {
    let digits = phoneField.value.replace(/\D/g, "");
    if (digits.length === 11 && /^[78]/.test(digits)) digits = digits.slice(1);
    digits = digits.slice(0, 10);
    phoneField.value = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)]
      .filter(Boolean)
      .join(" ");
  });
  const preset = new URL(location.href).searchParams.get("code");
  if (preset) form.elements.code.value = preset.slice(0, 40);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    result.hidden = true;
    submit.disabled = true;
    try {
      const response = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.elements.code.value,
          phone: phoneField.value,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Не удалось проверить заказ.");
      draw(data);
      result.focus({ preventScroll: true });
    } catch (error) {
      message.textContent =
        error instanceof TypeError
          ? "Нет связи с сервером. Попробуйте ещё раз."
          : error.message;
    } finally {
      submit.disabled = false;
    }
  });
})();
