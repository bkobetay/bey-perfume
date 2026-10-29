(() => {
  const kit = window.adminKit;
  if (!kit) return;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const num = (n) => new Intl.NumberFormat("ru-KZ").format(n);
  const money = kit.money;
  const shortDate = (value) =>
    new Intl.DateTimeFormat("ru-KZ", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  const shortDay = (value) =>
    new Intl.DateTimeFormat("ru-KZ", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(value));
  const typeName = (type) => (type === "razliv" ? "Разлив" : "Распив");
  const volumes = [5, 10, 20, 30];

  const root = $("#products-list");
  const editor = $("#product-editor");
  const search = $("#product-search");
  const typeSelect = $("#product-type");
  const narrow = matchMedia("(max-width: 1180px)");
  let list = [];
  let loaded = false;
  let loading = false;
  let filter = "all";
  let selectedId = null;
  let returnFocus = null;
  let backdrop = null;

  // The site applies a sale price whenever it is below the regular price;
  // the end date only drives the countdown shown to customers.
  // The API reports the end of whichever discount wins; when a group
  // promotion wins, the product's own sale end is only known as ownSaleEndsAt.
  const ownSaleEnd = (p) =>
    p.ownSaleEndsAt !== undefined
      ? p.ownSaleEndsAt
      : p.promotion
        ? null
        : p.saleEndsAt;
  const saleState = (p) =>
    p.salePricePerMl === null || p.salePricePerMl === undefined
      ? "none"
      : ownSaleEnd(p) && Date.parse(ownSaleEnd(p)) <= Date.now()
        ? "expired"
        : "active";

  const filters = {
    all: { title: "Все", test: () => true },
    available: { title: "В наличии", test: (p) => p.available },
    unavailable: { title: "Нет в наличии", test: (p) => !p.available },
    sale: { title: "Со скидкой", test: (p) => p.onSale },
  };
  const chips = Object.entries(filters).map(([value, { title }]) => {
    const chip = el("button", "chip");
    chip.type = "button";
    chip.dataset.filter = value;
    chip.setAttribute("aria-pressed", String(value === filter));
    chip.append(el("span", "", title), el("span", "tab-count", "0"));
    chip.onclick = () => {
      filter = value;
      chips.forEach((c) =>
        c.setAttribute("aria-pressed", String(c.dataset.filter === filter)),
      );
      render();
    };
    $(".product-filters").append(chip);
    return chip;
  });

  const dirty = () => editor.querySelector('form[data-dirty="true"]');
  const confirmDiscard = (text) => !dirty() || confirm(text);

  function stateBox(title, text, tone) {
    const box = el("div", "state-box");
    if (tone) box.dataset.tone = tone;
    box.append(el("strong", "", title));
    if (text) box.append(el("span", "", text));
    return box;
  }

  async function loadProducts() {
    if (loading) return;
    loading = true;
    root.setAttribute("aria-busy", "true");
    $("#products-caption").textContent = "Загружаем товары…";
    try {
      const data = await kit.api("products");
      list = data.products;
      loaded = true;
      render();
      const current = list.find((p) => p.id === selectedId);
      if (current && !dirty()) drawEditor(current);
      else if (!current && selectedId) closeEditor(true);
    } catch (error) {
      if (!kit.loggedIn()) return;
      $("#products-caption").textContent = "";
      const box = stateBox("Не удалось загрузить товары", error.message, "error");
      const retry = el("button", "btn btn-secondary", "Повторить");
      retry.type = "button";
      retry.onclick = loadProducts;
      box.append(retry);
      root.replaceChildren(box);
    } finally {
      loading = false;
      root.setAttribute("aria-busy", "false");
    }
  }

  function matches(p) {
    const query = search.value.trim().toLowerCase();
    return (
      (typeSelect.value === "all" || p.type === typeSelect.value) &&
      (!query ||
        [p.code, p.brand, p.name, p.id]
          .join(" ")
          .toLowerCase()
          .includes(query))
    );
  }

  function row(p) {
    const button = el("button", "product-row");
    button.type = "button";
    button.dataset.id = p.id;
    if (p.id === selectedId) button.setAttribute("aria-current", "true");
    const name = el("span", "p-name");
    name.append(el("strong", "", p.name), el("small", "", p.brand));
    const meta = el("span", "p-meta");
    const type = el("span", "type-tag", typeName(p.type));
    type.dataset.type = p.type;
    const avail = el(
      "span",
      "avail",
      p.available ? "В наличии" : "Нет в наличии",
    );
    avail.dataset.available = String(p.available);
    meta.append(type, avail);
    const state = saleState(p);
    const promo = state === "none" && p.promotion ? p.promotion : null;
    const percent =
      state === "none"
        ? 0
        : Math.round(
            ((p.basePricePerMl - p.salePricePerMl) / p.basePricePerMl) * 100,
          );
    const sale = el("span", "p-sale");
    if (state !== "none") {
      sale.append(
        el("span", "sale-pill", `−${percent}%`),
        document.createTextNode(
          " " +
            (state === "expired"
              ? "срок истёк"
              : ownSaleEnd(p)
                ? "до " + shortDay(ownSaleEnd(p))
                : p.promotion
                  ? "своя акция"
                  : "без срока"),
        ),
      );
    } else if (promo) {
      sale.append(
        el("span", "sale-pill", `−${promo.percent}%`),
        document.createTextNode(" «" + promo.title + "»"),
      );
    } else sale.textContent = "—";
    sale.dataset.state = promo ? "promo" : state;
    sale.title =
      state !== "none"
        ? `Акция: ${num(p.salePricePerMl)} ₸/мл`
        : promo
          ? `Акция «${promo.title}» −${promo.percent}%`
          : "";
    button.append(
      el("span", "p-code", p.code || "—"),
      name,
      meta,
      el("span", "p-price", `${num(p.basePricePerMl)} ₸/мл`),
      sale,
    );
    button.setAttribute(
      "aria-label",
      `${p.code || ""} ${p.brand} ${p.name}, ${typeName(p.type)}, ${num(p.basePricePerMl)} тенге за мл, ${p.available ? "в наличии" : "нет в наличии"}${state === "none" ? "" : ", акция " + num(p.salePricePerMl) + " тенге за мл" + (ownSaleEnd(p) ? " до " + shortDate(ownSaleEnd(p)) : "")}${promo ? ", действует акция «" + promo.title + "» минус " + promo.percent + "%" : ""}`,
    );
    button.onclick = () => openEditor(p.id, button);
    return button;
  }

  function render() {
    if (!loaded) return;
    const base = list.filter(matches);
    chips.forEach(
      (chip) =>
        (chip.lastChild.textContent = base.filter(
          filters[chip.dataset.filter].test,
        ).length),
    );
    const shown = base.filter(filters[filter].test);
    const head = el("div", "products-head");
    head.setAttribute("aria-hidden", "true");
    for (const title of ["Код", "Аромат", "Тип", "Наличие", "Цена за мл", "Акция"])
      head.append(el("span", "", title));
    root.replaceChildren(head, ...shown.map(row));
    if (!shown.length)
      root.append(
        stateBox("Ничего не найдено", "Измените поиск или фильтр."),
      );
    $("#products-caption").textContent =
      `Показано: ${shown.length} из ${list.length}`;
  }

  function markSelected() {
    root.querySelectorAll(".product-row").forEach((r) => {
      if (r.dataset.id === selectedId) r.setAttribute("aria-current", "true");
      else r.removeAttribute("aria-current");
    });
  }

  function openEditor(id, origin) {
    if (
      id !== selectedId &&
      !confirmDiscard(
        "Есть несохранённые изменения товара. Открыть другой товар без сохранения?",
      )
    )
      return;
    const p = list.find((x) => x.id === id);
    if (!p) return;
    selectedId = id;
    returnFocus = origin || null;
    markSelected();
    drawEditor(p);
    if (narrow.matches) {
      editor.dataset.open = "true";
      editor.setAttribute("role", "dialog");
      editor.setAttribute("aria-modal", "true");
      if (!backdrop) {
        backdrop = el("div", "editor-backdrop");
        backdrop.onclick = () => closeEditor();
      }
      editor.before(backdrop);
      document.body.style.overflow = "hidden";
    }
    editor.querySelector("h2")?.focus();
  }

  function closeEditor(force = false) {
    if (
      !force &&
      !confirmDiscard("Есть несохранённые изменения товара. Закрыть без сохранения?")
    )
      return;
    const wasOpen = editor.dataset.open === "true";
    editor.dataset.open = "false";
    editor.removeAttribute("role");
    editor.removeAttribute("aria-modal");
    backdrop?.remove();
    document.body.style.overflow = "";
    if (narrow.matches || force) {
      selectedId = null;
      markSelected();
      drawEmpty();
    }
    if (wasOpen && returnFocus?.isConnected) returnFocus.focus();
  }

  function drawEmpty() {
    const box = el("div", "editor-empty");
    const h2 = el("h2", "", "Редактирование товара");
    h2.id = "product-editor-title";
    box.append(
      h2,
      el(
        "p",
        "muted",
        "Выберите товар в списке, чтобы изменить цену, наличие или акцию.",
      ),
    );
    editor.replaceChildren(box);
  }

  const toLocalInput = (iso) => {
    const d = new Date(iso);
    return new Date(d - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  function numberField(id, title, value, required) {
    const label = el("label", "field");
    label.htmlFor = id;
    const wrap = el("span", "input-suffix");
    const input = el("input");
    input.id = id;
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.inputMode = "numeric";
    input.required = required;
    input.value = value ?? "";
    wrap.append(input, el("span", "", "₸ / мл"));
    label.append(el("span", "field-label", title), wrap);
    return { label, input };
  }

  function drawEditor(p) {
    const head = el("div", "editor-head");
    const titleBox = el("div");
    const tags = el("div", "editor-tags");
    const type = el("span", "type-tag", typeName(p.type));
    type.dataset.type = p.type;
    tags.append(el("span", "p-code", p.code || p.id), type);
    const h2 = el("h2", "", p.name);
    h2.id = "product-editor-title";
    h2.tabIndex = -1;
    titleBox.append(tags, h2, el("small", "", p.brand));
    const close = el("button", "editor-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Закрыть редактирование");
    close.onclick = () => closeEditor();
    head.append(titleBox, close);

    const form = el("form", "product-form");
    form.noValidate = true;
    const price = numberField(
      "edit-price",
      "Обычная цена за 1 мл",
      p.basePricePerMl,
      true,
    );

    const switchLabel = el("label", "switch-field");
    const switchText = el("span");
    const switchHint = el("small");
    switchText.append(el("strong", "", "В наличии"), switchHint);
    const available = el("input", "switch");
    available.type = "checkbox";
    available.setAttribute("role", "switch");
    available.checked = p.available;
    const syncSwitch = () =>
      (switchHint.textContent = available.checked
        ? "Покупатели могут заказать на сайте"
        : "Заказать на сайте сейчас нельзя");
    syncSwitch();
    switchLabel.append(switchText, available);

    const saleGroup = el("fieldset", "sale-group");
    saleGroup.append(el("legend", "", "Акция (необязательно)"));
    const sale = numberField(
      "edit-sale",
      "Акционная цена за 1 мл",
      p.salePricePerMl,
      false,
    );
    const saleHint = el(
      "span",
      "field-hint",
      "Ниже обычной цены. Оставьте пустым, чтобы убрать акцию.",
    );
    sale.label.append(saleHint);
    const endLabel = el("label", "field");
    endLabel.htmlFor = "edit-sale-end";
    const endRow = el("span", "sale-end-row");
    const end = el("input");
    end.id = "edit-sale-end";
    end.type = "datetime-local";
    if (p.salePricePerMl !== null && ownSaleEnd(p))
      end.value = toLocalInput(ownSaleEnd(p));
    const clearEnd = el("button", "btn btn-secondary", "Без срока");
    clearEnd.type = "button";
    clearEnd.onclick = () => {
      end.value = "";
      form.dispatchEvent(new Event("input"));
    };
    endRow.append(end, clearEnd);
    endLabel.append(
      el("span", "field-label", "Конец акции"),
      endRow,
      el("span", "field-hint", "Покупатели увидят таймер до этой даты."),
    );
    const removeSale = el("button", "btn btn-danger-ghost", "Убрать акцию");
    removeSale.type = "button";
    const hasSavedSale =
      p.salePricePerMl !== null && p.salePricePerMl !== undefined;
    const syncRemove = () =>
      (removeSale.hidden = !hasSavedSale && sale.input.value === "" && !end.value);
    removeSale.onclick = async () => {
      if (!hasSavedSale) {
        // Unsaved draft only: just clear the fields.
        sale.input.value = "";
        end.value = "";
        form.dispatchEvent(new Event("input"));
        sale.input.focus();
        return;
      }
      if (
        !confirm(
          `Убрать акцию для «${p.name}»? Сразу начнёт действовать обычная цена ${num(p.basePricePerMl)} ₸/мл.` +
            (form.dataset.dirty === "true"
              ? " Другие несохранённые изменения в форме будут сброшены."
              : ""),
        )
      )
        return;
      await persist(
        {
          version: p.version,
          pricePerMl: p.basePricePerMl,
          available: p.available,
          salePricePerMl: null,
          saleEndsAt: null,
        },
        "Акция снята. Действует обычная цена.",
      );
    };
    saleGroup.append(sale.label, endLabel, removeSale);

    const preview = el("section", "price-preview");
    preview.setAttribute("aria-label", "Цены на сайте после сохранения");
    const previewGrid = el("div", "preview-grid");
    const previewNote = el("p", "preview-note");
    preview.append(el("h3", "", "Цены на сайте"), previewGrid, previewNote);
    if (p.promotion)
      preview.append(
        el(
          "p",
          "preview-note promo-note",
          `Также действует акция «${p.promotion.title}» −${p.promotion.percent}%` +
            (p.promotion.endsAt ? " до " + shortDate(p.promotion.endsAt) : "") +
            ". Покупатель получает самую низкую цену.",
        ),
      );

    const feedback = el("p", "form-message");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    const submit = el("button", "btn btn-primary", "Сохранить изменения");
    submit.type = "submit";

    form.append(
      price.label,
      switchLabel,
      saleGroup,
      preview,
      feedback,
      submit,
    );

    function values() {
      const base = price.input.value === "" ? NaN : Number(price.input.value);
      const salePrice =
        sale.input.value === "" ? null : Number(sale.input.value);
      return { base, salePrice };
    }
    function validate() {
      const { base, salePrice } = values();
      price.input.removeAttribute("aria-invalid");
      sale.input.removeAttribute("aria-invalid");
      if (!Number.isSafeInteger(base) || base < 0) {
        price.input.setAttribute("aria-invalid", "true");
        return [price.input, "Укажите обычную цену целым числом от 0."];
      }
      if (
        salePrice !== null &&
        (!Number.isSafeInteger(salePrice) || salePrice < 0 || salePrice >= base)
      ) {
        sale.input.setAttribute("aria-invalid", "true");
        return [
          sale.input,
          "Цена акции должна быть целым числом ниже обычной цены.",
        ];
      }
      return null;
    }
    function updatePreview() {
      const { base, salePrice } = values();
      const valid = Number.isSafeInteger(base) && base >= 0;
      const onSale =
        valid &&
        salePrice !== null &&
        Number.isSafeInteger(salePrice) &&
        salePrice >= 0 &&
        salePrice < base;
      const perMl = onSale ? salePrice : base;
      previewGrid.replaceChildren(
        ...volumes.map((ml) => {
          const cell = el("div", "preview-cell");
          cell.append(
            el("span", "", ml + " мл"),
            el("strong", "", valid ? money(perMl * ml) : "—"),
          );
          if (onSale) cell.append(el("s", "", money(base * ml)));
          return cell;
        }),
      );
      const ends = end.value ? new Date(end.value) : null;
      previewNote.textContent = !valid
        ? "Укажите цену, чтобы увидеть расчёт."
        : !onSale
          ? available.checked
            ? "Цена за мл × объём."
            : "Товар отмечен как отсутствующий — заказать его нельзя."
          : ends && ends <= new Date()
            ? "Срок акции истёк, но акционная цена всё ещё действует. Очистите акционную цену, чтобы вернуть обычную."
            : ends
              ? `Акционная цена до ${shortDate(ends)}.`
              : "Акционная цена без срока окончания.";
    }
    updatePreview();

    form.addEventListener("input", () => {
      form.dataset.dirty = "true";
      syncSwitch();
      syncRemove();
      updatePreview();
      feedback.dataset.tone = "";
      feedback.textContent = "";
      price.input.removeAttribute("aria-invalid");
      sale.input.removeAttribute("aria-invalid");
    });
    form.onsubmit = async (event) => {
      event.preventDefault();
      const problem = validate();
      if (problem) {
        feedback.dataset.tone = "error";
        feedback.textContent = problem[1];
        problem[0].focus();
        return;
      }
      const { base, salePrice } = values();
      await persist(
        {
          version: p.version,
          pricePerMl: base,
          available: available.checked,
          salePricePerMl: salePrice,
          saleEndsAt: end.value ? new Date(end.value).toISOString() : null,
        },
        "Сохранено. Цены на 5, 10, 20 и 30 мл обновлены.",
      );
    };
    async function persist(body, successText) {
      const controls = form.querySelectorAll("input, button");
      controls.forEach((c) => (c.disabled = true));
      feedback.dataset.tone = "";
      feedback.textContent = "Сохраняем…";
      try {
        const result = await kit.api("products/" + p.id, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        const fresh = result.product;
        const index = list.findIndex((x) => x.id === fresh.id);
        if (index >= 0) list[index] = fresh;
        form.dataset.dirty = "false";
        render();
        drawEditor(fresh);
        const message = editor.querySelector(".form-message");
        message.dataset.tone = "success";
        message.textContent = successText;
        document.dispatchEvent(new CustomEvent("admin:catalog-changed"));
      } catch (error) {
        if (!kit.loggedIn()) return;
        feedback.dataset.tone = "error";
        feedback.textContent = error.message;
        if (error.status === 409 && !form.querySelector(".reload-product")) {
          const reload = el(
            "button",
            "btn btn-secondary btn-block reload-product",
            "Загрузить актуальные данные",
          );
          reload.type = "button";
          reload.onclick = () => {
            form.dataset.dirty = "false";
            loadProducts();
          };
          feedback.after(reload);
        }
      } finally {
        controls.forEach((c) => (c.disabled = false));
      }
    }
    syncRemove();
    editor.replaceChildren(head, form);
  }

  search.addEventListener("input", render);
  typeSelect.addEventListener("change", render);
  $("#refresh-products").onclick = () => {
    if (
      confirmDiscard(
        "Есть несохранённые изменения товара. Обновить список без сохранения?",
      )
    ) {
      const form = dirty();
      if (form) form.dataset.dirty = "false";
      loadProducts();
    }
  };
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && editor.dataset.open === "true") {
      event.preventDefault();
      closeEditor();
    }
  });
  narrow.addEventListener("change", () => {
    if (!narrow.matches && editor.dataset.open === "true") {
      editor.dataset.open = "false";
      editor.removeAttribute("role");
      editor.removeAttribute("aria-modal");
      backdrop?.remove();
      document.body.style.overflow = "";
    }
  });

  document.addEventListener("admin:section", (event) => {
    if (event.detail !== "products" && editor.dataset.open === "true") {
      editor.dataset.open = "false";
      editor.removeAttribute("role");
      editor.removeAttribute("aria-modal");
      backdrop?.remove();
      document.body.style.overflow = "";
    }
  });
  // Promotions change the final prices shown here.
  document.addEventListener("admin:promotions-changed", () => {
    if (!loaded) return;
    loaded = false;
    if (kit.section() === "products" && !dirty()) loadProducts();
  });
  const maybeLoad = () => {
    if (kit.loggedIn() && kit.section() === "products" && !loaded) loadProducts();
  };
  document.addEventListener("admin:section", maybeLoad);
  document.addEventListener("admin:ready", maybeLoad);
  document.addEventListener("admin:logout", () => {
    list = [];
    loaded = false;
    selectedId = null;
    closeEditor(true);
    root.replaceChildren(stateBox("Загружаем товары…"));
    $("#products-caption").textContent = "";
  });
})();

/* ---------- «Наборы» и «Акции» ---------- */
(() => {
  const kit = window.adminKit;
  if (!kit) return;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const money = kit.money;
  const num = (n) => new Intl.NumberFormat("ru-KZ").format(n);
  const when = (value) =>
    new Intl.DateTimeFormat("ru-KZ", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  const plural = (n, [one, few, many]) => {
    const d = n % 10,
      h = n % 100;
    return `${n} ${d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many}`;
  };
  const toLocalInput = (iso) => {
    const d = new Date(iso);
    return new Date(d - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  const fromLocalInput = (value) =>
    value ? new Date(value).toISOString() : null;
  const narrow = matchMedia("(max-width: 1180px)");
  const volumes = [5, 10, 20, 30];
  let uid = 0;

  function stateBox(title, text, tone) {
    const box = el("div", "state-box");
    if (tone) box.dataset.tone = tone;
    box.append(el("strong", "", title));
    if (text) box.append(el("span", "", text));
    return box;
  }
  function errorBox(title, error, retry) {
    const box = stateBox(title, error.message, "error");
    const button = el("button", "btn btn-secondary", "Повторить");
    button.type = "button";
    button.onclick = retry;
    box.append(button);
    return box;
  }

  /* Form building blocks */
  function field(title, input, hint) {
    const label = el("label", "field");
    input.id ||= "f" + ++uid;
    label.htmlFor = input.id;
    label.append(el("span", "field-label", title), input);
    if (hint) label.append(el("span", "field-hint", hint));
    return label;
  }
  function textInput(value, maxLength, required) {
    const input = el("input");
    input.value = value ?? "";
    input.maxLength = maxLength;
    input.required = required;
    input.autocomplete = "off";
    return input;
  }
  function numberInput(value, suffix, { min = 0, max } = {}) {
    const wrap = el("span", "input-suffix");
    const input = el("input");
    input.type = "number";
    input.min = String(min);
    if (max !== undefined) input.max = String(max);
    input.step = "1";
    input.inputMode = "numeric";
    input.value = value ?? "";
    input.id = "f" + ++uid;
    wrap.append(input, el("span", "", suffix));
    return { wrap, input };
  }
  function numberField(title, value, suffix, hint, options) {
    const { wrap, input } = numberInput(value, suffix, options);
    const label = el("label", "field");
    label.htmlFor = input.id;
    label.append(el("span", "field-label", title), wrap);
    if (hint) label.append(el("span", "field-hint", hint));
    return { label, input };
  }
  function dateField(title, iso, clearText, hint, onChange) {
    const input = el("input");
    input.type = "datetime-local";
    input.id = "f" + ++uid;
    if (iso) input.value = toLocalInput(iso);
    const row = el("span", "sale-end-row");
    const clear = el("button", "btn btn-secondary", clearText);
    clear.type = "button";
    clear.onclick = () => {
      input.value = "";
      onChange();
    };
    row.append(input, clear);
    const label = el("label", "field");
    label.htmlFor = input.id;
    label.append(el("span", "field-label", title), row);
    if (hint) label.append(el("span", "field-hint", hint));
    return { label, input };
  }
  function switchField(title, on, off, checked) {
    const label = el("label", "switch-field");
    const text = el("span");
    const hint = el("small");
    text.append(el("strong", "", title), hint);
    const input = el("input", "switch");
    input.type = "checkbox";
    input.setAttribute("role", "switch");
    input.checked = checked;
    const sync = () => (hint.textContent = input.checked ? on : off);
    sync();
    label.append(text, input);
    return { label, input, sync };
  }
  function invalid(input, on) {
    if (on) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  /* Shared list + side panel/sheet behaviour (same as «Товары и цены») */
  function workspace({ panel, section, emptyTitle, emptyText, titleId, rowFor }) {
    let backdrop = null;
    let key = null;
    const dirty = () => panel.querySelector('form[data-dirty="true"]');
    function sheet(open) {
      if (open && narrow.matches) {
        panel.dataset.open = "true";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        if (!backdrop) {
          backdrop = el("div", "editor-backdrop");
          backdrop.onclick = () => close();
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
    function drawEmpty() {
      const box = el("div", "editor-empty");
      const h2 = el("h2", "", emptyTitle);
      h2.id = titleId;
      box.append(h2, el("p", "muted", emptyText));
      panel.replaceChildren(box);
    }
    function open(newKey, draw) {
      if (
        newKey !== key &&
        dirty() &&
        !confirm("Есть несохранённые изменения. Открыть другое без сохранения?")
      )
        return false;
      key = newKey;
      draw();
      sheet(true);
      panel.querySelector("h2")?.focus();
      return true;
    }
    function close(force = false) {
      if (
        !force &&
        dirty() &&
        !confirm("Есть несохранённые изменения. Закрыть без сохранения?")
      )
        return false;
      const wasOpen = panel.dataset.open === "true";
      const old = key;
      sheet(false);
      if (narrow.matches || force) {
        key = null;
        drawEmpty();
      }
      if (wasOpen) (rowFor(old) || $("#" + section + "-panel h1"))?.focus();
      return true;
    }
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && panel.dataset.open === "true") {
        event.preventDefault();
        close();
      }
    });
    narrow.addEventListener("change", () => {
      if (!narrow.matches && panel.dataset.open === "true") sheet(false);
    });
    document.addEventListener("admin:section", (event) => {
      if (event.detail !== section && panel.dataset.open === "true")
        sheet(false);
    });
    return {
      open,
      close,
      dirty,
      drawEmpty,
      get key() {
        return key;
      },
      set key(value) {
        key = value;
      },
    };
  }
  function editorHead(titleId, tags, title, subtitle, onClose) {
    const head = el("div", "editor-head");
    const box = el("div");
    const tagRow = el("div", "editor-tags");
    tagRow.append(...tags);
    const h2 = el("h2", "", title);
    h2.id = titleId;
    h2.tabIndex = -1;
    box.append(tagRow, h2);
    if (subtitle) box.append(el("small", "", subtitle));
    const close = el("button", "editor-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Закрыть");
    close.onclick = onClose;
    head.append(box, close);
    return head;
  }
  function tag(text, kind) {
    const t = el("span", "tag", text);
    if (kind) t.dataset.kind = kind;
    return t;
  }
  function filterChips(container, filters, current, onChange) {
    return Object.entries(filters).map(([value, { title }]) => {
      const chip = el("button", "chip");
      chip.type = "button";
      chip.dataset.filter = value;
      chip.setAttribute("aria-pressed", String(value === current));
      chip.append(el("span", "", title), el("span", "tab-count", "0"));
      chip.onclick = () => onChange(value);
      container.append(chip);
      return chip;
    });
  }
  // A 409 offers to reload the latest version instead of overwriting it.
  function conflictButton(form, reload) {
    if (form.querySelector(".reload-latest")) return;
    const button = el(
      "button",
      "btn btn-secondary btn-block reload-latest",
      "Загрузить актуальные данные",
    );
    button.type = "button";
    button.onclick = () => {
      form.dataset.dirty = "false";
      reload();
    };
    form.querySelector(".form-message").after(button);
  }

  /* Catalog (for set components and promotion scopes) */
  let catalog = [];
  let catalogAt = 0;
  async function loadCatalog(force = false) {
    if (!force && catalog.length && Date.now() - catalogAt < 60000)
      return catalog;
    catalog = (await kit.api("products")).products;
    catalogAt = Date.now();
    return catalog;
  }
  document.addEventListener("admin:catalog-changed", () => (catalogAt = 0));
  const productById = (id) => catalog.find((p) => p.id === id);

  /* ================= Наборы ================= */
  const sets = (() => {
    const root = $("#sets-list");
    const panel = $("#set-editor");
    const search = $("#set-search");
    let list = [];
    let loaded = false;
    let loading = false;
    let filter = "all";
    const filters = {
      all: { title: "Все", test: () => true },
      visible: { title: "На сайте", test: (s) => s.visible },
      hidden: { title: "Скрытые", test: (s) => !s.visible },
      sale: { title: "Со скидкой", test: (s) => s.onSale },
    };
    const chips = filterChips($(".set-filters"), filters, filter, (value) => {
      filter = value;
      chips.forEach((c) =>
        c.setAttribute("aria-pressed", String(c.dataset.filter === filter)),
      );
      render();
    });
    const rowFor = (id) =>
      id && root.querySelector(`.set-row[data-id="${CSS.escape(id)}"]`);
    const ws = workspace({
      panel,
      section: "sets",
      emptyTitle: "Набор",
      emptyText: "Выберите набор в списке или создайте новый.",
      titleId: "set-editor-title",
      rowFor,
    });
    const composition = (s) =>
      s.items.map((i) => `${i.code || i.name} ${i.ml} мл`).join(", ");
    const percentOff = (s) =>
      s.regularPrice > 0
        ? Math.round(((s.regularPrice - s.price) / s.regularPrice) * 100)
        : 0;

    async function load() {
      if (loading) return;
      loading = true;
      root.setAttribute("aria-busy", "true");
      $("#sets-caption").textContent = "Загружаем наборы…";
      try {
        const [data] = await Promise.all([
          kit.api("sets"),
          loadCatalog().catch(() => catalog),
        ]);
        list = data.sets;
        loaded = true;
        render();
        const open = ws.key && ws.key !== "new" && list.find((s) => s.id === ws.key);
        if (open && !ws.dirty()) draw(open);
        else if (ws.key && ws.key !== "new" && !open) ws.close(true);
      } catch (error) {
        if (!kit.loggedIn()) return;
        $("#sets-caption").textContent = "";
        root.replaceChildren(errorBox("Не удалось загрузить наборы", error, load));
      } finally {
        loading = false;
        root.setAttribute("aria-busy", "false");
      }
    }
    function row(s) {
      const button = el("button", "product-row set-row");
      button.type = "button";
      button.dataset.id = s.id;
      if (s.id === ws.key) button.setAttribute("aria-current", "true");
      const title = el("span", "p-name");
      title.append(
        el("strong", "", s.title),
        el(
          "small",
          "",
          plural(s.items.length, ["аромат", "аромата", "ароматов"]) +
            " · " +
            composition(s),
        ),
      );
      const price = el("span", "s-price");
      price.append(el("strong", "", money(s.price)));
      if (s.onSale) price.append(el("s", "", money(s.regularPrice)));
      const tags = el("span", "s-tags");
      if (s.onSale)
        tags.append(
          tag(
            `−${percentOff(s)}%` +
              (s.saleEndsAt ? " до " + when(s.saleEndsAt) : ""),
            "sale",
          ),
        );
      tags.append(
        s.visible ? tag("На сайте", "on") : tag("Скрыт", "off"),
      );
      if (!s.available) tags.append(tag("Нет в наличии", "danger"));
      button.append(title, price, tags);
      button.setAttribute(
        "aria-label",
        `Набор «${s.title}», ${composition(s)}, цена ${money(s.price)}${s.onSale ? ", скидка " + percentOff(s) + "%" : ""}, ${s.visible ? "показан на сайте" : "скрыт"}${s.available ? "" : ", нет в наличии"}`,
      );
      button.onclick = () => ws.open(s.id, () => draw(s));
      return button;
    }
    function render() {
      if (!loaded) return;
      const query = search.value.trim().toLowerCase();
      const base = list.filter(
        (s) =>
          !query ||
          [s.title, s.description, ...s.items.flatMap((i) => [i.code, i.brand, i.name])]
            .join(" ")
            .toLowerCase()
            .includes(query),
      );
      chips.forEach(
        (chip) =>
          (chip.lastChild.textContent = base.filter(
            filters[chip.dataset.filter].test,
          ).length),
      );
      const shown = base.filter(filters[filter].test);
      root.replaceChildren(...shown.map(row));
      if (!shown.length)
        root.append(
          list.length
            ? stateBox("Ничего не найдено", "Измените поиск или фильтр.")
            : stateBox(
                "Наборов пока нет",
                "Нажмите «Создать набор», чтобы собрать первый.",
              ),
        );
      $("#sets-caption").textContent = `Показано: ${shown.length} из ${list.length}`;
    }
    function markSelected() {
      root.querySelectorAll(".set-row").forEach((r) => {
        if (r.dataset.id === ws.key) r.setAttribute("aria-current", "true");
        else r.removeAttribute("aria-current");
      });
    }

    function draw(set, message) {
      markSelected();
      const isNew = !set;
      const draft = {
        items: (set?.items || []).map((i) => ({ productId: i.productId, ml: i.ml })),
      };
      const head = editorHead(
        "set-editor-title",
        isNew
          ? [tag("Новый набор", "on")]
          : [
              set.visible ? tag("На сайте", "on") : tag("Скрыт", "off"),
              ...(set.onSale ? [tag("Скидка", "sale")] : []),
            ],
        isNew ? "Новый набор" : set.title,
        isNew ? "" : composition(set),
        () => ws.close(),
      );
      const form = el("form", "product-form");
      form.noValidate = true;
      const title = textInput(set?.title, 80, true);
      const description = el("textarea");
      description.maxLength = 300;
      description.rows = 3;
      description.value = set?.description || "";
      description.placeholder = "Например: три лёгких аромата на лето";

      // Components
      const comps = el("fieldset", "sale-group components");
      comps.append(el("legend", "", "Ароматы в наборе (1–10)"));
      const compList = el("ul", "component-list");
      const pickerInput = el("input");
      pickerInput.type = "search";
      pickerInput.id = "f" + ++uid;
      pickerInput.placeholder = "Код, бренд или название";
      pickerInput.autocomplete = "off";
      const pickerLabel = el("label", "field");
      pickerLabel.htmlFor = pickerInput.id;
      pickerLabel.append(el("span", "field-label", "Добавить аромат"), pickerInput);
      const results = el("div", "picker-results");
      results.setAttribute("aria-live", "polite");
      comps.append(compList, pickerLabel, results);

      function drawComponents() {
        compList.replaceChildren(
          ...draft.items.map((item, index) => {
            const p = productById(item.productId);
            const li = el("li", "component");
            const info = el("span", "component-info");
            info.append(
              el(
                "strong",
                "",
                p ? `${p.code ? p.code + " · " : ""}${p.name}` : item.productId,
              ),
              el(
                "small",
                "",
                p
                  ? `${p.brand} · ${num(p.basePricePerMl)} ₸/мл` +
                      (p.available ? "" : " · нет в наличии")
                  : "Аромат не найден в каталоге",
              ),
            );
            const ml = el("select", "component-ml");
            ml.setAttribute("aria-label", "Объём: " + (p?.name || ""));
            for (const v of volumes) {
              const option = el("option", "", v + " мл");
              option.value = String(v);
              option.selected = v === item.ml;
              option.disabled =
                v !== item.ml &&
                draft.items.some((o) => o.productId === item.productId && o.ml === v);
              ml.append(option);
            }
            ml.onchange = () => {
              item.ml = Number(ml.value);
              changed();
            };
            const price = el(
              "span",
              "component-price",
              p ? money(p.basePricePerMl * item.ml) : "—",
            );
            const remove = el("button", "component-remove", "×");
            remove.type = "button";
            remove.setAttribute("aria-label", "Убрать из набора: " + (p?.name || ""));
            remove.onclick = () => {
              draft.items.splice(index, 1);
              changed();
              pickerInput.focus();
            };
            li.append(info, ml, price, remove);
            return li;
          }),
        );
        if (!draft.items.length)
          compList.append(el("li", "component-empty", "Добавьте хотя бы один аромат."));
        pickerInput.disabled = draft.items.length >= 10;
        pickerInput.placeholder =
          draft.items.length >= 10
            ? "В наборе уже 10 ароматов"
            : "Код, бренд или название";
      }
      function drawResults() {
        const query = pickerInput.value.trim().toLowerCase();
        if (!query) {
          results.replaceChildren();
          return;
        }
        const found = catalog
          .filter((p) =>
            [p.code, p.brand, p.name].join(" ").toLowerCase().includes(query),
          )
          .slice(0, 6);
        results.replaceChildren(
          ...found.map((p) => {
            const button = el("button", "picker-item");
            button.type = "button";
            button.append(
              el("strong", "", `${p.code ? p.code + " · " : ""}${p.name}`),
              el(
                "small",
                "",
                `${p.brand} · ${num(p.basePricePerMl)} ₸/мл${p.available ? "" : " · нет в наличии"}`,
              ),
            );
            const free = volumes.find(
              (v) =>
                !draft.items.some((i) => i.productId === p.id && i.ml === v),
            );
            const preferred = [10, ...volumes].find(
              (v) => !draft.items.some((i) => i.productId === p.id && i.ml === v),
            );
            button.disabled = free === undefined;
            button.setAttribute("aria-label", "Добавить в набор: " + p.name);
            button.onclick = () => {
              draft.items.push({ productId: p.id, ml: preferred });
              pickerInput.value = "";
              results.replaceChildren();
              changed();
              pickerInput.focus();
            };
            return button;
          }),
        );
        if (!found.length)
          results.append(el("p", "field-hint", "Ничего не найдено."));
      }
      pickerInput.addEventListener("input", (event) => {
        event.stopPropagation();
        drawResults();
      });
      pickerInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          results.querySelector(".picker-item:not(:disabled)")?.click();
        }
      });

      // Price
      const priceGroup = el("fieldset", "sale-group");
      priceGroup.append(el("legend", "", "Цена набора"));
      const modes = el("div", "segmented");
      const modeName = "set-price-mode-" + ++uid;
      const radio = (value, text, checked) => {
        const label = el("label", "segment");
        const input = el("input");
        input.type = "radio";
        input.name = modeName;
        input.value = value;
        input.checked = checked;
        label.append(input, el("span", "", text));
        modes.append(label);
        return input;
      };
      const custom = set?.fixedPrice !== null && set?.fixedPrice !== undefined;
      radio("sum", "Сумма ароматов", !custom);
      const customRadio = radio("fixed", "Своя цена", custom);
      const fixed = numberField("Своя цена набора", set?.fixedPrice, "₸");
      priceGroup.append(modes, fixed.label);

      const saleGroup = el("fieldset", "sale-group");
      saleGroup.append(el("legend", "", "Скидка на набор (необязательно)"));
      const salePrice = numberField(
        "Цена со скидкой",
        set?.salePrice,
        "₸",
        "Ниже обычной цены набора.",
      );
      const saleEnd = dateField(
        "Конец скидки",
        set?.salePrice === null || set?.salePrice === undefined
          ? null
          : set.ownSaleEndsAt !== undefined
            ? set.ownSaleEndsAt
            : set.promotion
              ? null
              : set.saleEndsAt,
        "Без срока",
        "После этой даты снова действует обычная цена.",
        () => form.dispatchEvent(new Event("input")),
      );
      const hasSavedSale = set?.salePrice !== null && set?.salePrice !== undefined;
      const removeSale = el("button", "btn btn-danger-ghost", "Убрать акцию");
      removeSale.type = "button";
      saleGroup.append(salePrice.label, saleEnd.label, removeSale);

      const visible = switchField(
        "Показывать на сайте",
        "Покупатели видят набор",
        "Набор скрыт от покупателей",
        set ? set.visible : true,
      );
      const available = switchField(
        "В наличии",
        "Набор можно заказать",
        "Заказать набор сейчас нельзя",
        set ? set.available : true,
      );
      const sort = numberField(
        "Порядок показа",
        set?.sort ?? 0,
        "",
        "Меньше число — выше в списке на сайте.",
        { min: -9999 },
      );

      const preview = el("section", "price-preview");
      preview.setAttribute("aria-label", "Расчёт цены набора");
      const previewGrid = el("div", "set-preview");
      preview.append(el("h3", "", "Расчёт"), previewGrid);

      const feedback = el("p", "form-message");
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");
      const actions = el("div", "editor-actions");
      const submit = el(
        "button",
        "btn btn-primary",
        isNew ? "Создать набор" : "Сохранить набор",
      );
      submit.type = "submit";
      actions.append(submit);
      if (!isNew) {
        const del = el("button", "btn btn-danger-ghost", "Удалить набор");
        del.type = "button";
        del.onclick = async () => {
          if (
            !confirm(`Удалить набор «${set.title}»? Это действие нельзя отменить.`)
          )
            return;
          await run(async () => {
            await kit.api("sets/" + set.id, { method: "DELETE" });
            form.dataset.dirty = "false";
            list = list.filter((s) => s.id !== set.id);
            render();
            ws.close(true);
            kit.notify(`Набор «${set.title}» удалён.`);
          });
        };
        actions.append(del);
      }

      form.append(
        field("Название", title),
        field("Описание", description, "До 300 символов. Необязательно."),
        comps,
        priceGroup,
        saleGroup,
        visible.label,
        available.label,
        sort.label,
        preview,
        feedback,
        actions,
      );

      const sumRegular = () =>
        draft.items.reduce((sum, item) => {
          const p = productById(item.productId);
          return sum + (p ? p.basePricePerMl * item.ml : 0);
        }, 0);
      const intOrNull = (input) =>
        input.value === "" ? null : Number(input.value);
      function values() {
        const isCustom = customRadio.checked;
        const regular = isCustom ? intOrNull(fixed.input) : sumRegular();
        return {
          title: title.value.trim(),
          description: description.value.trim(),
          items: draft.items.map((i) => ({ productId: i.productId, ml: i.ml })),
          fixedPrice: isCustom ? intOrNull(fixed.input) : null,
          salePrice: intOrNull(salePrice.input),
          saleEndsAt: fromLocalInput(saleEnd.input.value),
          available: available.input.checked,
          visible: visible.input.checked,
          sort: sort.input.value === "" ? 0 : Number(sort.input.value),
          regular,
        };
      }
      function updatePreview() {
        const v = values();
        const separate = sumRegular();
        const ends = v.saleEndsAt ? new Date(v.saleEndsAt) : null;
        const saleOn =
          v.salePrice !== null &&
          Number.isSafeInteger(v.salePrice) &&
          v.regular !== null &&
          v.salePrice < v.regular &&
          (!ends || ends > new Date());
        const final = saleOn ? v.salePrice : v.regular;
        const rows = [
          ["Ароматы по отдельности", separate ? money(separate) : "—"],
          ["Цена набора", v.regular !== null && Number.isSafeInteger(v.regular) ? money(v.regular) : "—"],
        ];
        if (saleOn)
          rows.push([
            "Со скидкой" + (ends ? " до " + when(ends) : ""),
            money(v.salePrice),
          ]);
        const savings = Number.isSafeInteger(final) ? separate - final : 0;
        previewGrid.replaceChildren(
          ...rows.map(([k, val]) => {
            const line = el("p", "preview-line");
            line.append(el("span", "", k), el("strong", "", val));
            return line;
          }),
        );
        const note = el("p", "preview-note");
        note.textContent =
          savings > 0 && separate > 0
            ? `Выгода покупателя: ${money(savings)} (${Math.round((savings / separate) * 100)}%) по сравнению с покупкой по отдельности.`
            : ends && ends <= new Date() && v.salePrice !== null
              ? "Срок скидки прошёл — действует обычная цена набора."
              : "Акции из раздела «Акции» могут снизить цену ещё сильнее.";
        previewGrid.append(note);
      }
      function sync() {
        fixed.label.hidden = !customRadio.checked;
        visible.sync();
        available.sync();
        removeSale.hidden =
          !hasSavedSale && salePrice.input.value === "" && !saleEnd.input.value;
        updatePreview();
      }
      function changed() {
        form.dataset.dirty = "true";
        drawComponents();
        sync();
      }
      form.addEventListener("input", () => {
        form.dataset.dirty = "true";
        feedback.dataset.tone = "";
        feedback.textContent = "";
        form.querySelectorAll("[aria-invalid]").forEach((i) => invalid(i, false));
        sync();
      });
      form.addEventListener("change", sync);

      function validate(v) {
        if (!v.title) return [title, "Введите название набора."];
        if (!v.items.length) return [pickerInput, "Добавьте в набор хотя бы один аромат."];
        if (
          customRadio.checked &&
          (v.fixedPrice === null || !Number.isSafeInteger(v.fixedPrice) || v.fixedPrice < 0)
        )
          return [fixed.input, "Укажите свою цену набора целым числом."];
        if (
          v.salePrice !== null &&
          (!Number.isSafeInteger(v.salePrice) || v.salePrice < 0 || v.salePrice >= v.regular)
        )
          return [salePrice.input, "Цена со скидкой должна быть целым числом ниже цены набора."];
        if (!Number.isSafeInteger(v.sort))
          return [sort.input, "Порядок показа — целое число."];
        return null;
      }
      async function run(task) {
        const controls = form.querySelectorAll("input, select, textarea, button");
        controls.forEach((c) => (c.disabled = true));
        feedback.dataset.tone = "";
        feedback.textContent = "Сохраняем…";
        try {
          await task();
        } catch (error) {
          if (!kit.loggedIn()) return;
          feedback.dataset.tone = "error";
          feedback.textContent = error.message;
          if (error.status === 409) conflictButton(form, load);
        } finally {
          if (form.isConnected) {
            controls.forEach((c) => (c.disabled = false));
            pickerInput.disabled = draft.items.length >= 10;
          }
        }
      }
      async function persist(body, successText) {
        await run(async () => {
          const result = await kit.api(isNew ? "sets" : "sets/" + set.id, {
            method: isNew ? "POST" : "PATCH",
            body: JSON.stringify(isNew ? body : { ...body, version: set.version }),
          });
          const saved = result.set;
          form.dataset.dirty = "false";
          const index = list.findIndex((s) => s.id === saved.id);
          if (index >= 0) list[index] = saved;
          else list.push(saved);
          ws.key = saved.id;
          render();
          draw(saved, successText);
        });
      }
      form.onsubmit = async (event) => {
        event.preventDefault();
        const v = values();
        const problem = validate(v);
        if (problem) {
          invalid(problem[0], true);
          feedback.dataset.tone = "error";
          feedback.textContent = problem[1];
          problem[0].focus();
          return;
        }
        const { regular, ...body } = v;
        await persist(body, isNew ? "Набор создан." : "Набор сохранён.");
      };
      removeSale.onclick = async () => {
        if (!hasSavedSale) {
          salePrice.input.value = "";
          saleEnd.input.value = "";
          form.dispatchEvent(new Event("input"));
          salePrice.input.focus();
          return;
        }
        if (
          !confirm(
            `Убрать скидку с набора «${set.title}»? Сразу начнёт действовать обычная цена.` +
              (form.dataset.dirty === "true"
                ? " Другие несохранённые изменения будут сброшены."
                : ""),
          )
        )
          return;
        await persist(
          {
            title: set.title,
            description: set.description || "",
            items: set.items.map((i) => ({ productId: i.productId, ml: i.ml })),
            fixedPrice: set.fixedPrice ?? null,
            salePrice: null,
            saleEndsAt: null,
            available: set.available,
            visible: set.visible,
            sort: set.sort ?? 0,
          },
          "Акция снята. Действует обычная цена набора.",
        );
      };

      drawComponents();
      sync();
      if (message) {
        feedback.dataset.tone = "success";
        feedback.textContent = message;
      }
      panel.replaceChildren(head, form);
    }

    $("#create-set").onclick = async () => {
      try {
        await loadCatalog();
      } catch (error) {
        kit.notify(error.message, "error");
        return;
      }
      if (ws.open("new", () => draw(null))) markSelected();
    };
    search.addEventListener("input", render);
    $("#refresh-sets").onclick = () => {
      if (
        ws.dirty() &&
        !confirm("Есть несохранённые изменения набора. Обновить без сохранения?")
      )
        return;
      const form = ws.dirty();
      if (form) form.dataset.dirty = "false";
      catalogAt = 0;
      load();
    };
    return {
      load,
      get loaded() {
        return loaded;
      },
      reset() {
        list = [];
        loaded = false;
        ws.close(true);
        root.replaceChildren(stateBox("Загружаем наборы…"));
      },
      invalidate() {
        loaded = false;
      },
      list: () => list,
    };
  })();

  /* ================= Акции ================= */
  const promotions = (() => {
    const root = $("#promotions-list");
    const panel = $("#promotion-editor");
    const search = $("#promotion-search");
    let list = [];
    let loaded = false;
    let loading = false;
    let filter = "all";
    const scopes = {
      all: "Весь ассортимент",
      female: "Женские",
      male: "Мужские",
      niche: "Нишевые",
      universal: "Универсальные",
      raspiv: "Распив",
      brand: "Бренд",
      sets: "Наборы",
    };
    const statusNames = {
      active: "Активна",
      scheduled: "Запланирована",
      expired: "Завершена",
      off: "Выключена",
    };
    const filters = {
      all: { title: "Все", test: () => true },
      active: { title: "Активные", test: (p) => p.status === "active" },
      scheduled: { title: "Запланированы", test: (p) => p.status === "scheduled" },
      expired: { title: "Завершены", test: (p) => p.status === "expired" },
      off: { title: "Выключены", test: (p) => p.status === "off" },
    };
    const chips = filterChips($(".promotion-filters"), filters, filter, (value) => {
      filter = value;
      chips.forEach((c) =>
        c.setAttribute("aria-pressed", String(c.dataset.filter === filter)),
      );
      render();
    });
    const rowFor = (id) =>
      id && root.querySelector(`.promo-row[data-id="${CSS.escape(id)}"]`);
    const ws = workspace({
      panel,
      section: "promotions",
      emptyTitle: "Акция",
      emptyText: "Выберите акцию в списке или создайте новую.",
      titleId: "promotion-editor-title",
      rowFor,
    });
    const scopeLabel = (p) =>
      p.scope === "brand" ? "Бренд: " + (p.scopeValue || "—") : scopes[p.scope] || p.scope;
    const affectedText = (scope, count) =>
      scope === "sets"
        ? plural(count, ["набор", "набора", "наборов"])
        : plural(count, ["аромат", "аромата", "ароматов"]);
    const period = (p) =>
      p.startsAt && new Date(p.startsAt) > new Date()
        ? "с " + when(p.startsAt) + (p.endsAt ? " до " + when(p.endsAt) : "")
        : p.endsAt
          ? "до " + when(p.endsAt)
          : "без срока";
    function statusOf(active, startsAt, endsAt) {
      const now = new Date();
      if (!active) return "off";
      if (endsAt && new Date(endsAt) <= now) return "expired";
      if (startsAt && new Date(startsAt) > now) return "scheduled";
      return "active";
    }
    function matchesScope(p, scope, value) {
      if (scope === "all") return true;
      if (scope === "raspiv") return p.type === "raspiv";
      if (scope === "brand") return p.brand === value;
      if (scope === "sets") return false;
      return p.collection === scope;
    }

    async function load() {
      if (loading) return;
      loading = true;
      root.setAttribute("aria-busy", "true");
      $("#promotions-caption").textContent = "Загружаем акции…";
      try {
        const [data] = await Promise.all([
          kit.api("promotions"),
          loadCatalog().catch(() => catalog),
        ]);
        list = data.promotions;
        loaded = true;
        render();
        const open = ws.key && ws.key !== "new" && list.find((p) => p.id === ws.key);
        if (open && !ws.dirty()) draw(open);
        else if (ws.key && ws.key !== "new" && !open) ws.close(true);
      } catch (error) {
        if (!kit.loggedIn()) return;
        $("#promotions-caption").textContent = "";
        root.replaceChildren(errorBox("Не удалось загрузить акции", error, load));
      } finally {
        loading = false;
        root.setAttribute("aria-busy", "false");
      }
    }
    function row(p) {
      const button = el("button", "product-row promo-row");
      button.type = "button";
      button.dataset.id = p.id;
      if (p.id === ws.key) button.setAttribute("aria-current", "true");
      const title = el("span", "p-name");
      title.append(
        el("strong", "", p.title),
        el("small", "", `${scopeLabel(p)} · ${affectedText(p.scope, p.affected ?? 0)}`),
      );
      const percent = el("span", "promo-percent", `−${p.percent}%`);
      const dates = el("span", "promo-dates", period(p));
      const status = el("span", "promo-status");
      const badge = el("span", "status-badge", statusNames[p.status] || p.status);
      badge.dataset.promo = p.status;
      status.append(badge);
      button.append(title, percent, dates, status);
      button.setAttribute(
        "aria-label",
        `Акция «${p.title}», ${scopeLabel(p)}, минус ${p.percent}%, ${period(p)}, ${statusNames[p.status] || p.status}, ${affectedText(p.scope, p.affected ?? 0)}`,
      );
      button.onclick = () => ws.open(p.id, () => draw(p));
      return button;
    }
    function render() {
      if (!loaded) return;
      const query = search.value.trim().toLowerCase();
      const base = list.filter(
        (p) =>
          !query ||
          [p.title, p.scopeValue, scopes[p.scope]].join(" ").toLowerCase().includes(query),
      );
      chips.forEach(
        (chip) =>
          (chip.lastChild.textContent = base.filter(
            filters[chip.dataset.filter].test,
          ).length),
      );
      const shown = base.filter(filters[filter].test);
      root.replaceChildren(...shown.map(row));
      if (!shown.length)
        root.append(
          list.length
            ? stateBox("Ничего не найдено", "Измените поиск или фильтр.")
            : stateBox(
                "Акций пока нет",
                "Нажмите «Создать акцию», чтобы дать скидку на группу ароматов.",
              ),
        );
      $("#promotions-caption").textContent = `Показано: ${shown.length} из ${list.length}`;
    }
    function markSelected() {
      root.querySelectorAll(".promo-row").forEach((r) => {
        if (r.dataset.id === ws.key) r.setAttribute("aria-current", "true");
        else r.removeAttribute("aria-current");
      });
    }

    function draw(promo, message) {
      markSelected();
      const isNew = !promo;
      const badge = el(
        "span",
        "status-badge",
        isNew ? "Новая" : statusNames[promo.status] || promo.status,
      );
      badge.dataset.promo = isNew ? "new" : promo.status;
      const head = editorHead(
        "promotion-editor-title",
        [badge],
        isNew ? "Новая акция" : promo.title,
        isNew ? "" : scopeLabel(promo),
        () => ws.close(),
      );
      const form = el("form", "product-form");
      form.noValidate = true;
      const title = textInput(promo?.title, 60, true);
      title.placeholder = "Например: Осенняя распродажа";
      const scope = el("select");
      for (const [value, text] of Object.entries(scopes)) {
        const option = el("option", "", text);
        option.value = value;
        option.selected = (promo?.scope || "all") === value;
        scope.append(option);
      }
      const brand = el("select");
      const brands = [...new Set(catalog.map((p) => p.brand))].sort((a, b) =>
        a.localeCompare(b, "ru"),
      );
      brand.append(el("option", "", "Выберите бренд"));
      brand.firstChild.value = "";
      for (const name of brands) {
        const option = el(
          "option",
          "",
          `${name} (${catalog.filter((p) => p.brand === name).length})`,
        );
        option.value = name;
        option.selected = promo?.scopeValue === name;
        brand.append(option);
      }
      if (promo?.scope === "brand" && promo.scopeValue && !brands.includes(promo.scopeValue)) {
        const option = el("option", "", promo.scopeValue + " (нет в каталоге)");
        option.value = promo.scopeValue;
        option.selected = true;
        brand.append(option);
      }
      const brandField = field("Бренд", brand);
      const percent = numberField("Скидка", promo?.percent, "%", "От 1 до 90%.", {
        min: 1,
        max: 90,
      });
      const starts = dateField(
        "Начало",
        promo?.startsAt,
        "Сразу",
        "Пусто — акция начинается сразу после сохранения.",
        () => form.dispatchEvent(new Event("input")),
      );
      const ends = dateField(
        "Конец",
        promo?.endsAt,
        "Без срока",
        "После этой даты цены автоматически станут обычными.",
        () => form.dispatchEvent(new Event("input")),
      );
      const active = switchField(
        "Акция включена",
        "Действует в указанные даты",
        "Выключена — покупатели её не видят",
        promo ? promo.active : true,
      );
      const preview = el("section", "price-preview");
      preview.setAttribute("aria-label", "Что увидят покупатели");
      const previewText = el("p", "promo-preview");
      const previewNote = el("p", "preview-note");
      preview.append(el("h3", "", "Итог"), previewText, previewNote);

      const feedback = el("p", "form-message");
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");
      const actions = el("div", "editor-actions");
      const submit = el(
        "button",
        "btn btn-primary",
        isNew ? "Создать акцию" : "Сохранить акцию",
      );
      submit.type = "submit";
      actions.append(submit);
      if (!isNew && promo.active && promo.status !== "expired") {
        const stop = el("button", "btn btn-secondary", "Завершить сейчас");
        stop.type = "button";
        stop.onclick = async () => {
          if (
            !confirm(
              `Завершить акцию «${promo.title}» сейчас? Цены сразу станут обычными.` +
                (form.dataset.dirty === "true"
                  ? " Другие несохранённые изменения будут сброшены."
                  : ""),
            )
          )
            return;
          await persist(
            {
              title: promo.title,
              scope: promo.scope,
              scopeValue: promo.scopeValue ?? null,
              percent: promo.percent,
              startsAt: promo.startsAt ?? null,
              endsAt: promo.endsAt ?? null,
              active: false,
            },
            "Акция завершена. Цены снова обычные.",
          );
        };
        actions.append(stop);
      }
      if (!isNew) {
        const del = el("button", "btn btn-danger-ghost", "Удалить акцию");
        del.type = "button";
        del.onclick = async () => {
          if (!confirm(`Удалить акцию «${promo.title}»? Это действие нельзя отменить.`))
            return;
          await run(async () => {
            await kit.api("promotions/" + promo.id, { method: "DELETE" });
            form.dataset.dirty = "false";
            list = list.filter((p) => p.id !== promo.id);
            render();
            ws.close(true);
            changedPrices();
            kit.notify(`Акция «${promo.title}» удалена.`);
          });
        };
        actions.append(del);
      }

      form.append(
        field("Название", title, "Видно покупателям на сайте."),
        field("На что действует", scope),
        brandField,
        percent.label,
        starts.label,
        ends.label,
        active.label,
        preview,
        feedback,
        actions,
      );

      function values() {
        return {
          title: title.value.trim(),
          scope: scope.value,
          scopeValue: scope.value === "brand" ? brand.value || null : null,
          percent: percent.input.value === "" ? NaN : Number(percent.input.value),
          startsAt: fromLocalInput(starts.input.value),
          endsAt: fromLocalInput(ends.input.value),
          active: active.input.checked,
        };
      }
      function updatePreview() {
        const v = values();
        const matched = catalog.filter((p) => matchesScope(p, v.scope, v.scopeValue));
        const setCount = sets.loaded ? sets.list().length : null;
        let target;
        if (v.scope === "sets")
          target = setCount === null ? "наборы" : affectedText("sets", setCount);
        else if (v.scope === "all")
          target =
            affectedText("products", matched.length) +
            (setCount ? " и " + affectedText("sets", setCount) : "");
        else if (v.scope === "brand" && !v.scopeValue) target = null;
        else target = affectedText("products", matched.length);
        const pct = Number.isSafeInteger(v.percent) ? v.percent : null;
        previewText.textContent =
          pct && target
            ? `−${pct}% на ${target}` +
              (v.startsAt && new Date(v.startsAt) > new Date()
                ? " с " + when(v.startsAt)
                : "") +
              (v.endsAt ? " до " + when(v.endsAt) : " без срока")
            : "Укажите скидку и то, на что она действует.";
        const status = statusOf(v.active, v.startsAt, v.endsAt);
        const example = matched.find((p) => p.available) || matched[0];
        const examplePrice =
          pct && example && v.scope !== "sets"
            ? ` Например, ${example.name}: ${num(example.basePricePerMl)} → ${num(Math.round((example.basePricePerMl * (100 - pct)) / 100))} ₸/мл.`
            : "";
        previewNote.textContent =
          {
            active: "Начнёт действовать сразу после сохранения.",
            scheduled: "Запланирована: включится автоматически.",
            expired: "Дата окончания уже прошла — акция не действует.",
            off: "Выключена — покупатели её не видят.",
          }[status] + examplePrice;
        badge.textContent = isNew ? "Новая" : statusNames[status];
        badge.dataset.promo = isNew ? "new" : status;
      }
      function sync() {
        brandField.hidden = scope.value !== "brand";
        active.sync();
        updatePreview();
      }
      form.addEventListener("input", () => {
        form.dataset.dirty = "true";
        feedback.dataset.tone = "";
        feedback.textContent = "";
        form.querySelectorAll("[aria-invalid]").forEach((i) => invalid(i, false));
        sync();
      });
      form.addEventListener("change", sync);
      function validate(v) {
        if (!v.title) return [title, "Введите название акции."];
        if (v.scope === "brand" && !v.scopeValue) return [brand, "Выберите бренд."];
        if (!Number.isSafeInteger(v.percent) || v.percent < 1 || v.percent > 90)
          return [percent.input, "Скидка — целое число от 1 до 90%."];
        if (v.startsAt && v.endsAt && new Date(v.endsAt) <= new Date(v.startsAt))
          return [ends.input, "Конец акции должен быть позже начала."];
        return null;
      }
      async function run(task) {
        const controls = form.querySelectorAll("input, select, button");
        controls.forEach((c) => (c.disabled = true));
        feedback.dataset.tone = "";
        feedback.textContent = "Сохраняем…";
        try {
          await task();
        } catch (error) {
          if (!kit.loggedIn()) return;
          feedback.dataset.tone = "error";
          feedback.textContent = error.message;
          if (error.status === 409) conflictButton(form, load);
        } finally {
          if (form.isConnected) controls.forEach((c) => (c.disabled = false));
        }
      }
      async function persist(body, successText) {
        await run(async () => {
          const result = await kit.api(isNew ? "promotions" : "promotions/" + promo.id, {
            method: isNew ? "POST" : "PATCH",
            body: JSON.stringify(isNew ? body : { ...body, version: promo.version }),
          });
          const saved = result.promotion;
          form.dataset.dirty = "false";
          const index = list.findIndex((p) => p.id === saved.id);
          if (index >= 0) list[index] = saved;
          else list.unshift(saved);
          ws.key = saved.id;
          render();
          draw(saved, successText);
          changedPrices();
        });
      }
      form.onsubmit = async (event) => {
        event.preventDefault();
        const v = values();
        const problem = validate(v);
        if (problem) {
          invalid(problem[0], true);
          feedback.dataset.tone = "error";
          feedback.textContent = problem[1];
          problem[0].focus();
          return;
        }
        await persist(v, isNew ? "Акция создана." : "Акция сохранена.");
      };
      sync();
      if (message) {
        feedback.dataset.tone = "success";
        feedback.textContent = message;
      }
      panel.replaceChildren(head, form);
    }
    // Promotions change product and set prices elsewhere in the cabinet.
    function changedPrices() {
      catalogAt = 0;
      sets.invalidate();
      document.dispatchEvent(new CustomEvent("admin:promotions-changed"));
    }

    $("#create-promotion").onclick = async () => {
      try {
        await loadCatalog();
      } catch (error) {
        kit.notify(error.message, "error");
        return;
      }
      if (ws.open("new", () => draw(null))) markSelected();
    };
    search.addEventListener("input", render);
    $("#refresh-promotions").onclick = () => {
      if (
        ws.dirty() &&
        !confirm("Есть несохранённые изменения акции. Обновить без сохранения?")
      )
        return;
      const form = ws.dirty();
      if (form) form.dataset.dirty = "false";
      catalogAt = 0;
      load();
    };
    return {
      load,
      get loaded() {
        return loaded;
      },
      reset() {
        list = [];
        loaded = false;
        ws.close(true);
        root.replaceChildren(stateBox("Загружаем акции…"));
      },
    };
  })();

  const maybeLoad = () => {
    if (!kit.loggedIn()) return;
    if (kit.section() === "sets" && !sets.loaded) sets.load();
    if (kit.section() === "promotions") {
      if (!promotions.loaded) promotions.load();
      // Set counts in the promotion preview.
      if (!sets.loaded) sets.load();
    }
  };
  document.addEventListener("admin:section", maybeLoad);
  document.addEventListener("admin:ready", maybeLoad);
  document.addEventListener("admin:logout", () => {
    catalog = [];
    catalogAt = 0;
    sets.reset();
    promotions.reset();
    $("#sets-caption").textContent = "";
    $("#promotions-caption").textContent = "";
  });
})();
